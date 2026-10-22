# AWS preview deployed — 2026-10-22

BOMA preview: **https://bomahoop.com**. API readiness: **https://api.bomahoop.com/health/ready**. OIDC discovery: **https://auth.bomahoop.com/realms/boma/.well-known/openid-configuration**.

This is the owner-approved preview, not a public business launch. Registration, real payments, payment sandbox callbacks, physical viewing scheduling and media release remain disabled. No demo listings/accounts or fabricated Tanzania geography were imported. Provider onboarding, real staff MFA, dataset approval, business policies, remaining release implementation and security review are still tracked in ../release-status.md.

## Release and resources

- Existing account `282400617488`, region `eu-west-1`, EC2 `i-0b904532baab17f5f`, private RDS `boma-prod-db` reused. No new compute/database instance or DNS change.
- Runtime release tag `1d93d01e6616`, native ARM64 API/web images in existing ECR repositories `boma/api`, `boma/web`.
- Deployment files: `/opt/boma/releases/1d93d01e6616/deploy`; `/opt/boma/current` points there. Source archive, image scan reports, native build/check logs retained in versioned release directories.
- Pre-release snapshot `boma-prod-db-pre-release-1d93d01e6616-20261022` is available and retained.
- Managed JSON runtime secrets: `/boma/production/api`, `/boma/production/keycloak`, `/boma/production/compose`. Secret values are absent from Git and Terraform state. Host policy `boma-managed-runtime-secrets` reads only their exact ARNs. The temporary master-secret read permission was removed after bootstrap.
- App and Keycloak use separate PostgreSQL roles/databases with verified RDS TLS and mounted regional CA bundle. Schema migrations applied successfully; no existing application tables/roles were overwritten and no business rows were read for bootstrap.
- Certificate covers apex/www/api/auth/admin and expires 2027-01-20; certbot renewal service runs, with Nginx periodic reload. Certificate expiry alerting/restore drills remain release gates.
- Only Nginx publishes application ports 80/443; database, Redis, API, web, Keycloak and management port are private.

## Access and cleanup

Following the owner's direction to authenticate with the configured BOMA credentials, the IAM user was used only for bootstrap of a narrowly scoped, time-limited deployment role and its later cleanup. Provisioning used the assumed temporary deployment session. The deployment role/policy were deleted at completion, local temporary session credentials deleted, and the temporary ECR Docker login removed. The EC2 runtime uses its instance role; no workstation credentials were copied to the host.

No credentials were copied from chat into tools/configuration. Rotate the console credentials/access keys disclosed in chat through the account owner's secure AWS workflow; this deployment did not revoke user keys or affect the other accounts.

## Executed checks

- 46 backend tests passed natively on ARM64 in isolated disposable PostGIS/Redis containers, plus Ruff, scoped mypy, migration checks and pip-audit. Test containers/network removed.
- API and hardened web runtime images passed the existing HIGH/CRITICAL fixable-vulnerability scan gate. Published image filesystem layers match the scanned candidates. The initial web image's unused npm dependency vulnerabilities were removed from the runtime, not ignored.
- Web lint/typecheck/3 unit tests/production build and native 512 MiB web smoke checks passed. Preview banner is visible.
- Compose startup/health passed for Nginx, API, web, Redis, Keycloak and Celery worker; renewal and Celery beat services running.
- Public HTTPS web health 200; API DB/Redis readiness 200; BOMA/master OIDC discovery 200.
- Anonymous private session/identity routes return 401, Swagger 404, disabled sandbox callback 503.
- Browser silent SSO initialization and PKCE S256 redirect to the real Keycloak sign-in form pass without browser warnings. No real customer/staff account was created or used.
- Fixed proxy frame policy narrowly for OIDC helper pages: only BOMA-controlled origins may frame them; ordinary pages retain DENY. Access logs omit query strings/referrers to avoid authorization-code leakage.
- Terraform metadata-only secret/policy declarations formatted and validated using `init -backend=false`; no Terraform apply/import or production state mutation was performed.

## Operations

```sh
ssh -i ~/.ssh/boma boma@bomahoop.com
cd /opt/boma/current
docker compose -f compose.yaml -f compose.preview.yaml ps
```

Runtime configuration now comes from Secrets Manager via `infrastructure/scripts/render-secrets.py`, executed through the EC2 instance role. The legacy SSM-based `deploy.sh`/`render-env.sh` is not the correct redeployment path for this preview. Stage a new release, render its configuration privately, validate/scan it, then switch deliberately with rollback references preserved.

Keycloak admin remains restricted to the configured administrator IP. Its temporary bootstrap administrator is stored in the Keycloak managed secret; retrieve through the owner's secure AWS console/session, never chat/logs. Establish a permanent protected administrator and staff MFA before granting staff access; self-registration stays off until passwordless activation is integrated.

The Terraform additions describe only the three secret containers and exact host-read policy, never their values. Before a future apply, import the existing secret metadata into `aws_secretsmanager_secret.runtime["api"|"keycloak"|"compose"]` and the policy into `module.iam.aws_iam_role_policy.runtime_secrets[0]`; review all other drift. Do not apply a plan that tries to recreate unrelated infrastructure.

## Rollback

For application failure, stop only this release's Compose services, retain its files/images/volumes and preserve current DNS. This was a first deployment, so there is no previous working application release to switch to. Do not downgrade schemas or delete database/secret records automatically. The retained pre-release snapshot is the recovery point; any restore into another RDS instance needs a separately approved resource/cost plan. Keep the snapshot through owner validation.

Incremental spend remains within the approved low-usage allowance: three secrets, snapshot retention and minor image/log/API usage, with existing EC2/RDS unchanged. Actual bills vary with traffic/storage/burst credits; the estimate is not a spending cap.

## Web redesign release — 2026-10-22

- Web only: `boma/web:4c473a30aa2c` (commit `4c473a3`, branch `feat/frontend-redesign`). API, Keycloak, database and nginx unchanged (API still `1d93d01e6616`).
- Built natively on the host with `NEXT_PUBLIC_DEPLOYMENT_PREVIEW=true` from `/opt/boma/releases/4c473a30aa2c/source`; Trivy HIGH/CRITICAL fixable gate passed (`web-scan.log`). The image is local to the host and was not pushed to ECR.
- Switched by setting `WEB_TAG` in `/opt/boma/current/.env` and recreating only the `web` service; health check, nginx probe and public HTTPS checks passed.
- Rollback: `cp /opt/boma/current/.env.bak-before-web-4c473a30aa2c /opt/boma/current/.env && docker compose -f compose.yaml -f compose.preview.yaml up -d --no-deps web` (restores web `1d93d01e6616`).

## Geography manager fix — 2026-10-22

- Web only: `boma/web:c3aa9e7c16c3` (commit `c3aa9e7`), same host-build, Trivy gate and `WEB_TAG` switch as above; previous web `4c473a30aa2c`.
- Rollback: `cp /opt/boma/current/.env.bak-before-web-c3aa9e7c16c3 /opt/boma/current/.env && docker compose -f compose.yaml -f compose.preview.yaml up -d --no-deps web`.
