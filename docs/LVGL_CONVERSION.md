# LVGL Conversion Plan

## Overview

Convert the current C++ header-based rendering pipeline to ESPHome's native LVGL integration, replacing manual pixel rendering, touch handling, and state management with declarative YAML widgets.

## Current Architecture → LVGL Architecture

**Current**: The editor generates C++ headers (`state_manager.h`, `touch_handler.h`, `display_renderer.h`) with manual pixel-level rendering and custom touch hit-box detection.

**LVGL**: ESPHome's native LVGL integration handles rendering, touch, scrolling, and widget management declaratively in YAML.

## Key Changes

### 1. Codegen Overhaul (biggest effort)

`web/packages/editor/src/lib/codegen/esphome.ts` currently generates:

- **C++ headers** → Replace with **LVGL YAML** (`lvgl:` pages/widgets)
- **Manual touch handling** → Drop entirely (LVGL handles it)
- **Manual display rendering** → Drop entirely (LVGL handles it)
- **State manager** → Simplify to `sensor:` / `binary_sensor:` with `on_value:` → `lvgl.widget.update` patterns

### 2. Component Schema Mapping

Each component in `web/packages/schema/components.json` needs an LVGL equivalent:

| Editor Component | LVGL Widget | Notes |
|-----------------|-------------|-------|
| Button | `button:` | `checkable`, `on_click` |
| Text / Label | `label:` | `text_font`, `text_color` |
| Gauge | `arc:` or `bar:` | Native value indicators |
| Containers / Layout | `obj:` | `layout: flex` for flow |

### 3. Navigation Model Change

- **Current**: Custom C++ navigation enum, ViewState management
- **LVGL**: Native `page_wrap: true` with swipe gestures built-in (see `esphome/lvgl-test.yaml` for working 3-page demo)

### 4. Hardware Package

`esphome/packages/lvgl_hardware.yaml` replaces the current display/touch driver configuration.

### 5. What Can Be Dropped

- `touch_handler.h` generation (LVGL handles touch natively)
- `display_renderer.h` generation (LVGL renders widgets)
- Hit-box calculation logic
- Manual pixel drawing code
- The "retro aesthetic" C++ rendering (needs recreation as LVGL styles/themes)

### 6. What Gets Simpler

- **Scrollable lists** — free with LVGL (`obj:` with `scrollbar_mode: auto`)
- **State sync** — just `lvgl.widget.update` in `on_value`
- **Touch interactions** — declarative `on_click`, `on_value_change`

### 7. Risk / Effort Areas

- **Retro theme**: Custom aesthetic with decorative corners/shadows needs reimplementation as LVGL styles — may not map 1:1
- **Codegen rewrite**: The core generator is essentially a full rewrite from C++ output to YAML output
- **Schema changes**: Component properties need to align with LVGL widget properties instead of pixel coordinates

## Recommended Approach

1. Extend the LVGL demo (`esphome/lvgl-test.yaml`) to cover all component types the editor supports
2. Rewrite the codegen to target LVGL YAML structure
3. The editor UI and canvas can stay largely the same — only the output format changes

## Reference

- Working LVGL demo: `esphome/lvgl-test.yaml`
- Hardware config: `esphome/packages/lvgl_hardware.yaml`
