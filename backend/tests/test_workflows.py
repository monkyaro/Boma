import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError
from app.extensions import db
from app.listings.listing_model import Listing
from app.onboarding.onboarding_model import IdentityVerificationCase
from app.workspace.workspace_model import (
    Region, OfficerAssignment, AuditEvent, VerificationCase, PropertyViewEvent,
)
from app.bookings.bookings_model import Booking, AvailabilityNight

HEADERS = {"Authorization": "Bearer test"}


def actor(claims, user, *roles, mfa=True):
    claims.update(sub=user, realm_access={"roles": list(roles)}, amr=["pwd", "otp"] if mfa else [])


@pytest.fixture
def property_row(geography):
    region, district, ward, _ = geography
    owner = "owner-" + uuid.uuid4().hex[:24]
    row = Listing(owner_id=owner, title="Test property", listing_type="sale", property_type="house",
                  price=Decimal("1000000"), currency="TZS", region="Test region", region_code=region,
                  district_code=district, ward_code=ward, location="SRID=4326;POINT(39.2 -6.8)", status="published")
    db.session.add(row)
    db.session.commit()
    return row


def assign(user, region, district=None, ward=None):
    db.session.add(OfficerAssignment(officer_id=user, region_code=region, district_code=district, ward_code=ward))
    db.session.commit()


def test_publish_requires_identity_then_geography(client, token_claims, property_row):
    row = property_row
    owner_id = row.owner_id
    row.status = "draft"
    db.session.commit()
    actor(token_claims, owner_id, "owner")
    assert client.post(f"/listings/{row.listing_id}/publish", json={"version": 1}, headers=HEADERS).status_code == 403
    db.session.add(IdentityVerificationCase(user_id=row.owner_id, status="approved"))
    db.session.commit()
    response = client.post(f"/listings/{row.listing_id}/publish", json={"version": 1}, headers=HEADERS)
    assert response.status_code == 200
    assert response.json["verification_status"] == "UNVERIFIED"


def test_owner_edits_version_and_invalidates_evidence(client, token_claims, property_row):
    row = property_row
    owner_id = row.owner_id
    db.session.add(VerificationCase(listing_id=row.listing_id, listing_version=row.version))
    db.session.commit()
    actor(token_claims, owner_id, "owner")
    endpoint = f"/listings/{row.listing_id}"
    assert client.patch(endpoint, json={"title": "New title", "version": 0}, headers=HEADERS).status_code == 409
    response = client.patch(endpoint, json={"title": "New title", "version": 1}, headers=HEADERS)
    assert response.status_code == 200
    assert response.json["version"] == 2
    assert VerificationCase.query.filter_by(listing_id=row.listing_id).one().status == "stale"
    assert client.delete(endpoint, json={"version": 2}, headers=HEADERS).status_code == 200
    assert client.get(endpoint).status_code == 404


def test_verified_owner_cannot_mutate(client, token_claims, property_row):
    property_row.verification_status = "VERIFIED"
    db.session.commit()
    actor(token_claims, property_row.owner_id, "owner")
    url = f"/listings/{property_row.listing_id}"
    assert client.patch(url, json={"title": "Forbidden", "version": 1}, headers=HEADERS).status_code == 403
    assert client.delete(url, json={"version": 1}, headers=HEADERS).status_code == 403
    assert client.post(url + "/change-requests", json={"reason": "Please change title"}, headers=HEADERS).status_code == 201


def test_foreign_owner_and_anonymous_cannot_edit(client, token_claims, property_row):
    url = f"/listings/{property_row.listing_id}"
    actor(token_claims, "another-owner", "owner")
    assert client.patch(url, json={"version": 1, "title": "Forbidden"}, headers=HEADERS).status_code == 404
    assert client.patch(url, json={"version": 1}).status_code == 401


def test_verification_requires_mfa_geography_and_current_evidence(client, token_claims, property_row, geography):
    row = property_row
    assign("officer-test", geography[0], geography[1], geography[2])
    url = f"/workspace/properties/{row.listing_id}/verification"
    decision = {"version": row.version, "decision": "verified", "evidence": "Reference to physical ownership check"}
    actor(token_claims, "officer-test", "officer", mfa=False)
    assert client.post(url, json=decision, headers=HEADERS).status_code == 403
    actor(token_claims, "unassigned", "officer")
    assert client.post(url, json=decision, headers=HEADERS).status_code == 403
    actor(token_claims, "officer-test", "officer")
    assert client.post(url, json={**decision, "version": 0}, headers=HEADERS).status_code == 409
    response = client.post(url, json=decision, headers=HEADERS)
    assert response.status_code == 200
    assert response.json["verification_status"] == "VERIFIED"


def test_officer_queue_never_leaks_other_region(client, token_claims, property_row, geography):
    assign("wrong-region", geography[3])
    actor(token_claims, "wrong-region", "officer")
    assert property_row.listing_id not in {item["listing_id"] for item in client.get("/workspace/properties", headers=HEADERS).json["items"]}


def test_identity_review_separate_from_property(client, token_claims, property_row, geography):
    listing_id = property_row.listing_id
    case = IdentityVerificationCase(user_id=property_row.owner_id, residence_region_code=geography[3])
    db.session.add(case)
    db.session.commit()
    assign("identity-officer", geography[0])
    actor(token_claims, "identity-officer", "officer")
    url = f"/workspace/identity-cases/{case.case_id}/decision"
    data = {"decision": "approved", "reference": "Test physical ID check"}
    assert client.post(url, json=data, headers=HEADERS).status_code == 403
    assign("identity-officer", geography[3])
    assert client.post(url, json=data, headers=HEADERS).status_code == 200
    assert db.session.get(Listing, listing_id).verification_status == "UNVERIFIED"
    assert client.post(url, json=data, headers=HEADERS).status_code == 409


def test_public_privacy_and_filters(client, property_row):
    row = property_row
    body = client.get(f"/listings/{row.listing_id}").json
    assert not {"owner_id", "location", "latitude", "longitude", "user_id"} & body.keys()
    assert body["verification_status"] == "UNVERIFIED"
    assert client.get("/listings?min_price=NaN").status_code == 400
    assert client.get("/listings?max_price=-1").status_code == 400
    assert client.get(f"/listings?region_code={row.region_code}&q=Test&min_price=100").json["total"] == 1


def test_view_tracking_consent_and_dedup(client, token_claims, property_row):
    actor(token_claims, "visitor", "buyer")
    url = f"/listings/{property_row.listing_id}/view"
    assert client.post(url, json={"consent": False}, headers=HEADERS).json == {"recorded": False}
    assert client.post(url, json={"consent": True}, headers=HEADERS).status_code == 200
    assert client.post(url, json={"consent": True}, headers=HEADERS).status_code == 200
    rows = PropertyViewEvent.query.filter_by(listing_id=property_row.listing_id).all()
    assert len(rows) == 1 and rows[0].visitor_hash != "visitor"


def test_viewing_gate_and_owner_cannot_read_customer_messages(client, token_claims, property_row, geography):
    row = property_row
    owner_id = row.owner_id
    actor(token_claims, "viewing-customer", "buyer")
    inquiry = client.post("/workspace/inquiries", json={"listing_id": row.listing_id, "kind": "viewing"}, headers=HEADERS).json
    url = f"/workspace/inquiries/{inquiry['inquiry_id']}"
    assign("viewing-officer", geography[0])
    actor(token_claims, "viewing-officer", "officer")
    response = client.post(url + "/schedule", json={"officer_id": "viewing-officer", "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat()}, headers=HEADERS)
    assert response.status_code == 409
    actor(token_claims, owner_id, "owner")
    assert client.get(url + "/messages", headers=HEADERS).status_code == 403


def test_audit_cannot_be_updated_or_deleted(app, property_row):
    row = AuditEvent(actor_id="test-auditor", action="test.immutable", target_id=property_row.listing_id)
    db.session.add(row)
    db.session.commit()
    event_id = row.event_id
    for statement in ("UPDATE audit_events SET action='changed' WHERE event_id=:id", "DELETE FROM audit_events WHERE event_id=:id"):
        with pytest.raises(DBAPIError):
            db.session.execute(text(statement), {"id": event_id})
            db.session.commit()
        db.session.rollback()


def test_commission_is_negotiated_owner_paid_and_approved(client, token_claims, property_row, geography):
    row = property_row
    owner_id = row.owner_id
    assign("deal-officer", geography[0])
    actor(token_claims, "deal-officer", "officer")
    response = client.post("/deals", json={"listing_id": row.listing_id, "customer_id": "deal-customer", "agreed_price": "1000000"}, headers=HEADERS)
    assert response.status_code == 201
    deal_id = response.json["deal_id"]
    url = f"/deals/{deal_id}/commission"
    agreement = {"calculation": "percentage", "rate_or_amount": "2.5", "basis_amount": "1000000", "basis_description": "Negotiated sale price", "written_reference": "TEST-AGREEMENT", "due_date": "2027-01-01"}
    response = client.post(url, json=agreement, headers=HEADERS)
    assert response.status_code == 201
    assert response.json["payer"] == "property_owner"
    assert response.json["amount_due"] == "25000.00"
    assert client.post(url + "/approve", json={}, headers=HEADERS).status_code == 403
    actor(token_claims, "finance-admin", "national_admin")
    assert client.post(url + "/approve", json={}, headers=HEADERS).status_code == 200
    payment = {"amount": "10000", "reference": "receipt-" + uuid.uuid4().hex}
    assert client.post(url + "/payments", json=payment, headers=HEADERS).status_code == 201
    assert client.post(url + "/payments", json=payment, headers=HEADERS).status_code == 200
    assert client.get(url, headers=HEADERS).json["balance"] == "15000.00"
    actor(token_claims, "deal-customer", "buyer")
    assert client.get(url, headers=HEADERS).status_code == 403
    actor(token_claims, owner_id, "owner")
    assert client.get(url, headers=HEADERS).json["payer"] == "property_owner"


def booking_data(listing_id, key):
    start = datetime.now(timezone.utc).date() + timedelta(days=10)
    return {"listing_id": listing_id, "check_in": start.isoformat(), "check_out": (start + timedelta(days=2)).isoformat(), "guests": 2, "idempotency_key": key}


def test_booking_idempotency_cancel_and_conflict(client, token_claims, property_row):
    property_row.listing_type = "short_stay"
    db.session.commit()
    actor(token_claims, "booking-guest", "guest")
    listing_id = property_row.listing_id
    data = booking_data(listing_id, "booking-test")
    first = client.post("/bookings", json=data, headers=HEADERS)
    assert first.status_code == 201
    assert client.post("/bookings", json=data, headers=HEADERS).json["booking_id"] == first.json["booking_id"]
    assert client.post("/bookings", json={**data, "guests": 3}, headers=HEADERS).status_code == 409
    assert client.post("/bookings", json={**data, "idempotency_key": "another"}, headers=HEADERS).status_code == 409
    assert client.post(f"/bookings/{first.json['booking_id']}/cancel", json={}, headers=HEADERS).status_code == 200
    assert client.post("/bookings", json={**data, "idempotency_key": "after-cancel"}, headers=HEADERS).status_code == 201
    availability = client.get(f"/bookings/availability/{listing_id}").json
    assert "guest_id" not in str(availability)
    assert availability["payments_enabled"] is False


def test_booking_prevents_concurrent_double_booking(app, token_claims, property_row):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    property_row.listing_type = "short_stay"
    db.session.commit()
    listing_id = property_row.listing_id
    actor(token_claims, "concurrent-guest", "guest")
    barrier = Barrier(2)
    def submit(key):
        with app.test_client() as client:
            barrier.wait(timeout=10)
            return client.post("/bookings", json=booking_data(listing_id, key), headers=HEADERS).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(submit, ["concurrent-one", "concurrent-two"]))
    assert sorted(statuses) == [201, 409]
    assert AvailabilityNight.query.filter_by(listing_id=listing_id).count() == 2


def test_media_is_fail_closed_and_owner_scoped(client, token_claims, property_row):
    listing_id, owner_id = property_row.listing_id, property_row.owner_id
    data = {"kind": "photo", "listing_id": listing_id, "content_type": "image/jpeg", "size_bytes": 1200}
    actor(token_claims, owner_id, "owner")
    assert client.post("/media/uploads", json=data, headers=HEADERS).status_code == 503
    assert client.post("/media/uploads", json={**data, "content_type": "image/svg+xml"}, headers=HEADERS).status_code == 400
    actor(token_claims, "other-media-owner", "owner")
    assert client.post("/media/uploads", json=data, headers=HEADERS).status_code == 404


def test_customer_application_allows_drafts_without_role_escalation(client, token_claims):
    from tests.test_listings import NEW_LISTING
    actor(token_claims, "new-owner-" + uuid.uuid4().hex[:20], "buyer")
    assert client.post("/onboarding/owner-identity", json={}, headers=HEADERS).status_code == 201
    draft = client.post("/listings", json=NEW_LISTING, headers=HEADERS)
    assert draft.status_code == 201
    assert draft.json["status"] == "draft"
    assert token_claims["realm_access"]["roles"] == ["buyer"]
    assert client.post(f"/listings/{draft.json['listing_id']}/publish", json={"version": 1}, headers=HEADERS).status_code == 403


def test_customer_officer_messages_are_private_and_appointment_can_complete(client, token_claims, property_row, geography):
    listing_id, owner_id = property_row.listing_id, property_row.owner_id
    actor(token_claims, "messaging-customer", "buyer")
    inquiry = client.post("/workspace/inquiries", json={"listing_id": listing_id, "kind": "inquiry"}, headers=HEADERS).json
    url = f"/workspace/inquiries/{inquiry['inquiry_id']}"
    assign("messaging-officer", geography[0])
    actor(token_claims, "messaging-officer", "officer")
    schedule = {"officer_id": "messaging-officer", "scheduled_at": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()}
    assert client.post(url + "/schedule", json=schedule, headers=HEADERS).status_code == 200
    assert client.post(url + "/messages", json={"body": "Your BOMA officer can help."}, headers=HEADERS).status_code == 201
    actor(token_claims, "messaging-customer", "buyer")
    messages = client.get(url + "/messages", headers=HEADERS).json["items"]
    assert len(messages) == 1 and not messages[0]["from_me"]
    assert not {"sender_id", "owner_id", "officer_id"} & messages[0].keys()
    actor(token_claims, "unrelated-customer", "buyer")
    assert client.get(url + "/messages", headers=HEADERS).status_code == 403
    actor(token_claims, owner_id, "owner", "officer")
    assert client.get(url + "/messages", headers=HEADERS).status_code == 403
    actor(token_claims, "messaging-officer", "officer")
    assert client.post(url + "/outcome", json={"status": "completed", "reference": "Attendance test"}, headers=HEADERS).status_code == 200


def test_demand_uses_unique_customers_not_repeat_inquiries(client, token_claims, property_row, app, monkeypatch):
    listing_id = property_row.listing_id
    monkeypatch.setitem(app.config, "VERIFICATION_INQUIRY_THRESHOLD", 2)
    data = {"listing_id": listing_id, "kind": "inquiry"}
    actor(token_claims, "demand-customer-one", "buyer")
    for _ in range(2):
        assert client.post("/workspace/inquiries", json=data, headers=HEADERS).status_code == 201
    assert VerificationCase.query.filter_by(listing_id=listing_id).count() == 0
    actor(token_claims, "demand-customer-two", "buyer")
    assert client.post("/workspace/inquiries", json=data, headers=HEADERS).status_code == 201
    assert VerificationCase.query.filter_by(listing_id=listing_id).count() == 1


def test_owner_availability_blocks_prevent_requests_and_expired_holds_release(client, token_claims, property_row):
    property_row.listing_type = "short_stay"
    db.session.commit()
    listing_id, owner_id = property_row.listing_id, property_row.owner_id
    data = booking_data(listing_id, "blocked-test")
    dates = {key: data[key] for key in ("check_in", "check_out")}
    actor(token_claims, owner_id, "owner")
    url = f"/bookings/availability/{listing_id}"
    assert client.post(url, json={**dates, "blocked": True}, headers=HEADERS).status_code == 200
    actor(token_claims, "availability-guest", "guest")
    assert client.post("/bookings", json=data, headers=HEADERS).status_code == 409
    actor(token_claims, owner_id, "owner")
    assert client.post(url, json={**dates, "blocked": False}, headers=HEADERS).status_code == 200
    actor(token_claims, "availability-guest", "guest")
    response = client.post("/bookings", json=data, headers=HEADERS)
    booking = db.session.get(Booking, response.json["booking_id"])
    booking.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.session.commit()
    assert client.get(url).json["unavailable"] == []


def test_mobile_device_tokens_never_return_in_session_or_notification_data(client, token_claims):
    token = "private-test-device-" + uuid.uuid4().hex
    actor(token_claims, "mobile-device-user", "buyer")
    response = client.post("/workspace/devices", json={"provider": "expo", "token": token}, headers=HEADERS)
    assert response.status_code == 201
    assert response.json["delivery_enabled"] is False
    assert token not in str(client.get("/workspace/session", headers=HEADERS).json)
    assert token not in str(client.get("/workspace/notifications", headers=HEADERS).json)
    assert client.delete("/workspace/devices", json={"token": token}, headers=HEADERS).status_code == 200


def test_concurrent_listing_edits_require_refresh(app, token_claims, property_row):
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier
    listing_id, owner_id = property_row.listing_id, property_row.owner_id
    actor(token_claims, owner_id, "owner")
    barrier = Barrier(2)
    def edit(title):
        with app.test_client() as client:
            barrier.wait(timeout=10)
            return client.patch(f"/listings/{listing_id}", json={"version": 1, "title": title}, headers=HEADERS).status_code
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(edit, ["Concurrent first title", "Concurrent second title"])) == [200, 409]


def test_approved_agreements_and_receipts_cannot_be_rewritten(app, property_row):
    from app.deals.deals_model import Deal, CommissionAgreement, CommissionPayment
    deal = Deal(listing_id=property_row.listing_id, customer_id="immutable-customer", officer_id="immutable-officer", agreed_price=1000)
    db.session.add(deal)
    db.session.flush()
    agreement = CommissionAgreement(deal_id=deal.deal_id, payer_id=property_row.owner_id, calculation="fixed", rate_or_amount=100,
                                     basis_amount=1000, basis_description="test basis", amount_due=100, written_reference="test agreement",
                                     due_date=datetime.now(timezone.utc).date(), created_by="officer", approved_by="supervisor", approved_at=datetime.now(timezone.utc))
    db.session.add(agreement)
    db.session.flush()
    payment = CommissionPayment(agreement_id=agreement.agreement_id, amount=100, reference=uuid.uuid4().hex, recorded_by="finance")
    db.session.add(payment)
    db.session.commit()
    agreement_id, payment_id = agreement.agreement_id, payment.payment_id
    for statement, identifier in (
        ("UPDATE commission_agreements SET amount_due=200 WHERE agreement_id=:id", agreement_id),
        ("DELETE FROM commission_payments WHERE payment_id=:id", payment_id),
        ("TRUNCATE audit_events", None),
    ):
        with pytest.raises(DBAPIError):
            db.session.execute(text(statement), {"id": identifier} if identifier else {})
            db.session.commit()
        db.session.rollback()


def test_sandbox_callbacks_are_signed_idempotent_and_never_confirm_bookings(client, token_claims, property_row, app, monkeypatch):
    import hashlib
    import hmac
    import json
    import secrets
    import time
    from app.payments.payments_model import SandboxPaymentEvent, SandboxPaymentIntent
    property_row.listing_type = "short_stay"
    db.session.commit()
    listing_id = property_row.listing_id
    actor(token_claims, "sandbox-guest", "guest")
    booking_id = client.post("/bookings", json=booking_data(listing_id, "sandbox-booking"), headers=HEADERS).json["booking_id"]
    intent_data = {"booking_id": booking_id, "amount": "1000", "idempotency_key": "sandbox-intent"}
    assert client.post("/payments/sandbox/intents", json=intent_data, headers=HEADERS).status_code == 503
    secret = secrets.token_urlsafe(32)
    monkeypatch.setitem(app.config, "PAYMENT_SANDBOX_ENABLED", True)
    monkeypatch.setitem(app.config, "PAYMENT_SANDBOX_SIGNING_SECRET", secret)
    intent = client.post("/payments/sandbox/intents", json=intent_data, headers=HEADERS)
    assert intent.status_code == 201
    intent_id = intent.json["intent_id"]
    assert client.post("/payments/sandbox/intents", json=intent_data, headers=HEADERS).json["intent_id"] == intent_id
    body = json.dumps({"event_id": "event-" + uuid.uuid4().hex, "intent_id": intent_id, "status": "succeeded"}).encode()
    timestamp = str(int(time.time()))
    signature = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()
    callback_headers = {"Content-Type": "application/json", "X-Boma-Timestamp": timestamp, "X-Boma-Signature": signature}
    assert client.post("/payments/sandbox/webhook", data=body).status_code == 401
    first = client.post("/payments/sandbox/webhook", data=body, headers=callback_headers)
    assert first.status_code == 200 and not first.json["duplicate"]
    assert client.post("/payments/sandbox/webhook", data=body, headers=callback_headers).json["duplicate"]
    assert SandboxPaymentEvent.query.filter_by(intent_id=intent_id).count() == 1
    assert db.session.get(SandboxPaymentIntent, intent_id).status == "succeeded"
    assert db.session.get(Booking, booking_id).status == "requested"


def test_owner_cannot_publish_direct_contact_in_listing_text(client, token_claims, property_row):
    listing_id, owner_id = property_row.listing_id, property_row.owner_id
    actor(token_claims, owner_id, "owner")
    for text_value in ("Call +255712345678", "Email owner@example.test", "See https://example.test", "Position -6.7224, 39.2145"):
        assert client.patch(f"/listings/{listing_id}", json={"version": 1, "description": text_value}, headers=HEADERS).status_code == 400


def test_geography_codes_are_generated_under_parent(client, token_claims):
    actor(token_claims, "national-admin", "national_admin")
    created = client.post("/workspace/geography", json={"kind": "region", "name": "Generated region " + uuid.uuid4().hex[:8]}, headers=HEADERS)
    assert created.status_code == 201
    region = created.json["code"]
    assert region.isdigit()
    assert client.post("/workspace/geography", json={"kind": "district", "name": "No parent"}, headers=HEADERS).status_code == 400
    first = client.post("/workspace/geography", json={"kind": "district", "name": "First", "parent_code": region}, headers=HEADERS)
    second = client.post("/workspace/geography", json={"kind": "district", "name": "Second", "parent_code": region}, headers=HEADERS)
    assert (first.json["code"], second.json["code"]) == (region + "01", region + "02")
    ward = client.post("/workspace/geography", json={"kind": "ward", "name": "Ward", "parent_code": first.json["code"]}, headers=HEADERS)
    assert ward.json["code"] == region + "0101"
    duplicate = client.post("/workspace/geography", json={"kind": "district", "name": "First", "parent_code": region}, headers=HEADERS)
    assert duplicate.status_code == 409
    actor(token_claims, "officer-test", "officer")
    assert client.post("/workspace/geography", json={"kind": "region", "name": "Officer region"}, headers=HEADERS).status_code == 403


def test_geography_rename_updates_listing_names(client, token_claims, property_row, geography):
    region, district, _, _ = geography
    listing_id = property_row.listing_id
    url = f"/workspace/geography/region/{region}"
    actor(token_claims, "officer-test", "officer")
    assert client.patch(url, json={"name": "Renamed"}, headers=HEADERS).status_code == 403
    actor(token_claims, "national-admin", "national_admin")
    assert client.patch(f"/workspace/geography/region/missing-{region}", json={"name": "Renamed"}, headers=HEADERS).status_code == 404
    taken = Region.query.filter(Region.code != region).first().name
    assert client.patch(url, json={"name": taken}, headers=HEADERS).status_code == 409
    new_name = "Renamed region " + region
    response = client.patch(url, json={"name": new_name}, headers=HEADERS)
    assert response.status_code == 200
    assert response.json == {"code": region, "name": new_name}
    assert client.patch(f"/workspace/geography/district/{district}", json={"name": "Renamed district"}, headers=HEADERS).status_code == 200
    db.session.expire_all()
    listing = db.session.get(Listing, listing_id)
    assert (listing.region, listing.district) == (new_name, "Renamed district")
    assert AuditEvent.query.filter_by(action="geography.rename", target_id=region).count() == 1
