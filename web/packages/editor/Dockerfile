# syntax=docker/dockerfile:1.7
ARG BUN_VERSION=1.3.13
FROM oven/bun:${BUN_VERSION} AS builder

ARG DOMAIN
ENV DOMAIN=${DOMAIN}

ENV DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    ccache \
    docker.io \
    git \
    python3-pip \
    python3-venv && \
    rm -rf /var/lib/apt/lists/*

# Create Python virtual environment and install ESPHome (pinned version for cache stability)
ARG ESPHOME_VERSION=2026.5.2
RUN python3 -m venv /opt/esphome-venv
RUN /opt/esphome-venv/bin/pip install --upgrade pip
RUN /opt/esphome-venv/bin/pip install "esphome==${ESPHOME_VERSION}"

# ESPHome's stock JPEG wrapper expands every decoded source pixel through
# RGB888 + floating-point scaling. Install the project-owned RGB565 block
# decoder into the deliberately pinned ESPHome package before pre-warming.
COPY packages/editor/esphome-patches /opt/esphome-patches
RUN /opt/esphome-venv/bin/python /opt/esphome-patches/apply-fast-jpeg.py

# Pre-compile Python bytecode for faster esphome startup
RUN /opt/esphome-venv/bin/python -m compileall -q /opt/esphome-venv

# Create shared cache directories
RUN mkdir -p /data/platformio /data/pio-build-cache /data/ccache

# Golden pre-warm: compile a minimal config matching the real target (esp32s3 + esp-idf).
# This bakes toolchains + PlatformIO packages + framework objects + ccache entries
# into the image, so the first user build on a fresh deploy is already warm.
ENV CCACHE_DIR=/data/ccache
ENV CCACHE_BASEDIR=/tmp/esphome-builds
ENV CCACHE_NOHASHDIR=true
ENV CCACHE_SLOPPINESS=pch_defines,time_macros,include_file_mtime,include_file_ctime
ENV CCACHE_MAXSIZE=10G
ENV CCACHE_COMPRESS=true
ENV CCACHE_COMPRESSLEVEL=1
ENV IDF_CCACHE_ENABLE=1
ENV PLATFORMIO_BUILD_CACHE_DIR=/data/pio-build-cache
ENV PLATFORMIO_CORE_DIR=/data/platformio
RUN /bin/sh /opt/esphome-patches/warmup.sh

WORKDIR /app

# Copy monorepo files
COPY bun.lock package.json bunfig.toml ./

# Copy workspace manifests first (better dependency caching)
COPY packages/db/package.json ./packages/db/package.json
COPY packages/assets/package.json ./packages/assets/package.json
COPY packages/email/package.json ./packages/email/package.json
COPY packages/editor/package.json ./packages/editor/package.json
COPY packages/schema/package.json ./packages/schema/package.json
COPY packages/admin/package.json ./packages/admin/package.json

# Install dependencies
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile

# Copy packages
COPY packages ./packages

# Build all packages
RUN bun run build

# Prune devDependencies for production
RUN bun install --production --frozen-lockfile

# Production image
FROM oven/bun:${BUN_VERSION}

ENV DEBIAN_FRONTEND=noninteractive

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt,sharing=locked \
    apt-get update && apt-get install -y --no-install-recommends \
    ccache \
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
COPY --from=builder /data /data

ENV NODE_ENV=production
ENV CONCURRENT_JOBS=2
ENV ESPHOME_VENV=/opt/esphome-venv

# Shared ESPHome / PlatformIO cache paths
ENV PLATFORMIO_CORE_DIR=/data/platformio
ENV PLATFORMIO_BUILD_CACHE_DIR=/data/pio-build-cache

# ccache configuration
ENV IDF_CCACHE_ENABLE=1
ENV CCACHE_DIR=/data/ccache
ENV CCACHE_BASEDIR=/tmp/esphome-builds
ENV CCACHE_NOHASHDIR=true
ENV CCACHE_SLOPPINESS=pch_defines,time_macros,include_file_mtime,include_file_ctime
ENV CCACHE_MAXSIZE=10G
ENV CCACHE_COMPRESS=true
ENV CCACHE_COMPRESSLEVEL=1

CMD ["bun", "run", "packages/editor/build/index.js"]
