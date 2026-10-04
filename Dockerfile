# LMS: the web app and the API in one image, built on the server from its own checkout
# (deploy/updater/update.sh, deploy/server/live.sh). The API serves the web app too (WEB_DIR).
FROM node:22-alpine AS web
WORKDIR /web
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive --network-timeout 600000
COPY frontend/ ./
ARG APP_VERSION=""
RUN APP_VERSION="$APP_VERSION" yarn build

FROM node:22-alpine AS api
WORKDIR /api
COPY backend/package.json backend/yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive --network-timeout 600000
COPY backend/ ./
ARG APP_VERSION=""
RUN APP_VERSION="$APP_VERSION" yarn build

FROM node:22-alpine
# Time zone data, so TZ (the kitchen's local time) works: "today", best-before dates, reminders.
RUN apk add --no-cache tzdata
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8790 TZ=Europe/Chisinau WEB_DIR=/app/web
WORKDIR /app
COPY --from=api --chown=node:node /api/dist ./dist
COPY --from=web --chown=node:node /web/dist ./web
USER node
EXPOSE 8790
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/server.cjs"]
