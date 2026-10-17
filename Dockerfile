# LMS: the web app and the API in one image, built on the server from its own checkout
# (deploy/updater/update.sh, deploy/server/live.sh). The API serves the web app too (WEB_DIR).
FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS web
WORKDIR /web
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive --network-timeout 600000
COPY frontend/ ./
ARG APP_VERSION=""
RUN APP_VERSION="$APP_VERSION" yarn build

FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402 AS api
WORKDIR /api
COPY backend/package.json backend/yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive --network-timeout 600000
COPY backend/ ./
ARG APP_VERSION=""
RUN APP_VERSION="$APP_VERSION" yarn build

FROM node:22.23.3-alpine3.24@sha256:0a7108bf6c7bf5de370ffb1a3ed6be93d405b43ff159f681a8d18c0e2bc2e402
# Time zone data, so TZ (the kitchen's local time) works: "today", best-before dates, reminders.
# vips-tools: photos are shrunk to small WebP files before they're stored (Drinks).
# postgresql16-client: pg_dump and pg_restore for the admin's backup download and restore.
RUN apk add --no-cache tzdata vips-tools postgresql16-client
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8790 TZ=Europe/Chisinau WEB_DIR=/app/web
WORKDIR /app
COPY --from=api --chown=node:node /api/dist ./dist
COPY --from=web --chown=node:node /web/dist ./web
USER node
EXPOSE 8790
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/server.cjs"]
