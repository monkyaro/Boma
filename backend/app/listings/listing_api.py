import hashlib
import hmac
from datetime import datetime, timezone
from flask import g, request, current_app
from flask_restx import Resource, Namespace, abort
from marshmallow import ValidationError, fields
from sqlalchemy.dialects.postgresql import insert
from app.extensions import db, flask_keycloak
from app.onboarding.onboarding_model import IdentityVerificationCase
from app.workspace.workspace_model import (
    Region, District, Favorite, PropertyChangeRequest, VerificationCase, PropertyViewEvent,
)
from app.workspace.access import audit, geography, roles
from app.workspace.validation import payload, string, public_text
from .listing_model import Listing
from .listing_schema import ListingSchema

listing_ns = Namespace('listings', description='Tanzania property marketplace')
listing_schema = ListingSchema()
public_listing_schema = ListingSchema(exclude=("owner_id",))
listings_schema = ListingSchema(many=True, exclude=("owner_id",))


def load_listing(data, partial=False):
    if not isinstance(data, dict):
        abort(400, "A JSON object is required")
    try:
        result = listing_schema.load(data, partial=partial)
    except ValidationError as error:
        abort(400, "Invalid listing", error=error.messages)
    for key in ("title", "description"):
        public_text(result.get(key))
    if result.get("region_code"):
        geography(result["region_code"], result.get("district_code"), result.get("ward_code"))
        result["region"] = db.session.get(Region, result["region_code"]).name
        if result.get("district_code"):
            result["district"] = db.session.get(District, result["district_code"]).name
    return result


def apply_listing(row, data):
    lat, lng = data.pop("latitude", None), data.pop("longitude", None)
    if lat is not None:
        row.location = f"SRID=4326;POINT({lng} {lat})"
    for key, value in data.items():
        setattr(row, key, value)


def own_listing(listing_id):
    row = Listing.query.filter_by(listing_id=listing_id, owner_id=g.user["userId"]).with_for_update().first()
    if row is None:
        abort(404, "Listing not found")
    if row.status == "withdrawn":
        abort(409, "Listing has been withdrawn")
    return row


def expected_version(row, data):
    if data.pop("version", None) != row.version:
        abort(409, "Listing changed; refresh before editing")


def invalidate(row):
    for case in VerificationCase.query.filter_by(listing_id=row.listing_id, status="pending").all():
        case.status = "stale"
    row.version += 1


@listing_ns.route("")
class Listings(Resource):
    def get(self):
        page = max(1, request.args.get("page", 1, type=int))
        per_page = max(1, min(request.args.get("per_page", 20, type=int), 100))
        query = Listing.query.filter_by(status="published")
        for field in ("listing_type", "property_type", "region", "region_code", "verification_status"):
            if request.args.get(field):
                query = query.filter(getattr(Listing, field) == request.args[field])
        if request.args.get("q"):
            query = query.filter(Listing.title.ilike("%" + request.args["q"][:200] + "%"))
        for key, operation in (("min_price", "min"), ("max_price", "max")):
            if key in request.args:
                from decimal import Decimal, InvalidOperation
                try:
                    amount = Decimal(request.args[key])
                    if not amount.is_finite() or amount < 0:
                        raise InvalidOperation
                except InvalidOperation:
                    abort(400, "Invalid price filter")
                query = query.filter(Listing.price >= amount if operation == "min" else Listing.price <= amount)
        result = query.order_by(Listing.created_at.desc(), Listing.listing_id).paginate(page=page, per_page=per_page, error_out=False)
        return {"items": listings_schema.dump(result.items), "total": result.total, "page": page}

    @flask_keycloak.require_token
    def post(self):
        case = IdentityVerificationCase.query.filter_by(user_id=g.user["userId"]).first()
        if "owner" not in roles() and case is None:
            abort(403, "Request owner onboarding before preparing drafts")
        data = load_listing(request.get_json(silent=True))
        row = Listing(owner_id=g.user["userId"])
        apply_listing(row, data)
        db.session.add(row)
        db.session.flush()
        audit("listing.create", row.listing_id)
        db.session.commit()
        return listing_schema.dump(row), 201


@listing_ns.route("/mine")
class MyListings(Resource):
    @flask_keycloak.require_token
    def get(self):
        rows = Listing.query.filter_by(owner_id=g.user["userId"]).order_by(Listing.created_at.desc()).limit(100).all()
        return {"items": listing_schema.dump(rows, many=True)}


@listing_ns.route("/<string:listing_id>")
class ListingDetail(Resource):
    def get(self, listing_id):
        row = db.session.get(Listing, listing_id)
        if row is None or row.status != "published":
            abort(404, "Listing not found")
        return public_listing_schema.dump(row)

    @flask_keycloak.require_token
    def patch(self, listing_id):
        row = own_listing(listing_id)
        if row.verification_status == "VERIFIED":
            abort(403, "Request a staff-approved change for verified property")
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            abort(400, "A JSON object is required")
        data = dict(data)
        expected_version(row, data)
        # Validate the complete proposed geography rather than accepting mismatched partial updates.
        merged = {key: getattr(row, key) for key in ("region_code", "district_code", "ward_code")}
        merged.update({key: data[key] for key in merged if key in data})
        if merged["region_code"]:
            geography(**merged)
            data.update({key: value for key, value in merged.items() if value is not None})
        apply_listing(row, load_listing(data, partial=True))
        invalidate(row)
        audit("listing.edit", listing_id, version=row.version)
        db.session.commit()
        return listing_schema.dump(row)

    @flask_keycloak.require_token
    def delete(self, listing_id):
        row = own_listing(listing_id)
        if row.verification_status == "VERIFIED":
            abort(403, "Verified properties require a staff withdrawal request")
        data = payload({"version": fields.Integer(required=True)})
        expected_version(row, data)
        row.status = "withdrawn"
        invalidate(row)
        audit("listing.withdraw", listing_id)
        db.session.commit()
        return {"status": row.status}


@listing_ns.route("/<string:listing_id>/publish")
class Publish(Resource):
    @flask_keycloak.require_token
    def post(self, listing_id):
        row = own_listing(listing_id)
        expected_version(row, payload({"version": fields.Integer(required=True)}))
        case = IdentityVerificationCase.query.filter_by(user_id=g.user["userId"]).with_for_update().first()
        if case is None or case.status != "approved":
            abort(403, "Owner identity approval required")
        if row.status != "draft":
            abort(409, "Only a draft can be published")
        geography(row.region_code, row.district_code, row.ward_code)
        if not row.ward_code:
            abort(400, "Region, district and ward required to publish")
        row.status = "published"
        row.version += 1
        audit("listing.publish", listing_id)
        db.session.commit()
        return listing_schema.dump(row)


@listing_ns.route("/<string:listing_id>/change-requests")
class ChangeRequests(Resource):
    @flask_keycloak.require_token
    def post(self, listing_id):
        row = own_listing(listing_id)
        if row.verification_status != "VERIFIED":
            abort(409, "Unverified properties can be edited directly")
        data = payload({"reason": string(4000)})
        change = PropertyChangeRequest(listing_id=listing_id, owner_id=g.user["userId"], **data)
        db.session.add(change)
        db.session.flush()
        audit("listing.change_request", change.request_id)
        db.session.commit()
        return {"request_id": change.request_id, "status": change.status}, 201


@listing_ns.route("/favorites")
class Favorites(Resource):
    @flask_keycloak.require_token
    def get(self):
        rows = Listing.query.join(Favorite).filter(Favorite.user_id == g.user["userId"], Listing.status == "published").all()
        return {"items": listings_schema.dump(rows)}


@listing_ns.route("/<string:listing_id>/favorite")
class FavoriteDetail(Resource):
    @flask_keycloak.require_token
    def post(self, listing_id):
        row = db.session.get(Listing, listing_id)
        if row is None or row.status != "published":
            abort(404, "Listing not found")
        db.session.execute(insert(Favorite).values(user_id=g.user["userId"], listing_id=listing_id).on_conflict_do_nothing())
        db.session.commit()
        return {"saved": True}

    @flask_keycloak.require_token
    def delete(self, listing_id):
        Favorite.query.filter_by(user_id=g.user["userId"], listing_id=listing_id).delete()
        db.session.commit()
        return {"saved": False}


@listing_ns.route("/<string:listing_id>/view")
class View(Resource):
    @flask_keycloak.require_token
    def post(self, listing_id):
        row = db.session.get(Listing, listing_id)
        if row is None or row.status != "published":
            abort(404, "Listing not found")
        # Explicit opt-in; authenticated daily deduplication avoids reload inflation.
        if payload({"consent": fields.Boolean(required=True)})["consent"] is not True:
            return {"recorded": False}
        secret = current_app.config.get("SECRET_KEY")
        if not secret:
            abort(503, "View tracking unavailable")
        digest = hmac.new(secret.encode(), g.user["userId"].encode(), hashlib.sha256).hexdigest()
        db.session.execute(insert(PropertyViewEvent).values(listing_id=listing_id, visitor_hash=digest,
                                                          day=datetime.now(timezone.utc).date()).on_conflict_do_nothing())
        db.session.commit()
        return {"recorded": True}
