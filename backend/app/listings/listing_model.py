import uuid
from datetime import datetime, timezone
from geoalchemy2 import Geography
from app.extensions import db


class Listing(db.Model):
    __tablename__ = "listings"

    listing_id = db.Column(db.String(36), primary_key=True,
                           default=lambda: str(uuid.uuid4()))
    owner_id = db.Column(db.String(36), nullable=False, index=True)  # Keycloak sub
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    listing_type = db.Column(db.String(10), nullable=False)  # sale | rent
    property_type = db.Column(db.String(30), nullable=False)
    price = db.Column(db.Numeric(14, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="TZS")
    region = db.Column(db.String(100), nullable=False, index=True)
    district = db.Column(db.String(100))
    location = db.Column(Geography(geometry_type="POINT", srid=4326))
    status = db.Column(db.String(20), nullable=False, default="draft")
    created_at = db.Column(db.DateTime(timezone=True),
                           default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime(timezone=True),
                           default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    @classmethod
    def get_by_id(cls, listing_id):
        return cls.query.filter_by(listing_id=listing_id).first()
