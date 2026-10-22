ARG NODE_VERSION=24-alpine

FROM node:$NODE_VERSION AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:$NODE_VERSION AS build
WORKDIR /app
# Browser config is inlined at build time
ARG NEXT_PUBLIC_API_URL=https://api.bomahoop.com
ARG NEXT_PUBLIC_KEYCLOAK_URL=https://auth.bomahoop.com
ARG NEXT_PUBLIC_KEYCLOAK_REALM=boma
ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=boma-web
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
    NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
    NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:$NODE_VERSION AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1
CMD ["node", "server.js"]
