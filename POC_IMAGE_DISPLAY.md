# Proof of Concept: Dynamic Vacuum Map Display

## Overview
This document preserves the findings and implementation details of the dynamic image display POC. The goal was to fetch and render a real-time vacuum map from Home Assistant on an ESP32-S3.

## Final Working Configuration

### 1. ESPHome Configuration (`packages/images.yaml`)
```yaml
online_image:
  - id: vacuum_map_image
    url: "http://10.0.0.241:8123/api/image_proxy/image.roborock_qrevo_curv_series_waldsee"
    request_headers:
      Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...[REST_OF_TOKEN]
    type: RGB565
    format: png
    resize: 200x150
    update_interval: 30s
```

### 2. Global HTTP Settings (`packages/base.yaml`)
```yaml
substitutions:
  ha_host: "10.0.0.241"

# Enable PSRAM
psram:
  mode: octal

http_request:
  useragent: esphome/device
  timeout: 10s
  verify_ssl: false
```

### 3. Rendering Logic (`includes/display_renderer.h`)
```cpp
// Within the Detail View rendering function:
int map_sy = getSY(ly);
it.image(20, map_sy, static_cast<esphome::image::Image*>(&(id(vacuum_map_image))), ImageAlign::TOP_LEFT);
```

## Key Findings

- **Authentication**: Home Assistant's `api/image_proxy` requires a Long-Lived Access Token passed via `request_headers`.
- **Format**: Vacuum maps are typically served as **PNG**. Explicitly setting `format: png` was necessary to avoid decoding errors (Error 4).
- **Network**: DNS resolution for `.local` was unreliable; using the static IP (`10.0.0.241`) resolved timeout issues.
- **SSL**: Disabling SSL verification (`verify_ssl: false`) is recommended for local HTTP traffic to save resources and avoid certificate issues.

## Challenges & Warnings

- **Missing Headers**: Logs reported `No header with name etag found`. This prevents caching, forcing a full redownload every interval.
- **Blocking**: Large image downloads (~14KB) occasionally blocked the main loop for >200ms, causing "api took a long time" warnings.
- **Latency**: Download times averaged ~9 seconds on the local network.

## Testing Script (`test_image.sh`)
```bash
#!/bin/bash
HA_HOST="10.0.0.241"
TOKEN="YOUR_TOKEN"
IMAGE_URL="http://${HA_HOST}:8123/api/image_proxy/image.roborock_qrevo_curv_series_waldsee"
curl -v -H "Authorization: Bearer ${TOKEN}" "${IMAGE_URL}" -o "test_image"
```