#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "${1:-}" == "--gallery" ]]; then
  bun run generate.ts --gallery
else
  bun run generate.ts "${1:-demo.json}"
fi
docker compose up -d --build --wait
