// NEXT_PUBLIC_* values are inlined at build time (see Dockerfile build args).
export const appConfig = {
  appName: "BOMA",
  // Browser -> API, through Nginx (https://api.bomahoop.com)
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
  // Seconds before expiry to refresh the access token
  tokenRefreshThreshold: 70,
  requestTimeout: 30000,
};

// Server components -> API over the Docker network. Read at request time.
export function apiInternalUrl() {
  return process.env.API_INTERNAL_URL || appConfig.apiUrl;
}
