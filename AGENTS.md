# AGENTS.md — BOMA

BOMA is a real estate marketplace for property sales and rentals in Tanzania. This monorepo
holds the AWS infrastructure and the apps. Read the README in the folder you work in
before changing it.

| Folder | Stack | Read first |
|---|---|---|
| `backend/` | Python 3.12, Flask + Flask-RESTX, SQLAlchemy/Alembic, PostgreSQL 17 + PostGIS, Redis + Celery, Keycloak JWT | `backend/README.md` |
| `frontend/` | Next.js 16 (App Router, Cache Components), TypeScript, Tailwind 4, keycloak-js, React Query | `frontend/README.md`, `frontend/AGENTS.md` |
| `keycloak-theme/` | Keycloakify login theme `boma` (React, Vite) | `keycloak-theme/README.md` |
| `infrastructure/` | Terraform (AWS eu-west-1), Docker Compose on one EC2 host, scripts, docs | `infrastructure/docs/*.md` |

## Build and test

Run the checks for every folder you touch before you finish. CI runs the same checks on every pull request
(`.github/workflows/<app>.yml`).

```bash
# backend: tests need PostGIS and Redis on localhost (see backend/.env.test)
cd backend
docker compose -f docker-compose.dev.yml up -d postgres redis
docker compose -f docker-compose.dev.yml exec postgres createdb -U boma boma_test   # once
pip install -r requirements-dev.txt
python -m pytest -q
flask --app run db upgrade && flask --app run db check   # migrations must match models

# frontend
cd frontend
npm ci
npm run lint && npm run typecheck && npm test && npm run build

# keycloak-theme (needs Java 21 + Maven for the jar)
cd keycloak-theme
npm ci
npm run build-keycloak-theme
```

## Conventions

- **Backend features** go in one package per feature: `app/<feature>/<feature>_model.py`, `_schema.py` and `_api.py`. Each package exports a `Namespace`, imports its model in `app/model.py`, and registers in `app/__init__.py`. `app/listings/` is the example to copy.
- **Configuration** is read only from environment variables in `app/setting.py`. When you add a variable, also add it to `backend/.env.example`. Production values live in SSM Parameter Store (`/boma/production/api/*`), and a maintainer adds them there.
- **Migrations:** every model change ships with an Alembic migration from `flask --app run db migrate`. Review the generated file and commit it. Migrations run automatically when the API starts, so they must keep working with the previous release, which may be rolled back to. Never edit a migration that is already on `main`.
- **Geospatial data:** use PostGIS through GeoAlchemy2. Store coordinates as SRID 4326. Use only extensions that Amazon RDS supports.
- **Auth:** protect endpoints with `@flask_keycloak.require_token` plus a role check. Always enforce authorization in the API, never only in the UI. The frontend uses the authorization code flow with PKCE (`boma-web` client); never use the password grant.
- **Roles:** the target realm roles are `owner`, `buyer`, `tenant`, `guest`, `officer`, `regional_supervisor` and `national_admin`. The starter code still uses `agent`, so align it with these roles when you touch it.
- **Files:** media and documents go to S3 using presigned URLs. Identity documents (owner IDs, verification evidence) are never public and never get CORS. They are only served through the API with short-lived URLs.
- **Frontend:** this is Next.js 16 and it differs from older versions. Read `frontend/node_modules/next/dist/docs/` before changing framework-level code. Uncached server reads must render inside `<Suspense>`. `NEXT_PUBLIC_*` values are inlined at build time.
- **Containers:** they must stay stateless, with nothing important written to local disk. The goal is a later move to ECS Fargate.
- **Tests:** add or update them with every change. Keep the existing test style (`backend/tests/`, vitest in the frontend).
- **Code style:** match the code around you. Keep diffs focused; don't reformat or rename unrelated code.

## Hard rules

- Never commit secrets: `.env` files, keys, tokens, passwords or real personal data. Use `.env.example` with placeholder values.
- Don't run `terraform apply`, deploy scripts or AWS CLI commands that change anything. Infrastructure changes (`infrastructure/`) are proposals in a pull request, which a maintainer reviews, plans and applies.
- Don't weaken security to make something pass. That covers TLS, token validation, CORS, security headers, S3 public access blocks and the non-root containers.
- Don't add agentic AI or LLM features to BOMA.
- Don't add paid AWS services (OpenSearch, NAT Gateway, ALB, ECS and so on) without a maintainer's approval.
- Don't copy code, data or secrets from other projects (for example HOPE) beyond the patterns already adapted here.
- Work on a branch and open a pull request against `main`. Never push directly to `main`, which publishes images to ECR.

## Pull requests

- Keep each pull request to one concern, and say in the title which app it touches.
- In the description, list what changed, how you tested it, and any new environment variables, migrations or Keycloak changes the maintainer must make.
- CI must be green before review.

## Owner master specification (2026-10-22)

Read `docs/requirements.md`, `docs/decisions.md` and `docs/implementation-plan.md` for the owner-supplied `cod` specification. Preserve the existing directory layout. New listing drafts permit owners or local owner applicants, never the legacy `agent` role alone. Identity cases grant no Keycloak roles; officer review enforces geographic scoping, staff MFA and audit history. Treat existing infrastructure resource and budget statements as unverified until owner-authorized read-only discovery. Target runtime secrets are Secrets Manager/instance roles; existing SSM configuration requires a reviewed transition. Never inspect local credential files or production data as a shortcut to discovery.


## Expanded implementation

`docs/api.md` is the workflow contract; `docs/release-status.md` tracks unfinished release gates. Owner applicants may prepare drafts using their local identity case; approved cases authorize publishing without silent Keycloak role elevation. Staff MFA requires vetted `mfa` or both `pwd` and `otp`, never a primary OTP alone. Keep media/payment/push integrations fail-closed until tested configuration and required policies exist. Mobile is in `apps/mobile` (read its README); run typecheck and native bundle exports. Backend checks also include Ruff and strict mypy on the typed adapter contract. Do not bypass dependency-audit gates to obtain a green build.
