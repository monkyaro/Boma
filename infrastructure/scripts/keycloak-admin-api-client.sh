#!/usr/bin/env bash
# Create (or update) the confidential client the API uses to create staff accounts.
#
# "boma-admin-api" has only a service account (client credentials; no browser or password
# flows). Its service account gets the realm-management roles view-realm, view-users,
# query-users and manage-users. Which realm roles may be granted is enforced by the API
# (backend/app/staff/staff_api.py): officer, regional_supervisor, finance and support only.
# Idempotent. Progress goes to stderr; nothing secret is printed unless PRINT_SECRET=1, which
# writes only the client secret to stdout so it can be piped into Secrets Manager.
#
# Runs inside the Keycloak container, with the bootstrap admin from its environment:
#   docker exec -i <keycloak container> bash -s < infrastructure/scripts/keycloak-admin-api-client.sh
set -euo pipefail

REALM=${REALM:-boma}
CLIENT=${CLIENT:-boma-admin-api}
K=/opt/keycloak/bin/kcadm.sh
CONFIG=$(mktemp)
trap 'rm -f "$CONFIG"' EXIT
k() { "$K" "$@" --config "$CONFIG"; }
log() { echo "$@" >&2; }

k config credentials --server http://localhost:8080 --realm master \
  --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD" >/dev/null 2>&1

id=$(k get clients -r "$REALM" -q clientId="$CLIENT" --fields id --format csv --noquotes)
if [ -z "$id" ]; then
  k create clients -r "$REALM" -s clientId="$CLIENT" -s name="BOMA API staff provisioning" \
    -s enabled=true -s publicClient=false -s serviceAccountsEnabled=true \
    -s standardFlowEnabled=false -s implicitFlowEnabled=false -s directAccessGrantsEnabled=false >/dev/null
  id=$(k get clients -r "$REALM" -q clientId="$CLIENT" --fields id --format csv --noquotes)
  log "Created client $CLIENT"
else
  k update "clients/$id" -r "$REALM" -s enabled=true -s publicClient=false -s serviceAccountsEnabled=true \
    -s standardFlowEnabled=false -s implicitFlowEnabled=false -s directAccessGrantsEnabled=false
  log "Client $CLIENT exists; flows re-checked"
fi

account=$(k get "clients/$id/service-account-user" -r "$REALM" --fields username --format csv --noquotes)
k add-roles -r "$REALM" --uusername "$account" --cclientid realm-management \
  --rolename view-realm --rolename view-users --rolename query-users --rolename manage-users
log "Service account $account has realm-management view-realm, view-users, query-users, manage-users"

if [ "${PRINT_SECRET:-0}" = 1 ]; then
  k get "clients/$id/client-secret" -r "$REALM" --fields value --format csv --noquotes
fi
