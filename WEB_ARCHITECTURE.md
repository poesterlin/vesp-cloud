# WEB_ARCHITECTURE.md - ESPHome Visual Display Editor

**Purpose:** Architectural guidance for building a web-based visual editor that generates ESPHome display code.

**Last Updated:** 1/17/2026  
**Status:** Reference documentation for full-stack development

---

## Overview

This document describes a complete Svelte-based web canvas editor system that allows users to:
- Visually design display pages with drag-and-drop components
- Configure components (buttons, text, sliders, gauges) with Home Assistant entity bindings
- Link components to Home Assistant entities and service calls
- Export fully functional ESPHome YAML and C++ code
- Keep web preview synchronized with actual ESP rendering

The architecture uses a **schema-driven** approach where a single JSON schema serves as the source of truth for generating both TypeScript types and C++ rendering code. This ensures consistency between the web preview and the generated ESP firmware.

---

## Architecture Philosophy

### Key Principles

| Principle | Benefit |
|-----------|---------|
| **Single Source of Truth** | One JSON schema generates TS types and C++ code |
| **Schema-Driven** | TypeScript types and C++ renderers auto-generated from schema |
| **Separation of Concerns** | Schema → Types → UI → Codegen (clear dependency chain) |
| **Preview Accuracy** | Web renderer must exactly match ESP rendering to build trust |
| **No Manual Sync** | Type changes propagate automatically to all consumers |
| **Modular Codegen** | Generate YAML and C++ independently from schema |

### Decision: Server-Side Rendering Considerations

For your use case (display configuration editor), this is primarily about **code generation**, not rendering. However, understanding rendering trade-offs is useful:

**Local (ESP) Rendering:**
- Touch interaction latency: ~16ms
- Works offline
- Limited complexity (basic shapes, text, simple gauges)

**Server-Side Rendering:**
- Useful for: complex charts, historical data visualization, image overlays
- Trade-off: 100-500ms latency (poor for interactive elements)
- Recommendation: **Hybrid approach** - local for UI chrome, server for content

**For the editor:** Generate code that uses local rendering for immediate interactivity, with optional server-rendered charts via MQTT/HTTP.

---

## Project Structure

```text
esphome-designer/
├── packages/
│   ├── schema/
│   │   ├── components.json           # JSON Schema (single source of truth)
│   │   ├── generate-types.ts         # Script to generate TS types
│   │   └── dist/
│   │       └── types.ts              # AUTO-GENERATED TypeScript types
│   │
│   ├── editor/                       # Svelte web application
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── components/
│   │   │   │   │   ├── canvas/
│   │   │   │   │   │   ├── DesignCanvas.svelte
│   │   │   │   │   │   ├── renderers/
│   │   │   │   │   │   │   ├── ButtonRenderer.svelte
│   │   │   │   │   │   │   ├── TextRenderer.svelte
│   │   │   │   │   │   │   ├── SliderRenderer.svelte
│   │   │   │   │   │   │   ├── GaugeRenderer.svelte
│   │   │   │   │   │   │   └── index.ts
│   │   │   │   │   │   └── SelectionOverlay.svelte
│   │   │   │   │   ├── sidebar/
│   │   │   │   │   │   ├── ComponentPalette.svelte
│   │   │   │   │   │   ├── PropertyEditor.svelte
│   │   │   │   │   │   └── EntityPicker.svelte
│   │   │   │   │   └── toolbar/
│   │   │   │   ├── stores/
│   │   │   │   │   ├── project.svelte.ts    # Project state (Svelte 5 runes)
│   │   │   │   │   ├── selection.svelte.ts  # UI selection state
│   │   │   │   │   └── history.svelte.ts    # Undo/redo stack
│   │   │   │   ├── codegen/
│   │   │   │   │   ├── esphome.ts           # YAML generator
│   │   │   │   │   ├── cpp.ts               # C++ code generator
│   │   │   │   │   └── templates/           # Code templates (optional)
│   │   │   │   └── utils/
│   │   │   ├── routes/
│   │   │   └── app.html
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   └── codegen/                      # Optional: standalone CLI
│       ├── src/
│       │   ├── generators/
│       │   │   ├── yaml.ts
│       │   │   └── cpp.ts
│       │   └── cli.ts
│       └── package.json
│
├── pnpm-workspace.yaml
└── package.json
```

---

## Core Data Model: Component Schema

The JSON schema defines all possible components and their properties. This is the **single source of truth**.

---

## Phase 1 Implementation: Dual-Mode Navigation & Core Components

Based on the hand-coded reference, the generator and UI will prioritize a dual-mode interaction model.

### 1. Global Navigation Logic (Hardcoded Pattern)
Every project follows a fixed navigation structure:
- **Main Dashboard (Carousel):**
    - Horizontal Swipes (Left/Right) switch between root pages.
    - Pages are **fixed height** (240x320) and non-scrollable.
    - *Reference:* `esphome/includes/state_manager.h` (`ViewState`, `mainPageIndex`) and `esphome/includes/touch_handler.h`.
- **Detail Views (Apps):**
    - Vertically scrollable.
    - Triggered by `openDetail(viewId)` action.
    - Includes a hardcoded "Back" button that resets `viewMode` to `DASHBOARD`.
    - *Reference:* `esphome/includes/render_details.h` and `esphome/includes/render_detail_*.h`.

### 2. The "Retro" Visual Language
Components support a `variant` property. The default "retro" variant replicates the hand-coded aesthetic:
- **RetroContainer:** Implements `drawRetroBox` with decorative corners and label cutouts.
- **Button:** Supports loading states (circle animation) and debouncing logic.
- *Reference:* `esphome/includes/render_helpers.h` (`drawRetroBox`) and `esphome/includes/button.h`.

### 3. Special Components

#### IconComponent (Procedural Icons)
Instead of raster images, we use procedural drawing functions:
```json
{
  "type": "icon",
  "iconType": "bulb | window | vacuum | climate",
  "stateBinding": { "entityId": "light.living_room" },
  "color": { "r": 255, "g": 200, "b": 0 }
}
```
*Reference:* `esphome/includes/render_helpers.h` (`drawBulbIcon`, `drawWindowIcon`).

#### MusicComponent (Media Player)
A compound component mirroring the hand-coded music page:
```json
{
  "type": "music_player",
  "entityId": "media_player.spotify",
  "showVisualizer": true,
  "controls": ["play", "skip", "like"]
}
```
*Reference:* `esphome/includes/render_pages.h` (`renderPage1_Music`) and `esphome/includes/scrolling_text.h`.

### 5. Project Creation & Initialization
The editor supports configurable project creation:
- **Display Configuration:** Set dimensions (width/height) and platform (ILI9XXX, ST7789, etc.) at creation.
- **Initial Content Scaffolding:** 
    - Specify number of initial dashboard pages.
    - List detail views (e.g., "Vacuum, Climate, Lights") to auto-generate placeholders.
- **Theme Selection:** Default "Retro" theme applied, but configurable via `ProjectConfig`.

---

## Component Schema Details

To support the transition from manual C++ to generated code, the following additions to `components.json` are required:

### 1. View Definitions
```json
"ViewMode": {
  "enum": ["DASHBOARD", "DETAIL"]
},
"DetailView": {
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "title": { "type": "string" },
    "components": { "type": "array", "items": { "$ref": "#/definitions/Component" } },
    "maxScrollY": { "type": "number" }
  }
}
```

### 2. Action Schema Extension
Add navigation-specific actions to `ActionBinding`:
```json
"NavigationAction": {
  "type": "object",
  "properties": {
    "type": { "enum": ["OPEN_DETAIL", "GO_BACK", "NEXT_PAGE", "PREV_PAGE"] },
    "targetId": { "type": "string" }
  }
}
```

### 3. Component "Retro" Properties
Add `variant` and `loadingBinding` to `BaseComponent`:
```json
"BaseComponent": {
  "properties": {
    "variant": { "enum": ["default", "retro", "minimal"], "default": "retro" },
    "loadingBinding": { "$ref": "#/definitions/EntityBinding" },
    "onTap": { "$ref": "#/definitions/ActionBinding" }
  }
}
```

---

## Component Schema Details

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "definitions": {
    "Position": {
      "type": "object",
      "properties": {
        "x": { "type": "number" },
        "y": { "type": "number" }
      },
      "required": ["x", "y"]
    },
    "Size": {
      "type": "object",
      "properties": {
        "width": { "type": "number" },
        "height": { "type": "number" }
      },
      "required": ["width", "height"]
    },
    "Color": {
      "type": "object",
      "properties": {
        "r": { "type": "integer", "minimum": 0, "maximum": 255 },
        "g": { "type": "integer", "minimum": 0, "maximum": 255 },
        "b": { "type": "integer", "minimum": 0, "maximum": 255 }
      },
      "required": ["r", "g", "b"]
    },
    "EntityBinding": {
      "type": "object",
      "properties": {
        "entityId": { "type": "string", "pattern": "^[a-z_]+\\.[a-z_0-9]+$" },
        "attribute": { "type": ["string", "null"] }
      },
      "required": ["entityId"]
    },
    "ActionBinding": {
      "type": "object",
      "properties": {
        "service": { "type": "string", "pattern": "^[a-z_]+\\.[a-z_0-9]+$" },
        "target": { "$ref": "#/definitions/EntityBinding" },
        "data": { "type": "object" }
      },
      "required": ["service"]
    },
    "BaseComponent": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "type": { "type": "string" },
        "position": { "$ref": "#/definitions/Position" },
        "size": { "$ref": "#/definitions/Size" },
        "visible": { "type": "boolean", "default": true },
        "visibleWhen": { "$ref": "#/definitions/EntityBinding" }
      },
      "required": ["id", "type", "position"]
    },
    "TextComponent": {
      "allOf": [
        { "$ref": "#/definitions/BaseComponent" },
        {
          "properties": {
            "type": { "const": "text" },
            "text": { "type": "string" },
            "textBinding": { "$ref": "#/definitions/EntityBinding" },
            "fontSize": { "enum": ["small", "medium", "large"] },
            "color": { "$ref": "#/definitions/Color" },
            "align": { "enum": ["left", "center", "right"] }
          }
        }
      ]
    },
    "ButtonComponent": {
      "allOf": [
        { "$ref": "#/definitions/BaseComponent" },
        {
          "properties": {
            "type": { "const": "button" },
            "label": { "type": "string" },
            "icon": { "type": "string" },
            "backgroundColor": { "$ref": "#/definitions/Color" },
            "pressAction": { "$ref": "#/definitions/ActionBinding" },
            "holdAction": { "$ref": "#/definitions/ActionBinding" }
          },
          "required": ["size"]
        }
      ]
    },
    "SliderComponent": {
      "allOf": [
        { "$ref": "#/definitions/BaseComponent" },
        {
          "properties": {
            "type": { "const": "slider" },
            "min": { "type": "number", "default": 0 },
            "max": { "type": "number", "default": 100 },
            "step": { "type": "number", "default": 1 },
            "valueBinding": { "$ref": "#/definitions/EntityBinding" },
            "onChange": { "$ref": "#/definitions/ActionBinding" },
            "orientation": { "enum": ["horizontal", "vertical"] }
          },
          "required": ["size"]
        }
      ]
    },
    "GaugeComponent": {
      "allOf": [
        { "$ref": "#/definitions/BaseComponent" },
        {
          "properties": {
            "type": { "const": "gauge" },
            "min": { "type": "number" },
            "max": { "type": "number" },
            "valueBinding": { "$ref": "#/definitions/EntityBinding" },
            "unit": { "type": "string" },
            "segments": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "from": { "type": "number" },
                  "to": { "type": "number" },
                  "color": { "$ref": "#/definitions/Color" }
                }
              }
            }
          },
          "required": ["size", "min", "max"]
        }
      ]
    },
    "Component": {
      "oneOf": [
        { "$ref": "#/definitions/TextComponent" },
        { "$ref": "#/definitions/ButtonComponent" },
        { "$ref": "#/definitions/SliderComponent" },
        { "$ref": "#/definitions/GaugeComponent" }
      ]
    },
    "Page": {
      "type": "object",
      "properties": {
        "id": { "type": "string" },
        "name": { "type": "string" },
        "backgroundColor": { "$ref": "#/definitions/Color" },
        "components": {
          "type": "array",
          "items": { "$ref": "#/definitions/Component" }
        }
      },
      "required": ["id", "name", "components"]
    },
    "Project": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "display": {
          "type": "object",
          "properties": {
            "width": { "type": "integer" },
            "height": { "type": "integer" },
            "platform": { "enum": ["ili9xxx", "st7789", "ssd1306", "waveshare_epaper"] }
          }
        },
        "pages": {
          "type": "array",
          "items": { "$ref": "#/definitions/Page" }
        },
        "fonts": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "file": { "type": "string" },
              "size": { "type": "integer" }
            }
          }
        }
      },
      "required": ["name", "display", "pages"]
    }
  }
}
```

### Schema Usage Pattern

1. Define component properties in `components.json`
2. Run `pnpm run generate:types` to auto-generate TypeScript types
3. Import types in Svelte components and codegen modules
4. Both web UI and C++ code generation use the same type definitions
5. Changes to schema automatically propagate everywhere

---

## Codegen: TypeScript Type Generation

Convert the JSON schema to TypeScript types automatically:

```typescript
// packages/schema/generate-types.ts
import { compile } from "json-schema-to-typescript";
import fs from "fs/promises";

async function generate() {
  const schema = JSON.parse(
    await fs.readFile("./components.json", "utf-8")
  );

  // Generate the Project type (which includes all nested types)
  const ts = await compile(schema.definitions.Project, "Project", {
    additionalProperties: false,
    bannerComment: "// AUTO-GENERATED - DO NOT EDIT\n// Run: pnpm run generate:types",
  });

  await fs.writeFile("./dist/types.ts", ts);
  console.log("✓ Generated types.ts");
}

generate().catch(console.error);
```

Generated types are then used throughout the codebase:

```typescript
// packages/editor/src/lib/stores/project.svelte.ts
import type { Project, Page, Component } from "@esphome-designer/schema";

function createProjectStore() {
  let project = $state<Project>({
    name: "New Project",
    display: { width: 320, height: 240, platform: "ili9xxx" },
    pages: [{ id: "page-1", name: "Home", components: [] }],
    fonts: [],
  });

  return {
    get project() { return project; },
    addPage(page: Page) {
      project.pages.push(page);
    },
    addComponent(component: Component) {
      // Type-safe component addition
      project.pages[0].components.push(component);
    },
  };
}
```

---

## Web UI: Svelte Canvas Editor

### Design Canvas Component

```svelte
<!-- packages/editor/src/lib/components/canvas/DesignCanvas.svelte -->
<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import ComponentRenderer from "./renderers/ComponentRenderer.svelte";
  import SelectionOverlay from "./SelectionOverlay.svelte";

  let canvasEl: HTMLDivElement;

  function handleCanvasClick(e: MouseEvent) {
    if (e.target === canvasEl) {
      selectionStore.clear();
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const componentType = e.dataTransfer?.getData("component-type");
    if (!componentType) return;

    const rect = canvasEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    projectStore.addComponent({
      id: crypto.randomUUID(),
      type: componentType,
      position: { x, y },
      size: { width: 100, height: 40 },
    } as any);
  }
</script>

<div
  class="canvas-container"
  style:width="{projectStore.project.display.width}px"
  style:height="{projectStore.project.display.height}px"
  bind:this={canvasEl}
  onclick={handleCanvasClick}
  ondrop={handleDrop}
  ondragover={(e) => e.preventDefault()}
>
  {#each projectStore.currentPage.components as component (component.id)}
    <ComponentRenderer {component} />
  {/each}

  <SelectionOverlay />
</div>

<style>
  .canvas-container {
    position: relative;
    background: #1a1a1a;
    border: 2px solid #333;
    overflow: hidden;
  }
</style>
```

### Component Renderer Pattern

Each component type has a dedicated renderer that mirrors the ESP rendering:

```svelte
<!-- packages/editor/src/lib/components/canvas/renderers/GaugeRenderer.svelte -->
<script lang="ts">
  import type { GaugeComponent } from "@esphome-designer/schema";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import Draggable from "../Draggable.svelte";

  interface Props {
    component: GaugeComponent;
  }

  let { component }: Props = $props();

  // Mock value for preview
  let previewValue = $state(65);

  const normalizedValue = $derived(
    (previewValue - component.min) / (component.max - component.min)
  );
  const angle = $derived(-135 + normalizedValue * 270);
  const isSelected = $derived(selectionStore.selectedIds.has(component.id));
</script>

<Draggable {component}>
  <svg
    width={component.size.width}
    height={component.size.height}
    class="gauge"
    class:selected={isSelected}
  >
    <!-- Background arc -->
    <circle
      cx={component.size.width / 2}
      cy={component.size.height / 2}
      r={Math.min(component.size.width, component.size.height) / 2 - 5}
      fill="#2a2a2a"
      stroke="#444"
    />

    <!-- Needle (animated based on value) -->
    <line
      x1={component.size.width / 2}
      y1={component.size.height / 2}
      x2={component.size.width / 2 + Math.cos((angle * Math.PI) / 180) * 30}
      y2={component.size.height / 2 + Math.sin((angle * Math.PI) / 180) * 30}
      stroke="#ff6b00"
      stroke-width="2"
    />

    <!-- Value text -->
    <text
      x={component.size.width / 2}
      y={component.size.height / 2 + 20}
      text-anchor="middle"
      fill="white"
      font-size="14"
    >
      {previewValue}{component.unit ?? ""}
    </text>
  </svg>
</Draggable>

<style>
  .gauge {
    cursor: move;
  }
  .gauge.selected {
    outline: 2px solid #4a9eff;
  }
</style>
```

### State Management Pattern (Svelte 5 Runes)

```typescript
// packages/editor/src/lib/stores/project.svelte.ts
import type { Project, Page, Component } from "@esphome-designer/schema";

function createProjectStore() {
  let project = $state<Project>({
    name: "New Project",
    display: { width: 320, height: 240, platform: "ili9xxx" },
    pages: [{ id: "page-1", name: "Home", components: [] }],
    fonts: [],
  });

  let currentPageId = $state("page-1");

  const currentPage = $derived(
    project.pages.find((p) => p.id === currentPageId)!
  );

  return {
    get project() { return project; },
    get currentPage() { return currentPage; },
    get currentPageId() { return currentPageId; },

    setCurrentPage(id: string) {
      currentPageId = id;
    },

    addPage(page: Page) {
      project.pages.push(page);
    },

    addComponent(component: Component) {
      currentPage.components.push(component);
    },

    updateComponent(id: string, updates: Partial<Component>) {
      const idx = currentPage.components.findIndex((c) => c.id === id);
      if (idx !== -1) {
        currentPage.components[idx] = {
          ...currentPage.components[idx],
          ...updates,
        } as Component;
      }
    },

    deleteComponent(id: string) {
      const idx = currentPage.components.findIndex((c) => c.id === id);
      if (idx !== -1) {
        currentPage.components.splice(idx, 1);
      }
    },

    exportJSON(): string {
      return JSON.stringify(project, null, 2);
    },

    loadProject(p: Project) {
      project = p;
      currentPageId = p.pages[0]?.id ?? "";
    },
  };
}

export const projectStore = createProjectStore();
```

---

## Codegen: ESPHome YAML Generation

```typescript
// packages/editor/src/lib/codegen/esphome.ts
import type { Project, Component } from "@esphome-designer/schema";

export function generateESPHomeYAML(project: Project): string {
  const lines: string[] = [];

  lines.push(`# Generated by ESPHome Designer`);
  lines.push(`# Project: ${project.name}`);
  lines.push(``);

  // Substitutions
  lines.push(`substitutions:`);
  lines.push(`  device_name: ${project.name.toLowerCase().replace(/\s+/g, "-")}`);
  lines.push(``);

  // ESPHome core
  lines.push(`esphome:`);
  lines.push(`  name: \${device_name}`);
  lines.push(`  includes:`);
  lines.push(`    - generated/display_renderer.h`);
  lines.push(``);

  // Display hardware config
  lines.push(`display:`);
  lines.push(`  - platform: ${project.display.platform}`);
  lines.push(`    id: main_display`);
  lines.push(`    dimensions:`);
  lines.push(`      width: ${project.display.width}`);
  lines.push(`      height: ${project.display.height}`);
  lines.push(`    lambda: |-`);
  lines.push(`      renderDisplay(it, currentPage);`);
  lines.push(``);

  // Fonts
  lines.push(`font:`);
  for (const font of project.fonts) {
    lines.push(`  - file: "${font.file}"`);
    lines.push(`    id: ${font.id}`);
    lines.push(`    size: ${font.size}`);
  }
  lines.push(``);

  // Extract and generate HA sensor bindings
  const bindings = extractAllBindings(project);

  if (bindings.sensors.length > 0) {
    lines.push(`sensor:`);
    for (const entity of bindings.sensors) {
      lines.push(`  - platform: homeassistant`);
      lines.push(`    id: ${entityToId(entity)}`);
      lines.push(`    entity_id: ${entity}`);
      lines.push(`    internal: true`);
    }
    lines.push(``);
  }

  if (bindings.textSensors.length > 0) {
    lines.push(`text_sensor:`);
    for (const entity of bindings.textSensors) {
      lines.push(`  - platform: homeassistant`);
      lines.push(`    id: ${entityToId(entity)}`);
      lines.push(`    entity_id: ${entity}`);
      lines.push(`    internal: true`);
    }
    lines.push(``);
  }

  // Globals for page state
  lines.push(`globals:`);
  lines.push(`  - id: current_page`);
  lines.push(`    type: int`);
  lines.push(`    initial_value: "0"`);

  return lines.join("\n");
}

function extractAllBindings(project: Project) {
  const sensors = new Set<string>();
  const textSensors = new Set<string>();

  for (const page of project.pages) {
    for (const comp of page.components) {
      if ("valueBinding" in comp && comp.valueBinding) {
        sensors.add(comp.valueBinding.entityId);
      }
      if ("textBinding" in comp && comp.textBinding) {
        textSensors.add(comp.textBinding.entityId);
      }
    }
  }

  return {
    sensors: [...sensors],
    textSensors: [...textSensors],
  };
}

function entityToId(entity: string): string {
  return "ha_" + entity.replace(/\./g, "_");
}
```

---

## Codegen: C++ Renderer Generation

```typescript
// packages/editor/src/lib/codegen/cpp.ts
import type { Project, Component, GaugeComponent, ButtonComponent, Color } from "@esphome-designer/schema";

export function generateCppRenderer(project: Project): string {
  const lines: string[] = [];

  lines.push(`// AUTO-GENERATED by ESPHome Designer`);
  lines.push(`#pragma once`);
  lines.push(`#include "esphome.h"`);
  lines.push(``);

  // Forward declarations
  lines.push(`extern int currentPage;`);
  lines.push(``);

  // Generate page render functions
  for (let i = 0; i < project.pages.length; i++) {
    const page = project.pages[i];
    lines.push(generatePageRenderer(page, i, project));
    lines.push(``);
  }

  // Main render dispatcher
  lines.push(`void renderDisplay(display::Display& it, int page) {`);
  lines.push(`  it.fill(Color::BLACK);`);
  lines.push(`  switch (page) {`);
  for (let i = 0; i < project.pages.length; i++) {
    lines.push(`    case ${i}: renderPage${i}(it); break;`);
  }
  lines.push(`  }`);
  lines.push(`}`);

  return lines.join("\n");
}

function generatePageRenderer(page: any, index: number, project: Project): string {
  const lines: string[] = [];

  lines.push(`void renderPage${index}(display::Display& it) {`);

  if (page.backgroundColor) {
    lines.push(`  it.fill(${colorToCpp(page.backgroundColor)});`);
  }

  for (const comp of page.components) {
    lines.push(generateComponentCode(comp, project));
  }

  lines.push(`}`);
  return lines.join("\n");
}

function generateComponentCode(comp: Component, project: Project): string {
  switch (comp.type) {
    case "text":
      return generateTextCode(comp);
    case "button":
      return generateButtonCode(comp as ButtonComponent);
    case "gauge":
      return generateGaugeCode(comp as GaugeComponent);
    case "slider":
      return generateSliderCode(comp);
    default:
      return `  // Unknown component type: ${comp.type}`;
  }
}

function generateGaugeCode(comp: GaugeComponent): string {
  const cx = comp.position.x + comp.size.width / 2;
  const cy = comp.position.y + comp.size.height / 2;
  const radius = Math.min(comp.size.width, comp.size.height) / 2 - 5;

  const valueSource = comp.valueBinding
    ? `id(${entityToId(comp.valueBinding.entityId)}).state`
    : "0";

  return `
  // Gauge: ${comp.id}
  {
    float value = ${valueSource};
    float normalized = (value - ${comp.min}f) / (${comp.max}f - ${comp.min}f);
    normalized = fmax(0.0f, fmin(1.0f, normalized));
    float angle = -135.0f + (normalized * 270.0f);
    float radians = angle * PI / 180.0f;

    // Background circle
    it.filled_circle(${cx}, ${cy}, ${radius}, Color(42, 42, 42));

    // Needle
    int needleLen = ${radius - 15};
    int endX = ${cx} + (int)(needleLen * cos(radians));
    int endY = ${cy} + (int)(needleLen * sin(radians));
    it.line(${cx}, ${cy}, endX, endY, Color(255, 107, 0));

    // Center dot
    it.filled_circle(${cx}, ${cy}, 4, Color(255, 107, 0));

    // Value text
    char buf[16];
    snprintf(buf, sizeof(buf), "%.0f${comp.unit ?? ""}", value);
    it.printf(${cx}, ${cy + 20}, id(font_medium), TextAlign::CENTER, "%s", buf);
  }`;
}

function generateButtonCode(comp: ButtonComponent): string {
  const bgColor = comp.backgroundColor ?? { r: 50, g: 50, b: 50 };

  return `
  // Button: ${comp.id}
  it.filled_rectangle(${comp.position.x}, ${comp.position.y}, ${comp.size.width}, ${comp.size.height}, ${colorToCpp(bgColor)});
  it.rectangle(${comp.position.x}, ${comp.position.y}, ${comp.size.width}, ${comp.size.height}, Color(100, 100, 100));
  it.printf(${comp.position.x + comp.size.width / 2}, ${comp.position.y + comp.size.height / 2}, id(font_medium), TextAlign::CENTER, "${comp.label ?? ""}");`;
}

function generateTextCode(comp: any): string {
  const textSource = comp.textBinding
    ? `id(${entityToId(comp.textBinding.entityId)}).state.c_str()`
    : `"${comp.text ?? ""}"`;

  const color = comp.color ?? { r: 255, g: 255, b: 255 };

  return `
  // Text: ${comp.id}
  it.printf(${comp.position.x}, ${comp.position.y}, id(font_medium), ${colorToCpp(color)}, TextAlign::TOP_LEFT, ${textSource});`;
}

function generateSliderCode(comp: any): string {
  // Sliders are complex with touch handling - placeholder
  return `
  // Slider: ${comp.id}
  it.rectangle(${comp.position.x}, ${comp.position.y}, ${comp.size.width}, ${comp.size.height}, Color(100, 100, 100));`;
}

function colorToCpp(c: Color): string {
  return `Color(${c.r}, ${c.g}, ${c.b})`;
}

function entityToId(entity: string): string {
  return "ha_" + entity.replace(/\./g, "_");
}
```

---

## Export & Integration

### Export Panel UI

```svelte
<!-- packages/editor/src/lib/components/ExportPanel.svelte -->
<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { generateESPHomeYAML } from "$lib/codegen/esphome";
  import { generateCppRenderer } from "$lib/codegen/cpp";

  let yamlOutput = $state("");
  let cppOutput = $state("");
  let activeTab = $state<"yaml" | "cpp" | "json">("yaml");

  function generate() {
    yamlOutput = generateESPHomeYAML(projectStore.project);
    cppOutput = generateCppRenderer(projectStore.project);
  }

  function downloadAll() {
    download("display.yaml", yamlOutput);
    download("display_renderer.h", cppOutput);
    download("project.json", projectStore.exportJSON());
  }

  function download(filename: string, content: string) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<div class="export-panel">
  <button onclick={generate} class="primary">Generate Code</button>
  <button onclick={downloadAll}>Download All</button>

  <div class="tabs">
    <button class:active={activeTab === "yaml"} onclick={() => (activeTab = "yaml")}>YAML</button>
    <button class:active={activeTab === "cpp"} onclick={() => (activeTab = "cpp")}>C++</button>
    <button class:active={activeTab === "json"} onclick={() => (activeTab = "json")}>JSON</button>
  </div>

  <pre><code>
    {#if activeTab === "yaml"}
      {yamlOutput}
    {:else if activeTab === "cpp"}
      {cppOutput}
    {:else}
      {projectStore.exportJSON()}
    {/if}
  </code></pre>
</div>

<style>
  .export-panel {
    padding: 20px;
    background: #2a2a2a;
    border-radius: 8px;
  }

  button {
    padding: 8px 16px;
    margin-right: 8px;
    background: #333;
    border: 1px solid #555;
    color: #fff;
    border-radius: 4px;
    cursor: pointer;
  }

  button.primary {
    background: #4a9eff;
    border-color: #4a9eff;
  }

  button.active {
    background: #4a9eff;
  }

  pre {
    background: #1a1a1a;
    padding: 12px;
    border-radius: 4px;
    overflow-x: auto;
    max-height: 400px;
  }
</style>
```

---

## Workflow: Adding a New Component Type

### Step 1: Update Schema

Add the new component definition to `packages/schema/components.json`:

```json
"IconComponent": {
  "allOf": [
    { "$ref": "#/definitions/BaseComponent" },
    {
      "properties": {
        "type": { "const": "icon" },
        "icon": { "type": "string" },
        "color": { "$ref": "#/definitions/Color" },
        "scale": { "type": "number", "default": 1 }
      },
      "required": ["size", "icon"]
    }
  ]
},

// Add to Component oneOf:
"Component": {
  "oneOf": [
    // ... existing ...
    { "$ref": "#/definitions/IconComponent" }
  ]
}
```

### Step 2: Regenerate Types

```bash
pnpm run generate:types
```

Types automatically include `IconComponent`.

### Step 3: Create Svelte Renderer

```svelte
<!-- packages/editor/src/lib/components/canvas/renderers/IconRenderer.svelte -->
<script lang="ts">
  import type { IconComponent } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";

  interface Props {
    component: IconComponent;
  }

  let { component }: Props = $props();
</script>

<Draggable {component}>
  <div class="icon" style:scale={component.scale}>
    <!-- Render icon SVG or image -->
  </div>
</Draggable>
```

### Step 4: Create C++ Generator

```typescript
// In packages/editor/src/lib/codegen/cpp.ts

function generateIconCode(comp: any): string {
  return `
  // Icon: ${comp.id}
  // Render icon at position (${comp.position.x}, ${comp.position.y})
  it.printf(${comp.position.x}, ${comp.position.y}, nullptr, Color(${comp.color.r}, ${comp.color.g}, ${comp.color.b}), "${comp.icon}");`;
}

// Add to generateComponentCode:
case "icon":
  return generateIconCode(comp);
```

### Step 5: Update Component Dispatcher

Update `ComponentRenderer.svelte` to include the new renderer.

---

## Key Development Patterns

### ✅ DO's

1. **Always update the schema first** - it's the source of truth
2. **Generate types after schema changes** - keep TS types in sync
3. **Keep web renderers visually identical to C++ renderers** - build user trust
4. **Use TypeScript strict mode** - catch type errors early
5. **Mock entity values in preview** - let users see live updates
6. **Test codegen output** - actually compile generated YAML/C++

### ❌ DON'Ts

1. **Don't manually edit generated types** - they're auto-generated from schema
2. **Don't hardcode color values** - use the Color schema consistently
3. **Don't skip validation** - validate project JSON before export
4. **Don't leave TODO comments in generated code** - generated code should be production-ready
5. **Don't assume C++ behavior in Svelte** - test both renderers

---

## Testing Strategy

### Unit Tests: Type Generation

```typescript
// packages/schema/__tests__/types.test.ts
import { Project, Component, GaugeComponent } from "../dist/types";

test("GaugeComponent type validation", () => {
  const gauge: GaugeComponent = {
    id: "gauge-1",
    type: "gauge",
    position: { x: 10, y: 20 },
    size: { width: 100, height: 100 },
    min: 0,
    max: 100,
    valueBinding: { entityId: "sensor.temperature" },
  };

  expect(gauge.min).toBe(0);
  expect(gauge.max).toBe(100);
});
```

### Integration Tests: Codegen Output

```typescript
// packages/editor/__tests__/codegen.test.ts
import { generateCppRenderer } from "$lib/codegen/cpp";
import type { Project } from "@esphome-designer/schema";

test("generates valid C++ code", () => {
  const project: Project = {
    name: "Test",
    display: { width: 320, height: 240, platform: "ili9xxx" },
    pages: [{
      id: "p1",
      name: "Home",
      components: [{
        id: "text-1",
        type: "text",
        position: { x: 0, y: 0 },
        text: "Hello",
      } as any],
    }],
    fonts: [],
  };

  const cpp = generateCppRenderer(project);

  // Should contain valid C++ syntax
  expect(cpp).toContain("#pragma once");
  expect(cpp).toContain("void renderPage0");
  expect(cpp).toContain("Hello");
});
```

---

## Performance Considerations

### Web Editor

- **Canvas rendering:** Use SVG for crisp rendering at any zoom level
- **Large projects:** Virtualize component list if >100 components
- **Undo/redo:** Store delta changes, not full project snapshots
- **Preview updates:** Debounce property editor changes

### Code Generation

- **Template strings:** Use function composition over string interpolation
- **Memory:** Stream output for very large projects (1000+ components)
- **Validation:** Run quick lint before exporting to catch errors early

---

## Security Considerations

### Input Validation

- Validate all entity IDs match HA entity format (`domain.entity`)
- Sanitize component names (no shell metacharacters)
- Validate service calls target valid HA services
- Check component positions are within display bounds

### Generated Code

- Escape strings in generated C++ to prevent injection
- Validate all numeric values in acceptable ranges
- Don't generate untrusted HTML in preview

---

## Future Enhancements

| Feature | Benefit | Effort |
|---------|---------|--------|
| **Live preview on real ESP** | See actual rendering, not just web simulation | High |
| **Component library** | Reusable component templates | Medium |
| **Theme system** | Quick dark/light mode, custom color schemes | Medium |
| **Animation support** | Transitions, page swipes, value animations | High |
| **Touch gesture editor** | Visually define swipe zones and tap areas | High |
| **Collaborative editing** | Multiple users design simultaneously | Very High |
| **Version control integration** | Git diff projects, merge changes | Medium |

---

## References

- **ESPHome Documentation:** https://esphome.io
- **Home Assistant:** https://www.home-assistant.io
- **JSON Schema:** https://json-schema.org
- **Svelte 5 Runes:** https://svelte.dev/docs/svelte/runes
- **json-schema-to-typescript:** https://github.com/bcherny/json-schema-to-typescript

