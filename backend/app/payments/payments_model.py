from app.extensions import db
from app.workspace.workspace_model import uid, now


class SandboxPaymentIntent(db.Model):
    __tablename__ = "sandbox_payment_intents"
    intent_id = db.Column(db.String(36), primary_key=True, default=uid)
    user_id = db.Column(db.String(36), nullable=False, index=True)
    booking_id = db.Column(db.ForeignKey("bookings.booking_id"), nullable=False)
    idempotency_key = db.Column(db.String(100), nullable=False)
    amount = db.Column(db.Numeric(14, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="TZS")
    status = db.Column(db.String(20), nullable=False, default="pending")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (db.UniqueConstraint("user_id", "idempotency_key"),)


class SandboxPaymentEvent(db.Model):
    __tablename__ = "sandbox_payment_events"
    event_id = db.Column(db.String(100), primary_key=True)
    intent_id = db.Column(db.ForeignKey("sandbox_payment_intents.intent_id"), nullable=False, index=True)
    payload_hash = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
