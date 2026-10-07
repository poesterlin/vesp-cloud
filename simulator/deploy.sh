#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "${1:-}" == "--lvgl" ]]; then
  bun run generate-lvgl.ts --theme "${2:-modern}" "${3:-lvgl-demo.json}" --output generated/live-lvgl
  export SIMULATOR_GENERATED_DIR=generated/live-lvgl
elif [[ "${1:-}" == "--gallery" ]]; then
  bun run generate.ts --gallery
else
  bun run generate.ts "${1:-demo.json}"
fi
docker compose up -d --build --wait
