# HA Metadata Exporter

Home Assistant integration focused on exporting Home Assistant metadata for editor tooling.

## Features

- **Metadata export** — WebSocket API that exposes all HA entities, services, devices, and areas for the web editor
- **Custom panel** — built-in dashboard panel at `/display-metadata`

## Metadata export

The websocket command `esphome_display/export` returns all HA metadata (entities, services, devices, and areas) with sensitive attributes stripped. This payload is consumed by the web editor to power pickers and codegen configuration.

## Configuration

### UI (recommended)

**Settings -> Devices & Services -> Add Integration -> HA Metadata Exporter**

### YAML

The integration is config-flow based. Add it from UI.

## Installation

### HACS

Add this repository as a custom integration in HACS.

### Manual

```bash
cp -r custom_components/esphome_display /config/custom_components/
```

Restart Home Assistant, then add the integration via UI.

**Requires Home Assistant 2024.1.0+**
