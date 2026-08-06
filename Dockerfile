# syntax=docker/dockerfile:1
#
# Builds a lean, self-contained image via Next.js `output: "standalone"`
# (see next.config.ts). Works unmodified on ARM64 (Raspberry Pi, Apple
# Silicon) or x86_64 — Docker just builds for whatever host it's run on,
# no cross-compilation needed.
#
# Two ways to run this:
#   - docker compose up            (local / Tailscale self-host — see docker-compose.yml)
#   - CapRover                     (see captain-definition, which points here)
#
# Migrations are NOT run automatically on container start (the runner stage
# deliberately excludes the Prisma CLI to stay small). Run them once against
# whatever Postgres DATABASE_URL points at, using the `builder` stage:
#   docker build --target builder -t propertyops-migrate .
#   docker run --rm --env-file .env propertyops-migrate npx prisma migrate deploy
#   docker run --rm --env-file .env propertyops-migrate npm run db:seed   # optional demo data

FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# `next build` only needs these to be *present*, not valid — nothing connects to
# a database or signs a real session at build time (see src/lib/prisma.ts,
# src/lib/auth.ts). Real values are supplied at container runtime instead.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder"
ENV CRON_SECRET="build-time-placeholder"

RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Local-disk photo-upload fallback (see src/lib/storage.ts) — owned by the
# runtime user so it's writable whether or not a volume gets mounted here.
RUN mkdir -p /app/public/uploads && chown nextjs:nodejs /app/public/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
