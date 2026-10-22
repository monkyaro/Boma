from flask import g, request
from flask_restx import Resource, Namespace, fields
from marshmallow import ValidationError
from app.extensions import db, flask_keycloak
from .listing_model import Listing
from .listing_schema import ListingSchema

listing_ns = Namespace('listings', description='Property listings for sale and rent')

add_listing = listing_ns.model('Add New Listing', {
    "title": fields.String(required=True),
    "description": fields.String,
    "listing_type": fields.String(required=True, enum=["sale", "rent"]),
    "property_type": fields.String(required=True),
    "price": fields.String(required=True),
    "currency": fields.String(default="TZS"),
    "region": fields.String(required=True),
    "district": fields.String,
    "latitude": fields.Float,
    "longitude": fields.Float,
})

listing_schema = ListingSchema()
public_listing_schema = ListingSchema(exclude=("owner_id",))
listings_schema = ListingSchema(many=True, exclude=("owner_id",))


@listing_ns.route("")
class Listings(Resource):
    def get(self):
        page = request.args.get("page", 1, type=int)
        per_page = min(request.args.get("per_page", 20, type=int), 100)
        query = Listing.query.filter_by(status="published")
        for field in ("listing_type", "property_type", "region"):
            if request.args.get(field):
                query = query.filter(getattr(Listing, field) == request.args[field])
        rs = query.order_by(Listing.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False)
        return {"items": listings_schema.dump(rs.items), "total": rs.total, "page": page}, 200

    @listing_ns.expect(add_listing)
    @flask_keycloak.require_token
    @flask_keycloak.check_realm_access("owner")
    def post(self):
        try:
            data = listing_schema.load(listing_ns.payload or {})
        except ValidationError as err:
            return {'error': err.messages}, 400

        lat, lng = data.pop("latitude"), data.pop("longitude")
        rs = Listing(owner_id=g.user["userId"], **data)
        if lat is not None and lng is not None:
            rs.location = f"SRID=4326;POINT({lng} {lat})"

        db.session.add(rs)
        db.session.commit()
        return listing_schema.dump(rs), 201


@listing_ns.route("/<string:listing_id>")
class ListingDetail(Resource):
    def get(self, listing_id):
        rs = Listing.get_by_id(listing_id)
        if rs is None or rs.status != "published":
            return {"message": "Listing not found"}, 404
        return public_listing_schema.dump(rs), 200
