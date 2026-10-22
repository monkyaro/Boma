#!/bin/bash
# Deploy the BOMA Compose stack to the EC2 host, with automatic rollback.
#   1. Checks that both images exist in ECR (built and scanned by CI from main).
#   2. Syncs infrastructure/docker/ to /opt/boma and renders env files from SSM.
#   3. Issues the Let's Encrypt certificate on first run.
#   4. Pulls and starts the new tags, waits for every health check, then probes the
#      public hostnames through nginx. On any failure it restores the previous tags.
#   5. Probes the public URLs from here.
# Usage: infrastructure/scripts/deploy.sh --api-tag <git sha> --web-tag <git sha> [--theme <jar>]
# Omitted tags keep the version currently deployed.
set -euo pipefail

AWS="aws --profile boma-hoop --region eu-west-1"
HOST=boma@bomahoop.com
SSH_OPTS=(-i "${SSH_KEY:-$HOME/.ssh/boma}")
REGISTRY=282400617488.dkr.ecr.eu-west-1.amazonaws.com
DOCKER_DIR=$(cd "$(dirname "$0")/../docker" && pwd)

API_TAG="" WEB_TAG="" THEME=""
while [ $# -gt 0 ]; do
  case $1 in
    --api-tag) API_TAG=$2; shift 2 ;;
    --web-tag) WEB_TAG=$2; shift 2 ;;
    --theme) THEME=$2; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

for pair in "boma/api:$API_TAG" "boma/web:$WEB_TAG"; do
  repo=${pair%%:*} tag=${pair#*:}
  [ -z "$tag" ] && continue
  $AWS ecr describe-images --repository-name "$repo" --image-ids imageTag="$tag" >/dev/null ||
    { echo "Image $repo:$tag not found in ECR" >&2; exit 1; }
done

echo "==> Syncing compose files"
rsync -az --delete -e "ssh ${SSH_OPTS[*]}" \
  --exclude '.env' --exclude '*.env' --exclude '*.new' --exclude 'keycloak/providers/' \
  "$DOCKER_DIR/" "$HOST:/opt/boma/"
ssh "${SSH_OPTS[@]}" "$HOST" mkdir -p /opt/boma/keycloak/providers
if [ -n "$THEME" ]; then
  echo "==> Uploading Keycloak theme"
  scp "${SSH_OPTS[@]}" "$THEME" "$HOST:/opt/boma/keycloak/providers/boma-theme.jar"
fi

echo "==> Deploying on host"
# "-" stands for "keep the current tag" (ssh drops empty arguments)
ssh "${SSH_OPTS[@]}" "$HOST" bash -s -- "$REGISTRY" "${API_TAG:--}" "${WEB_TAG:--}" <<'REMOTE'
set -euo pipefail
REGISTRY=$1 NEW_API=${2#-} NEW_WEB=${3#-}
cd /opt/boma
chmod +x render-env.sh
./render-env.sh

prev() { grep -E "^$1=" .env | cut -d= -f2 || true; }
PREV_API=$(prev API_TAG) PREV_WEB=$(prev WEB_TAG)
API=${NEW_API:-$PREV_API} WEB=${NEW_WEB:-$PREV_WEB}
[ -n "$API" ] && [ -n "$WEB" ] || { echo "First deploy needs --api-tag and --web-tag" >&2; exit 1; }

set_tags() { # <api tag> <web tag>
  sed -i -E '/^(REGISTRY|API_TAG|WEB_TAG)=/d' .env
  printf 'REGISTRY=%s\nAPI_TAG=%s\nWEB_TAG=%s\n' "$REGISTRY" "$1" "$2" >> .env
}

# Requests through nginx on this host, as a browser would send them.
probe() {
  local ok=0
  for url in https://bomahoop.com/healthz https://api.bomahoop.com/health/ready \
             https://auth.bomahoop.com/realms/master/.well-known/openid-configuration; do
    host=${url#https://}; host=${host%%/*}
    if curl -fsS -o /dev/null --max-time 10 --resolve "$host:443:127.0.0.1" "$url"; then
      echo "  ok   $url"
    else
      echo "  FAIL $url"; ok=1
    fi
  done
  return $ok
}

aws ecr get-login-password --region eu-west-1 | docker login --username AWS --password-stdin "$REGISTRY" >/dev/null

# Compose needs the tags set before any command, including the certbot runs below.
set_tags "$API" "$WEB"
restore_tags() { [ -n "$PREV_API" ] && [ -n "$PREV_WEB" ] && set_tags "$PREV_API" "$PREV_WEB" || true; }

# First run: get the certificate with certbot standalone (nothing is on port 80 yet).
if ! docker compose run --rm --no-deps --entrypoint test certbot -f /etc/letsencrypt/live/bomahoop.com/fullchain.pem 2>/dev/null; then
  echo "==> Requesting Let's Encrypt certificate"
  docker compose run --rm --no-deps -p 80:80 --entrypoint certbot certbot certonly --standalone \
    --non-interactive --agree-tos --email admin.hoop@gmail.com --key-type ecdsa \
    --cert-name bomahoop.com -d bomahoop.com -d www.bomahoop.com -d api.bomahoop.com \
    -d auth.bomahoop.com -d admin.bomahoop.com || { restore_tags; exit 1; }
fi

echo "==> Starting api=$API web=$WEB (previous api=${PREV_API:-none} web=${PREV_WEB:-none})"
if docker compose pull --quiet && docker compose up -d --remove-orphans --wait --wait-timeout 300 && probe; then
  docker image prune -af --filter "until=168h" >/dev/null
  echo "==> Deployed"
  exit 0
fi

echo "==> Deployment failed" >&2
docker compose ps
if [ -n "$PREV_API" ] && [ -n "$PREV_WEB" ]; then
  echo "==> Rolling back to api=$PREV_API web=$PREV_WEB" >&2
  restore_tags
  docker compose up -d --remove-orphans --wait --wait-timeout 300 && probe || echo "Rollback is unhealthy too" >&2
fi
exit 1
REMOTE

echo "==> Public checks"
for url in https://bomahoop.com/healthz https://api.bomahoop.com/health/ready \
           https://auth.bomahoop.com/realms/master/.well-known/openid-configuration; do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$url" || true)
  echo "  $code $url"
done
