# AWS initial deployment approval plan

Prepared 2026-10-22T11:47:06.696450+00:00. Status: **approved and executed**. See [live preview deployment](live-preview.md) for actual resources, checks and cleanup. The preparation/discovery notes below are historical.

## Confirmed read-only discovery

- Account `282400617488`, region `eu-west-1`, non-root principal `arn:aws:iam::282400617488:user/hoop-boma-1` from configured profile `boma-hoop`. This is an IAM user; a temporary deployment role/session is required for writes under the owner specification.
- Existing EC2 `i-0b904532baab17f5f`, `t4g.large`, Ubuntu/aarch64, public address `54.195.168.146`, VPC `vpc-096f483431b466de4`, instance profile `boma-prod-app-host`. SSM Online. Trusted-hostname SSH works. Docker Compose v5.6.1; approximately 25 GiB root disk free. No running containers returned by docker ps.
- Existing private RDS `boma-prod-db`, PostgreSQL 17.11, `db.t4g.small`, 20 GiB, available, seven-day backups. No application rows, credentials or secret values were read.
- Existing ECR `boma/api`, `boma/web`, both empty.
- Existing Route 53 zone `Z0468528I0KL8ZKCOQT2`: apex, www, api, auth, admin A records already target `54.195.168.146`, TTL 300. No DNS change proposed.
- No SSM parameter metadata found under `/boma/production/`; no existing application runtime configuration assumed. Public HTTPS health probes did not succeed.
- Local build host supports amd64 only; native release images must be built/scanned on the existing ARM64 server or an authorized ARM builder.

## Proposed scope

Deploy an **initial preview**, not an approved public transaction service, at `https://bomahoop.com` with API/auth/admin subdomains already configured. Reuse existing compute, network, database, buckets and image repositories where metadata confirms compatibility. Do not create another EC2/RDS, change DNS, replace resources, access business rows, or enable live payments/registration.

Reviewable release source commit: `84f842dc26bc7d599098a655cfc60c6680b7bd3b`. Package this exact tree; exclude ignored local credential files, .git, node_modules and build caches. This source-built initial release is a proposed exception to the repository's existing main/CI-only artifact path because GitHub CLI is unauthenticated and ECR is empty. The owner must approve this exception; all existing server-side test/dependency/image-scan gates must still pass. Native ARM tests and image scans precede image publication/startup; no audit bypass.

## Changes requiring explicit approval

1. Use an authorized temporary deployment role/session with scoped ECR publishing, Secrets Manager creation/reading, RDS snapshot creation and narrowly scoped host-policy changes if required. Review the policy delta before applying; no administrator or root runtime credentials. The discovered IAM-user session is not treated as permission to perform writes.
2. Create a pre-release manual RDS snapshot and wait for availability. Retain it through validation; no deletion/pruning as part of this deployment.
3. Create three managed JSON runtime secrets, `/boma/production/api`, `/boma/production/keycloak`, `/boma/production/compose`; grant the existing host role read access only to these secret ARNs. Reuse the existing managed RDS administrator secret through an approved host-only bootstrap operation; never output credentials.
4. Bootstrap app and isolated Keycloak DB roles/schema/PostGIS only after checking metadata compatibility. No business row reads, destructive migrations, database replacement or data import. Apply reviewed Alembic schema migrations to BOMA only; stop on unexpected existing tables/revision history.
5. Build and scan native ARM64 API/web images from the pinned source; tag by source commit, publish to the existing BOMA ECR repositories. Do not push main or publish unrelated repositories. Retain previous image references if any appear during final preflight.
6. Update only `/opt/boma` deployment files, adapting runtime rendering to Secrets Manager and instance roles. No local .env or development realm secrets are uploaded. Configure production HTTPS URLs, CORS and private database TLS, while retaining disabled media/public release, physical scheduling, sandbox/live payments and provider-driven activation until separately configured/approved.
7. Start Compose services, obtain/renew TLS certificates for the existing five names, initialize an absent BOMA realm using production PKCE redirects and audience/MFA mapper definitions. Preserve any existing realms/users; do not enable self-registration or create demo identities/listings.
8. Validate web/API/Keycloak readiness over TLS, private port exposure, token validation and disabled sensitive features. Keep a visible preview status and prevent presenting the system as ready for real transactions.

## Monthly cost estimate and incremental spending

AWS Price List API queried during this session, EU (Ireland), on-demand, 730 hours/month:

| Existing item | Current compute rate | Estimated monthly |
|---|---|---|
| t4g.large Linux shared | $0.0736/hour | $53.73 |
| db.t4g.small PostgreSQL single-AZ | $0.035/hour | $25.55 |
| One public IPv4 | AWS published $0.005/hour | $3.65 |
| **Verified compute/IP subtotal** | | **$82.93** |

The RDS API also returned an unused-capacity-reservation price dimension; it is not an additional running-instance charge and is excluded. Existing storage, logs, S3/ECR, DNS, backup growth, burst credits, request volume and transfer are usage-dependent. Planning allowance for the existing stack is approximately **$95–125/month**, excluding tax and unusual traffic; this is not a billing forecast or hard cap. Historical repository claims of an approved $120 budget were not treated as owner approval.

New deployment allowance: three standard Secrets Manager secrets at AWS published $0.40/secret/month plus API usage, retained pre-release snapshot storage and small initial image/log/API usage: propose **up to $6/month incremental at low usage**, with actual usage billed. Native image builds consume existing EC2 compute; burst credits/CPU load may add usage charges. Any materially higher quote/required resource change returns for approval before proceeding.

Price references: https://aws.amazon.com/ec2/pricing/on-demand/ ; https://aws.amazon.com/rds/postgresql/pricing/ ; https://aws.amazon.com/vpc/pricing/ ; https://aws.amazon.com/secrets-manager/pricing/ . Compute figures above come from the actual Price List API query, not search snippets. Snapshot storage is covered by the conservative incremental allowance and depends on retained incremental backup volume; stop for approval if the verified quote exceeds that allowance.

## Rollback

- Record the initial host/file/container/image state before changes; currently no running application containers have been observed.
- Stage deployment files under a new versioned directory and preserve any existing `/opt/boma` files; no rsync --delete over unknown files.
- If first deployment fails, stop only containers created by this release, restore previous deployment files/tags if present, and leave DNS unchanged. Do not prune images or delete unrelated volumes.
- Keep the RDS snapshot; do not downgrade or overwrite database contents automatically. If schema/data recovery is needed, restore to a separate RDS instance only under a separately approved costed recovery plan; preserve the original.
- Retain secret versions and scoped permissions for diagnosis/rollback; no secret deletion/rotation without a reviewed reason.

## Approval required

Approve the existing-resource preview scope, up to $6/month initial incremental allowance, snapshot/schema bootstrap, the three secret resources and scoped host-role permission changes, TLS issuance, and native source-build release exception. Also identify the authorized temporary AWS role/Identity Center session mechanism (profile or role ARN, never credentials in chat). This approval does not approve a public business launch, live payments, DNS changes or provisioning additional compute/databases.


## Post-approval preparation

The source archive was staged under `/opt/boma/releases/84f842dc26bc`; its SHA256 matched the local archive. Native API and web images were built. Trivy v0.76 identified no gated findings in the API image and three fixable HIGH findings in unused global npm dependencies in the web runtime (`brace-expansion` and `undici`). A release hardening change removes unused npm from the standalone runtime and adds the required visible preview banner; re-run web checks/native scan before release. The application behavior change is limited to preview labeling; payment/registration restrictions remain enabled.

Only the existing EC2 service role was found, with EC2-only trust. No BOMA temporary workstation deployment role/Identity Center profile is currently available. Do not bootstrap IAM through long-lived user credentials or grant the host role self-escalation. Owner was asked to configure a temporary deployment session while build/test preparation continues.
