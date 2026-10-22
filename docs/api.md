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
- National administrator `POST /workspace/geography`: `{kind:"region"|"district"|"ward",name,parent_code?,code?}`. Import only from an approved source. Districts require a region `parent_code`, wards a district. When `code` is omitted it is generated sequentially: regions `01`, `02`…; districts `<region code>01`…; wards `<district code>01`…. Returns `201 {code}`; duplicate code or name within the parent `409`.
- National administrator `PATCH /workspace/geography/<kind>/<code>`: `{name}` renames an entry (codes never change). Region and district renames also update the display names stored on listings. Audited as `geography.rename`; unknown entry `404`, duplicate name within the parent `409`.
- National administrator `GET /staff`: everyone holding a staff role (`officer`, `regional_supervisor`, `finance`, `support`, `national_admin`) with `{user_id,email,first_name,last_name,enabled,setup_pending,roles,assignments}`.
- National administrator `POST /staff`: `{email,first_name,last_name,role:"officer"|"regional_supervisor"|"finance"|"support",region_code?,district_code?,ward_code?}` creates a Keycloak account with that single role and required actions verify email, set password and configure an authenticator app, then emails the setup link (3 days). Officers and supervisors require a valid region (optional district/ward) and get an officer assignment in the same request; other roles take no area. `national_admin` cannot be granted here (operator script only). Returns `201 {user_id,invite_sent}`; existing email `409`; a failed role grant removes the new account (`502`). Audited `staff.create`.
- National administrator `PATCH /staff/<user_id>`: `{enabled}` deactivates (signs the user out, marks their assignments inactive) or reactivates (marks them active). `POST /staff/<user_id>/invitation` resends the setup email. Both refuse national administrators and the caller's own account (`403`) and non-staff accounts (`404`). Audited `staff.disable`/`staff.enable`/`staff.invite`.
- Staff endpoints return `503` until `KEYCLOAK_ADMIN_URL` and `KEYCLOAK_ADMIN_CLIENT_SECRET` are configured (`infrastructure/scripts/keycloak-admin-api-client.sh` creates the `boma-admin-api` service-account client).
