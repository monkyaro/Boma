from datetime import date, datetime, timezone
from flask import g, current_app
from flask_restx import Namespace, Resource, abort
from marshmallow import fields
from sqlalchemy import or_, func
from app.extensions import db, flask_keycloak
from app.listings.listing_model import Listing
from app.onboarding.onboarding_model import IdentityVerificationCase
from .workspace_model import (
    Region, District, Ward, OfficerAssignment, AuditEvent, Inquiry, OfficerMessage,
    VerificationCase, Notification, PropertyChangeRequest,
)
from .access import staff_only, scope, listing_scope, geography, roles, audit, notify, has_mfa
from .validation import payload, string, choice, public_text

workspace_ns = Namespace("workspace", description="BOMA staff and customer workflows")


def serialized(row, names):
    result = {}
    for name in names.split():
        value = getattr(row, name)
        result[name] = value.isoformat() if isinstance(value, (datetime, date)) else value
    return result


def visible_listing(listing_id):
    listing = Listing.query.filter_by(listing_id=listing_id).with_for_update().first()
    if listing is None or listing.status != "published":
        abort(404, "Listing not found")
    return listing


def staff_listings():
    query = Listing.query
    if "national_admin" not in roles():
        assignments = OfficerAssignment.query.filter_by(
            officer_id=g.user["userId"], active=True, available=True).all()
        clauses = []
        for a in assignments:
            clause = Listing.region_code == a.region_code
            if a.district_code:
                clause &= Listing.district_code == a.district_code
            if a.ward_code:
                clause &= Listing.ward_code == a.ward_code
            clauses.append(clause)
        query = query.filter(or_(*clauses) if clauses else db.false())
    return query


@workspace_ns.route("/geography")
class Geography(Resource):
    def get(self):
        return {
            "regions": [serialized(x, "code name") for x in Region.query.order_by(Region.name).all()],
            "districts": [serialized(x, "code name region_code") for x in District.query.order_by(District.name).all()],
            "wards": [serialized(x, "code name district_code") for x in Ward.query.order_by(Ward.name).all()],
        }

    @staff_only
    def post(self):
        if "national_admin" not in roles():
            abort(403, "National administrator required")
        data = payload({"kind": choice(["region", "district", "ward"]), "code": string(32),
                        "name": string(100), "parent_code": string(32, False)})
        kind = data.pop("kind")
        parent = data.pop("parent_code", None)
        model = {"region": Region, "district": District, "ward": Ward}[kind]
        if db.session.get(model, data["code"]):
            abort(409, "Geography code already exists")
        if kind != "region":
            parent_model = Region if kind == "district" else District
            if not parent or not db.session.get(parent_model, parent):
                abort(400, "Valid parent required")
            data["region_code" if kind == "district" else "district_code"] = parent
        if model.query.filter_by(**{key: value for key, value in data.items() if key != "code"}).first():
            abort(409, "Geography name already exists in parent")
        row = model(**data)
        db.session.add(row)
        audit("geography.create", data["code"], kind=kind)
        db.session.commit()
        return {"code": row.code}, 201


@workspace_ns.route("/assignments")
class Assignments(Resource):
    @staff_only
    def get(self):
        query = OfficerAssignment.query
        if "national_admin" not in roles():
            query = query.filter_by(officer_id=g.user["userId"])
        return {"items": [serialized(x, "assignment_id officer_id region_code district_code ward_code active available")
                          for x in query.limit(200).all()]}

    @staff_only
    def post(self):
        if not roles() & {"national_admin", "regional_supervisor"}:
            abort(403, "Supervisor required")
        data = payload({"officer_id": string(36), "region_code": string(32),
                        "district_code": string(32, False), "ward_code": string(32, False)})
        geography(data["region_code"], data.get("district_code"), data.get("ward_code"))
        scope(data["region_code"], data.get("district_code"), data.get("ward_code"))
        row = OfficerAssignment(**data)
        db.session.add(row)
        db.session.flush()
        audit("assignment.create", row.assignment_id)
        db.session.commit()
        return {"assignment_id": row.assignment_id}, 201


@workspace_ns.route("/assignments/<string:assignment_id>")
class AssignmentDetail(Resource):
    @staff_only
    def patch(self, assignment_id):
        row = db.session.get(OfficerAssignment, assignment_id)
        if row is None:
            abort(404, "Assignment not found")
        data = payload({"active": fields.Boolean(), "available": fields.Boolean()})
        if "active" in data and not roles() & {"national_admin", "regional_supervisor"}:
            abort(403, "Supervisor required")
        if row.officer_id != g.user["userId"] or "active" in data:
            if not roles() & {"national_admin", "regional_supervisor"}:
                abort(403, "Supervisor required")
            scope(row.region_code, row.district_code, row.ward_code)
        for key, value in data.items():
            setattr(row, key, value)
        audit("assignment.update", row.assignment_id, **data)
        db.session.commit()
        return {"message": "Assignment updated"}


@workspace_ns.route("/identity-cases")
class IdentityCases(Resource):
    @staff_only
    def get(self):
        query = IdentityVerificationCase.query.filter_by(status="pending")
        if "national_admin" not in roles():
            codes = db.session.query(OfficerAssignment.region_code).filter_by(
                officer_id=g.user["userId"], active=True, available=True,
                district_code=None, ward_code=None)
            query = query.filter(IdentityVerificationCase.residence_region_code.in_(codes))
        return {"items": [serialized(x, "case_id user_id status residence_region_code") for x in query.limit(100).all()]}


@workspace_ns.route("/identity-cases/<string:case_id>/decision")
class IdentityDecision(Resource):
    @staff_only
    def post(self, case_id):
        case = IdentityVerificationCase.query.filter_by(case_id=case_id).with_for_update().first()
        if case is None:
            abort(404, "Identity case not found")
        if not case.residence_region_code:
            abort(409, "Owner must first select residence region")
        scope(case.residence_region_code)
        if case.user_id == g.user["userId"]:
            abort(403, "Cannot decide own identity case")
        if case.status != "pending":
            abort(409, "Case already decided")
        data = payload({"decision": choice(["approved", "rejected"]), "reference": string(200)})
        case.status = data["decision"]
        audit("identity." + case.status, case.case_id, reference=data["reference"])
        notify(case.user_id, "Your owner identity review is " + case.status + ".")
        db.session.commit()
        return {"status": case.status}


@workspace_ns.route("/properties")
class StaffProperties(Resource):
    @staff_only
    def get(self):
        return {"items": [serialized(x, "listing_id title status verification_status version region_code district_code ward_code")
                          for x in staff_listings().order_by(Listing.created_at.desc()).limit(100).all()]}


@workspace_ns.route("/properties/<string:listing_id>/verification")
class Verification(Resource):
    @staff_only
    def post(self, listing_id):
        listing = Listing.query.filter_by(listing_id=listing_id).with_for_update().first()
        if listing is None:
            abort(404, "Listing not found")
        listing_scope(listing)
        if listing.owner_id == g.user["userId"]:
            abort(403, "Cannot verify own property")
        if listing.status != "published" or listing.verification_status == "VERIFIED":
            abort(409, "Published unverified listing required")
        data = payload({"version": fields.Integer(required=True), "decision": choice(["verified", "rejected"]),
                        "evidence": string(4000)})
        if data["version"] != listing.version:
            abort(409, "Listing changed; collect new evidence")
        case = VerificationCase.query.filter_by(listing_id=listing_id, listing_version=listing.version).first()
        if case and case.status != "pending":
            abort(409, "This version has already been reviewed")
        if case is None:
            case = VerificationCase(listing_id=listing_id, listing_version=listing.version)
            db.session.add(case)
        case.status, case.evidence, case.officer_id = data["decision"], data["evidence"], g.user["userId"]
        if data["decision"] == "verified":
            listing.verification_status = "VERIFIED"
        listing.version += 1
        audit("property." + data["decision"], listing_id, version=data["version"])
        notify(listing.owner_id, "Your property review is complete.")
        db.session.commit()
        return {"verification_status": listing.verification_status, "version": listing.version}


@workspace_ns.route("/inquiries")
class Inquiries(Resource):
    @flask_keycloak.require_token
    def get(self):
        rows = Inquiry.query.filter_by(customer_id=g.user["userId"]).order_by(Inquiry.created_at.desc()).limit(100).all()
        return {"items": [serialized(x, "inquiry_id listing_id kind status scheduled_at created_at") for x in rows]}

    @flask_keycloak.require_token
    def post(self):
        data = payload({"listing_id": string(36), "kind": choice(["inquiry", "viewing"])})
        listing = visible_listing(data["listing_id"])
        if listing.owner_id == g.user["userId"]:
            abort(403, "Cannot inquire on own listing")
        row = Inquiry(customer_id=g.user["userId"], **data)
        db.session.add(row)
        db.session.flush()
        threshold = current_app.config["VERIFICATION_INQUIRY_THRESHOLD"]
        if threshold > 0 and listing.verification_status == "UNVERIFIED":
            interest = db.session.query(func.count(func.distinct(Inquiry.customer_id))).filter_by(listing_id=listing.listing_id).scalar()
            if interest >= threshold and not VerificationCase.query.filter_by(listing_id=listing.listing_id, listing_version=listing.version).first():
                db.session.add(VerificationCase(listing_id=listing.listing_id, listing_version=listing.version))
        audit("inquiry.create", row.inquiry_id, kind=row.kind)
        db.session.commit()
        return serialized(row, "inquiry_id listing_id kind status"), 201


@workspace_ns.route("/tasks")
class Tasks(Resource):
    @staff_only
    def get(self):
        ids = staff_listings().with_entities(Listing.listing_id).subquery()
        inquiries = Inquiry.query.filter(Inquiry.listing_id.in_(db.select(ids.c.listing_id)))
        return {"inquiries": [serialized(x, "inquiry_id listing_id customer_id kind status officer_id scheduled_at")
                              for x in inquiries.order_by(Inquiry.created_at.desc()).limit(100).all()],
                "verification": [serialized(x, "case_id listing_id listing_version status")
                                 for x in VerificationCase.query.filter(VerificationCase.listing_id.in_(db.select(ids.c.listing_id)),
                                                                       VerificationCase.status == "pending").limit(100).all()],
                "changes": [serialized(x, "request_id listing_id reason status")
                            for x in PropertyChangeRequest.query.filter(PropertyChangeRequest.listing_id.in_(db.select(ids.c.listing_id)),
                                                                       PropertyChangeRequest.status == "pending").limit(100).all()]}


@workspace_ns.route("/inquiries/<string:inquiry_id>/schedule")
class Schedule(Resource):
    @staff_only
    def post(self, inquiry_id):
        row = Inquiry.query.filter_by(inquiry_id=inquiry_id).with_for_update().first()
        if row is None:
            abort(404, "Inquiry not found")
        listing = db.session.get(Listing, row.listing_id)
        listing_scope(listing)
        if row.status != "requested" and not (
            row.status == "scheduled" and roles() & {"regional_supervisor", "national_admin"}
        ):
            abort(409, "Only requested appointments or supervisor reassignments can be scheduled")
        data = payload({"officer_id": string(36), "scheduled_at": fields.AwareDateTime(required=True)})
        listing_scope(listing, data["officer_id"])
        if data["officer_id"] in {listing.owner_id, row.customer_id}:
            abort(403, "An independent officer must accompany the customer")
        if row.kind == "viewing":
            if not current_app.config["VIEWING_POLICY_APPROVED"]:
                abort(409, "Physical viewing policy awaits owner approval")
            if listing.verification_status != "VERIFIED":
                abort(409, "Property verification required before a physical viewing")
        if data["scheduled_at"] <= datetime.now(timezone.utc):
            abort(400, "Appointment must be in the future")
        row.officer_id, row.scheduled_at, row.status = data["officer_id"], data["scheduled_at"], "scheduled"
        audit("inquiry.schedule", inquiry_id, officer_id=row.officer_id, scheduled_at=row.scheduled_at.isoformat())
        notify(row.customer_id, "BOMA has scheduled your appointment. Check your workspace.")
        notify(row.officer_id, "You have a new BOMA appointment.")
        db.session.commit()
        return {"status": row.status}


def conversation(inquiry_id):
    row = db.session.get(Inquiry, inquiry_id)
    if row is None:
        abort(404, "Inquiry not found")
    listing = db.session.get(Listing, row.listing_id)
    if g.user["userId"] == listing.owner_id:
        abort(403, "Owners cannot access customer conversations")
    if g.user["userId"] != row.customer_id:
        if not roles() & {"officer", "regional_supervisor", "national_admin"}:
            abort(403, "Conversation unavailable")
        if not has_mfa():
            abort(403, "Staff MFA required")
        listing_scope(listing)
        if row.officer_id != g.user["userId"] and not roles() & {"regional_supervisor", "national_admin"}:
            abort(403, "Assigned officer required")
    return row


@workspace_ns.route("/inquiries/<string:inquiry_id>/messages")
class Messages(Resource):
    @flask_keycloak.require_token
    def get(self, inquiry_id):
        conversation(inquiry_id)
        return {"items": [dict(serialized(x, "message_id body created_at"),
                                from_me=x.sender_id == g.user["userId"])
                          for x in OfficerMessage.query.filter_by(inquiry_id=inquiry_id).order_by(OfficerMessage.created_at).limit(200).all()]}

    @flask_keycloak.require_token
    def post(self, inquiry_id):
        row = conversation(inquiry_id)
        if not row.officer_id:
            abort(409, "BOMA has not assigned an officer yet")
        data = payload({"body": string(4000)})
        message = OfficerMessage(inquiry_id=inquiry_id, sender_id=g.user["userId"], **data)
        db.session.add(message)
        recipient = row.officer_id if g.user["userId"] == row.customer_id else row.customer_id
        notify(recipient, "You have a new message from BOMA.")
        audit("message.send", inquiry_id)
        db.session.commit()
        return {"message": "Message sent"}, 201


@workspace_ns.route("/notifications")
class Notifications(Resource):
    @flask_keycloak.require_token
    def get(self):
        return {"items": [serialized(x, "notification_id body read_at created_at") for x in Notification.query.filter_by(
            user_id=g.user["userId"]).order_by(Notification.created_at.desc()).limit(100).all()]}


@workspace_ns.route("/notifications/<string:notification_id>/read")
class ReadNotification(Resource):
    @flask_keycloak.require_token
    def post(self, notification_id):
        row = Notification.query.filter_by(notification_id=notification_id, user_id=g.user["userId"]).first()
        if row is None:
            abort(404, "Notification not found")
        row.read_at = datetime.now(timezone.utc)
        db.session.commit()
        return {"message": "Read"}


@workspace_ns.route("/reports")
class Reports(Resource):
    @staff_only
    def get(self):
        query = staff_listings()
        return {"listings": query.count(), "verified": query.filter_by(verification_status="VERIFIED").count(),
                "by_status": {status: count for status, count in query.with_entities(Listing.status, func.count()).group_by(Listing.status).all()}}


@workspace_ns.route("/audit")
class Audit(Resource):
    @staff_only
    def get(self):
        if "national_admin" not in roles():
            abort(403, "National administrator required")
        return {"items": [serialized(x, "event_id actor_id action target_id details created_at")
                          for x in AuditEvent.query.order_by(AuditEvent.created_at.desc()).limit(100).all()]}


@workspace_ns.route("/changes/<string:request_id>/decision")
class ChangeDecision(Resource):
    @staff_only
    def post(self, request_id):
        if not roles() & {"regional_supervisor", "national_admin"}:
            abort(403, "Supervisor approval required")
        change = PropertyChangeRequest.query.filter_by(request_id=request_id).with_for_update().first()
        if change is None:
            abort(404, "Change request not found")
        listing = Listing.query.filter_by(listing_id=change.listing_id).with_for_update().one()
        listing_scope(listing)
        if change.owner_id == g.user["userId"]:
            abort(403, "Independent reviewer required")
        if change.status != "pending":
            abort(409, "Change already decided")
        data = payload({"decision": choice(["approve", "reject", "withdraw"]),
                        "version": fields.Integer(required=True), "title": string(200, False),
                        "description": string(4000, False)})
        if data["version"] != listing.version:
            abort(409, "Listing changed; review again")
        if data["decision"] == "approve":
            if not any(key in data for key in ("title", "description")):
                abort(400, "A reviewed title or description is required")
            for key in ("title", "description"):
                if key in data:
                    setattr(listing, key, public_text(data[key]))
            listing.verification_status = "UNVERIFIED"
            listing.version += 1
        elif data["decision"] == "withdraw":
            listing.status = "withdrawn"
            listing.version += 1
        change.status = data["decision"]
        audit("change." + change.status, request_id)
        notify(change.owner_id, "BOMA has reviewed your property change request.")
        db.session.commit()
        return {"status": change.status}


@workspace_ns.route("/inquiries/<string:inquiry_id>/outcome")
class InquiryOutcome(Resource):
    @flask_keycloak.require_token
    def post(self, inquiry_id):
        row = Inquiry.query.filter_by(inquiry_id=inquiry_id).with_for_update().first()
        if row is None:
            abort(404, "Inquiry not found")
        data = payload({"status": choice(["cancelled", "completed"]), "reference": string(200, False)})
        if data["status"] == "cancelled" and row.customer_id == g.user["userId"]:
            pass
        else:
            if not roles() & {"officer", "regional_supervisor", "national_admin"} or not has_mfa():
                abort(403, "Authorized BOMA officer required")
            listing_scope(db.session.get(Listing, row.listing_id))
            if data["status"] == "completed" and (row.officer_id != g.user["userId"] or not data.get("reference")):
                abort(403, "Assigned officer and attendance reference required")
        if row.status in {"cancelled", "completed"}:
            abort(409, "Outcome already recorded")
        if data["status"] == "completed" and row.status != "scheduled":
            abort(409, "Appointment must be scheduled first")
        row.status = data["status"]
        audit("inquiry." + row.status, row.inquiry_id, reference=data.get("reference", ""))
        notify(row.customer_id, "Your BOMA appointment is " + row.status + ".")
        db.session.commit()
        return {"status": row.status}


@workspace_ns.route("/session")
class Session(Resource):
    @flask_keycloak.require_token
    def get(self):
        return {"user_id": g.user["userId"], "roles": sorted(roles())}


@workspace_ns.route("/devices")
class Devices(Resource):
    @flask_keycloak.require_token
    def post(self):
        from .workspace_model import DeviceToken
        from sqlalchemy.dialects.postgresql import insert
        data = payload({"provider": choice(["expo", "fcm"]), "token": string(500)})
        db.session.execute(insert(DeviceToken).values(user_id=g.user["userId"], **data).on_conflict_do_update(
            index_elements=[DeviceToken.token], set_={"user_id": g.user["userId"], "provider": data["provider"], "active": True}))
        audit("device.register", g.user["userId"])
        db.session.commit()
        return {"registered": True, "delivery_enabled": False}, 201

    @flask_keycloak.require_token
    def delete(self):
        from .workspace_model import DeviceToken
        data = payload({"token": string(500)})
        DeviceToken.query.filter_by(user_id=g.user["userId"], token=data["token"]).update({"active": False})
        db.session.commit()
        return {"registered": False}
