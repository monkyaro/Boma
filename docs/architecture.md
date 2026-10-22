# Application architecture

## Existing repository

Preserve `frontend/` (Next.js), `backend/` (Flask/RESTX, SQLAlchemy, Alembic and Celery), `keycloak-theme/`, and `infrastructure/` (Terraform and production Compose). Existing CI has backend tests, migration checks, dependency/image scans and frontend checks. Do not rename working paths to match the proposed greenfield monorepo.

## Target boundaries

Browser/Expo -> Keycloak Authorization Code + PKCE -> Flask API -> PostgreSQL/PostGIS. Celery consumes Redis tasks for notifications, media validation and metrics. Private S3 stores originals/documents; only approved derivatives may reach a CDN. MapLibre receives approximate positions only. Start search with indexed PostgreSQL; no OpenSearch provisioning.

Keycloak owns authentication and approved role claims. Local identity cases track onboarding independently from property verification; opening a case grants no roles. All ownership, role, geographic and workflow guards execute server-side. Public DTOs explicitly exclude owner identifiers, contacts, identity records and precise coordinates. Verified listing edits will use transaction locks/version checks. Payment adapters stay disabled until policy approval.

Add Expo, shared API client and worker packaging in later milestones without breaking existing build contexts. Tanzania geography will be imported from an approved source with region/district/ward foreign keys; current text geography is legacy, not authoritative.

## Deployment boundary

Local services must use their own Compose project/network/volumes and loopback ports. Proposed staging: Ubuntu EC2/Compose, private RDS/PostGIS with isolated Keycloak database, private S3, instance roles, managed runtime secrets and backups. Existing infrastructure claims are unverified; inspect and reconcile before any Terraform plan or deployment. See aws-discovery.md. No infrastructure changes are authorized by these documents.
