#!/bin/bash
# Restore the BOMA database into a NEW RDS instance. The live boma-prod-db is never modified.
#   test                 restore the latest restorable time, verify it, then delete it (restore drill)
#   new <name> [source]  restore and keep the instance, for recovery or investigation
# source: --snapshot <id> | --time <ISO-8601 UTC, e.g. 2026-10-22T08:00:00Z> | latest (default)
# A restored db.t4g.small costs about $0.05/hour until deleted. Switching the app to a restored
# instance is a manual, approved step: see docs/disaster-recovery.md.
# Usage: infrastructure/scripts/restore.sh test
#        infrastructure/scripts/restore.sh new boma-prod-db-restore --time 2026-10-22T08:00:00Z
set -euo pipefail

AWS="aws --profile boma-hoop --region eu-west-1"
SSH="ssh -i ${SSH_KEY:-$HOME/.ssh/boma} boma@bomahoop.com"
SRC=boma-prod-db
MODE=${1:?usage: restore.sh test | new <name> [--snapshot id | --time ts]}
shift

if [ "$MODE" = test ]; then
  TARGET=$SRC-restoretest-$(date -u +%Y%m%d%H%M)
  SOURCE=(latest)
elif [ "$MODE" = new ]; then
  TARGET=${1:?name for the new instance}; shift
  SOURCE=("${@:-latest}")
else
  echo "Unknown mode: $MODE" >&2; exit 2
fi
[ "$TARGET" != "$SRC" ] || { echo "Refusing to use the live instance name" >&2; exit 1; }

read -r SG CLASS < <($AWS rds describe-db-instances --db-instance-identifier "$SRC" \
  --query 'DBInstances[0].[VpcSecurityGroups[0].VpcSecurityGroupId,DBInstanceClass]' --output text)
COMMON=(--target-db-instance-identifier "$TARGET" --db-subnet-group-name "$SRC" --vpc-security-group-ids "$SG"
  --db-parameter-group-name "$SRC-pg17" --db-instance-class "$CLASS" --no-multi-az --no-publicly-accessible
  --no-deletion-protection --copy-tags-to-snapshot --tags Key=Purpose,Value=restore Key=Project,Value=boma)

echo "==> Restoring $SRC (${SOURCE[*]}) into $TARGET"
case ${SOURCE[0]} in
  latest) $AWS rds restore-db-instance-to-point-in-time --source-db-instance-identifier "$SRC" \
            --use-latest-restorable-time "${COMMON[@]}" >/dev/null ;;
  --time) $AWS rds restore-db-instance-to-point-in-time --source-db-instance-identifier "$SRC" \
            --restore-time "${SOURCE[1]:?timestamp}" "${COMMON[@]}" >/dev/null ;;
  --snapshot) # snapshot restore takes --db-instance-identifier instead of --target-...
            $AWS rds restore-db-instance-from-db-snapshot --db-snapshot-identifier "${SOURCE[1]:?snapshot id}" \
              --db-instance-identifier "${COMMON[@]:1}" >/dev/null ;;
  *) echo "Unknown source: ${SOURCE[*]}" >&2; exit 2 ;;
esac
echo "    waiting for $TARGET (usually 10-20 minutes)"
$AWS rds wait db-instance-available --db-instance-identifier "$TARGET"
HOST=$($AWS rds describe-db-instances --db-instance-identifier "$TARGET" --query 'DBInstances[0].Endpoint.Address' --output text)
echo "    endpoint $HOST"

# Verify with the application role (its password is in the restored data, same as production).
echo "==> Verifying restored data"
APP_PW=$($AWS ssm get-parameter --name /boma/production/db/BOMA_APP_PASSWORD --with-decryption --query Parameter.Value --output text)
VERIFY_SQL="\\set ON_ERROR_STOP on
SELECT current_database(), now() AS checked_at;
SELECT version_num AS migration FROM alembic_version;
SELECT postgis_lib_version() AS postgis;
SELECT relname AS table, n_live_tup AS rows FROM pg_stat_user_tables ORDER BY relname;"
STATUS=0
printf '%s\n%s\n' "$APP_PW" "$VERIFY_SQL" |
  $SSH "IFS= read -r PGPASSWORD; export PGPASSWORD; psql -X 'host=$HOST dbname=boma user=boma_app sslmode=require'" ||
  STATUS=$?
printf '%s\n' "$($AWS ssm get-parameter --name /boma/production/keycloak/KC_DB_PASSWORD --with-decryption --query Parameter.Value --output text)" \
  "\\set ON_ERROR_STOP on" "SELECT count(*) AS keycloak_realms FROM realm;" |
  $SSH "IFS= read -r PGPASSWORD; export PGPASSWORD; psql -X 'host=$HOST dbname=keycloak user=keycloak sslmode=require'" ||
  STATUS=$?

if [ "$MODE" = test ]; then
  echo "==> Deleting test instance $TARGET"
  $AWS rds delete-db-instance --db-instance-identifier "$TARGET" --skip-final-snapshot --delete-automated-backups >/dev/null
  [ $STATUS -eq 0 ] && echo "RESTORE TEST PASSED ($(date -u +%FT%TZ))" || echo "RESTORE TEST FAILED" >&2
else
  echo "Kept $TARGET at $HOST. Delete it when done: $AWS rds delete-db-instance --db-instance-identifier $TARGET --skip-final-snapshot"
fi
exit $STATUS
