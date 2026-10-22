# BOMA web frontend

Next.js 16 (App Router, TypeScript, Tailwind 4) for the BOMA Real Estate Marketplace.
Auth and API patterns follow the HOPE frontend: a single `keycloak-js` instance, an axios
client that refreshes and attaches the token, and React Query hooks per feature.

> Next.js 16 differs from older versions; read `node_modules/next/dist/docs/` before changing
> framework-level code (see `AGENTS.md`). Cache Components is on, so uncached server reads
> (API calls, `params`) must render inside `<Suspense>`.

## Layout

- `src/config/` – app and Keycloak config (`NEXT_PUBLIC_*`, inlined at build time)
- `src/lib/keycloak.ts` – shared Keycloak instance; `src/contexts/AuthContext.tsx` – `useAuth()`
- `src/services/apiClient.ts` – browser axios client with Bearer token
- `src/services/listingServerApi.ts` – server-side reads via `API_INTERNAL_URL` (runtime)
- `src/app/` – `/` latest listings, `/listings/[id]`, `/dashboard/listings/new` (agents/owners), `/healthz`
- `public/silent-check-sso.html` – Keycloak silent SSO check

## Develop

```bash
cp .env.example .env.local
npm install
npm run dev            # http://localhost:3000, backend on :8000
npm run lint && npm run typecheck && npm test
```

## Keycloak

Realm `boma`, public client `boma-web` (standard flow + PKCE S256), redirect URIs
`https://bomahoop.com/*`, `https://www.bomahoop.com/*`, web origins the same.
Add an audience mapper so access tokens include `boma-api` (the backend checks `aud`).
Realm roles used: `agent`, `owner`.

## Docker / CI

`Dockerfile` builds a standalone server (non-root, port 3000, `/healthz` health check).
`NEXT_PUBLIC_*` are build args with production defaults; `API_INTERNAL_URL` is set at runtime
(e.g. `http://api:8000` on the Compose network).

`.github/workflows/ci.yml`: lint, typecheck, tests, `npm audit`, build on every PR; on `main` it
builds a `linux/arm64` image, scans it with Trivy and pushes it to ECR `boma/web` via GitHub OIDC.
Needs the repo variable `AWS_ECR_PUSH_ROLE_ARN`.
