from flask import current_app, g
from flask_restx import Namespace, Resource, abort
from marshmallow import fields
from app.extensions import db
from app.workspace.access import require_staff_roles, geography, audit
from app.workspace.validation import payload, string, choice
from app.workspace.workspace_model import OfficerAssignment
from .keycloak_admin import KeycloakAdminError, keycloak_admin

staff_ns = Namespace("staff", description="Staff accounts, created by national administrators")

# Roles a national administrator may grant. New national administrators are created by an
# operator (infrastructure/scripts/keycloak-create-admin.sh), never through the API.
CREATABLE_ROLES = ["officer", "regional_supervisor", "finance", "support"]
STAFF_DIRECTORY_ROLES = CREATABLE_ROLES + ["national_admin"]
GEOGRAPHIC_ROLES = {"officer", "regional_supervisor"}

admin_only = require_staff_roles("national_admin")


def directory():
    client = keycloak_admin()
    if client is None:
        abort(503, "Staff account creation is not configured yet")
    return client


def unavailable(error):
    current_app.logger.warning("Keycloak admin error: %s (status %s)", error, error.status)
    abort(502, "The staff directory is unavailable. Please try again.")


def managed_staff(client, user_id):
    """Loads a staff account this API may change: holds a creatable role, never national_admin or self."""
    if user_id == g.user["userId"]:
        abort(403, "You cannot change your own staff account")
    try:
        roles = set(client.realm_roles(user_id))
    except KeycloakAdminError as error:
        if error.status == 404:
            abort(404, "Staff account not found")
        unavailable(error)
    if "national_admin" in roles:
        abort(403, "National administrators are managed by an operator")
    if not roles & set(CREATABLE_ROLES):
        abort(404, "Staff account not found")
    return roles


def setup_email(client, user_id):
    config = current_app.config
    try:
        client.send_setup_email(user_id, config["STAFF_SETUP_CLIENT_ID"], config["STAFF_SETUP_REDIRECT_URL"])
        return True
    except KeycloakAdminError as error:
        current_app.logger.warning("Staff setup email failed: %s (status %s)", error, error.status)
        return False


@staff_ns.route("")
class Staff(Resource):
    @admin_only
    def get(self):
        client = directory()
        people = {}
        try:
            for role in STAFF_DIRECTORY_ROLES:
                for user in client.users_with_role(role):
                    person = people.setdefault(user["id"], {
                        "user_id": user["id"], "email": user.get("email"),
                        "first_name": user.get("firstName", ""), "last_name": user.get("lastName", ""),
                        "enabled": user.get("enabled", False),
                        "setup_pending": bool(user.get("requiredActions")),
                        "roles": [], "assignments": []})
                    person["roles"].append(role)
        except KeycloakAdminError as error:
            unavailable(error)
        if people:
            for row in OfficerAssignment.query.filter(OfficerAssignment.officer_id.in_(people)).all():
                people[row.officer_id]["assignments"].append({
                    "assignment_id": row.assignment_id, "region_code": row.region_code,
                    "district_code": row.district_code, "ward_code": row.ward_code,
                    "active": row.active, "available": row.available})
        items = sorted(people.values(), key=lambda p: (p["first_name"].lower(), p["last_name"].lower(), p["email"] or ""))
        return {"items": items}

    @admin_only
    def post(self):
        data = payload({"email": fields.Email(required=True), "first_name": string(100), "last_name": string(100),
                        "role": choice(CREATABLE_ROLES), "region_code": string(32, False),
                        "district_code": string(32, False), "ward_code": string(32, False)})
        email = data["email"].strip().lower()
        if data["role"] in GEOGRAPHIC_ROLES:
            geography(data.get("region_code"), data.get("district_code"), data.get("ward_code"))
        elif data.get("region_code"):
            abort(400, "Only officers and regional supervisors are assigned a region")
        client = directory()
        try:
            user_id = client.create_user(email, data["first_name"].strip(), data["last_name"].strip())
        except KeycloakAdminError as error:
            if error.status == 409:
                abort(409, "An account with this email already exists")
            unavailable(error)
        try:
            client.add_realm_role(user_id, data["role"])
            if data["role"] in GEOGRAPHIC_ROLES:
                db.session.add(OfficerAssignment(officer_id=user_id, region_code=data["region_code"],
                                                 district_code=data.get("district_code"), ward_code=data.get("ward_code")))
            audit("staff.create", user_id, role=data["role"], email=email, region_code=data.get("region_code"),
                  district_code=data.get("district_code"), ward_code=data.get("ward_code"))
            db.session.commit()
        except Exception as error:
            # Never leave a half-provisioned account behind
            db.session.rollback()
            try:
                client.delete_user(user_id)
            except KeycloakAdminError:
                current_app.logger.error("Could not remove half-created staff account %s", user_id)
            if isinstance(error, KeycloakAdminError):
                unavailable(error)
            raise
        return {"user_id": user_id, "invite_sent": setup_email(client, user_id)}, 201


@staff_ns.route("/<string:user_id>")
class StaffMember(Resource):
    @admin_only
    def patch(self, user_id):
        enabled = payload({"enabled": fields.Boolean(required=True)})["enabled"]
        client = directory()
        managed_staff(client, user_id)
        try:
            client.set_enabled(user_id, enabled)
        except KeycloakAdminError as error:
            unavailable(error)
        # A deactivated officer drops out of coverage; reactivation restores it
        OfficerAssignment.query.filter_by(officer_id=user_id).update({"active": enabled})
        audit("staff.enable" if enabled else "staff.disable", user_id)
        db.session.commit()
        return {"user_id": user_id, "enabled": enabled}


@staff_ns.route("/<string:user_id>/invitation")
class StaffInvitation(Resource):
    @admin_only
    def post(self, user_id):
        client = directory()
        managed_staff(client, user_id)
        if not setup_email(client, user_id):
            abort(502, "The invitation email could not be sent. Please try again.")
        audit("staff.invite", user_id)
        db.session.commit()
        return {"user_id": user_id, "invite_sent": True}
