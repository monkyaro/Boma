import hashlib
import hmac
import time
from flask import current_app, g, request
from flask_restx import Namespace, Resource, abort
from sqlalchemy import text
from app.extensions import db, flask_keycloak
from app.bookings.bookings_model import Booking
from app.workspace.validation import payload, string, money, choice
from app.workspace.access import audit
from .payments_model import SandboxPaymentIntent, SandboxPaymentEvent

payments_ns = Namespace("payments", description="Explicit sandbox adapter; no live money movement")


def sandbox():
    if not current_app.config["PAYMENT_SANDBOX_ENABLED"] or not current_app.config.get("PAYMENT_SANDBOX_SIGNING_SECRET"):
        abort(503, "Payment sandbox is not configured; live payments are disabled")


@payments_ns.route("/sandbox/intents")
class Intent(Resource):
    @flask_keycloak.require_token
    def post(self):
        sandbox()
        data = payload({"booking_id": string(36), "amount": money(), "idempotency_key": string(100)})
        booking = Booking.query.filter_by(booking_id=data["booking_id"], guest_id=g.user["userId"]).first()
        if booking is None:
            abort(404, "Booking request not found")
        if data["amount"] <= 0:
            abort(400, "Positive sandbox amount required")
        db.session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                           {"key": "sandbox-intent:" + g.user["userId"] + ":" + data["idempotency_key"]})
        row = SandboxPaymentIntent.query.filter_by(user_id=g.user["userId"], idempotency_key=data["idempotency_key"]).first()
        if row:
            if row.booking_id != data["booking_id"] or row.amount != data["amount"]:
                abort(409, "Idempotency key already used with different details")
            return {"intent_id": row.intent_id, "status": row.status, "sandbox": True}, 200
        row = SandboxPaymentIntent(user_id=g.user["userId"], **data)
        db.session.add(row)
        db.session.flush()
        audit("sandbox.intent", row.intent_id)
        db.session.commit()
        return {"intent_id": row.intent_id, "status": row.status, "sandbox": True}, 201


@payments_ns.route("/sandbox/webhook")
class SandboxWebhook(Resource):
    def post(self):
        sandbox()
        body = request.get_data()
        timestamp = request.headers.get("X-Boma-Timestamp", "")
        signature = request.headers.get("X-Boma-Signature", "")
        try:
            if abs(time.time() - int(timestamp)) > 300:
                raise ValueError
        except ValueError:
            abort(401, "Invalid callback timestamp")
        expected = hmac.new(current_app.config["PAYMENT_SANDBOX_SIGNING_SECRET"].encode(),
                            timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, signature):
            abort(401, "Invalid callback signature")
        data = payload({"event_id": string(100), "intent_id": string(36), "status": choice(["succeeded", "failed"])})
        # Serialize event IDs even if an invalid replay targets a different intent.
        db.session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))"),
                           {"key": "sandbox-event:" + data["event_id"]})
        digest = hashlib.sha256(body).hexdigest()
        event = db.session.get(SandboxPaymentEvent, data["event_id"])
        if event:
            if event.payload_hash != digest:
                abort(409, "Event identifier reused for different callback")
            return {"received": True, "duplicate": True, "sandbox": True}
        intent = SandboxPaymentIntent.query.filter_by(intent_id=data["intent_id"]).with_for_update().first()
        if intent is None:
            abort(404, "Sandbox intent not found")
        if intent.status not in {"pending", data["status"]}:
            abort(409, "Sandbox intent already reached a different terminal state")
        intent.status = data["status"]
        db.session.add(SandboxPaymentEvent(event_id=data["event_id"], intent_id=intent.intent_id, payload_hash=digest))
        # Deliberately do not confirm bookings, record real receipts, or settle/refund money.
        db.session.commit()
        return {"received": True, "duplicate": False, "sandbox": True}
