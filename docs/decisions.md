# Decisions and unresolved policies

## Accepted implementation decisions

- Preserve existing backend/frontend paths; migrate layout only with a separate compatibility plan.
- Remove legacy `agent` permission when touching listing creation. An officer is not implicitly an owner.
- Owner account IDs are private metadata, excluded from anonymous listing DTOs.
- Owner onboarding opens/reads a pending identity case and permits preparing drafts on the same account. An approved local case is the publishing capability; no automatic Keycloak staff-role elevation occurs.

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

## Proposed operational defaults (not commercial policy approval)

Booking request holds last 15 minutes, accept 1–90 nights and cap input at 20 guests. These are provisional technical limits; they do not imply actual unit capacity, pricing or confirmed booking policy. Physical scheduling remains disabled; its proposed verification gate requires VERIFIED property. Demand task generation defaults to disabled (threshold 0). Uploads, sandbox payments and real push delivery default to disabled. No live payment adapter is configured.

See release-status.md for unfinished implementation and provider/data dependencies; existing initial-milestone wording is historical, not a claim that the full product is finished.
