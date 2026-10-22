from app.extensions import ma
from marshmallow import fields, validate

LISTING_TYPES = ("sale", "rent")
PROPERTY_TYPES = ("house", "apartment", "land", "commercial", "room")


class ListingSchema(ma.Schema):
    listing_id = fields.String(dump_only=True)
    owner_id = fields.String(dump_only=True)
    title = fields.String(required=True, validate=validate.Length(min=3, max=200))
    description = fields.String(load_default=None)
    listing_type = fields.String(required=True, validate=validate.OneOf(LISTING_TYPES))
    property_type = fields.String(required=True, validate=validate.OneOf(PROPERTY_TYPES))
    price = fields.Decimal(required=True, as_string=True, validate=validate.Range(min=0))
    currency = fields.String(load_default="TZS", validate=validate.Length(equal=3))
    region = fields.String(required=True)
    district = fields.String(load_default=None)
    latitude = fields.Float(load_only=True, load_default=None, validate=validate.Range(-90, 90))
    longitude = fields.Float(load_only=True, load_default=None, validate=validate.Range(-180, 180))
    status = fields.String(dump_only=True)
    created_at = fields.DateTime(dump_only=True)
