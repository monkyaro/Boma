# Approved AWS preview deployment — preparation status

Owner approved the costed plan in chat. Release activation remains pending authorized temporary deployment access; there has been no snapshot, database bootstrap/migration, IAM change, secret creation, ECR publication, DNS change or public service startup.

Completed on existing EC2 `i-0b904532baab17f5f`:

- Staged original source archive under `/opt/boma/releases/84f842dc26bc` and verified SHA256 `a33266ab7ff91533f029a4a70c723671188462c9a12cc56d6f609c5e0fe6a7a0`.
- Built native ARM64 API/web candidates. API passed the existing HIGH/CRITICAL fixable-vulnerability gate. Initial web candidate failed for three vulnerabilities in global npm dependencies.
- Committed runtime hardening/preview banner as `1d93d01e6616`; staged source under `/opt/boma/releases/1d93d01e6616`. Backend source is identical to the original tested release. The standalone runtime omits unused npm; no scan gate was bypassed.
- Candidate API image: `sha256:9ccc0acdbcda3fa797376288e41658f89056f935e1ea239892bacd43a0070384`.
- Candidate web image: `sha256:b625245df8286999c1b06a73bf9e349f30ae7cf43eb9eb5e1112540ba387da5e`.
- Both ARM64 candidates pass Trivy's HIGH/CRITICAL fixable-vulnerability gate (same severity/unfixed policy as existing CI). Scanner image pinned to `aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c`.
- Native backend validation on disposable PostgreSQL/PostGIS and Redis: **46 tests passed**, Ruff, scoped mypy, migration upgrade/drift and pip-audit passed. Disposable containers/network were removed. No production database was used.
- Native web smoke check under 512 MiB: health endpoint, visible preview banner and npm removal passed. Smoke container was removed; no running services remain.
- Local web lint/typecheck/3 unit tests/production build passed after hardening.
- Prepared Secrets Manager runtime renderer with strict instance-role validation, nonempty/valid-key/value checks, owner-only atomic output and suppressed secret/error values; exercised using synthetic secret responses, not actual credentials.

## Required access

Read-only discovery found only the IAM user profile `boma-hoop` and the EC2-only-trusted service role `boma-prod-app-host`. No deploy role trusting workstation sessions was found. The owner specification requires IAM Identity Center or temporary-role credentials for provisioning; the IAM user's permissions are not used to bootstrap an alternate role or silently weaken that requirement.

Configure an authorized Identity Center profile or assumable deployment-role ARN locally. Do not send credentials in chat. Once available, verify account/role, then execute the already approved snapshot/secrets/scoped-host-policy/bootstrap/publication/TLS plan. Any expanded resource or cost requirement returns for approval; the existing plan need not be re-approved.
