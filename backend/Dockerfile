# LMS API image: built from this folder by deploy/docker-compose.yml.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --non-interactive
COPY . .
ARG APP_VERSION=""
RUN APP_VERSION="$APP_VERSION" yarn build

FROM node:22-alpine
# Time zone data, so TZ (the kitchen's local time) works: "today", best-before dates, reminders.
RUN apk add --no-cache tzdata
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8790 TZ=Europe/Chisinau
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 8790
# The proxy guard answers 404 without the Worker's key, so the health check sends it too.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health',{headers:{'x-lms-proxy-key':process.env.PROXY_SECRET||''}}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/server.cjs"]
