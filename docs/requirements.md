# BOMA requirements

Source: owner-supplied `../cod` (2026-10-22). This document governs new work; legacy infrastructure descriptions are not evidence of owner approval or deployed state.

## Confirmed rules

- Tanzania-only sales, long-term rentals and short stays; TZS, East Africa Time, future Swahili/English.
- All communication, viewings and negotiation pass through authorized BOMA staff. No owner contact or precise coordinates in public responses.
- One account can hold multiple approved roles. Customer registration needs no officer verification; owner identity approval is required to publish, but drafts are allowed while pending.
- Owner identity approval and property verification are separate. Published properties can be UNVERIFIED. Owners may change unverified listings; verified listing changes require staff approval and audit history.
- Listings are free. Sales/rental commissions are negotiated per deal and paid by owners. No invented short-stay fees or live payouts.
- Assign officers by region/district/ward with workload, reassignment and audit history. Separate owner residence from property location.
- Demand-driven property review uses configurable criteria; staff decide verification. Booking concurrency, payment idempotency and protected uploads are mandatory.
- Primary communications: in-app and push. Email/WhatsApp activation uses approved adapters; no assumed provider availability.
- Staff MFA, least privilege, privacy, retention, audit logs and legal review are required before launch.

## Initial acceptance criteria

- Existing starter code remains runnable; documented local services are isolated from other host projects.
- Owner tokens or accounts with local owner-onboarding cases may prepare drafts; neither legacy agent roles nor an application grants staff privileges. Publishing requires approved identity.
- Anonymous listing responses omit owner identifiers and exact coordinates.
- Authenticated accounts may request owner verification without creating a duplicate account or granting themselves owner privileges. Repeated requests return the same pending case.
- Identity review/approval is unavailable until geographic assignments, MFA assurance and immutable decision auditing exist.
- CI tests allowed and forbidden requests; migration upgrade, downgrade and drift checks pass locally.

Remaining modules and acceptance criteria follow milestones in implementation-plan.md.
