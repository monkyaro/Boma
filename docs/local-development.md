# Isolated local development

Run from the repository root. Docker/Compose is required. This configuration does not read AWS credentials or contact production services. PostgreSQL/Redis are internal-only; the API binds loopback port 8100. Its project name and volumes are separate from other applications on this host. Credentials in this file are disposable local defaults.

```sh
docker compose -f compose.dev.yaml up -d --build postgres redis api worker
curl http://localhost:8100/health/ready
# Create a disposable test database once, then run integration tests and migration drift checks:
docker compose -f compose.dev.yaml exec postgres createdb -U boma boma_test
docker compose -f compose.dev.yaml --profile test run --rm tests
# Stop without deleting persisted data:
docker compose -f compose.dev.yaml down
```

The API container entrypoint applies migrations before serving. No Keycloak realm or delivery provider is configured automatically: authenticated local calls require a separately configured development Keycloak with issuer/audience matching the API. Tests mock JWT decoding only; no production credentials are needed. Staff approval, passwordless adapters, public publishing, UI onboarding and push integrations remain future increments. The existing frontend retains its own development instructions; do not point it at production to test these APIs.

## Initial owner onboarding contract

Send a valid bearer access token with the approved API audience. Existing accounts of any customer role can request verification; owner privileges require a later audited approval flow.

```http
POST /onboarding/owner-identity
Authorization: Bearer <development-token>
Content-Type: application/json

{}
```

Returns 201 with `case_id`, `status: pending`, `created_at`; repeats return 200 with the same case. `GET /onboarding/owner-identity` returns only the current account's case or 404. Both require authentication (401). Payloads specifying identity, status or roles fail (400). No staff decision endpoint is exposed. Owners can still create drafts via `POST /listings`; buyer and legacy agent tokens receive 403. Public listing results omit owner IDs and exact location.

For local migration rollback on a disposable database only: `flask --app run db downgrade d37dde63a5f3`. This drops identity cases. Production records must be preserved; rollback there needs an approved migration plan.
