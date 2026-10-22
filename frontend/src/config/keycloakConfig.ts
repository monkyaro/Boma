import type { KeycloakConfig } from "keycloak-js";

export function getKeycloakConfig(): KeycloakConfig {
  return {
    url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8080",
    realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "boma",
    clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "boma-web",
  };
}
