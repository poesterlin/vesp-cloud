#!/bin/sh
set -eu

WARMUP_DIR=/tmp/warmup
mkdir -p "$WARMUP_DIR"
trap 'rm -rf "$WARMUP_DIR"' EXIT

cat > "$WARMUP_DIR/warmup.yaml" <<'EOF'
esphome:
  name: warmup

esp32:
  variant: esp32s3
  cpu_frequency: 240MHz
  framework:
    type: esp-idf
    advanced:
      compiler_optimization: PERF

psram:
  mode: octal
  speed: 80MHz

logger:

api:

ota:
  - platform: esphome

wifi:
  ssid: warmup-network
  password: warmup-password

http_request:

i2c:
  sda: GPIO8
  scl: GPIO9

display:
  - platform: ssd1306_i2c
    model: SSD1306 128x64

# Pull JPEGDEC, esp-dsp and pngle into the baked PlatformIO/component caches.
image:
  - platform: online_image
    url: https://example.invalid/warmup.jpg
    id: warmup_jpeg
    format: jpeg
    type: RGB565
    resize: 364x222
  - platform: online_image
    url: https://example.invalid/warmup.png
    id: warmup_png
    format: png
    type: RGB565
    resize: 364x222
EOF

/opt/esphome-venv/bin/python -m esphome compile "$WARMUP_DIR/warmup.yaml"
