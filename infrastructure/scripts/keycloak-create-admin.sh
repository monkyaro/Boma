#!/usr/bin/env bash
# Create (or update) a BOMA national administrator in the boma realm.
#
# The account gets the national_admin role and must, at first sign-in, choose a new password
# and set up an authenticator app; staff API access needs both factors (keycloak-staff-mfa.sh).
# The email is marked verified because the administrator is created by an operator.
#
# Runs inside the Keycloak container with the bootstrap admin from its environment. Pass the
# temporary password on stdin before the script, so it never appears in a command line:
#   ( printf 'TEMP_PASSWORD=%q\n' "$(cat password-file)"; cat infrastructure/scripts/keycloak-create-admin.sh ) |
#     docker exec -i <keycloak container> bash -s -- <email> <first name> <last name>
set -euo pipefail

EMAIL=${1:?email required}
FIRST=${2:?first name required}
LAST=${3:?last name required}
: "${TEMP_PASSWORD:?TEMP_PASSWORD must be set before the script on stdin}"
REALM=${REALM:-boma}
K=/opt/keycloak/bin/kcadm.sh
CONFIG=$(mktemp)
trap 'rm -f "$CONFIG"' EXIT
k() { "$K" "$@" --config "$CONFIG"; }

k config credentials --server http://localhost:8080 --realm master \
  --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD" >/dev/null

id=$(k get users -r "$REALM" -q email="$EMAIL" -q exact=true --fields id --format csv --noquotes)
if [ -z "$id" ]; then
  k create users -r "$REALM" -s username="$EMAIL" -s email="$EMAIL" -s firstName="$FIRST" -s lastName="$LAST" \
    -s enabled=true -s emailVerified=true >/dev/null
  id=$(k get users -r "$REALM" -q email="$EMAIL" -q exact=true --fields id --format csv --noquotes)
  echo "Created $EMAIL"
fi
k update "users/$id" -r "$REALM" -s enabled=true -s emailVerified=true \
  -s 'requiredActions=["UPDATE_PASSWORD","CONFIGURE_TOTP"]'
k set-password -r "$REALM" --userid "$id" --new-password "$TEMP_PASSWORD" --temporary
k add-roles -r "$REALM" --uid "$id" --rolename national_admin
echo "$EMAIL: roles $(k get-roles -r "$REALM" --uid "$id" --fields name --format csv --noquotes | tr '\n' ' ')"
echo "First sign-in will ask for a new password and an authenticator app."
