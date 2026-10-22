import axios from "axios";
import { appConfig } from "@/config/appConfig";
import { getKeycloak } from "@/lib/keycloak";

// Browser-side client: attaches (and refreshes) the Keycloak access token.
const apiClient = axios.create({
  baseURL: appConfig.apiUrl,
  timeout: appConfig.requestTimeout,
});

apiClient.interceptors.request.use(async (config) => {
  const keycloak = getKeycloak();
  if (keycloak.authenticated) {
    await keycloak.updateToken(appConfig.tokenRefreshThreshold);
    config.headers.Authorization = `Bearer ${keycloak.token}`;
  }
  return config;
});

export default apiClient;
