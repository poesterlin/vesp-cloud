# vESP.cloud

Visual editor and firmware generator for ESPHome touch displays.

<p align="center">
  <img src="web/packages/assets/imgs/logo-256x256.jpg" alt="vESP.cloud logo" width="220" />
</p>

## What Is vESP.cloud?

vESP.cloud lets you design dashboards visually, generate production ESPHome firmware,
and integrate with Home Assistant for real-world smart home control.

## Hardware Support

vESP.cloud currently supports only the **Guition ESP32-S3-4848S040** display module:

- **Display**: 480 x 480 RGB
- **Driver IC**: ST7701S
- **Touch Controller**: GT911

## Free Firmware Generation

You can generate the full ESPHome firmware code for free.

- Design your UI in the editor
- Export/download the generated YAML and C++ include files
- Build and flash with your own ESPHome setup at no cost

## Home Assistant HACS Component

The repository includes the `metadata-exporter` Home Assistant integration. 

[![Open your Home Assistant instance and open this repository inside HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=poesterlin&repository=vesp-cloud&category=integration)

## Screenshots

<p>
  <img src="web/packages/assets/screenshots/editor.png" alt="vESP.cloud editor" width="49%" />
  <img src="web/packages/assets/screenshots/device-screen-1.png" alt="vESP.cloud device UI" width="49%" />
</p>

## Core Stack

- **Frontend**: Svelte 5, TypeScript, Bun
- **Codegen**: TypeScript + JSON schema driven generation
- **Firmware**: ESPHome + C++ headers/templates
- **HA Integration**: Custom Home Assistant component (`custom_components/esphome_display`)

## Quick Start

### Web editor

1. Go to `web/`
2. Install deps: `bun install`
3. Run: `bun run dev`

### Home Assistant integration

#### HACS (recommended)

1. Open HACS in Home Assistant
2. Go to **Integrations** -> **Custom repositories**
3. Add `https://github.com/poesterlin/vesp-cloud` as an **Integration** repository
4. Install **vESP.cloud Notifications & Data Bridge**
5. Restart Home Assistant

#### Manual install

Copy `custom_components/esphome_display` into your Home Assistant
`config/custom_components/` directory.

### ESPHome test firmware

1. Make sure ESPHome is installed
2. Go to `esphome/`
3. Compile: `esphome compile my-display.yaml`

## Repository Layout

- `web/packages/editor/` - SvelteKit editor app
- `web/packages/schema/` - project/component schema package
- `web/packages/assets/` - shared brand assets and screenshots
- `esphome/` - firmware projects and references
- `custom_components/esphome_display/` - Home Assistant integration
