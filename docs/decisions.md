# Decisions and unresolved policies

## Accepted implementation decisions

- Preserve existing backend/frontend paths; migrate layout only with a separate compatibility plan.
- Remove legacy `agent` permission when touching listing creation. An officer is not implicitly an owner.
- Owner account IDs are private metadata, excluded from anonymous listing DTOs.
- Initial owner onboarding only opens/reads a pending identity case. It neither grants roles nor publishes listings.

## Open owner decisions

| Decision | Safe behavior until approved |
|---|---|
| Sales/rental payment collection by owner or BOMA | Separate commission receivables; no live collection |
| Short-stay commission, custody, settlement, cancellation/refund, instant booking | No live payment or automatic confirmation |
| Verify property before physical viewing | Proposed gate; keep physical scheduling unavailable pending decision |
| Mandatory verification before short-stay booking | No live booking confirmation until policy is approved |
| Demand thresholds and risk checks | No numeric production thresholds; staff-only decisions |
| Owner organizations, verification evidence and retention | No document upload/review until access/retention rules are set |
| Tanzania legal/privacy/brokerage/tax/payment review | Launch blocked pending qualified local counsel |
| WhatsApp provider approval, fallback and opt-in | Adapter only; no live WhatsApp integration |
| Authoritative Tanzania geography source | No fabricated geography seed |
| AWS account/domain/environment/budget authorization | Read-only discovery; no apply, DNS/IAM changes or production data access |
| Runtime secret migration from existing SSM conventions | Target Secrets Manager + instance roles; review compatibility first |

Existing infrastructure docs claim deployed production resources and a $120 approved budget. These are repository statements, not verified findings or authorization in this session. Do not use them to justify spending.
