# Project Architecture

This repo contains a visual editor and code generator for ESPHome display firmware.
It targets the ESP32-S3 + ST7701S 480x480 display + GT911 touch hardware
and produces a wall-mounted Home Assistant control panel.

## Directory map

| Path | What it is |
|------|------------|
| `web/packages/editor/src/lib/codegen/` | TypeScript code generator |
| `web/packages/editor/src/lib/templates/includes/` | C++ template headers (generated firmware uses these) |

---

## `web/packages/editor/` — Code Generator (Source of Truth)

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

## Schema

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

## Display Performance Constraints

The ESP32-S3 display has three key bottlenecks that every widget must account for:

### 1. Synchronous image loading blocks the main thread

ESPHome's `online_image` component delivers pixel data asynchronously via an HTTP
download, but rendering the image data into the display buffer happens on the
main loop. Large images rendered in a single frame can cause visible stutter.

**Mitigation:** The `ImageWidget` renders images progressively in 32-pixel tile
strips per frame, rate-limited to 2 images per display frame via
`MAX_IMAGES_PER_FRAME`. While an image is mid-render,
`UiInvalidation::request_continue(image_bounds)` carries the image's concrete
damage region into additional draw cycles until the image is fully rendered.

### 2. Painting is slow — minimize redraw area

Every pixel written to the ST7701S display costs bus time. Repainting the whole
screen on every change is too slow, so only the smallest possible area should be
redrawn.

**Mitigation:** The dirty-rect system (`ui_invalidation.h`):
- Widgets call `mark_dirty()` when their state changes, registering their dirty bounds
  with `UiInvalidation::request_rect()`.
- On each frame, the screen draw loop calls
  `UiInvalidation::needs_redraw_in(bounds)` per widget — widgets whose bounds
  don't overlap any dirty rect are skipped entirely.
- Current-frame and next-frame damage sets keep invalidations raised during
  drawing from being lost at the end of the frame.
- Dirty rectangles are clipped to the 480x480 screen, deduplicated, and nearby
  overlapping/adjacent rectangles are coalesced. If 16 compacted rectangles are
  still insufficient, the system escalates to a full redraw.
- Background widgets use `ui_fast_filled_rectangle()` (static DRAM buffer for
  batch LCD transfers) for solid fills instead of a full pixel-by-pixel draw.

### 3. HA service calls don't include a data refresh trigger

`HomeAssistantServiceCallAction` calls in C++ are fire-and-forget — calling e.g.
`todo.update_item` sends a mutation to Home Assistant but does not fetch the
resulting state change. The widget needs a **second binding** to trigger a data
refresh.

**Mitigation (see `TodoPreviewWidget` for reference):**
1. **Mutate:** The widget calls `HomeAssistantServiceCallAction` directly in
   C++ to perform the action (e.g. complete a todo item).
2. **Detect change:** A C++ `subscribe_home_assistant_state` binding watches the
   entity and sets a `bool` refetch flag when HA pushes a state update.
3. **Refetch:** A fast YAML interval (250ms) monitors the flag and fires a
   `homeassistant.service` call with `capture_response` to fetch fresh data,
   parsing the JSON response into an `Observable<std::string>`.
4. **Poll:** The widget's `update()` method polls the `Observable` pointer,
   detects the change, re-parses, and calls `mark_dirty()`.

For simple single-entity toggles, `on_action` is sufficient because the state
pushback arrives via the regular `subscribe_home_assistant_state` binding —
the mutation itself is enough to trigger HA to broadcast the new state.

---

## Implementation Conventions

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
- Dirty-rect partial redraws: screens check `UiInvalidation::needs_redraw_in()`
  before dispatching intersecting widgets through `draw_clipped()`
- Fast fill: `ui_fast_filled_rectangle()` for solid color rectangles
- Background widgets (`is_background_widget()`) are drawn first via `sortComponentsForWidgetLayering()`

### Dirty checking and invalidation
- Dirty checking is a required part of every widget; do not replace it with
  unconditional partial or full-screen redraws.
- `paint_bounds()` must conservatively contain every pixel a widget can paint.
  `dirty_bounds()` defaults to it but may be widened for atomic container
  repainting. `touch_bounds()` stays separate so accessibility slop does not
  enlarge redraw regions.
- Widgets poll bound state in `update()`. Compare against a cached last-rendered
  value and call `mark_dirty()` only when the visible result changes. Use
  quantized comparisons for floats where appropriate.
- Every runtime mutation that changes rendered output (including setters for
  color, text, alignment, icons, loading state, or visibility) must invalidate
  the affected paint region. Setup-only configuration may avoid invalidation,
  but it should be clearly separated from runtime setters.
- `mark_dirty()` invalidates `dirty_bounds()` by default. Use
  `set_dirty_bounds()` when a container background and its children must repaint
  atomically, such as conditional variants that share an erasing background.
- On a partial frame, redraw all layers intersecting the dirty region in normal
  paint order: background widgets first, normal widgets second, and top/chrome
  widgets last. If a background is repainted, any foreground content it erases
  must also be included in the same dirty region and redrawn.
- All screen and tab-container widget painting goes through `draw_clipped()`,
  which clips to `paint_bounds()` and, when applicable, the scroll viewport.
  `ui_fast_filled_rectangle()` bypasses ESPHome's normal pixel path, so its
  manual clipping behavior must be preserved.
- Scrolling invalidates the scroll viewport because all pixels in that viewport
  move; fixed/scroll-exempt widgets should not repaint during a scroll-only
  frame.
- Multi-frame rendering (for example tiled images or future animations) calls
  `request_continue(rect, tag)`. The rectangle is stored in the next-frame
  damage set and promoted when the current draw ends.
- Dirty rectangles are screen-clipped, empty rectangles are ignored, and
  duplicate/nearby rectangles are coalesced before escalating to a full redraw.
- A full redraw is appropriate for screen transitions, theme/layout changes, or
  damage overflow. It should not be the normal response to an entity update,
  touch interaction, loading animation, or timer tick.

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

1. [ ] Implement/update the C++ widget class in `templates/includes/ui_widgets.h`
2. [ ] Add/update the TypeScript generator in `codegen/ui-screens.ts`
3. [ ] Add/update schema types in `@vesp-cloud/schema`
4. [ ] Add the canvas renderer in `components/canvas/renderers/`
5. [ ] Add property editor fields in `components/sidebar/PropertyEditor.svelte`
6. [ ] Add to the component palette in `components/sidebar/ComponentPalette.svelte`
7. [ ] Add default values in `utils/component-factory.ts`
8. [ ] Add validation rules in `codegen/validations.ts`
9. [ ] Add tests in `codegen/__tests__/`
10. [ ] If the feature needs new C++ infrastructure (new screen type, new base class), add it to `templates/includes/` and update the template list in `codegen/esphome-yaml.ts` includes
