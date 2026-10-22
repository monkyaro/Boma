# Foundation increment — 2026-10-22

Implemented requirements/architecture/decision/implementation documents, isolated local Compose and CI configuration validation, initial owner identity case submission/read with database uniqueness and status constraints, owner-only draft creation and public owner-ID exclusion. Existing paths and production infrastructure are preserved.

Verified locally:

- 15 pytest integration tests pass against isolated PostGIS/Redis, including authentication/role denials, account-scoped cases, rejected self-approval, duplicate/concurrent submission and public privacy fields.
- Migration upgrade, disposable-database downgrade/re-upgrade and Alembic model drift checks pass.
- Compose configuration validation and git whitespace checks pass.
- API `/health/ready` returns database/Redis OK at `http://localhost:8100`.
- Existing Flask-RESTX emits two jsonschema deprecation warnings.

A repeat-run fixture defect was corrected: test cleanup now removes the Alembic marker along with test tables, with a guard requiring database name `boma_test`.

Not claimed complete: full Milestone A security/tooling coverage, authoritative geography, passwordless Keycloak/provider setup, staff MFA and geographic assignments, identity decision auditing, frontend onboarding, or production readiness. Next increment should establish geography/assignment and audited review before enabling officer decisions. Customer submission never grants owner privileges. Payment/short-stay/viewing/legal decisions are tracked in decisions.md.

No AWS calls, provisioning, DNS/IAM changes or production data access occurred. Existing AWS resource/cost assertions remain unverified; discovery and a costed owner-approved plan precede deployment. GitHub CLI is unauthenticated, so a remote PR could not be opened in this session.

Run instructions and API examples: local-development.md. The isolated local stack is running; stop it using `docker compose -f compose.dev.yaml down` without deleting volumes.
