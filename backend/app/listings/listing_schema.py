from app.extensions import ma
from marshmallow import fields, validate, validates_schema, ValidationError

LISTING_TYPES = ("sale", "rent", "short_stay")
PROPERTY_TYPES = ("house", "apartment", "land", "commercial", "room")


class ListingSchema(ma.Schema):
    listing_id = fields.String(dump_only=True)
    owner_id = fields.String(dump_only=True)
    title = fields.String(required=True, validate=validate.Length(min=3, max=200))
    description = fields.String(load_default=None, validate=validate.Length(max=4000))
    listing_type = fields.String(required=True, validate=validate.OneOf(LISTING_TYPES))
    property_type = fields.String(required=True, validate=validate.OneOf(PROPERTY_TYPES))
    price = fields.Decimal(required=True, as_string=True, validate=validate.Range(min=0, max=999999999999))
    currency = fields.String(load_default="TZS", validate=validate.OneOf(["TZS"]))
    region = fields.String(required=True, validate=validate.Length(min=1, max=100))
    district = fields.String(load_default=None, validate=validate.Length(max=100))
    latitude = fields.Float(load_only=True, load_default=None, validate=validate.Range(-90, 90))
    longitude = fields.Float(load_only=True, load_default=None, validate=validate.Range(-180, 180))
    region_code = fields.String(validate=validate.Length(min=1, max=32))
    district_code = fields.String(validate=validate.Length(min=1, max=32))
    ward_code = fields.String(validate=validate.Length(min=1, max=32))
    verification_status = fields.String(dump_only=True)
    version = fields.Integer(dump_only=True)
    status = fields.String(dump_only=True)
    created_at = fields.DateTime(dump_only=True)

    @validates_schema
    def coordinate_pair(self, data, **kwargs):
        if (data.get("latitude") is None) != (data.get("longitude") is None):
            raise ValidationError("Provide both latitude and longitude")
        if data.get("latitude") is not None and not (
            -11.8 <= data["latitude"] <= -0.9 and 29.3 <= data["longitude"] <= 40.6
        ):
            raise ValidationError("Coordinates must be inside Tanzania's supported bounds")
