# Release status — 2026-10-22

This is an expanded local implementation, not a completed production launch. Never present an empty local marketplace or sandbox records as real business activity.

| Area | Implemented | Remaining release gate |
|---|---|---|
| Foundation | Existing monorepo preserved; Compose web/API/worker/PostGIS/Redis/Keycloak; CI, migration/lint/type/security checks | Resolve dependency advisories; production restore/performance/alerting validation |
| Identity/geography | Owner cases, local draft capability, scoped independent decisions, MFA token enforcement, geography hierarchy/admin | Approved Tanzania dataset/boundaries; real staff directory/MFA configuration; tested passwordless email/WhatsApp/fallback; identity-document access/retention |
| Listings | Public search, verification badges, owner portal, identity-gated publish, locked/versioned edit/withdraw, verified change approvals, private coordinates | Complete public-content moderation/PII evasion tests; exact geographic-boundary checks; media scanning/EXIF removal/derivative publishing and protected document workflows; approximate map once geography is approved |
| Operations | Multiple geographic assignments/availability, scoped tasks, unique-inquiry demand trigger, review references, appointment assignment/reassignment/outcome, staff-only customer messages, in-app center | Owner-approved viewing policy; broader fraud/risk signals, workload-aware automatic assignment, full evidence capture, raw/bot/anonymous analytics and retention policy |
| Sales/rentals | BOMA-mediated offers/deals, negotiated owner-paid fixed/percent agreements, independent approval, immutable receipts, balances/finance report | Full contract storage/signature workflows, expanded rental milestones/ledger/invoice rendering, agreed proceeds collection model and real reconciliation |
| Short stay | One unit per listing, nightly availability/block/hold locking, expiry/cancel requests, exact-payload idempotency, sandbox callback reconciliation | Approved commercial policies/capacity/pricing; real booking confirmation/check-in/out, refund/settlement policy engines and contracted provider; no live money movement |
| Mobile | Native customer/officer flows, secure tokens/offline reference drafts, device registration; Android/iOS bundle export | Physical-device testing, media capture, accessibility/localization, push delivery credentials/adapter, native signing/distribution |
| AWS | Existing Terraform preserved; discovery/approval/rollback checklist | Authorized temporary access, metadata discovery, current regional quote and approved resource plan; no AWS deployment performed |

## Unresolved owner inputs

Provider names for email/WhatsApp/payment, an authoritative geography source, viewing verification gate, short-stay commercial policies, legal/privacy/brokerage/tax/payment review and deployment budget/resource approval. No secrets should be sent in chat. Pending inputs do not enable any production feature automatically.

## Security scans

Local `npm audit` reports 5 high-severity transitive findings in web development tooling (`braces` chain), and 15 in the Expo/Metro/CLI dependency tree (`braces` and `node-forge` chains). Compatible `npm audit fix` did not resolve them; forced framework downgrades were not applied. CI audit gates remain active. Counts may change with advisories and need rechecking before release. See the actual scan output for dependency paths; these findings are not represented as an exploit assessment or an approved exception.

No overall milestone or production-readiness claim is made until its remaining gates are tested/approved. See progress.md for the latest executed checks.


Backend dependency audit (`pip-audit -r requirements.txt`) reported no known vulnerabilities in the executed local scan. This does not replace application or infrastructure security review. Web audit findings are in development tooling; Expo audit also reports findings when omitting dev dependencies because its build toolchain is part of the Expo dependency tree.
