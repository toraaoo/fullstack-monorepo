# syntax=docker/dockerfile:1

ARG NODE_VERSION=24-alpine
ARG BUN_VERSION=1.4.0-alpine
ARG TURBO_VERSION=2.10.12

FROM oven/bun:${BUN_VERSION} AS bun

FROM node:${NODE_VERSION} AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
ENV CI=1 \
    DO_NOT_TRACK=1 \
    TURBO_TELEMETRY_DISABLED=1 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo

FROM base AS prune
ARG TURBO_VERSION
COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun x turbo@${TURBO_VERSION} prune web --docker

FROM base AS deps
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=prune /repo/out/full/ .
RUN bun run turbo build --filter=web

FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q --spider "http://127.0.0.1:${PORT}/healthz" || exit 1

CMD ["node", "apps/web/server.js"]