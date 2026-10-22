"""enforce immutable audit and financial records

Revision ID: 4915e96f2ec0
Revises: 68071752acbe
Create Date: 2026-10-22 11:26:16.861316

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4915e96f2ec0'
down_revision = '68071752acbe'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_events
    FOR EACH STATEMENT EXECUTE FUNCTION boma_audit_immutable();
    CREATE TRIGGER receipt_immutable BEFORE UPDATE OR DELETE ON commission_payments
    FOR EACH ROW EXECUTE FUNCTION boma_audit_immutable();
    CREATE OR REPLACE FUNCTION boma_approved_agreement_immutable() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'DELETE' OR OLD.approved_at IS NOT NULL THEN
        RAISE EXCEPTION 'Commission agreement history must be preserved';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER approved_agreement_immutable BEFORE UPDATE OR DELETE ON commission_agreements
    FOR EACH ROW EXECUTE FUNCTION boma_approved_agreement_immutable();
    """)


def downgrade():
    op.execute("DROP TRIGGER approved_agreement_immutable ON commission_agreements")
    op.execute("DROP FUNCTION boma_approved_agreement_immutable()")
    op.execute("DROP TRIGGER receipt_immutable ON commission_payments")
    op.execute("DROP TRIGGER audit_no_truncate ON audit_events")
