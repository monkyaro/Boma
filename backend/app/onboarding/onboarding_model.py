import uuid
from datetime import datetime, timezone
from app.extensions import db


class IdentityVerificationCase(db.Model):
    """One initial identity case per account; submission never grants roles."""

    __tablename__ = "identity_verification_cases"
    case_id = db.Column(db.String(36), primary_key=True,
                        default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), nullable=False, unique=True)
    residence_region_code = db.Column(db.ForeignKey("regions.code"))
    status = db.Column(db.String(20), nullable=False, default="pending")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False,
                           default=lambda: datetime.now(timezone.utc))
    __table_args__ = (
        db.CheckConstraint("status IN ('pending', 'approved', 'rejected')",
                           name="ck_identity_case_status"),
    )
