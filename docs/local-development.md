# Local development

From repository root:

```sh
python3 local/init.py
docker compose -f compose.dev.yaml up -d --build
curl http://localhost:8100/health/ready
# Create the disposable test database once:
docker compose -f compose.dev.yaml exec postgres createdb -U boma boma_test
# Integration tests and migration drift:
docker compose -f compose.dev.yaml --profile test run --rm tests
# Stop without deleting data:
docker compose -f compose.dev.yaml down
```

Web: http://localhost:3000. API: http://localhost:8100. Local Keycloak: http://localhost:8180 (admin username `local-admin`; randomly generated local password stays in ignored `.env`). Do not print/share the password or reuse local credentials in production. `local/init.py` creates owner-readable credentials without overwriting an existing file. Existing Keycloak databases retain their initial credentials; changing `.env` does not reset them.

This Compose project has separate networks/volumes from other host applications. Databases/Redis are internal-only and published app ports bind loopback. Keycloak has its own PostgreSQL database. Browser issuer uses localhost while the API fetches JWKS over the private Compose network; issuer validation is unchanged. Local development uses HTTP loopback only; deployed environments require HTTPS and reviewed hostnames.

The realm blueprint defines public PKCE clients, audience and AMR mappers, role names and no bundled users. It initializes a missing realm; modifying the import file does not overwrite an existing realm. Staff authentication flows/MFA and development accounts need explicit local identity administration. Self-registration is disabled until the passwordless provider integration is supplied/tested (authentication.md). No production realm, account, secret or data is contacted.

Production data is not seeded. Load approved Tanzania geography via national-admin workflows, then onboard accounts/properties normally. Tests use isolated synthetic geography and properties in `boma_test`; those fixtures are never displayed as real listings.

## App checks

```sh
cd frontend
npm ci
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Browser tests mock public API responses; they exercise search, verification disclosure and failure states. Backend tests separately enforce role, geography, privacy, state transitions and concurrency. Real provider login/registration/MFA and physical-device push remain release gates.

```sh
cd apps/mobile
npm ci
npm run typecheck
npx expo export --platform android --platform ios --output-dir dist
npx expo start
```

See apps/mobile/README.md for native redirect/network configuration. No APK/IPA, app-store submission or physical-device execution is claimed by a JS bundle export.

## Rollback

Revert the matching code commits for application rollback; do not downgrade production data by default. All five new migrations have forward/backward steps. On the empty disposable `boma_test` database, downgrade to `c9b41f686e67`, then upgrade/check again to test the complete rollback chain. This removes workflow/media/device/sandbox data and must never run on production. Audit and financial history is deliberately immutable in normal operation; test fixtures may drop only the guarded disposable test schema.
