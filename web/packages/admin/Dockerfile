ARG BUN_VERSION=1.3.13
FROM oven/bun:${BUN_VERSION} AS builder

WORKDIR /app

COPY bun.lock package.json bunfig.toml ./
COPY packages/db/package.json ./packages/db/package.json
COPY packages/admin/package.json ./packages/admin/package.json

RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

COPY packages ./packages

RUN bun run --filter @esphome-designer/admin build

RUN bun install --production --frozen-lockfile

FROM oven/bun:${BUN_VERSION}

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bunfig.toml ./bunfig.toml
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production

CMD ["bun", "run", "packages/admin/build/index.js"]
