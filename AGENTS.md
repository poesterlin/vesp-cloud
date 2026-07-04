# Project Architecture

This repo contains three ESPHome display projects that share a common lineage.
They all target the same hardware (ESP32-S3 + ST7701S 480x480 display + GT911 touch)
and provide a wall-mounted Home Assistant control panel.

## Overview

```
 ┌─────────────┐     ┌──────────────┐     ┌──────────────────────┐
 │   legacy/   │     │  improved/   │     │  web/packages/editor │
 │             │     │              │     │    (codegen)          │
 │ Monolithic  │     │ Widget-based │     │ Widget-based + TS    │
 │ C++ firmware│     │ C++ firmware │     │ code generator        │
 │             │     │              │     │                      │
 │ Fixed,       │     │ Reference    │     │ ★ Source of Truth    │
 │ feature-rich │     │ impl, same   │     │ Generates firmware   │
 │ reference    │     │ widgets      │     │ from editor UI       │
 └──────┬──────┘     └──────┬───────┘     └──────────┬───────────┘
        │                   │                        │
        │   Reference UX    │   Understand widget    │
        │   & behavior      │   patterns             │
        │   (read-only)     │                        │
        └───────────────────┼────────────────────────┘
                            │
                      New feature
                      work goes here
```

## Directory map

| Path | What it is |
|------|------------|
| `esphome/legacy/` | Original monolithic firmware |
| `esphome/improved/` | Reference widget-architecture firmware |
| `web/packages/editor/src/lib/codegen/` | TypeScript code generator |
| `web/packages/editor/src/lib/templates/includes/` | C++ template headers (generated firmware uses these) |

---

## 1. `esphome/legacy/` — The Original

**Architecture:** Monolithic. One global `DisplayState gState` struct. Render functions
are free functions (not classes). Touch handling is a single large switch/case on
`gState.currentView`. Home Assistant API calls are YAML-defined scripts.

**Key files:**
- `state_manager.h` — `DisplayState` (all state), `ViewState` enum, button overlays
- `display_renderer.h` — main loop, dispatches to `renderPages()` or detail renderers
- `touch_handler.h` — tap detection, navigation, todo item completion
- `render_pages.h` — dashboard pages with preview cards
- `render_details.h` — dispatches to per-feature detail views
- `render_detail_todo.h` — todo list detail view (tabs, checkbox, scrolling)
- `render_detail_lights.h` — light controls
- `render_detail_vacuum.h` — vacuum controls
- `render_detail_climate.h` — climate controls
- `render_detail_music.h` — music controls
- `render_detail_timer.h` — timer/countdown
- `render_detail_scenes.h` — scene activation
- `packages/sensors.yaml` — HA sensor bindings, action scripts, polling intervals

**Features implemented:**
- Dashboard with 4 pages
- Todo/shopping list with tab switching, item completion via HA API
- Vacuum control (start, stop, dock, locate)
- Light toggle (single entity)
- Climate display
- Music control (play/pause, next, volume)
- Timer/countdown
- Scene activation list
- Notifications (HA-driven toast overlay)
- Time/date header
- Scrolling text for long item summaries
- Beeper for tap feedback
- 5-second loading timeout for todo actions

**Role today:** Fixed reference. Do not modify — it stays as-is. When implementing a feature
in the codegen project, study the legacy code to understand the desired end-user
behavior: what happens when you tap, what the loading state looks like, what HA
calls are made, what the timeout behavior is.

---

## 2. `esphome/improved/` — Widget Architecture Reference

**Architecture:** Widget-based, same class hierarchy as the codegen project but
simpler (no TypeScript, no code generation — C++ is written directly). Uses
`Observable<T>` for state, dirty-rect invalidation, and a `ScreenController`
for navigation.

**Key files:**
- `ui_types.h` — `TouchType` enum, `TouchEvent` struct, `UiScreenId` enum
- `ui_state.h` — `Observable<T>` template, `UiState` struct
- `ui_widgets.h` — `Widget` base class + all widget subclasses
- `ui_screen_base.h` — `Screen` base class + `GenericScreen`
- `ui_screens.h` — `ScreenController` + `setup_ui_screens()`
- `ui_chrome.h` — `HeaderWidget`, `DetailHeaderWidget`, `PageIndicatorWidget`
- `ui_tab_container.h` — `TabContainerWidget`
- `ui_scrollable_detail.h` — `ScrollableDetailScreen`
- `ui_invalidation.h` — Dirty-rect tracking (max 16 rects)
- `ui_redraw.h` — Display update bridge
- `ui_retro.h` — Color palette + drawing primitives
- `ui_touch.h` — `BasicTouchHandler` (GT911 → TouchEvent)
- `ui_renderer.h` — `render_basic_ui()` main render hook
- `ui_app.h` — `UiApp` singleton (global orchestrator)

**Widget class hierarchy:**
```
Widget (abstract)
├── RectWidget          — filled rectangle
├── ImageWidget         — tiled image with fallback/placeholder
├── LabelWidget         — text with bool/value binding, text_fn
├── ButtonWidget        — clipped-corner button with loading state
├── IconWidget          — MDI icon glyph
├── ImageToggleWidget   — on/off toggle with circle + rays
├── TodoPreviewWidget   — todo list preview (3 items, non-interactive)
├── PageIndicatorWidget — home page dots
├── HeaderWidget        — time/date header
├── DetailHeaderWidget  — detail screen header with back button
├── TabContainerWidget  — tab bar + child widgets per tab
└── LoadingWidget       — "CONNECTING" full-screen overlay
```

**Screens:**
- `Home` — dashboard with 4 pages, page indicator, header
- `Detail*` — one per detail view (Climate, Lights, Todo, Vacuum, Music, Timer, Scenes, Actions)

**Key patterns to study when extending the codegen project:**
- Widget `update()` polls bound `Observable<T>*` pointers and self-marks dirty
- `handle_touch()` returns `true` if the widget consumed the event
- Dirty-rect partial redraws (widgets skipped if they don't overlap any dirty rect)
- `ui_fast_filled_rectangle()` uses a static DRAM buffer for batch LCD transfers
- `ScreenController::navigate_to()` calls `exit()` / `enter()` / `layout()` lifecycle
- Home screen swipe detection (|dx| > 60, |dx| > |dy|) changes pages

**Features implemented (subset of legacy):**
- Dashboard with 4 pages, page indicator
- Button A/B toggles (local state)
- LED lamp toggle (HA switch)
- Todo preview (3 items, non-interactive) on home page
- Scenes list (scrollable, 12 entries, loading state per entry)
- Time/date header
- "CONNECTING" loading overlay
- 20-second idle timeout (returns to home page 0)
- HA connection monitoring (navigate home on disconnect)

---

## 3. `web/packages/editor/` — Code Generator (Source of Truth)

**Architecture:** A SvelteKit web application with a visual editor for designing
ESPHome display layouts. The editor produces a `Project` JSON model, which is
then fed through a TypeScript code generator to produce ready-to-compile ESPHome
firmware (`.yaml` + C++ `.h` files).

**Key directories:**
```
src/lib/
├── codegen/           — TypeScript → ESPHome YAML/C++ code generator
│   ├── esphome-yaml.ts    — Main YAML generator (on_boot, bindings, touch, intervals)
│   ├── ui-screens.ts      — C++ screen/widget setup code generator
│   ├── ui-state.ts        — C++ UiState struct generator
│   ├── ui-types.ts        — C++ UiScreenId enum generator
│   ├── ui-theme.ts        — C++ theme header generator
│   ├── condition-expr.ts  — Condition expression compiler
│   ├── mdi-icons.ts       — MDI icon font YAML + UTF-8 C escapes
│   ├── secrets.ts         — secrets.yaml generator
│   ├── utils.ts           — C++ identifier helpers, traversal
│   ├── validations.ts     — Project validation rules
│   └── __tests__/         — Test suite (bun test)
├── templates/         — C++ template headers
│   └── includes/          — 11 header files used by generated firmware
│       ├── ui_widgets.h       — Widget classes (INCLUDES TodoPreviewWidget)
│       ├── ui_app.h           — UiApp singleton
│       ├── ui_screen_base.h   — Screen + GenericScreen
│       ├── ui_scrollable_detail.h — ScrollableDetailScreen
│       ├── ui_tab_container.h — TabContainerWidget
│       ├── ui_chrome.h        — Header/DetailHeader/PageIndicator
│       ├── ui_invalidation.h  — Dirty-rect system
│       ├── ui_redraw.h        — Display update bridge
│       ├── ui_renderer.h      — Main render hook
│       ├── ui_retro.h         — Colors + drawing primitives
│       └── ui_touch.h         — BasicTouchHandler
├── components/        — Svelte UI (canvas, sidebar, toolbar)
├── stores/            — Svelte 5 rune stores (project, selection, history, HA entities)
├── utils/             — Shared utilities (color, fonts, component factory)
└── server/            — SvelteKit endpoints (auth, project CRUD, S3, Stripe)
```

**Widget component types (from schema):**
| `type` | C++ class | Status |
|--------|-----------|--------|
| `text` | `LabelWidget` | Complete |
| `button` | `ButtonWidget` | Complete |
| `icon` | `IconWidget` | Complete |
| `image` | `ImageWidget` | Complete (static + HA online) |
| `rectangle` | `RectWidget` | Complete |
| `light_state` | `ImageToggleWidget` | Complete |
| `todo_list` | `TodoPreviewWidget` | Complete (checkable + HA integration) |
| `tab_container` | `TabContainerWidget` | Complete |
| `conditional_area` | `RectWidget` + variants | Complete |
| `notificationOverlay` | `NotificationOverlayWidget` | Complete |
| `pageHeader` | `HeaderWidget` | Complete |
| *(dashboard pages)* | `PageIndicatorWidget`, `LoadingWidget` | Complete |
| `slider` | — | Not yet |
| `gauge` | — | Not yet |
| `procedural_icon` | — | Not yet |
| `auto_layout_list` | — | Not yet |

**Code generation pipeline:**
```
Project JSON (from editor)
    │
    ├── ui-types.ts     → ui_types.h        (UiScreenId enum)
    ├── ui-state.ts     → ui_state.h        (UiState + Observables)
    ├── ui-screens.ts   → ui_screens.h      (ScreenController + setup_ui_screens)
    ├── ui-theme.ts     → ui_theme.h        (retro/modern flag)
    ├── esphome-yaml.ts → project.yaml      (ESPHome config + on_boot lambda)
    ├── mdi-icons.ts    → fonts.yaml        (icon font glyphs)
    └── secrets.ts      → secrets.yaml      (WiFi, OTA, HA URL)
```

---

## Relationship Between Projects

### Codegen ↔ Improved

Both share the **same widget architecture**:
- Same `Widget` base class with `enter/exit/layout/update/handle_touch/draw` lifecycle
- Same `Observable<T>` polling pattern for state binding
- Same `UiInvalidation` dirty-rect system
- Same `ScreenController` for navigation
- Same `GenericScreen` holding `vector<unique_ptr<Widget>>`
- Same `BasicTouchHandler` for GT911 touch → `TouchEvent`

The **improved** project is simpler because:
- No code generation layer (C++ is written directly in `setup_ui_screens()`)
- No schema types, no TypeScript, no Svelte editor
- Widget instances are hardcoded in `ui_screens.h`, not generated

When adding a new widget type to the codegen project:
1. Implement the C++ class in `templates/includes/ui_widgets.h`
2. Add the TypeScript generator function in `codegen/ui-screens.ts`
3. Add the schema type in the `@vesp-cloud/schema` package
4. Add the canvas renderer, property editor, and palette entry in the Svelte UI
5. Add validation rules in `codegen/validations.ts`
6. Add tests in `codegen/__tests__/`

The **improved** project can be used as a testbed: prototype the widget in
`esphome/improved/includes/ui_widgets.h` first, test it on hardware, then port
the working C++ to the codegen templates.

### Codegen ↔ Legacy

The **legacy** project is a fixed reference — it is not modified and is not a
feature parity target. It exists only as a source of UX/behavior patterns to
inform new codegen work:

| Legacy feature (fixed, read-only) | Codegen status | Notes |
|-----------------------------------|----------------|-------|
| Todo list with tabs (Shopping/Tasks) | Single-list only | Tab switching not yet in codegen |
| Todo checkbox with loading animation | Complete | Spinning line animation ported June 2025 |
| Todo completion via HA API | Complete | Direct `HomeAssistantServiceCallAction` |
| Vacuum control (start/stop/dock) | Not started | Needs new widget type + HA integration |
| Climate display | Not started | Temperature/humidity display |
| Music control | Not started | Media player entity integration |
| Timer/countdown | Not started | Local timer with display |
| Scene activation | Partial | ScrollableDetailScreen exists, no scene-specific UI |
| Tap sound (beeper) | Not started | GPIO beeper integration |

When studying a legacy feature for a new codegen implementation:
1. **Read the legacy code** to understand the UX behavior and HA API calls
2. **Design the widget** following existing patterns in `templates/includes/ui_widgets.h`
3. **Add the codegen** (TypeScript generators, schema types, validation, tests)
4. **Add the editor UI** (canvas renderer, property editor, palette entry)

### Codegen ↔ Schema

The `@vesp-cloud/schema` package (at `web/packages/schema/`) defines the
TypeScript types for the `Project` JSON model. Every component type in the codegen
must have a corresponding type in the schema. The schema is auto-generated from
JSON Schema files.

```
web/packages/schema/
├── dist/types.ts      — Generated TypeScript types
├── src/               — JSON Schema source
└── package.json       — Published as @vesp-cloud/schema
```

---

## Implementation Conventions (applies to all three)

### C++ naming
- Widget classes: `PascalCase` (e.g., `TodoPreviewWidget`)
- Screen identifiers: `UiScreenId::DetailSomeName`
- Observable state fields: `snake_case` derived from HA entity (e.g., `sensor_esphome_todo_bridge_all_items`)
- Widget instance variables: `snake_case` + type prefix (e.g., `auto *todo_component`)

### State management
- Use `Observable<T>` for all HA-bound state
- Widgets **poll** bound pointers in `update()`, never push
- Binding lambdas call `target->set(value)` then `UiRedraw::trigger_display_update()`

### Rendering
- Dirty-rect partial redraws: widgets check `UiInvalidation::needs_redraw_in()` in `draw()`
- Fast fill: `ui_fast_filled_rectangle()` for solid color rectangles
- Background widgets (`is_background_widget()`) are drawn first via `sortComponentsForWidgetLayering()`

### Touch handling
- `handle_touch()` returns `true` if the event was consumed
- Screens iterate widgets in order, stop at first `true`
- Loading widgets ignore taps (return `false` or `true` to block)

### HA API calls
- Two patterns:
  1. **Via `on_action`:** `g_ui_app.on_action(entity_id, service)` — for simple single-entity calls
  2. **Direct:** `HomeAssistantServiceCallAction<> call(api, false); call.set_service(...); call.add_data(...); call.play();` — for multi-data calls like `todo.update_item`
- Dummy YAML script forces ESPHome to compile `HomeAssistantServiceCallAction` template

### Loading states
- Set `loading_ = true; loading_start_ms_ = now; mark_dirty();`
- Check timeout in `update()`: `if (loading_ && now - loading_start_ms_ > timeout) { loading_ = false; mark_dirty(); }`
- Show `"..."` or spinning animation in `draw()` while loading
- Standard timeout: 350ms for buttons, 5000ms for todo HA calls

---

## Adding a New Feature (Checklist)

When adding a feature to the codegen project:

1. [ ] Study the legacy implementation for UX behavior and HA API calls
2. [ ] Implement/update the C++ widget class in `templates/includes/ui_widgets.h`
3. [ ] Add/update the TypeScript generator in `codegen/ui-screens.ts`
4. [ ] Add/update schema types in `@vesp-cloud/schema`
5. [ ] Add the canvas renderer in `components/canvas/renderers/`
6. [ ] Add property editor fields in `components/sidebar/PropertyEditor.svelte`
7. [ ] Add to the component palette in `components/sidebar/ComponentPalette.svelte`
8. [ ] Add default values in `utils/component-factory.ts`
9. [ ] Add validation rules in `codegen/validations.ts`
10. [ ] Add tests in `codegen/__tests__/`
11. [ ] If the feature needs new C++ infrastructure (new screen type, new base class), add it to `templates/includes/` and update the template list in `codegen/esphome-yaml.ts` includes
