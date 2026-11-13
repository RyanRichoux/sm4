# syntax=docker/dockerfile:1

# ---- Build: install, compile every package, build the web app ----
FROM node:22-alpine AS build
RUN npm install -g pnpm@9.15.9
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/engine/package.json packages/engine/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile
COPY packages packages
COPY apps apps
RUN pnpm -r run build
# A self-contained copy of the server with production dependencies only
RUN pnpm --filter @sm/server deploy --prod /out

# ---- Runtime ----
FROM node:22-alpine
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 WEB_DIST=/app/public
WORKDIR /app
COPY --from=build /out ./
COPY --from=build /repo/apps/web/dist ./public
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz || exit 1
CMD ["node", "dist/server.js"]
