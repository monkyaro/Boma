#!/usr/bin/env bash
# Run on the BOMA ARM64 host. Uses disposable containers, no production data or AWS secrets.
set -euo pipefail
release=${1:?Supply staged release directory}
tag=${2:?Supply candidate tag}
phase=${3:-all}
[[ "$phase" =~ ^(all|scans|tests)$ ]] || exit 2
[[ "$tag" =~ ^[a-f0-9]{12,40}$ ]] || exit 2
cd "$release"
mkdir -p reports
scanner=aquasec/trivy@sha256:790fd66d1697395d8693d1acaa1ea702406a20f109b6fc7bac8db623eca6c06c
if [[ "$phase" != tests ]]; then
for app in api web; do
  docker image inspect "boma-${app}-candidate:$tag" --format '{{.Architecture}}' | grep -qx arm64
  docker save "boma-${app}-candidate:$tag" -o "$app.tar"
  docker run --rm -v "$release:/scan:ro" -v "$release/reports:/reports" \
    -v boma-release-scan-cache:/root/.cache/trivy "$scanner" image \
    --input "/scan/$app.tar" --scanners vuln --severity HIGH,CRITICAL --ignore-unfixed \
    --exit-code 1 --format json --output "/reports/trivy-$app.json"
done
printf 'ARM64 runtime image scans passed.\n'
fi
[[ "$phase" != scans ]] || exit 0

# Official PostgreSQL + official PostGIS packages, built natively (the old test image is amd64-only).
cat > Dockerfile.postgis-test <<'DOCKERFILE'
FROM postgres:17-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-17-postgis-3 && rm -rf /var/lib/apt/lists/*
DOCKERFILE
docker build -t boma-postgis-native-test:17 - < Dockerfile.postgis-test
network=boma-release-tests-$tag
postgres=boma-release-postgres-$tag
redis=boma-release-redis-$tag
cleanup() {
  docker rm -f "$postgres" "$redis" >/dev/null 2>&1 || true
  docker network rm "$network" >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker network create "$network" >/dev/null
docker run -d --name "$postgres" --network "$network" --network-alias postgres \
  --tmpfs /var/lib/postgresql/data:rw \
  -e POSTGRES_USER=boma -e POSTGRES_PASSWORD=isolated-test-only -e POSTGRES_DB=boma_test \
  boma-postgis-native-test:17 >/dev/null
docker run -d --name "$redis" --network "$network" --network-alias redis redis:7-alpine >/dev/null
ready=false
for attempt in {1..30}; do
  if docker exec "$postgres" pg_isready -U boma >/dev/null 2>&1; then ready=true; break; fi
  sleep 2
done
[[ "$ready" == true ]] || { echo 'Disposable PostgreSQL failed readiness' >&2; exit 1; }
docker run --rm --user root --network "$network" -v "$release/source/backend:/app:ro" \
  -e SECRET_KEY=isolated-native-test-only \
  -e SQLALCHEMY_DATABASE_URI=postgresql+psycopg://boma:isolated-test-only@postgres:5432/boma_test \
  -e CELERY_BROKER_URL=redis://redis:6379/0 -e CELERY_RESULT_BACKEND=redis://redis:6379/1 \
  -e RUFF_CACHE_DIR=/tmp/ruff \
  "boma-api-candidate:$tag" sh -c \
  'pip install -q -r requirements-dev.txt pip-audit && ruff check app tests && mypy --cache-dir /tmp/mypy && python -m pytest -q -p no:cacheprovider && flask --app run db upgrade && flask --app run db check && pip-audit -r requirements.txt'
printf 'Native release checks passed.\n'
