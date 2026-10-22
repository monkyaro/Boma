# BOMA architecture (production)

Single AWS account `282400617488`, region **eu-west-1** (Ireland), one environment: **production**.
All infrastructure is Terraform (`terraform/environments/production`), state in S3
`boma-tfstate-282400617488-euw1` with native locking.

## Diagram

```
                         Internet (users, mobile app, Let's Encrypt)
                                         │
                Route 53 zone bomahoop.com (Z0468528I0KL8ZKCOQT2)
        bomahoop.com · www · admin · api · auth  ──►  A  54.195.168.146 (Elastic IP)
                                         │ 80/443 only (+22 from 54.72.97.232)
┌──────────────────────────── VPC boma-prod 10.20.0.0/16 ─────────────────────────────┐
│  public subnets 10.20.0.0/24 (1a), 10.20.1.0/24 (1b)        route 0.0.0.0/0 → IGW   │
│  ┌───────────────── EC2 boma-prod-app-01  t4g.large · Ubuntu 24.04 arm64 ────────┐  │
│  │ SG app: 80, 443 from anywhere; 22 from admin IP · ufw · IMDSv2 · SSM agent     │  │
│  │ Docker Compose project "boma" (/opt/boma):                                     │  │
│  │                                                                                │  │
│  │   nginx :80/:443 ──┬── bomahoop.com, admin. ──►  web (Next.js :3000)           │  │
│  │   (TLS, headers,   ├── api.             ──────►  api (Flask/gunicorn :8000)    │  │
│  │    rate limits)    └── auth. /realms /resources ► keycloak (:8080, mgmt :9000) │  │
│  │   certbot (renew)                                 │        │                   │  │
│  │                      celery-worker, celery-beat ──┴► redis (broker, internal)  │  │
│  └───────────────┬─────────────────────────────────────────────┬────────────────┘  │
│                  │ 5432, TLS required (SG app → SG db)         │ S3 gateway endpoint│
│  private subnets 10.20.10.0/24 (1a), 10.20.11.0/24 (1b)   no internet route         │
│  ┌──────────────────────────────────────────────┐              │                    │
│  │ RDS boma-prod-db  PostgreSQL 17 + PostGIS    │              │                    │
│  │ db.t4g.small, gp3 20→100 GB, encrypted       │              │                    │
│  │ databases: boma (boma_app), keycloak         │              │                    │
│  └──────────────────────────────────────────────┘              │                    │
└────────────────────────────────────────────────────────────────┼────────────────────┘
                                                                 ▼
  S3 (private, encrypted, versioned): boma-prod-media-…, -documents-…, -identity-…
  ECR boma/api, boma/web · SSM Parameter Store /boma/production/* · Secrets Manager (RDS master)
  CloudWatch logs /boma/production/containers, alarms → SNS → admin.hoop@gmail.com
  CloudTrail (all regions) · AWS Budget $120/month · SES (bomahoop.com, DKIM/SPF/DMARC)
```

## Components

| Concern | Choice | Where |
|---|---|---|
| Network | Dedicated VPC, 2 AZs, public + private subnets, no NAT Gateway, free S3 gateway endpoint | `modules/network` |
| Compute | One EC2 t4g.large (2 vCPU, 8 GiB, Graviton), 30 GB gp3 encrypted, termination protection, auto-recover alarm | `modules/ec2`, `scripts/bootstrap.sh` |
| Containers | Docker Compose: nginx, certbot, web, api, celery-worker, celery-beat, keycloak, redis | `docker/compose.yaml` |
| Database | RDS PostgreSQL 17 single-AZ, PostGIS, `rds.force_ssl=1`, 7-day PITR | `modules/rds`, `scripts/db-init.sh` |
| Auth | Keycloak 26 on the same host, DB in RDS, theme `boma` from `keycloak-theme/` | `docker/compose.yaml` |
| TLS | Let's Encrypt (one certificate for 5 names) on nginx, renewed by certbot every 12 h | `docker/nginx` |
| Files | 3 private S3 buckets; browsers upload with presigned URLs; identity bucket API-only | `modules/s3` |
| Secrets | SSM Parameter Store SecureString (app), Secrets Manager (RDS master, managed by RDS) | `scripts/init-params.sh` |
| Images | ECR, immutable tags = git SHA, scan on push, keep 30 | `modules/ecr` |
| Monitoring | CloudWatch agent (memory, disk), alarms, container logs (30 days), CloudTrail, Budget | `modules/monitoring` |
| DNS / email | Records in the existing zone; SES domain identity | `modules/dns` |

### Hostnames

| Host | Serves |
|---|---|
| `bomahoop.com` | Public website (Next.js) |
| `www.bomahoop.com` | 301 to the apex |
| `admin.bomahoop.com` | Administrative dashboard (same Next.js app) |
| `api.bomahoop.com` | REST API (`/health/live`, `/health/ready`, Swagger off) |
| `auth.bomahoop.com` | Keycloak realm `boma`; `/admin/` only from the admin IP |

### Outbound connectivity

The app host sits in a public subnet with an Elastic IP and reaches the internet directly
(OS updates, ECR, Let's Encrypt, SES, FCM, SSM). S3 traffic uses the gateway endpoint.
RDS has no route to the internet and needs none. A NAT Gateway (~$35/month plus data) is
avoided; it becomes necessary only if the app moves to private subnets (e.g. Fargate).

### Memory budget on t4g.large (8 GiB)

| Service | Limit |
|---|---|
| keycloak | 1.5 GiB |
| api (3 gunicorn workers) | 1 GiB |
| celery-worker (concurrency 2) | 768 MiB |
| web | 512 MiB |
| redis (maxmemory 200 MB) | 256 MiB |
| celery-beat | 256 MiB |
| nginx, certbot | 128 MiB each |
| **Total limits** | **≈ 4.5 GiB**, leaving room for the OS, Docker and page cache |

## Future ECS Fargate migration

The design already keeps the containers stateless:

- Images are in ECR and configuration comes from SSM, which ECS task definitions read natively (`secrets`).
- PostgreSQL is RDS and files are in S3. Redis holds only broker and cache data (ElastiCache when migrating).
- Nothing important is stored in container volumes. The only volumes are the certificate and ACME webroot, which ACM on an ALB replaces.

Migration outline (not provisioned now):

1. Add private app subnets with a NAT Gateway or VPC endpoints (ECR, SSM, Logs, STS).
2. Add an ALB with an ACM certificate for the same hostnames. nginx goes away; its security headers move to the apps or to CloudFront.
3. Add an ECS cluster with one service each for web, api, celery-worker, celery-beat (1 task) and keycloak (with a `start --optimized` image). Add ElastiCache Redis.
4. Use a new `modules/ecs`. The network, rds, s3, ecr, iam and dns modules are reused, and the DNS A records become aliases to the ALB.
5. Cut over by changing DNS, keeping the EC2 host as the rollback target for one release.
