# Read-only AWS discovery and deployment proposal

## Discovery checklist

Use an owner-provided temporary role/Identity Center session. Never read `../aws_conf` into logs, copy stored credentials or assume the root account is acceptable. No AWS calls have been made in this increment.

1. Confirm STS account/role and intended region/environment with the owner.
2. Inventory EC2, VPC/subnets/routes/security groups, RDS metadata, S3 bucket settings, ECR, budgets/quotas, certificates and existing Terraform backend metadata. Do not read production rows, object contents or secret values.
3. Inspect relevant Route 53 zones/records and public DNS only after the intended domain is established; record current targets and TTLs.
4. Review IAM metadata for least privilege; no IAM mutations. Compare deployed resource identifiers with repository claims; do not assume Terraform state is current.
5. Record resource ownership and separate staging from production; identify unrelated resources to preserve.

## Proposed plan (not authorized for apply)

Reuse suitable owner-confirmed resources where safe. Proposed staging adds Ubuntu EC2/Compose, private RDS/PostGIS (isolated Keycloak database), private encrypted S3, minimal instance role, SSM access, Secrets Manager, monitoring/budget alerts and tested backups. No ECS/EKS, NAT, ALB or OpenSearch now. Reconcile the existing Terraform modules before generating an environment-specific plan; do not initialize or apply the production backend automatically.

Cost: the existing infrastructure cost document contains an **unverified historical estimate of approximately USD 95/month** for one environment. It is not a current quote or approval; staging, secret storage, traffic and retained backups can add cost. Before spending, obtain current regional pricing and supply line items, total/range and budget proposal for owner approval.

Affected resources must be enumerated by the reviewed Terraform plan, including any IAM/DNS changes. DNS cutover requires separate confirmed records, health/TLS checks and approval. Rollback keeps current DNS targets/TTL recorded and previous images available; restore DB backups in an isolated target and validate before switching. Never destroy data-bearing resources as routine rollback.
