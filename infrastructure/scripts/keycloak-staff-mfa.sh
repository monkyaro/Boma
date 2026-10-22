#!/usr/bin/env bash
# Make Keycloak report how a user signed in, so the API can require staff MFA.
#
# The API accepts staff actions only when the access token's "amr" claim holds both
# "pwd" and "otp" (backend/app/workspace/access.py). The realm's oidc-amr-mapper fills
# "amr" from the "default.reference.value" config of each completed flow execution, but only
# while that execution is younger than its "default.reference.maxAge" (seconds; unset = never).
# This copies the built-in browser flow to "boma-browser", tags the password form "pwd"
# and the OTP form "otp", and binds it as the realm browser flow. Idempotent.
#
# Runs inside the Keycloak container, with the bootstrap admin from its environment:
#   docker exec -i <keycloak container> bash -s < infrastructure/scripts/keycloak-staff-mfa.sh
set -euo pipefail

REALM=${REALM:-boma}
FLOW=boma-browser
# Staff must sign in again with their code after this long (Keycloak's default SSO session max).
MAX_AGE=${MAX_AGE:-36000}
K=/opt/keycloak/bin/kcadm.sh
CONFIG=$(mktemp)
trap 'rm -f "$CONFIG"' EXIT
k() { "$K" "$@" --config "$CONFIG"; }

k config credentials --server http://localhost:8080 --realm master \
  --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD" >/dev/null

if ! k get "authentication/flows" -r "$REALM" --fields alias --format csv --noquotes | grep -qx "$FLOW"; then
  k create "authentication/flows/browser/copy" -r "$REALM" -s newName="$FLOW"
  echo "Copied browser flow to $FLOW"
fi

# Lines of "id,providerId,authenticationConfig" for every execution in the flow.
executions=$(k get "authentication/flows/$FLOW/executions" -r "$REALM" \
  --fields id,providerId,authenticationConfig --format csv --noquotes)

tag() { # <providerId> <reference>
  local line id config
  line=$(printf '%s\n' "$executions" | grep ",$1," -m1 || printf '%s\n' "$executions" | grep ",$1\$" -m1) ||
    { echo "Execution $1 not found in $FLOW" >&2; exit 1; }
  id=${line%%,*}
  config=$(printf '%s' "$line" | cut -d, -f3)
  if [ -n "$config" ]; then
    k update "authentication/config/$config" -r "$REALM" -s alias="boma-$2-reference" \
      -s "config.\"default.reference.value\"=$2" -s "config.\"default.reference.maxAge\"=$MAX_AGE"
  else
    k create "authentication/executions/$id/config" -r "$REALM" -s alias="boma-$2-reference" \
      -s "config.\"default.reference.value\"=$2" -s "config.\"default.reference.maxAge\"=$MAX_AGE" >/dev/null
  fi
  echo "Tagged $1 as amr \"$2\""
}

tag auth-username-password-form pwd
tag auth-otp-form otp

# Realms created before the mapper was added to the import file lack it on their clients.
for client in boma-web boma-mobile; do
  id=$(k get clients -r "$REALM" -q clientId="$client" --fields id --format csv --noquotes)
  [ -n "$id" ] || continue
  if ! k get "clients/$id/protocol-mappers/models" -r "$REALM" --fields protocolMapper --format csv --noquotes |
      grep -qx oidc-amr-mapper; then
    k create "clients/$id/protocol-mappers/models" -r "$REALM" -s name=authentication-method-reference \
      -s protocol=openid-connect -s protocolMapper=oidc-amr-mapper \
      -s 'config."id.token.claim"=true' -s 'config."access.token.claim"=true' \
      -s 'config."introspection.token.claim"=true' >/dev/null
    echo "Added AMR mapper to $client"
  fi
done

k update "realms/$REALM" -s browserFlow="$FLOW"
echo "Realm $REALM uses browser flow $FLOW"
