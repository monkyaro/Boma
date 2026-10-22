#!/bin/bash
# Create the production configuration in SSM Parameter Store (/boma/production/...), read by
# docker/render-env.sh on the host. Secrets are generated here and never printed.
# Existing parameters are left as they are, so the script is safe to re-run; delete a parameter
# to regenerate it (then run scripts/db-init.sh for DB passwords and redeploy).
# Usage: infrastructure/scripts/init-params.sh
set -euo pipefail

AWS="aws --profile boma-hoop --region eu-west-1"
P=/boma/production
DOMAIN=bomahoop.com
ACCOUNT=282400617488

DB_HOST=$($AWS rds describe-db-instances --db-instance-identifier boma-prod-db \
  --query 'DBInstances[0].Endpoint.Address' --output text)

umask 077
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

existing() { $AWS ssm get-parameter --name "$1" --with-decryption --query Parameter.Value --output text 2>/dev/null; }
gen() { openssl rand -hex 24; }

# put <name> <type> <value>: create only if missing. JSON file keeps values out of argv.
put() {
  if existing "$1" >/dev/null; then echo "keep    $1"; return; fi
  jq -n --arg n "$1" --arg t "$2" --arg v "$3" '{Name:$n, Type:$t, Value:$v, Overwrite:false}' > "$TMP/p.json"
  $AWS ssm put-parameter --cli-input-json "file://$TMP/p.json" >/dev/null
  echo "created $1"
}

# Secrets reused by other parameters: take the stored value if it exists.
REDIS_PW=$(existing $P/compose/REDIS_PASSWORD || gen)
APP_DB_PW=$(existing $P/db/BOMA_APP_PASSWORD || gen)
KC_DB_PW=$(existing $P/keycloak/KC_DB_PASSWORD || gen)

put $P/compose/REDIS_PASSWORD SecureString "$REDIS_PW"
put $P/db/BOMA_APP_PASSWORD   SecureString "$APP_DB_PW" # used by db-init.sh only

put $P/api/SECRET_KEY              SecureString "$(gen)"
put $P/api/SQLALCHEMY_DATABASE_URI SecureString "postgresql+psycopg://boma_app:$APP_DB_PW@$DB_HOST:5432/boma?sslmode=require"
put $P/api/CELERY_BROKER_URL       SecureString "redis://:$REDIS_PW@redis:6379/0"
put $P/api/CELERY_RESULT_BACKEND   SecureString "redis://:$REDIS_PW@redis:6379/1"
put $P/api/FLASK_DEBUG             String "false"
put $P/api/KEYCLOAK_ISSUER         String "https://auth.$DOMAIN/realms/boma"
put $P/api/KEYCLOAK_AUDIENCE       String "boma-api"
put $P/api/CORS_ORIGINS            String "https://$DOMAIN,https://admin.$DOMAIN"
put $P/api/SWAGGER_UI_ENABLED      String "false"
put $P/api/AWS_REGION              String "eu-west-1"
put $P/api/AWS_S3_ENDPOINT_URL     String "https://s3.eu-west-1.amazonaws.com"
put $P/api/MEDIA_S3_BUCKET         String "boma-prod-media-$ACCOUNT"

put $P/keycloak/KC_DB_URL                   String "jdbc:postgresql://$DB_HOST:5432/keycloak?sslmode=require"
put $P/keycloak/KC_DB_USERNAME              String "keycloak"
put $P/keycloak/KC_DB_PASSWORD              SecureString "$KC_DB_PW"
put $P/keycloak/KC_BOOTSTRAP_ADMIN_USERNAME String "bootstrap-admin"
put $P/keycloak/KC_BOOTSTRAP_ADMIN_PASSWORD SecureString "$(gen)"

echo "Done. Read a value with: $AWS ssm get-parameter --with-decryption --name <name>"
