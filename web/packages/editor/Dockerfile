# syntax=docker/dockerfile:1.7
ARG BUN_VERSION=1.3.13
FROM oven/bun:${BUN_VERSION} AS builder

ENV DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
    git \
    python3-pip \
    python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Create Python virtual environment and install ESPHome
RUN python3 -m venv /opt/esphome-venv
RUN /opt/esphome-venv/bin/pip install --upgrade pip
RUN /opt/esphome-venv/bin/pip install esphome

WORKDIR /app

# Copy monorepo files
COPY bun.lock package.json bunfig.toml ./

# Copy workspace manifests first (better dependency caching)
COPY packages/editor/package.json ./packages/editor/package.json
COPY packages/schema/package.json ./packages/schema/package.json

# Install dependencies
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

# Copy packages
COPY packages ./packages

# Build all packages
RUN bun run build

# Production image
FROM oven/bun:${BUN_VERSION}

ENV DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    docker.io \
    git \
    python3 \
    python3-venv && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bunfig.toml ./bunfig.toml
COPY --from=builder /app/packages ./packages
COPY --from=builder /opt/esphome-venv /opt/esphome-venv

ENV NODE_ENV=production
ENV CONCURRENT_JOBS=2
ENV ESPHOME_VENV=/opt/esphome-venv

# EXPOSE 5173

CMD ["bun", "run", "packages/editor/build/index.js"]
