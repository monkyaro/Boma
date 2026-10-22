#!/bin/bash
# Runs on the EC2 host (in /opt/boma). Writes the Compose env files from SSM Parameter Store,
# using the instance role. Only variable names are printed, never values.
#   /boma/production/compose/*   -> .env          (REDIS_PASSWORD; REGISTRY and *_TAG lines are kept)
#   /boma/production/api/*       -> api.env       (SECRET_KEY, SQLALCHEMY_DATABASE_URI, ...)
#   /boma/production/keycloak/*  -> keycloak.env  (KC_DB_URL, KC_DB_USERNAME, KC_DB_PASSWORD, ...)
# The parameter's last path segment is the variable name.
set -euo pipefail
cd "$(dirname "$0")"
umask 077

PREFIX=/boma/production
REGION=eu-west-1

# Writes KEY='value' lines for every parameter under <ssm path> to <file>.
render() {
  aws ssm get-parameters-by-path --region "$REGION" --path "$1" --recursive --with-decryption \
    --query 'Parameters[].[Name,Value]' --output json |
    jq -r --arg q "'" '.[] | (.[0] | split("/") | last) as $k | .[1] as $v
      | if ($v | contains($q) or contains("\n")) then error("\($k): value contains a quote or newline")
        else "\($k)=\($q)\($v)\($q)" end' > "$2"
  [ -s "$2" ] || { echo "No parameters under $1" >&2; exit 1; }
  echo "$1: $(cut -d= -f1 "$2" | paste -sd' ')"
}

render "$PREFIX/api" api.env.new
render "$PREFIX/keycloak" keycloak.env.new
render "$PREFIX/compose" compose.env.new
{ grep -E '^(REGISTRY|API_TAG|WEB_TAG)=' .env 2>/dev/null || true; cat compose.env.new; } > .env.new

mv api.env.new api.env
mv keycloak.env.new keycloak.env
mv .env.new .env
rm -f compose.env.new
