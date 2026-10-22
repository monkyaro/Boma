from datetime import datetime, timedelta, timezone
from flask import g
from flask_restx import Namespace, Resource, abort
from marshmallow import fields, validate
from sqlalchemy import text
from app.extensions import db, flask_keycloak
from app.listings.listing_model import Listing
from app.workspace.access import staff_only, audit, notify
from app.workspace.validation import payload, string
from app.workspace.workspace_api import serialized, staff_listings
from .bookings_model import Booking, AvailabilityNight

bookings_ns = Namespace("bookings", description="Short-stay requests and availability; live payments disabled")


def nights(start, end):
    if start < datetime.now(timezone.utc).date() or end <= start or (end - start).days > 90:
        abort(400, "Choose a future stay of 1 to 90 nights")
    return [start + timedelta(days=i) for i in range((end - start).days)]


def short_stay(listing_id):
    listing = Listing.query.filter_by(listing_id=listing_id, listing_type="short_stay").with_for_update().first()
    if listing is None or listing.status != "published":
        abort(404, "Short-stay property not found")
    expired = Booking.query.filter(Booking.listing_id == listing_id, Booking.status == "requested",
                                   Booking.expires_at <= datetime.now(timezone.utc)).all()
    for booking in expired:
        AvailabilityNight.query.filter_by(booking_id=booking.booking_id).delete()
        booking.status = "expired"
    db.session.flush()
    return listing


def booking_json(row):
    return serialized(row, "booking_id listing_id check_in check_out guests status expires_at created_at")


@bookings_ns.route("")
class Bookings(Resource):
    @flask_keycloak.require_token
    def get(self):
        query = Booking.query.filter_by(guest_id=g.user["userId"])
        return {"items": [booking_json(x) for x in query.order_by(Booking.created_at.desc()).limit(100).all()]}

    @flask_keycloak.require_token
    def post(self):
        data = payload({"listing_id": string(36), "check_in": fields.Date(required=True),
                        "check_out": fields.Date(required=True), "guests": fields.Integer(required=True, validate=validate.Range(min=1, max=20)),
                        "idempotency_key": string(100)})
        db.session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                           {"key": "booking:" + g.user["userId"] + ":" + data["idempotency_key"]})
        listing = short_stay(data["listing_id"])
        if listing.owner_id == g.user["userId"]:
            abort(403, "Cannot book own property")
        previous = Booking.query.filter_by(guest_id=g.user["userId"], idempotency_key=data["idempotency_key"]).first()
        if previous:
            if any(getattr(previous, key) != value for key, value in data.items()):
                abort(409, "Idempotency key belongs to a different request")
            db.session.commit()
            return booking_json(previous), 200
        dates = nights(data["check_in"], data["check_out"])
        if AvailabilityNight.query.filter(AvailabilityNight.listing_id == listing.listing_id, AvailabilityNight.night.in_(dates)).first():
            abort(409, "Dates are no longer available")
        # Operational hold only: no charges, settlement, instant confirmation or invented cancellation fee.
        booking = Booking(guest_id=g.user["userId"], expires_at=datetime.now(timezone.utc) + timedelta(minutes=15), **data)
        db.session.add(booking)
        db.session.flush()
        for night in dates:
            db.session.add(AvailabilityNight(listing_id=listing.listing_id, night=night, booking_id=booking.booking_id))
        audit("booking.request", booking.booking_id)
        notify(g.user["userId"], "BOMA received your short-stay request. No payment has been taken.")
        db.session.commit()
        return booking_json(booking), 201


@bookings_ns.route("/availability/<string:listing_id>")
class Availability(Resource):
    def get(self, listing_id):
        listing = short_stay(listing_id)
        today = datetime.now(timezone.utc).date()
        dates = AvailabilityNight.query.filter(AvailabilityNight.listing_id == listing.listing_id,
                                              AvailabilityNight.night >= today, AvailabilityNight.night < today + timedelta(days=365)).all()
        db.session.commit()
        return {"unavailable": [x.night.isoformat() for x in dates], "instant_booking": False, "payments_enabled": False}

    @flask_keycloak.require_token
    def post(self, listing_id):
        listing = short_stay(listing_id)
        if listing.owner_id != g.user["userId"]:
            abort(403, "Property owner required")
        data = payload({"check_in": fields.Date(required=True), "check_out": fields.Date(required=True), "blocked": fields.Boolean(required=True)})
        dates = nights(data["check_in"], data["check_out"])
        occupied = AvailabilityNight.query.filter(AvailabilityNight.listing_id == listing_id, AvailabilityNight.night.in_(dates)).all()
        if any(x.booking_id for x in occupied):
            abort(409, "Cannot change dates held by a guest request")
        if data["blocked"]:
            existing = {x.night for x in occupied}
            for night in dates:
                if night not in existing:
                    db.session.add(AvailabilityNight(listing_id=listing_id, night=night, blocked_by=g.user["userId"]))
        else:
            for row in occupied:
                db.session.delete(row)
        audit("availability.update", listing_id)
        db.session.commit()
        return {"message": "Availability updated"}


@bookings_ns.route("/<string:booking_id>/cancel")
class Cancel(Resource):
    @flask_keycloak.require_token
    def post(self, booking_id):
        initial = db.session.get(Booking, booking_id)
        if initial is None or initial.guest_id != g.user["userId"]:
            abort(404, "Booking not found")
        short_stay(initial.listing_id)
        row = Booking.query.filter_by(booking_id=booking_id).populate_existing().with_for_update().one()
        if row.status == "cancelled":
            return {"status": "cancelled"}
        if row.status != "requested":
            abort(409, "Request is no longer cancellable here")
        row.status = "cancelled"
        AvailabilityNight.query.filter_by(booking_id=booking_id).delete()
        audit("booking.cancel", booking_id)
        db.session.commit()
        return {"status": row.status}


@bookings_ns.route("/staff")
class StaffBookings(Resource):
    @staff_only
    def get(self):
        ids = staff_listings().with_entities(Listing.listing_id).subquery()
        rows = Booking.query.filter(Booking.listing_id.in_(db.select(ids.c.listing_id))).order_by(Booking.created_at.desc()).limit(100).all()
        return {"items": [booking_json(x) for x in rows], "policy_status": "awaiting_owner_approval"}
