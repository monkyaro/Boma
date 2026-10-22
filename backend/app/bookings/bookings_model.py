from app.extensions import db
from app.workspace.workspace_model import uid, now


class Booking(db.Model):
    __tablename__ = "bookings"
    booking_id = db.Column(db.String(36), primary_key=True, default=uid)
    listing_id = db.Column(db.ForeignKey("listings.listing_id"), nullable=False, index=True)
    guest_id = db.Column(db.String(36), nullable=False, index=True)
    check_in = db.Column(db.Date, nullable=False)
    check_out = db.Column(db.Date, nullable=False)
    guests = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="requested")
    idempotency_key = db.Column(db.String(100), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (
        db.UniqueConstraint("guest_id", "idempotency_key"),
        db.CheckConstraint("check_out > check_in AND guests > 0", name="ck_booking_dates_guests"),
    )


class AvailabilityNight(db.Model):
    """Unique unit/night rows prevent concurrent booking or owner blocks."""
    __tablename__ = "availability_nights"
    listing_id = db.Column(db.ForeignKey("listings.listing_id"), primary_key=True)
    night = db.Column(db.Date, primary_key=True)
    booking_id = db.Column(db.ForeignKey("bookings.booking_id"), index=True)
    blocked_by = db.Column(db.String(36))
    __table_args__ = (db.CheckConstraint(
        "(booking_id IS NOT NULL AND blocked_by IS NULL) OR (booking_id IS NULL AND blocked_by IS NOT NULL)",
        name="ck_availability_source"),)
