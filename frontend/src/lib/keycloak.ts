import Keycloak from "keycloak-js";
import { getKeycloakConfig } from "@/config/keycloakConfig";

// One Keycloak instance per browser tab, shared by AuthContext and apiClient.
let keycloakInstance: Keycloak | null = null;

export function getKeycloak(): Keycloak {
  if (typeof window === "undefined") {
    throw new Error("Keycloak is only available in the browser");
  }
  if (!keycloakInstance) {
    keycloakInstance = new Keycloak(getKeycloakConfig());
  }
  return keycloakInstance;
}
