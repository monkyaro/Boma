# Disaster recovery

## What holds state

| Data | Where | Protection |
|---|---|---|
| App data (listings, users' app records) | RDS `boma-prod-db`, database `boma` | Automated daily backups with point-in-time restore (7 days); manual snapshots via `backup.sh` |
| Keycloak (users, realms, clients) | Same RDS instance, database `keycloak` | Same as above |
| Images, videos, documents, identity files | S3 buckets (versioned) | Old versions kept 30 days (media) or 365 days (documents, identity) |
| Configuration and secrets | SSM Parameter Store, Secrets Manager | AWS managed. Regenerate with `init-params.sh` if lost. |
| Infrastructure | Terraform code in Git, state in a versioned S3 bucket | Rebuild with `terraform apply` |
| Container images | ECR (30 per repository) and Git | Rebuild from the commit with CI |
| TLS certificate | Docker volume on the host | Re-issued automatically on the first deploy to a new host |
| Redis | Container memory only | Not backed up. Queued jobs are lost on restart, and jobs must be idempotent. |

The EC2 host holds nothing that cannot be rebuilt.

## Targets

| | Target |
|---|---|
| RPO (data loss) | ≤ 5 minutes. RDS PITR replays transaction logs, typically to within the last 5 minutes. |
| RTO, app host lost | ~1 hour |
| RTO, database lost or corrupted | ~1–2 hours |
| RTO, region lost | Days. No cross-region copy yet (see Gaps). |

## Backups

```bash
infrastructure/scripts/backup.sh pre-release    # manual snapshot; prunes manual ones older than 35 days
```

Take a manual snapshot before every release with migrations, and before any manual data change.

## Restore drill (monthly, and before calling production ready)

```bash
infrastructure/scripts/restore.sh test
```

This restores the latest restorable time into a temporary instance. It connects from the app host as `boma_app` and `keycloak`, checks the migration version, PostGIS, the row counts and the Keycloak realms, then deletes the instance. It ends with `RESTORE TEST PASSED` or `FAILED`. Record the result:

| Date | Result | Duration | By |
|---|---|---|---|
| | | | |

## Scenarios

### App host lost or broken

The system status check alarm auto-recovers the instance on hardware failure. If the host is unusable:

1. `terraform apply -replace=module.ec2.aws_instance.app`, after showing the plan. `disable_api_termination` must be set to false in a plan first. The Elastic IP moves to the new instance, so DNS does not change.
2. Wait for bootstrap to finish (`/var/log/boma-bootstrap.log`, about 5 minutes).
3. Update the host key in `~/.ssh/known_hosts`.
4. Run `deploy.sh --api-tag <sha> --web-tag <sha> --theme <jar>`. It issues a new certificate and starts the stack.

### Bad release or migration

- **App bug:** `deploy.sh --api-tag <previous sha> --web-tag <previous sha>`.
- **Destructive migration:** restore the pre-release snapshot (next scenario), then deploy the previous tags.

### Database lost, corrupted, or bad data written

1. Pick the recovery point: a time just before the incident, or a snapshot.
2. Restore into a new instance. This takes 10–20 minutes, and the live DB is untouched:
   ```bash
   infrastructure/scripts/restore.sh new boma-prod-db-restore --time 2026-10-22T08:00:00Z
   # or: --snapshot boma-prod-db-pre-release-20261022-0800
   ```
3. Stop writers: `docker compose stop api celery-worker celery-beat keycloak` on the host.
4. Choose one of two ways to switch:
   - **Quick:** set `/boma/production/api/SQLALCHEMY_DATABASE_URI` and `/boma/production/keycloak/KC_DB_URL` to the new endpoint, then run `deploy.sh`. Afterwards, bring Terraform back in line during a planned window.
   - **Terraform-clean:** rename the old instance to `boma-prod-db-old`, rename the restored one to `boma-prod-db`, update both SSM endpoints if they changed, run `terraform plan` (expect only tag or attribute drift), then run `deploy.sh`.
5. Keep the old instance until the restored data is confirmed. Then delete it with a final snapshot, which requires turning off deletion protection first.

### S3 object deleted or overwritten

Versioning keeps the previous version. Use
`aws s3api list-object-versions --bucket <bucket> --prefix <key>`, then copy the wanted
`VersionId` back over the key, or delete the delete marker.

### Secrets lost or leaked

Delete the affected parameters, then run `init-params.sh`, `db-init.sh` and `deploy.sh`. For the
RDS master password, use `aws rds modify-db-instance --rotate-master-user-password`.
For the Keycloak admin, use a different admin account to reset the password.

### Region outage

There is currently no cross-region copy. To rebuild elsewhere:

1. Copy a snapshot to the new region. This is only possible if snapshots were copied beforehand, which is one of the Gaps below.
2. Change the region and AZs in the Terraform environment.
3. Apply, deploy, and repoint DNS.

## Gaps

- Cross-region snapshot copy, using an AWS Backup plan to copy into eu-central-1. It costs about $2/month at the current size and makes region loss recoverable.
- A logical `pg_dump` export to S3, which would allow restoring outside RDS or into a different major version.
- Redis persistence is off by design. Revisit this if Celery jobs become non-idempotent.
