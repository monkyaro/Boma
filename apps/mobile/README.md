# BOMA mobile

Expo/React Native customer and officer client. Existing web/API paths are preserved; mobile lives in `apps/mobile`.

Implemented: public search/details, verification badges, saved properties, inquiries/guided-viewing requests, short-stay request holds, private BOMA conversations, appointment display in EAT, notifications/read state, optional device registration, scoped identity/property decisions, and SecureStore offline evidence-reference drafts. Tokens/refresh tokens are kept in SecureStore, refreshed before expiry and revoked/removed on sign-out. User drafts are cleared on sign-out. Officer permissions are enforced by the same API and completed staff MFA; the native app cannot override them.

```sh
npm ci
npm run typecheck
npx expo export --platform android --platform ios --output-dir dist
npm run start
```

Use a development build with registered `boma://auth` redirect; arbitrary Expo Go redirects are not registered. `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_OIDC_ISSUER`, `EXPO_PUBLIC_OIDC_CLIENT_ID` configure reachable API and Keycloak URLs. A physical phone cannot use the server machine's localhost; use approved HTTPS staging or a controlled development network and matching issuer/redirect settings. Do not expose the local database/Redis or relax production TLS/token checks.

`EXPO_PUBLIC_EXPO_PROJECT_ID` is optional for push token registration. FCM/Expo project credentials and a reviewed delivery adapter are still required for actual push. Permission is requested only after the user taps Enable push. Registration currently returns `delivery_enabled:false`; in-app notifications work independently. There are no provider secrets in client bundles.

SecureStore drafts currently contain one evidence reference per signed-in account, not document/photo uploads or an automatic offline verification decision. Sensitive media capture, device testing/accessibility, passwordless provider activation, store signing/distribution, localization and provider-driven push delivery remain release tasks. Android and iOS JS bundles have been exported locally; no device or store readiness is claimed.
