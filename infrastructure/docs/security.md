> Current AWS preview deployment uses Secrets Manager, verified RDS TLS and versioned release files. See [the deployment record](../../docs/deployment/live-preview.md); legacy SSM-based deployment commands below are not the current preview path.

# Security

## Access

| Who / what | How | Limits |
|---|---|---|
| Administrators (AWS) | IAM user `hoop-boma-1`, CLI profile `boma-hoop` | The root account is not used. Enable MFA on the IAM user if it is not already on. |
| Administrators (host) | SSM Session Manager (preferred) or SSH `boma@bomahoop.com` | SSH is key-only, from `54.72.97.232/32` only, through both the SG and ufw. No root login, no password auth. The `ubuntu` user has been removed. |
| Keycloak admin console | `https://auth.bomahoop.com/admin/` | nginx allows only the admin IP. The management port 9000 is never exposed. |
| App host (instance role) | `boma-prod-app-host` | SSM core, CloudWatch agent, ECR read-only, S3 object access to the 3 BOMA buckets, read on `/boma/production/*` parameters, SES send only from `@bomahoop.com`, writes to its own log group |
| CI | GitHub OIDC (planned) | Push to ECR only. No long-lived keys. |

## Network

- Only 80 and 443 are open to the internet. Port 80 serves ACME challenges and redirects everything else to HTTPS.
- PostgreSQL (RDS) is in private subnets with no internet route. Its security group admits only the app host's security group on port 5432.
- Redis, Keycloak, the API, the web app and the Docker daemon publish no host ports. Only nginx binds 80/443.
- The default VPC security group has no rules.

## Encryption

| Data | At rest | In transit |
|---|---|---|
| EBS root volume | Encrypted (AWS managed key) | — |
| RDS | `storage_encrypted`, encrypted snapshots | `rds.force_ssl=1`; clients use `sslmode=require` |
| S3 buckets | SSE-S3 with bucket keys | Bucket policies deny non-TLS requests |
| Public traffic | — | TLS 1.2/1.3 (Mozilla intermediate), HSTS, OCSP stapling |
| Secrets | SSM SecureString (`aws/ssm` key), Secrets Manager | AWS API over TLS |

## Secrets

- RDS manages the master password in Secrets Manager. It never appears in Terraform state or variables.
- `init-params.sh` generates the app secrets with `openssl rand` and writes them to SSM. Nothing is printed. Values travel in a temporary file with mode 600, not in command arguments.
- On the host, `render-env.sh` writes `.env`, `api.env` and `keycloak.env` with mode 600 in `/opt/boma`. `deploy.sh` never syncs those files, and `.gitignore` excludes them.
- `db-init.sh` and `restore.sh` send database passwords to psql over SSH stdin, never in argv.
- Rotation: delete the parameter, run `init-params.sh` (and `db-init.sh` for DB passwords), then deploy.

## Application

- Keycloak uses the authorization code flow with PKCE for web and mobile. The password grant is disabled. The API verifies tokens locally against the realm's JWKS, checks `aud=boma-api`, and enforces roles server-side.
- Swagger UI is off in production. When it is enabled, it sits behind basic auth.
- Identity documents live in a separate bucket with no CORS. Access goes through the API only, using short-lived presigned URLs (10 minutes).
- All 4 S3 public access blocks are on, plus BucketOwnerEnforced. Nothing is public.
- Containers run with `no-new-privileges`, CPU and memory limits, and non-root users (api uid 10001, web `node`).
- nginx sets HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy` and `Permissions-Policy`. It also rate-limits the API (20 r/s per IP) and the auth endpoints (10 r/s per IP).

## Host hardening (bootstrap.sh)

- Unattended security upgrades are enabled. There are no automatic reboots; reboot in a maintenance window.
- chrony uses the Amazon Time Sync Service.
- ufw denies all incoming traffic except 80, 443 and SSH from the admin IP.
- IMDSv2 is required. The hop limit is 2, so containers can use the instance role.
- Container logs go to CloudWatch. The journal and logrotate handle host logs.

## Audit and detection

- CloudTrail covers all regions, management events, with log file validation. Logs go to an encrypted S3 bucket: 90 days, then Glacier IR, expiring after 2 years.
- CloudWatch alarms (CPU, memory, disk, RDS, status checks) notify through SNS to `admin.hoop@gmail.com`.
- The AWS Budget alerts at 80% actual and 100% forecast of $120. Alerts do not stop spending.

## Known gaps / next steps

- SSL expiry monitoring: certbot renews automatically, but no alarm fires yet if renewal fails. Planned: a daily host check that publishes a `cert_days_left` metric, with an alarm below 14 days.
- Clients use `sslmode=require` (encrypted but unverified). Moving to `verify-full` means shipping the RDS CA bundle in the images.
- fail2ban is not installed. With SSH limited to a single IP it adds little; reconsider if SSH is ever opened wider.
- There is no WAF. Consider CloudFront plus WAF when traffic grows.
- Production and development separation: only production exists by decision. A future dev environment gets its own Terraform environment, VPC and SSM prefix (`/boma/development`).
