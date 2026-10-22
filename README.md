# BOMA

BOMA Real Estate Marketplace (Tanzania), as a monorepo:

| Folder | What | Docs |
|---|---|---|
| `infrastructure/` | AWS (EC2 + Docker, RDS PostgreSQL/PostGIS, S3, ECR, Route 53, CloudWatch) with Terraform | below |
| `backend/` | Flask + Flask-RESTX API, Celery, Keycloak JWT | [backend/README.md](backend/README.md) |
| `frontend/` | Next.js 16 web app | [frontend/README.md](frontend/README.md) |
| `keycloak-theme/` | Keycloakify login theme `boma` | [keycloak-theme/README.md](keycloak-theme/README.md) |

CI lives in `.github/workflows/`: one workflow per app, triggered only by changes in its folder.

## Infrastructure

- Region: `eu-west-1`
- Environment: `production` (`infrastructure/terraform/environments/production`)
- State: S3 backend `boma-tfstate-282400617488-euw1` with native locking

### Usage

```bash
cd infrastructure/terraform/environments/production
terraform init
terraform plan -out=prod.tfplan   # review before applying
terraform apply prod.tfplan
```

Requires the `boma-hoop` AWS CLI profile. Never commit `*.tfvars`, `.env` files or keys.

### Layout

- `infrastructure/terraform/modules/` – network, security, iam, ec2, rds, s3, ecr, dns, monitoring
- `infrastructure/scripts/bootstrap.sh` – EC2 user data (Docker, CloudWatch agent, ufw, chrony, auto-updates; SSH disabled, admin via SSM)
- `infrastructure/docker/`, `infrastructure/docs/` – next stage
