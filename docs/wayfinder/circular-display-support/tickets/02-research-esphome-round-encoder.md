---
id: 02-research-esphome-round-encoder
map: circular-display-support
title: Research — ESPHome capabilities for round panels & rotary encoders
type: research
status: closed
assignee: ox-alpha (session of 2026-08-21)
blocked-by: []
blocks:
  - 03-grilling-device-profile-architecture
  - 04-grilling-cpp-input-abstraction
---

## Question

What does stock ESPHome give us today for (a) driving the T-Encoder-Pro's
round panel and (b) consuming rotary encoder input — so we know what must be
custom?

## Resolution

Verified against ESPHome 2026.8.0 docs (esphome.io).

### Display platforms for the round QSPI panels

Two candidate platforms; `qspi_dbi` is the proven-but-deprecated path,
`mipi_spi` is the strategic one:

| | `qspi_dbi` | `mipi_spi` |
|---|---|---|
| Status | **Deprecated** ("will be removed in a future release"), redundant with mipi_spi | Current MIPI DBI driver (SPI/quad/octal) |
| SH8601 (original panel) | `model: CUSTOM` + init_sequence (community-proven on this board) | **Not in driver-chip list** → CUSTOM + init_sequence |
| CO5300 (latest panel) | not built-in | **Native driver chip** (`CO5300`, typical 466×466) |
| Quad SPI | yes (`spi type: quad`) | yes (`bus_mode: quad`) |
| Panel power enable | `enable_pin` | `enable_pin` (list allowed) |
| Brightness | `brightness` 0–255 | `brightness` 0–255, **AMOLED-aware**, settable via lambda API at runtime |
| Manual-update pattern | `update_interval: never` + `auto_clear_enabled: false` works (community-proven on this board) | same options exist |
| Buffer behavior | PSRAM-backed | `buffer_size`: default **100% with PSRAM**; below 100% the **drawing lambda is called once per chunk** |

Key implications:

- **Recommendation shape:** target `mipi_spi`; original-variant profile
  carries an SH8601 init sequence as data either way. Device profiles
  should store panel driver + init sequence so both variants fit one
  framework.
- **Render-hook contract:** with `buffer_size` < 100% the lambda runs
  multiple times per frame (chunked). Our dirty-rect renderer
  (`render_basic_ui`) assumes whole-frame draws. Either pin
  `buffer_size: 100%` (~304 KB RGB565 for 390² — trivially fits 8 MB
  PSRAM) or make the C++ render entry chunk-tolerant. Must be decided in
  the firmware-assembly ticket.
- No LVGL requirement anywhere — plain lambda rendering is fully
  supported on both platforms.
- Hardware rotation/transform (`swap_xy`, mirror_x/y) available; CUSTOM
  model may need `transform: disabled`.

### Rotary encoder (`sensor: rotary_encoder`) — stock, fits perfectly

- Config: `pin_a` (IO1), `pin_b` (IO2); optional `pin_reset`, `resolution`
  (1/2/4 pulses per step), `min_value`/`max_value`, `restore_mode`,
  `publish_initial_value`.
- **Event triggers: `on_clockwise` / `on_anticlockwise`** — exactly the
  navigation hooks we need; lambdas can call into C++ directly.
- `sensor.rotary_encoder.set_value` action for programmatic reset.
- Detent count unknown (see ticket 01 Unverified) — `resolution` may need
  tuning per physical unit.

### Encoder push button

- Plain `binary_sensor: gpio` on IO0 (community-proven).
- Short vs long press: standard `on_multi_click` timing automation; no
  special component needed.

### Touch controllers

- **CST816** (latest variant): stock `touchscreen: platform: cst816`,
  interrupt-pin driven. Used with GC9A01A boards in official examples;
  coordinate transform options available per platform.
- **CHSC5816** (original variant): stock `chsc6x` platform docs only claim
  the Seeed Round Display family; **no confirmation it drives the 5816**.
  Community external component `github://mvonweis/esphome-chsc5816`
  (ESPHome 2025.6-tested, addr 0x2E, reset GPIO8/int GPIO9,
  interrupt-driven, standard `on_touch`/`on_update` triggers) is the
  working path today.
  - Consequence: the original-variant profile likely needs an
    `external_components:` entry → generated YAML must support external
    components and the compile worker needs GitHub access (or we vendor
    the component). Decision belongs to the firmware-assembly ticket.
- Round-panel coordinates: touch reports in square-framebuffer space;
  circle-outside corners are dead zones. Relevant later for editor
  validation, not a firmware problem.

### Sources

- qspi_dbi (deprecation notice, models, config):
  https://esphome.io/components/display/qspi_dbi/
- mipi_spi (driver chips incl. CO5300, buffer_size semantics, AMOLED
  brightness): https://esphome.io/components/display/mipi_spi/
- rotary_encoder:
  https://esphome.io/components/sensor/rotary_encoder/
- chsc6x: https://esphome.io/components/touchscreen/chsc6x/
- cst816: https://esphome.io/components/touchscreen/cst816/
- Community CHSC5816 component:
  https://github.com/mvonweis/esphome-chsc5816

### Caveats

- Stock `chsc6x` ↔ CHSC5816 compatibility unconfirmed; treat external
  component as required until someone tests stock chsc6x on hardware.
- CO5300 native support means the *latest* variant could avoid
  init-sequence data entirely — but only via `mipi_spi`, reinforcing it as
  the target platform.
- `qspi_dbi` removal timeline unstated; do not build new profiles on it.
