# ESPHome Visual Display Editor

A comprehensive visual design system and code generation suite for ESPHome-powered displays. This project allows you to design rich, interactive user interfaces for microcontrollers using a modern web-based editor and deploy them with Home Assistant integration.

## 🚀 Key Features

- **Visual Canvas Editor**: Drag-and-drop interface built with Svelte 5 for designing display layouts.
- **Schema-Driven Architecture**: A single JSON schema defines components, ensuring perfect synchronization between the web preview and generated C++ code.
- **Dual-Mode Navigation**: Implements a "Dashboard Carousel" for high-level status and "Detail Views" for deep-dive control/monitoring.
- **Retro Aesthetic**: Built-in "Retro" theme replicating classic UI styles with decorative corners, shadows, and procedural icons.
- **Home Assistant Integration**: 
    - Native entity bindings for sensors and controls.
    - Custom Home Assistant component for advanced features like interactive notifications.
- **Automated Codegen**: Generates complete ESPHome YAML and optimized C++ headers (`state_manager.h`, `touch_handler.h`, `display_renderer.h`).

## 🏗️ Project Structure

```text
home-display/
├── custom_components/    # Home Assistant custom integration (esphome_display)
├── esphome/              # ESPHome configuration and C++ header templates
│   ├── includes/         # Manual and generated C++ headers
│   └── packages/         # Reusable ESPHome YAML packages
├── web/                  # Web-based Visual Editor (Monorepo)
│   ├── packages/
│   │   ├── editor/       # Svelte 5 application
│   │   └── schema/       # JSON Schema and Type/Code Generators
└── docs/                 # Architectural and Phase-based documentation
```

## 🛠️ Tech Stack

- **Frontend**: Svelte 5 (Runes), TypeScript, Tailwind CSS, Bun.
- **Backend/Codegen**: Node.js/Bun, JSON Schema, `json-schema-to-typescript`.
- **Firmware**: ESPHome, C++20.
- **Integration**: Python (Home Assistant Custom Component).

## 🗺️ Roadmap

### Phase 1: Core Framework (In Progress)
- [x] Monorepo scaffolding and project stores.
- [x] JSON Schema definition for core components (Buttons, Gauges, Text).
- [x] Basic SVG-based web renderers.
- [x] Initial C++ and YAML generators.

### Phase 2: State & Navigation (Implementation)
- [x] Automated `state_manager.h` generation.
- [x] Global state tracking for Home Assistant sensors.
- [x] Navigation enum and ViewState management.

### Phase 3: Interaction & Binding
- [x] Automated `touch_handler.h` generation (Hit-box detection).
- [x] Home Assistant service call integration.
- [x] Automated `sensors.yaml` generation for HA entity tracking.

### Phase 4: Advanced Features (Planned)
- [ ] Live preview on real devices via ESPHome API.
- [ ] Interactive Notification System (Service-based).
- [ ] Asset management (Fonts, Icons, Sprites).

## 🚦 Getting Started

### Web Editor
1. Navigate to `web/`.
2. Install dependencies: `bun install`.
3. Start the dev server: `bun run dev --filter @esphome-designer/editor`.

### ESPHome Firmware
1. Ensure you have ESPHome installed.
2. Navigate to `esphome/`.
3. Compile the display config: `esphome compile my-display.yaml`.

### Home Assistant Component
1. Copy `custom_components/esphome_display` to your Home Assistant `config/custom_components/` directory.
2. Add `esphome_display:` to your `configuration.yaml`.

## 📖 Documentation

- [Web Architecture](./docs/WEB_ARCHITECTURE.md)
- [Integration Setup](./docs/INTEGRATION_SETUP.md)
- [Notification System](./docs/NOTIFICATIONS.md)
- [Phase 1 Plan](./docs/PHASE_1.md)

---
*Created and maintained for high-performance, low-latency home automation displays.*
