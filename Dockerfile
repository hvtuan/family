# syntax=docker/dockerfile:1.7

# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@10.33.2 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ─── Serve stage ──────────────────────────────────────────────────────────────
# Phase 2 spike: serve via @astrojs/node standalone instead of nginx static.
# Public pages are still prerendered into dist/client/; entry.mjs serves them
# alongside SSR routes (/admin/**).
FROM node:22-alpine AS serve
WORKDIR /app

RUN apk add --no-cache curl libc6-compat

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

ENV HOST=0.0.0.0
ENV PORT=80
ENV NODE_ENV=production

# Listen on port 80 to match Coolify's auto-generated Traefik label
# (loadbalancer.server.port=80) without a manual override.
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:80/ >/dev/null || exit 1

CMD ["node", "./dist/server/entry.mjs"]
