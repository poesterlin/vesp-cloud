FROM oven/bun:1 AS builder

RUN apt-get update && apt-get install -y \
    docker.io \
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

# Copy packages
COPY packages ./packages

# Install dependencies
RUN bun install --frozen-lockfile

# Build all packages
RUN bun run build

# Production image
FROM oven/bun:1

RUN apt-get update && apt-get install -y \
    docker.io && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/bunfig.toml ./bunfig.toml
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
ENV CONCURRENT_JOBS=2
ENV ESPHOME_VENV=/opt/esphome-venv

# EXPOSE 5173

CMD ["bun", "run", "packages/editor/build/index.js"]