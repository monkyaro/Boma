from app.extensions import db
from app.workspace.workspace_model import uid, now


class Deal(db.Model):
    __tablename__ = "deals"
    deal_id = db.Column(db.String(36), primary_key=True, default=uid)
    listing_id = db.Column(db.ForeignKey("listings.listing_id"), nullable=False, index=True)
    customer_id = db.Column(db.String(36), nullable=False, index=True)
    officer_id = db.Column(db.String(36), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="negotiating")
    agreed_price = db.Column(db.Numeric(14, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="TZS")
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (db.CheckConstraint("agreed_price > 0", name="ck_deal_price"),)


class Offer(db.Model):
    __tablename__ = "offers"
    offer_id = db.Column(db.String(36), primary_key=True, default=uid)
    deal_id = db.Column(db.ForeignKey("deals.deal_id"), nullable=False, index=True)
    amount = db.Column(db.Numeric(14, 2), nullable=False)
    recorded_by = db.Column(db.String(36), nullable=False)
    reference = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (db.CheckConstraint("amount > 0", name="ck_offer_amount"),)


class CommissionAgreement(db.Model):
    __tablename__ = "commission_agreements"
    agreement_id = db.Column(db.String(36), primary_key=True, default=uid)
    deal_id = db.Column(db.ForeignKey("deals.deal_id"), nullable=False, unique=True)
    payer_id = db.Column(db.String(36), nullable=False)
    calculation = db.Column(db.String(20), nullable=False)
    rate_or_amount = db.Column(db.Numeric(14, 2), nullable=False)
    basis_amount = db.Column(db.Numeric(14, 2), nullable=False)
    basis_description = db.Column(db.String(300), nullable=False)
    amount_due = db.Column(db.Numeric(14, 2), nullable=False)
    currency = db.Column(db.String(3), nullable=False, default="TZS")
    written_reference = db.Column(db.String(200), nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    created_by = db.Column(db.String(36), nullable=False)
    approved_by = db.Column(db.String(36))
    approved_at = db.Column(db.DateTime(timezone=True))
    __table_args__ = (
        db.CheckConstraint("calculation IN ('percentage', 'fixed')", name="ck_commission_calculation"),
        db.CheckConstraint("rate_or_amount > 0 AND basis_amount > 0 AND amount_due > 0", name="ck_commission_positive"),
        db.CheckConstraint("calculation != 'percentage' OR rate_or_amount <= 100", name="ck_commission_rate"),
    )


class CommissionPayment(db.Model):
    __tablename__ = "commission_payments"
    payment_id = db.Column(db.String(36), primary_key=True, default=uid)
    agreement_id = db.Column(db.ForeignKey("commission_agreements.agreement_id"), nullable=False, index=True)
    amount = db.Column(db.Numeric(14, 2), nullable=False)
    reference = db.Column(db.String(200), nullable=False, unique=True)
    recorded_by = db.Column(db.String(36), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), nullable=False, default=now)
    __table_args__ = (db.CheckConstraint("amount > 0", name="ck_commission_payment_amount"),)
