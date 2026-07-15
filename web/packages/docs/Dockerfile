# syntax=docker/dockerfile:1.7
ARG BUN_VERSION=1.3.13

FROM oven/bun:${BUN_VERSION} AS builder

WORKDIR /app

COPY bun.lock package.json bunfig.toml ./
COPY packages/admin/package.json ./packages/admin/package.json
COPY packages/assets/package.json ./packages/assets/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/docs/package.json ./packages/docs/package.json
COPY packages/editor/package.json ./packages/editor/package.json
COPY packages/email/package.json ./packages/email/package.json
COPY packages/schema/package.json ./packages/schema/package.json

RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

COPY packages/docs ./packages/docs
COPY packages/assets ./packages/assets

RUN bun run --filter @vesp-cloud/docs build

FROM nginx:1.29-alpine

COPY packages/docs/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/docs/.vitepress/dist /usr/share/nginx/html

EXPOSE 80
