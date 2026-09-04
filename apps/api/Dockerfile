# syntax=docker/dockerfile:1

ARG NODE_VERSION=24-alpine
ARG BUN_VERSION=1.4.0-alpine
ARG TURBO_VERSION=2.10.12

FROM oven/bun:${BUN_VERSION} AS bun

FROM node:${NODE_VERSION} AS base
COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun
ENV CI=1 \
    DO_NOT_TRACK=1 \
    TURBO_TELEMETRY_DISABLED=1
WORKDIR /repo

FROM base AS prune
ARG TURBO_VERSION
COPY . .
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun x turbo@${TURBO_VERSION} prune api --docker

FROM base AS deps
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

FROM base AS prod-deps
COPY --from=prune /repo/out/json/ .
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile --production

FROM deps AS build
COPY --from=prune /repo/out/full/ .
RUN bun run turbo build --filter=api

FROM node:${NODE_VERSION} AS runner
ENV NODE_ENV=production \
    APP_PORT=8000
WORKDIR /app

COPY --from=prod-deps /repo/ ./
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/packages/schemas/dist ./packages/schemas/dist

USER node
WORKDIR /app/apps/api
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -q --spider "http://127.0.0.1:${APP_PORT}/health/live" || exit 1

CMD ["node", "dist/main.js"]

ARG IMAGE_SOURCE="https://github.com/unknown/workspace"
ARG IMAGE_REVISION="unknown"
ARG IMAGE_VERSION="0.0.1"
ARG IMAGE_CREATED=""
LABEL org.opencontainers.image.title="workspace-api" \
      org.opencontainers.image.description="NestJS API for this workspace" \
      org.opencontainers.image.source="${IMAGE_SOURCE}" \
      org.opencontainers.image.revision="${IMAGE_REVISION}" \
      org.opencontainers.image.version="${IMAGE_VERSION}" \
      org.opencontainers.image.created="${IMAGE_CREATED}" \
      org.opencontainers.image.licenses="UNLICENSED"
