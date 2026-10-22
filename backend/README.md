# BOMA backend

REST API for the BOMA Real Estate Marketplace: Flask + Flask-RESTX, PostgreSQL/PostGIS,
Redis + Celery, Keycloak auth. Structure follows the HOPE backend (`create_app()` returning
`(app, celery)`, one package per feature with `*_api.py` / `*_model.py` / `*_schema.py`).

## Layout

- `run.py` – WSGI entry (`run:app`) and Celery app (`run.celery`)
- `app/__init__.py` – app factory, namespace registration, Swagger protection
- `app/setting.py` – all config, read from environment variables
- `app/utilities/keycloak_jwt.py` – `require_token`, `check_realm_access`, `check_resource_access`
- `app/health/` – `/health/live`, `/health/ready` (DB + Redis) for Nginx / CloudWatch checks
- `app/listings/` – starter feature: property listings with a PostGIS location
- `migrations/` – Alembic (Flask-Migrate), PostGIS-aware

## Local development

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
docker compose -f docker-compose.dev.yml exec api flask --app run db upgrade
# API on http://localhost:8000, Swagger on /swagger (basic auth from .env)
```

Tests need PostGIS and Redis on localhost (see `.env.test`):

```bash
docker compose -f docker-compose.dev.yml up -d postgres redis
docker compose -f docker-compose.dev.yml exec postgres createdb -U boma boma_test
pip install -r requirements-dev.txt && python -m pytest
```

## Adding a feature

1. `app/<feature>/<feature>_model.py`, `_schema.py`, `_api.py` (a `Namespace`)
2. Import the model in `app/model.py`, register the namespace in `app/__init__.py`
3. `flask --app run db migrate -m "..."`, review the file, commit it

Protect endpoints with `@flask_keycloak.require_token`, then `@flask_keycloak.check_realm_access("agent")`.
The caller is in `g.user` / `g.token`.

## CI/CD

`.github/workflows/backend.yml` (repo root): tests + migration drift check + `pip-audit` on every PR;
on `main` it builds a `linux/arm64` image, scans it with Trivy and pushes it to ECR `boma/api`
(tag = commit SHA) through GitHub OIDC. Needs the repo variable `AWS_ECR_PUSH_ROLE_ARN`.

The container runs as a non-root user, applies migrations on start, and serves gunicorn on port 8000.
Never commit `.env` files or keys.
