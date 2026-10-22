> Current AWS preview deployment uses Secrets Manager, verified RDS TLS and versioned release files. See [the deployment record](../../docs/deployment/live-preview.md); legacy SSM-based deployment commands below are not the current preview path.

# Deployment

Everything here runs from the admin workstation (`54.72.97.232`, AWS profile `boma-hoop`,
SSH key `~/.ssh/boma`). The host is `boma@bomahoop.com`, and the app directory is `/opt/boma`.

## 1. Infrastructure (Terraform)

```bash
cd infrastructure/terraform/environments/production
terraform init
terraform plan -out=prod.tfplan     # show the plan and get approval before applying
terraform apply prod.tfplan
```

## 2. One-time setup

Run these in order. Each step is idempotent.

| Step | Command | Result |
|---|---|---|
| Configuration and secrets | `infrastructure/scripts/init-params.sh` | `/boma/production/{compose,api,keycloak,db}/*` in SSM. Secrets are generated and never printed. |
| Database | `infrastructure/scripts/db-init.sh` | Roles `boma_app` and `keycloak`, database `keycloak`, PostGIS in `boma` |
| Images | Push to `main` (CI) | `boma/api:<sha>` and `boma/web:<sha>` in ECR |
| Theme | Keycloak theme workflow artifact | `keycloak-theme-for-kc-all-other-versions.jar` |

> **Superseded:** runtime configuration and secrets now live in Secrets Manager as the JSON secrets
> `/boma/production/api`, `/boma/production/keycloak` and `/boma/production/compose`, rendered on the host by
> `infrastructure/scripts/render-secrets.py`. The SSM steps below are legacy; see
> [live-preview.md](../../docs/deployment/live-preview.md) for the current redeployment path.

To change a setting, edit the parameter, then redeploy (step 3). `render-env.sh` picks up the new value.

```bash
aws --profile boma-hoop --region eu-west-1 ssm put-parameter --overwrite \
  --name /boma/production/api/CORS_ORIGINS --type String --value 'https://bomahoop.com,https://admin.bomahoop.com'
```

## 3. Deploy a release

```bash
infrastructure/scripts/deploy.sh --api-tag <sha> --web-tag <sha> [--theme path/to/theme.jar]
```

If you leave out a tag, the currently deployed version of that app is kept. The script:

1. Checks that the tags exist in ECR. Only tested, scanned images from `main` are there.
2. Uses rsync to copy `infrastructure/docker/` to `/opt/boma` (env files and jars are never copied), then runs `render-env.sh` on the host.
3. On the first run, it gets the Let's Encrypt certificate with certbot in standalone mode.
4. Runs `docker compose pull` and `up -d --wait`. This waits for every container health check.
5. Probes `https://bomahoop.com/healthz`, `https://api.bomahoop.com/health/ready` and the Keycloak discovery URL through nginx on the host.
6. On any failure, it restores the previous tags, starts them, and exits non-zero.
7. Prints the public status codes as seen from the workstation.

The API container runs `flask db upgrade` before gunicorn starts. Migrations must be backward
compatible with the previous release, so that a rollback still works. Take a snapshot first:
`infrastructure/scripts/backup.sh pre-release`.

Containers are recreated in place, which causes a few seconds of downtime per release. That is acceptable at the current scale.

## 4. Keycloak first login

The admin console is at `https://auth.bomahoop.com/admin/` (realm `master`). While bomahoop.com is a test
environment it is open to all IPs; restore the nginx allow list before go-live (see [security.md](security.md)).
Sign in with:

- user `bootstrap-admin`
- password: key `KC_BOOTSTRAP_ADMIN_PASSWORD` of the Secrets Manager secret `/boma/production/keycloak`

```bash
aws --profile boma-hoop --region eu-west-1 secretsmanager get-secret-value --secret-id /boma/production/keycloak \
  --query SecretString --output text | jq -r .KC_BOOTSTRAP_ADMIN_PASSWORD
```

Then:

1. Create a permanent admin user and delete `bootstrap-admin`.
2. Create realm `boma`, set its login theme to `boma`, and enable brute-force detection.
3. Create client `boma-web`: public, standard flow only, PKCE S256. Redirect URIs `https://bomahoop.com/*` and `https://admin.bomahoop.com/*`; web origins the same.
4. Create client `boma-api`: bearer-only (no flows). Add an audience mapper on `boma-web` so access tokens carry `aud=boma-api`.
5. Create realm roles `owner`, `buyer`, `tenant`, `guest`, `officer`, `regional_supervisor` and `national_admin`.
6. Disable direct access grants (the password grant) on every client.
7. Set SMTP to SES (`email-smtp.eu-west-1.amazonaws.com`, from `no-reply@bomahoop.com`).

Export the realm afterwards (`Realm settings → Action → Partial export`) and keep it out of Git
if it contains secrets.

## 5. Day-to-day operations

```bash
ssh -i ~/.ssh/boma boma@bomahoop.com                    # or: aws ssm start-session --target i-0b904532baab17f5f
cd /opt/boma && docker compose ps                       # status and health
docker compose logs -f --tail=100 api                   # also in CloudWatch /boma/production/containers
docker compose restart celery-worker
docker compose exec api flask --app run db current
```

## 6. CI/CD status

- **Done:** the backend, frontend and keycloak-theme workflows test the code, run security scans (pip-audit, npm audit, Trivy), and build arm64 images.
- **Missing:** pushing images to ECR needs a GitHub OIDC role. Terraform does not have it yet, and the `AWS_ECR_PUSH_ROLE_ARN` repository variable must be set to its ARN.
- **Missing:** an automated deploy job. Planned as a manual-approval GitHub environment `production` that runs the same steps through SSM Run Command. Until then, run `deploy.sh` from the workstation.
