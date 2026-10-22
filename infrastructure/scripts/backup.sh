#!/bin/bash
# On-demand backup of the BOMA database (app data and Keycloak both live in RDS boma-prod-db).
# RDS also takes automated daily backups with point-in-time recovery (7 days, Terraform);
# this adds a manual snapshot that is kept until pruned, e.g. before a migration or release.
# Manual snapshots older than RETAIN_DAYS (default 35) are deleted; the newest is always kept.
# Usage: infrastructure/scripts/backup.sh [label]
set -euo pipefail

AWS="aws --profile boma-hoop --region eu-west-1"
DB=boma-prod-db
RETAIN_DAYS=${RETAIN_DAYS:-35}
LABEL=${1:-manual}
SNAP="$DB-$(printf '%s' "$LABEL" | tr -cs '[:alnum:]' '-')-$(date -u +%Y%m%d-%H%M)"

echo "==> Creating snapshot $SNAP"
$AWS rds create-db-snapshot --db-instance-identifier "$DB" --db-snapshot-identifier "$SNAP" \
  --tags Key=Purpose,Value=backup Key=Label,Value="$LABEL" >/dev/null
$AWS rds wait db-snapshot-available --db-snapshot-identifier "$SNAP"
$AWS rds describe-db-snapshots --db-snapshot-identifier "$SNAP" \
  --query 'DBSnapshots[0].[DBSnapshotIdentifier,Status,AllocatedStorage,SnapshotCreateTime]' --output text

echo "==> Pruning manual snapshots older than $RETAIN_DAYS days"
CUTOFF=$(date -u -d "-$RETAIN_DAYS days" +%Y-%m-%dT%H:%M:%S)
$AWS rds describe-db-snapshots --db-instance-identifier "$DB" --snapshot-type manual \
  --query "DBSnapshots[?SnapshotCreateTime<'$CUTOFF' && DBSnapshotIdentifier!='$SNAP'].DBSnapshotIdentifier" \
  --output text | tr '\t' '\n' | while read -r old; do
    [ -n "$old" ] || continue
    echo "  delete $old"
    $AWS rds delete-db-snapshot --db-snapshot-identifier "$old" >/dev/null
  done

echo "==> Recovery points"
$AWS rds describe-db-instances --db-instance-identifier "$DB" \
  --query 'DBInstances[0].{latest_restorable:LatestRestorableTime,retention_days:BackupRetentionPeriod}' --output table
$AWS rds describe-db-snapshots --db-instance-identifier "$DB" \
  --query 'sort_by(DBSnapshots,&SnapshotCreateTime)[].[SnapshotType,DBSnapshotIdentifier,SnapshotCreateTime]' --output table
