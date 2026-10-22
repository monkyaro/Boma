import uuid
from datetime import datetime, timezone
from app.extensions import db


def uid():
    return str(uuid.uuid4())


def now():
    return datetime.now(timezone.utc)


class Region(db.Model):
    __tablename__ = "regions"
    code = db.Column(db.String(32), primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)


class District(db.Model):
    __tablename__ = "districts"
    code = db.Column(db.String(32), primary_key=True)
    region_code = db.Column(db.ForeignKey("regions.code"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    __table_args__ = (db.UniqueConstraint("region_code", "name"),)


class Ward(db.Model):
    __tablename__ = "wards"
    code = db.Column(db.String(32), primary_key=True)
    district_code = db.Column(db.ForeignKey("districts.code"), nullable=False, index=True)
    name = db.Column(db.String(100), nullable=False)
    __table_args__ = (db.UniqueConstraint("district_code", "name"),)


class OfficerAssignment(db.Model):
    __tablename__ = "officer_assignments"
    assignment_id = db.Column(db.String(36), primary_key=True, default=uid)
    officer_id = db.Column(db.String(36), nullable=False, index=True)
    region_code = db.Column(db.ForeignKey("regions.code"), nullable=False)
    district_code = db.Column(db.ForeignKey("districts.code"))
    ward_code = db.Column(db.ForeignKey("wards.code"))
    active = db.Column(db.Boolean, nullable=False, default=True)
    available = db.Column(db.Boolean, nullable=False, default=True)


class AuditEvent(db.Model):
    __tablename__ = "audit_events"
    event_id = db.Column(db.String(36), primary_key=True, default=uid)
    actor_id = db.Column(db.String(36), nullable=False, index=True)
    action = db.Column(db.String(80), nullable=False)
    target_id = db.Column(db.String(100), nullable=False, index=True)
    details = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)


class Favorite(db.Model):
    __tablename__ = "favorites"
    user_id = db.Column(db.String(36), primary_key=True)
    listing_id = db.Column(db.ForeignKey("listings.listing_id"), primary_key=True)


class Inquiry(db.Model):
    __tablename__ = "inquiries"
    inquiry_id = db.Column(db.String(36), primary_key=True, default=uid)
    listing_id = db.Column(db.ForeignKey("listings.listing_id"), nullable=False, index=True)
    customer_id = db.Column(db.String(36), nullable=False, index=True)
    kind = db.Column(db.String(20), nullable=False)  # inquiry | viewing
    status = db.Column(db.String(20), nullable=False, default="requested")
    officer_id = db.Column(db.String(36), index=True)
    scheduled_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (
        db.CheckConstraint("kind IN ('inquiry', 'viewing')", name="ck_inquiry_kind"),
        db.CheckConstraint("status IN ('requested', 'scheduled', 'completed', 'cancelled')", name="ck_inquiry_status"),
    )


class OfficerMessage(db.Model):
    __tablename__ = "officer_messages"
    message_id = db.Column(db.String(36), primary_key=True, default=uid)
    inquiry_id = db.Column(db.ForeignKey("inquiries.inquiry_id"), nullable=False, index=True)
    sender_id = db.Column(db.String(36), nullable=False)
    body = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)


class VerificationCase(db.Model):
    __tablename__ = "property_verification_cases"
    case_id = db.Column(db.String(36), primary_key=True, default=uid)
    listing_id = db.Column(db.ForeignKey("listings.listing_id"), nullable=False, index=True)
    listing_version = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")
    evidence = db.Column(db.Text)
    officer_id = db.Column(db.String(36))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (db.UniqueConstraint("listing_id", "listing_version"),)


class PropertyChangeRequest(db.Model):
    __tablename__ = "property_change_requests"
    request_id = db.Column(db.String(36), primary_key=True, default=uid)
    listing_id = db.Column(db.ForeignKey("listings.listing_id"), nullable=False, index=True)
    owner_id = db.Column(db.String(36), nullable=False)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)


class Notification(db.Model):
    __tablename__ = "notifications"
    notification_id = db.Column(db.String(36), primary_key=True, default=uid)
    user_id = db.Column(db.String(36), nullable=False, index=True)
    body = db.Column(db.String(300), nullable=False)
    read_at = db.Column(db.DateTime(timezone=True))
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)


class PropertyViewEvent(db.Model):
    __tablename__ = "property_view_events"
    listing_id = db.Column(db.ForeignKey("listings.listing_id"), primary_key=True)
    visitor_hash = db.Column(db.String(64), primary_key=True)
    day = db.Column(db.Date, primary_key=True)


class DeviceToken(db.Model):
    __tablename__ = "device_tokens"
    device_id = db.Column(db.String(36), primary_key=True, default=uid)
    user_id = db.Column(db.String(36), nullable=False, index=True)
    provider = db.Column(db.String(20), nullable=False)
    token = db.Column(db.String(500), nullable=False, unique=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
