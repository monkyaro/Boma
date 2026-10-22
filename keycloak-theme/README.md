# BOMA Keycloak theme

Login theme for the BOMA realm (`https://auth.bomahoop.com`), built with
[Keycloakify 11](https://docs.keycloakify.dev) + MUI. Based on the HOPE/Lomé theme,
rebranded to BOMA (teal `#0F4C5C`, terracotta `#E07A2F`) and translated to English.

Custom pages (`src/login/pages/`): Login, Register, LoginResetPassword, LoginUpdatePassword, Error.
Every other Keycloak page uses the Keycloakify default page inside `src/login/Template.tsx`.

## Develop

```bash
npm install
npm run storybook      # preview pages at http://localhost:6006
```

## Build

Needs Java 21 + Maven.

```bash
npm run build-keycloak-theme
```

Output in `dist_keycloak/`: use `keycloak-theme-for-kc-all-other-versions.jar` for Keycloak 26.
Copy it to `/opt/keycloak/providers/` in the Keycloak container (it is picked up at build/start time),
then in the admin console set *Realm settings → Themes → Login theme* to `boma`.

CI (`.github/workflows/keycloak-theme.yml` at the repo root) runs `npm audit` and the build on every PR, and uploads the JAR as an artifact.
