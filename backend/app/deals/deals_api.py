from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from flask import g
from flask_restx import Namespace, Resource, abort
from marshmallow import fields
from sqlalchemy import or_, func, text
from app.extensions import db, flask_keycloak
from app.listings.listing_model import Listing
from app.workspace.access import staff_only, listing_scope, roles, audit, notify, STAFF_ROLES, finance_only, has_mfa
from app.workspace.validation import payload, string, choice, money
from app.workspace.workspace_api import staff_listings, serialized
from .deals_model import Deal, Offer, CommissionAgreement, CommissionPayment

deals_ns = Namespace("deals", description="Officer-mediated sales and long-term rentals")


def staff_deal(deal_id):
    row = Deal.query.filter_by(deal_id=deal_id).with_for_update().first()
    if row is None:
        abort(404, "Deal not found")
    listing = db.session.get(Listing, row.listing_id)
    listing_scope(listing)
    return row, listing


def deal_json(row):
    return dict(serialized(row, "deal_id listing_id status currency created_at"), agreed_price=str(row.agreed_price))


@deals_ns.route("")
class Deals(Resource):
    @flask_keycloak.require_token
    def get(self):
        query = Deal.query.join(Listing)
        if roles() & (STAFF_ROLES | {"finance"}):
            if not has_mfa():
                abort(403, "Staff MFA required")
            ids = staff_listings().with_entities(Listing.listing_id).subquery()
            query = query.filter(Deal.listing_id.in_(db.select(ids.c.listing_id)))
        else:
            query = query.filter(or_(Deal.customer_id == g.user["userId"], Listing.owner_id == g.user["userId"]))
        return {"items": [deal_json(x) for x in query.order_by(Deal.created_at.desc()).limit(100).all()]}

    @staff_only
    def post(self):
        data = payload({"listing_id": string(36), "customer_id": string(36), "agreed_price": money()})
        listing = Listing.query.filter_by(listing_id=data["listing_id"]).with_for_update().first()
        if listing is None:
            abort(404, "Listing not found")
        listing_scope(listing)
        if listing.status != "published" or listing.listing_type == "short_stay":
            abort(409, "Published sale or long-term rental required")
        if data["customer_id"] in {listing.owner_id, g.user["userId"]} or listing.owner_id == g.user["userId"]:
            abort(403, "Independent owner, customer and BOMA officer required")
        if data["agreed_price"] <= 0:
            abort(400, "Positive deal price required")
        row = Deal(officer_id=g.user["userId"], **data)
        db.session.add(row)
        db.session.flush()
        audit("deal.create", row.deal_id)
        notify(row.customer_id, "BOMA opened a transaction for your property inquiry.")
        notify(listing.owner_id, "BOMA opened a transaction for your property.")
        db.session.commit()
        return deal_json(row), 201


@deals_ns.route("/<string:deal_id>/offers")
class Offers(Resource):
    @staff_only
    def post(self, deal_id):
        row, _ = staff_deal(deal_id)
        if row.status != "negotiating" or CommissionAgreement.query.filter_by(deal_id=deal_id).first():
            abort(409, "Close the proposed agreement before starting a new negotiation")
        data = payload({"amount": money(), "reference": string(200)})
        if data["amount"] <= 0:
            abort(400, "Positive offer required")
        offer = Offer(deal_id=deal_id, recorded_by=g.user["userId"], **data)
        db.session.add(offer)
        row.agreed_price = data["amount"]
        audit("deal.offer", deal_id)
        db.session.commit()
        return {"message": "Offer recorded by BOMA"}, 201


@deals_ns.route("/<string:deal_id>/commission")
class Commission(Resource):
    @flask_keycloak.require_token
    def get(self, deal_id):
        deal = db.session.get(Deal, deal_id)
        if deal is None:
            abort(404, "Deal not found")
        listing = db.session.get(Listing, deal.listing_id)
        if g.user["userId"] != listing.owner_id:
            if not roles() & (STAFF_ROLES | {"finance"}) or not has_mfa():
                abort(403, "Owner or authorized BOMA staff required")
            listing_scope(listing)
        agreement = CommissionAgreement.query.filter_by(deal_id=deal_id).first()
        if agreement is None:
            abort(404, "No commission agreement")
        paid = db.session.query(func.coalesce(func.sum(CommissionPayment.amount), 0)).filter_by(agreement_id=agreement.agreement_id).scalar()
        return dict(serialized(agreement, "agreement_id calculation basis_description currency written_reference due_date approved_at"),
                    payer="property_owner", amount_due=str(agreement.amount_due), paid=str(paid),
                    balance=str(agreement.amount_due - paid), basis_amount=str(agreement.basis_amount),
                    rate_or_amount=str(agreement.rate_or_amount))

    @staff_only
    def post(self, deal_id):
        deal, listing = staff_deal(deal_id)
        if deal.status != "negotiating" or CommissionAgreement.query.filter_by(deal_id=deal_id).first():
            abort(409, "Agreement already exists or negotiation closed")
        data = payload({"calculation": choice(["percentage", "fixed"]), "rate_or_amount": money(),
                        "basis_amount": money(), "basis_description": string(300),
                        "written_reference": string(200), "due_date": fields.Date(required=True)})
        if data["rate_or_amount"] <= 0 or data["basis_amount"] <= 0:
            abort(400, "Positive commission and basis required")
        if data["calculation"] == "percentage" and data["rate_or_amount"] > 100:
            abort(400, "Percentage cannot exceed 100")
        amount = data["rate_or_amount"]
        if data["calculation"] == "percentage":
            amount = (data["basis_amount"] * amount / Decimal(100)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if amount <= 0 or amount > Decimal("999999999999.99"):
            abort(400, "Commission amount outside supported range")
        agreement = CommissionAgreement(deal_id=deal_id, payer_id=listing.owner_id,
                                         amount_due=amount, created_by=g.user["userId"], **data)
        db.session.add(agreement)
        audit("commission.propose", deal_id, payer="property_owner", amount=str(amount))
        db.session.commit()
        return {"agreement_id": agreement.agreement_id, "amount_due": str(amount), "payer": "property_owner"}, 201


@deals_ns.route("/<string:deal_id>/commission/approve")
class ApproveCommission(Resource):
    @staff_only
    def post(self, deal_id):
        deal, listing = staff_deal(deal_id)
        if not roles() & {"regional_supervisor", "national_admin"}:
            abort(403, "Supervisor approval required")
        agreement = CommissionAgreement.query.filter_by(deal_id=deal_id).with_for_update().first()
        if agreement is None:
            abort(404, "No commission agreement")
        if agreement.approved_at or deal.status != "negotiating":
            abort(409, "Agreement already decided")
        if g.user["userId"] in {agreement.created_by, agreement.payer_id, deal.customer_id}:
            abort(403, "Independent approver required")
        agreement.approved_by, agreement.approved_at = g.user["userId"], datetime.now(timezone.utc)
        deal.status = "agreed"
        audit("commission.approve", agreement.agreement_id)
        notify(listing.owner_id, "Your negotiated BOMA commission agreement is approved.")
        db.session.commit()
        return {"status": "approved", "invoice_reference": agreement.agreement_id}


@deals_ns.route("/<string:deal_id>/commission/payments")
class RecordPayment(Resource):
    @finance_only
    def post(self, deal_id):
        _, _listing = staff_deal(deal_id)
        agreement = CommissionAgreement.query.filter_by(deal_id=deal_id).with_for_update().first()
        if agreement is None or not agreement.approved_at:
            abort(409, "Approved agreement required")
        data = payload({"amount": money(), "reference": string(200)})
        db.session.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"),
                           {"key": "commission-receipt:" + data["reference"]})
        previous = CommissionPayment.query.filter_by(reference=data["reference"]).first()
        if previous:
            if previous.agreement_id != agreement.agreement_id or previous.amount != data["amount"]:
                abort(409, "Payment reference already used for different details")
            return {"payment_id": previous.payment_id}, 200
        paid = db.session.query(func.coalesce(func.sum(CommissionPayment.amount), 0)).filter_by(agreement_id=agreement.agreement_id).scalar()
        if data["amount"] <= 0 or data["amount"] > agreement.amount_due - paid:
            abort(400, "Payment must be positive and cannot exceed outstanding commission")
        payment = CommissionPayment(agreement_id=agreement.agreement_id, recorded_by=g.user["userId"], **data)
        db.session.add(payment)
        db.session.flush()
        audit("commission.receipt", payment.payment_id, amount=str(data["amount"]))
        db.session.commit()
        return {"payment_id": payment.payment_id}, 201


@deals_ns.route("/<string:deal_id>/outcome")
class Outcome(Resource):
    @staff_only
    def post(self, deal_id):
        row, _ = staff_deal(deal_id)
        data = payload({"status": choice(["completed", "cancelled"]), "reference": string(200)})
        if row.status in {"completed", "cancelled"}:
            abort(409, "Outcome already recorded")
        if data["status"] == "completed" and row.status != "agreed":
            abort(409, "Approved commission agreement required")
        row.status = data["status"]
        audit("deal." + row.status, deal_id, reference=data["reference"])
        db.session.commit()
        return {"status": row.status}


@deals_ns.route("/finance/report")
class FinanceReport(Resource):
    @finance_only
    def get(self):
        ids = staff_listings().with_entities(Listing.listing_id).subquery()
        agreements = CommissionAgreement.query.join(Deal).filter(
            Deal.listing_id.in_(db.select(ids.c.listing_id)), CommissionAgreement.approved_at.is_not(None)).all()
        due = sum((x.amount_due for x in agreements), Decimal(0))
        agreement_ids = [x.agreement_id for x in agreements]
        paid = db.session.query(func.coalesce(func.sum(CommissionPayment.amount), 0)).filter(
            CommissionPayment.agreement_id.in_(agreement_ids)).scalar()
        return {"currency": "TZS", "commission_due": str(due), "commission_paid": str(paid),
                "outstanding": str(due - paid), "approved_agreements": len(agreements)}
