> Update: the approved AWS preview is now live at https://bomahoop.com. See [deployment record](deployment/live-preview.md). The implementation results below predate that deployment.

# BOMA implementation progress — 2026-10-22

The existing scaffold has been expanded into a local web/API/native implementation. The complete production system is not finished; release-status.md records both implementation gaps and external approval/provider gates.

## Implemented in this increment

- Marketplace search/filter/pagination, verification disclosure and recoverable loading/empty/error states.
- Customer workspace: saved properties, BOMA inquiries/conversations, appointments, short-stay requests and notifications.
- Owner workspace: identity application/residence, draft creation, identity-gated publish, versioned edit/withdraw, verified change requests, availability blocks.
- Staff workspace: geographic assignments/availability, identity/property decisions, task queues, appointment assignment/reassignment/outcome and scoped reporting. Completed MFA and independent review are enforced server-side.
- Negotiated owner-paid commissions with explicit basis/agreement/due date, independent approval, immutable receipts and finance balances/report.
- Short-stay request holds, unique nightly inventory, expiration/cancellation and transaction locking/idempotency. No live confirmation/fees/payouts.
- Signed/idempotent sandbox callback adapter that affects only sandbox intents, never real receipts or booking confirmation.
- Disabled-by-default private upload quarantine adapter; no unsafe public media release path.
- Expo customer/officer app, PKCE, SecureStore token/refresh handling and offline evidence-reference drafts, account-scoped device registration with push delivery still disabled.
- Separate local web/API/worker/PostGIS/Redis/Keycloak databases, local-only PKCE realm blueprint and secure local credential initialization.
- DB-backed append-only audit/receipt/approved-agreement controls; rate limiting, safe public DTOs, common contact/coordinate text guards, private response caching protection and database error/log redaction.

## Executed verification

| Check | Result |
|---|---|
| Backend pytest | **46 passed** against isolated PostGIS/Redis |
| Ruff | Pass for app/tests |
| Strict mypy | Pass for the explicitly scoped typed payment adapter contract; full Flask/ORM typing remains future work |
| Migration chain | Upgrade, downgrade to initial owner-case revision, re-upgrade and drift check pass on disposable boma_test |
| Backend dependency audit | No known vulnerabilities reported by pip-audit for requirements.txt |
| Web lint/typecheck/unit/build | Pass; 3 unit tests |
| Browser tests | 2 pass: search/verification/empty result and API failure recovery; public API is mocked |
| Actual local auth redirect | Browser reaches local Keycloak with Authorization Code + PKCE S256; not a completed registration/MFA integration test |
| Native client | Typecheck and Android + iOS Metro/Hermes exports pass; no device/store readiness claimed |
| Local Docker stack | Web/API/worker/auth built/started; marketplace visually inspected |
| Security scans | Web: 5 high tooling findings; Expo: 15 high dependency-tree findings remain; no gate disabled |

The backend tests include forbidden roles, primary-OTP-only staff denial, real JWT signature/issuer/audience/expiry verification, geographic scope, owner identity vs property verification separation, verified edit/delete denial, stale evidence, concurrent listing edits, concurrent booking overlap, cancellation/expiration/owner blocks, owner-paid commission calculation/receipt idempotency, sandbox signature/event replay, private customer conversations, immutable audit/financial records, and PII-free DB error/log handling. Existing Flask-RESTX/jsonschema and migration engine API deprecation warnings remain.

## Run and remaining dependencies

Open http://localhost:3000 (local machine/port forwarding). API readiness: http://localhost:8100/health/ready. Full commands are in local-development.md; API contracts are in api.md. The local database has no fabricated live listings or production geography. Self-registration remains gated on the passwordless provider integration; the realm blueprint includes no bundled accounts.

Provider names/dataset links and viewing policy were requested from the owner; no response or approval is inferred from elapsed time. Activation/WhatsApp/payment/push configuration, approved geography/boundaries, commercial policies, legal review, remaining release implementation and security findings are recorded in release-status.md. No AWS calls, provisioning, DNS/IAM changes, production data access or deployment occurred. The existing deployment plan remains a proposal pending verified metadata/current pricing and explicit approval.

Changes are on codex/boma-foundations. GitHub CLI is unauthenticated, so the remote PR cannot be opened from this session. No main push or image publication occurred.
