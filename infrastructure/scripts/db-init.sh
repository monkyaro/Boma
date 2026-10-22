#!/bin/bash
# Create the BOMA database roles and databases on RDS (idempotent), run from the admin workstation.
#   boma_admin  RDS master (password in Secrets Manager), administration only
#   boma_app    application role: owns the app tables in database "boma" (runs migrations)
#   keycloak    owns database "keycloak"
# Also enables PostGIS in "boma". Passwords come from SSM (run init-params.sh first) and reach
# psql on the host over SSH stdin, so they never appear in argv or output.
# Usage: infrastructure/scripts/db-init.sh
set -euo pipefail

AWS="aws --profile boma-hoop --region eu-west-1"
SSH="ssh -i ${SSH_KEY:-$HOME/.ssh/boma} boma@bomahoop.com"
P=/boma/production

read -r DB_HOST SECRET_ARN < <($AWS rds describe-db-instances --db-instance-identifier boma-prod-db \
  --query 'DBInstances[0].[Endpoint.Address,MasterUserSecret.SecretArn]' --output text)
MASTER_PW=$($AWS secretsmanager get-secret-value --secret-id "$SECRET_ARN" --query SecretString --output text | jq -r .password)
param() { $AWS ssm get-parameter --name "$1" --with-decryption --query Parameter.Value --output text; }
APP_PW=$(param $P/db/BOMA_APP_PASSWORD)
KC_PW=$(param $P/keycloak/KC_DB_PASSWORD)

{
  echo "$MASTER_PW"
  cat <<SQL
\set ON_ERROR_STOP on
\set app_pw '$APP_PW'
\set kc_pw '$KC_PW'

SELECT format('CREATE ROLE %I LOGIN', r) FROM unnest(ARRAY['boma_app','keycloak']) r
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) \gexec
ALTER ROLE boma_app PASSWORD :'app_pw';
ALTER ROLE keycloak PASSWORD :'kc_pw';
ALTER ROLE boma_app SET statement_timeout = '60s';

-- The master needs membership to create a database owned by keycloak (PG16+)
GRANT keycloak TO boma_admin;
SELECT 'CREATE DATABASE keycloak OWNER keycloak'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = 'keycloak') \gexec

REVOKE ALL ON DATABASE boma FROM PUBLIC;
REVOKE ALL ON DATABASE keycloak FROM PUBLIC;
GRANT CONNECT, TEMPORARY ON DATABASE boma TO boma_app;
GRANT CONNECT ON DATABASE keycloak TO keycloak;

-- Inside "boma": PostGIS (needs rds_superuser) and schema rights for the app role
CREATE EXTENSION IF NOT EXISTS postgis;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO boma_app;

SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname IN ('boma_admin','boma_app','keycloak') ORDER BY 1;
SELECT datname FROM pg_database WHERE datname IN ('boma','keycloak') ORDER BY 1;
SELECT postgis_full_version();
SQL
} | $SSH "IFS= read -r PGPASSWORD; export PGPASSWORD; psql -X 'host=$DB_HOST port=5432 dbname=boma user=boma_admin sslmode=require'"
