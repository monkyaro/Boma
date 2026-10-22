# Incremental implementation plan

| Milestone | Deliverable and exit criteria |
|---|---|
| A | Audit existing scaffold; requirements/architecture/decisions; isolated local stack; existing CI/security baseline; reproducible tests and rollback |
| B | Start with owner case submission/read and role correction. Then authoritative geography, assignments, audited officer identity decisions, staff MFA, secure passwordless Keycloak adapters and approved role upgrades |
| C | Listings, private location/media, public verification badge, identity-gated publish, optimistic locking and verified-owner mutation guards; test forbidden actions/leaks |
| D | Geographic officer scope, review evidence, deduplicated demand, appointments and notifications; test geographic denials |
| E | Officer-mediated offers/deals, owner-paid negotiated commission, approval/invoices/audit; test amount/basis/payor |
| F | Short-stay holds/bookings/policies and sandbox payment adapters; concurrency and webhook idempotency tests; live payments disabled |
| G | Expo customer/officer flows, push, accessibility, localization |
| H | Approved AWS staging, E2E/performance/security checks, restore drill, controlled launch |

Every increment includes migrations when needed, allowed/forbidden authorization tests, API examples, relevant frontend states, deployment and rollback instructions. Do not label a milestone complete until all its exit criteria are evidenced. Initial B is API-only: no review screen, role provisioning or live OTP is claimed.

## Local verification and rollback

See local-development.md. Stop the isolated Compose project without removing volumes. Revert application commits to roll back code. For the initial owner-case migration, downgrade only on a disposable development database; production case records must be preserved and require a separately approved rollback plan. Never edit the existing base migration.
