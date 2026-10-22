# Workflow API contracts

JSON requests; bearer tokens for all writes and private reads. Anonymous reads return only public DTOs. Timestamps use ISO 8601 with explicit timezone; date ranges are check-in inclusive/check-out exclusive. Monetary values are decimal strings in TZS. Authenticated writes have a default operational cap of 60/account/minute (configurable); Redis protection failures fail closed. Common responses: 400 invalid data, 401 invalid/missing token, 403 role/scope/MFA denial, 404 unavailable resource, 409 workflow/version/conflict, 429 throttled, 503 unconfigured service.

## Marketplace and owners

- `GET /listings`: `q`, `region_code`, `listing_type` (`sale`, `rent`, `short_stay`), `property_type`, `min_price`, `max_price`, `verification_status`, `page`, `per_page`. Returns `{items,total,page}`.
- `GET /listings/{id}`: published property; excludes owner ID, contacts and precise location. Verification is always explicit.
- `GET /workspace/geography`: `{regions,districts,wards}` with parent codes. No fabricated production seed.
- `POST /onboarding/owner-identity` with `{}`; repeated submissions return the same case. `PATCH` same route with `{residence_region_code}` while pending. `GET` returns only caller's case.
- `POST /listings`: owner token or existing local identity application; `title`, `listing_type`, `property_type`, `price`, `region`, optional `description`, `district`, `region_code`, `district_code`, `ward_code`, paired `latitude`/`longitude`. Draft coordinates are private and only coarsely bounded; authoritative geographic-boundary validation remains a release gate.
- `GET /listings/mine`: caller's drafts/published/withdrawn listings with versions.
- `POST /listings/{id}/publish` with `{version}`: requires approved owner identity and valid region/district/ward. New listings remain UNVERIFIED.
- `PATCH /listings/{id}` with `{version,title?,description?,...}`: only own UNVERIFIED property. Locked-row version checks prevent lost updates and invalidate pending evidence. `DELETE` with `{version}` soft-withdraws under the same guard.
- `POST /listings/{id}/change-requests` with `{reason}`: verified owner asks staff to change/withdraw.
- `GET /listings/favorites`; `POST`/`DELETE /listings/{id}/favorite`: idempotent saved listings.
- `POST /listings/{id}/view` with `{consent:true}`: authenticated daily deduplicated, HMAC-pseudonymized interest. No raw visitor IDs/IPs are stored. Anonymous raw analytics and comprehensive bot detection are not enabled.

## Customer/officer coordination

- `POST /workspace/inquiries` with `{listing_id,kind:"inquiry"|"viewing"}`; `GET` returns caller's requests. Owners cannot inquire on their own property.
- `POST /workspace/inquiries/{id}/schedule` with `{officer_id,scheduled_at}`: scoped staff/MFA, active available independent officer. Supervisor may reassign. Physical viewing stays disabled until `VIEWING_POLICY_APPROVED=true`; implemented proposed gate additionally requires VERIFIED property.
- `GET`/`POST /workspace/inquiries/{id}/messages`, POST `{body}`: customer and assigned BOMA officer/supervisor only. Property owner cannot access this customer conversation even with another role. Sender account IDs are omitted.
- `POST /workspace/inquiries/{id}/outcome` with `{status:"cancelled"|"completed",reference?}`: customers may cancel their request; completion requires assigned staff and attendance reference.
- `GET /workspace/notifications`; `POST /workspace/notifications/{id}/read`: account-scoped in-app center.
- `GET /workspace/session`: verified current subject/roles. `POST /workspace/devices` with `{provider:"expo"|"fcm",token}`; `DELETE` with `{token}` deactivates caller's device. Registration does not imply live delivery; tokens are never returned in lists.

## Scoped staff operations (MFA required)

- `GET /workspace/identity-cases`: pending cases in assigned residence region. `POST /workspace/identity-cases/{id}/decision` with `{decision:"approved"|"rejected",reference}`: independent reviewer; no self-approval. Residence is independent of property location.
- `GET /workspace/properties`; `POST /workspace/properties/{id}/verification` with `{version,decision:"verified"|"rejected",evidence}`: physical evidence reference, geographic scope and version guards; never auto-verifies from demand.
- `GET /workspace/tasks`: inquiries, review tasks and change requests in assigned geography. A configured positive `VERIFICATION_INQUIRY_THRESHOLD` creates review tasks from unique inquiring accounts; zero disables this unapproved demand policy.
- `GET /workspace/assignments`; supervisor `POST` with `{officer_id,region_code,district_code?,ward_code?}`. `PATCH /workspace/assignments/{id}` with `{available?,active?}`: own availability or scoped supervisor control. Assignment/reassignment is audited. Target must independently hold an authorized Keycloak staff role.
- Supervisor `POST /workspace/changes/{id}/decision` with `{version,decision:"approve"|"reject"|"withdraw",title?,description?}`; approved content changes reset property verification for re-review.
- `GET /workspace/reports`: scoped listing counts. National administrator `GET /workspace/audit`: immutable history. No audit mutation endpoint; DB triggers also deny update/delete/truncate.
- National administrator `POST /workspace/geography`: `{kind:"region"|"district"|"ward",code,name,parent_code?}`. Import only from an approved source.

## Deals and owner-paid commissions

- Staff `POST /deals`: `{listing_id,customer_id,agreed_price}` for published sale/rental; `GET` lists own or scoped staff transactions.
- Staff `POST /deals/{id}/offers`: `{amount,reference}`; officer records mediated negotiation before a commission proposal exists.
- Staff `POST /deals/{id}/commission`: `{calculation:"fixed"|"percentage",rate_or_amount,basis_amount,basis_description,written_reference,due_date}`. Payer is always derived from property owner, never supplied by caller. No global percentage.
- Independent supervisor `POST /deals/{id}/commission/approve`: freezes agreement and returns invoice reference. Approved terms cannot be rewritten at the DB layer.
- Owner/scoped staff `GET /deals/{id}/commission`: due/paid/balance and approved terms.
- Finance/national admin `POST /deals/{id}/commission/payments`: `{amount,reference}` manually records reconciled owner commission receipts. Reference-idempotent, overpayment forbidden, immutable receipts. This does not collect sale/rent proceeds or call a payment provider.
- Staff `POST /deals/{id}/outcome` with `{status:"completed"|"cancelled",reference}`; completion requires approved commission. Finance `GET /deals/finance/report` gives scoped totals.

## Short-stay requests

- `GET /bookings/availability/{listing_id}` returns unavailable dates, no guest data.
- Owner `POST` same route with `{check_in,check_out,blocked}` for 1–90 nights. Cannot overwrite guest holds.
- Guest `POST /bookings` with `{listing_id,check_in,check_out,guests,idempotency_key}` opens a 15-minute operational hold. Replays match exact payload; mismatches/overlaps return 409. Row locks + unique unit/night records prevent double booking. Each listing currently represents one unit.
- `GET /bookings` only caller's requests; `POST /bookings/{id}/cancel` releases requested holds. Expired requests release availability when accessed; no automatic live confirmation/charge/refund. Scoped staff `GET /bookings/staff`.
- The current 15-minute TTL, 90-night range and 20-guest input ceiling are proposed operational limits, not approved commercial booking policies. No capacity inventory or fee/cancellation policy is implied.

## Media adapter

`POST /media/uploads` with `{listing_id,kind:"photo"|"property_document",content_type,size_bytes}` is owner-scoped and disabled by default. Supported quarantined files: JPEG/PNG/PDF up to 10 MiB. When explicitly configured, returns a 5-minute size/content-type-constrained private S3 upload POST and upload ID. `GET /media/uploads/{id}` only returns caller's status, never originals/read URLs. There is no public release path without malware/metadata validation and derivative approval; identity-document upload/access is not implemented yet.

## Sandbox callback contract

The sandbox is disabled unless `PAYMENT_SANDBOX_ENABLED=true` and a runtime `PAYMENT_SANDBOX_SIGNING_SECRET` is configured. It does not call an external provider, move money or confirm a booking.

`POST /payments/sandbox/intents` is account-scoped with `{booking_id,amount,idempotency_key}`. Its amount is explicitly test input, not an approved short-stay price/fee. Repeated identical requests return the original intent. Callbacks to `POST /payments/sandbox/webhook` use raw JSON `{event_id,intent_id,status:"succeeded"|"failed"}` and headers `X-Boma-Timestamp` (Unix seconds, within 5 minutes) and `X-Boma-Signature` (hex HMAC-SHA256 of `timestamp + "." + raw_body`). Unknown signatures fail closed; event IDs are persisted/idempotent, conflicting replays return 409, and terminal states cannot be reversed. A real contracted provider must supply its own verified signature, reconciliation, refund/settlement contract and sandbox tests before live enablement.
