---
label: wayfinder:map
title: Circular display & rotary encoder support (T-Encoder-Pro)
status: open
---

# Map: Circular display & rotary encoder support (T-Encoder-Pro)

## Destination

A user can select the LILYGO T-Encoder-Pro (round display + native rotary
encoder) as a project's target device, design for the circular screen in the
editor, bind global navigation to the scroll wheel, and generate firmware that
compiles and works on the physical board — built on a general device-profile
framework so future boards are additive work.

## Notes

- **Domain:** ESPHome codegen monorepo (`web/packages/editor`). Known coupling
  points to the current Guition ESP32-S3-4848S040 target:
  - `web/packages/editor/src/lib/templates/hardware.yaml` — static ST7701S +
    GT911 + pin config (whole file is one board)
  - `web/packages/editor/src/lib/codegen/esphome-yaml.ts:1276` and `:1468` —
    hardcoded `platform: gt911` touchscreen blocks
  - `@vesp-cloud/schema` `DisplayConfig` is only `{width, height}`; no device
    concept exists in the Project model
  - Editor UI states hardware as fixed text in `ProjectSettings.svelte` and
    `CreateProjectModal.svelte`
  - All input flows through `BasicTouchHandler` (`templates/includes/ui_touch.h`)
- **Decisions locked during charting:**
  - Canvas = masked square canvas (circular overlay shows what gets cut off)
  - Wheel semantics = global navigation (rotate = switch dashboard pages/tabs /
    scroll detail views; push = activate/select). No per-widget bindings.
  - Existing projects auto-migrate: absent device field defaults to the
    Guition profile.
- **Skills:** consult `grill-with-docs` when working HITL tickets.
- **Tracker convention:** this directory is the tracker. The map is `map.md`;
  tickets live in `tickets/*.md`. Ticket frontmatter carries `type`
  (`research|prototype|grilling|task`), `status` (`open|claimed|closed`),
  `assignee` (the claim), and `blocked-by` / `blocks` (ticket ids) for the
  dependency graph. The frontier is: every open ticket whose `blocked-by`
  list contains only closed tickets.

## Decisions so far

<!-- one line per closed ticket: [title](link): gist -->

- [Research — T-Encoder-Pro hardware facts](tickets/01-research-tencoder-hardware.md):
  ESP32-S3R8 / 16MB flash / 8MB OPI PSRAM; 390×390 round QSPI AMOLED with
  **two panel variants** (SH8601+CHSC5816 original, CO5300+CST816 latest);
  encoder A=IO1 B=IO2 push=IO0 (strapping pin); display works via
  `qspi_dbi model: CUSTOM` + init sequence (component deprecated in favor
  of `mipi_spi`); no PWM backlight — brightness via driver register +
  VCI EN pin; specific build flags required or the board boot-loops.
- [Research — ESPHome capabilities for round panels & rotary encoders](tickets/02-research-esphome-round-encoder.md):
  target platform is `mipi_spi` (`qspi_dbi` deprecated): CO5300 panel
  native, SH8601 needs CUSTOM+init sequence; AMOLED brightness is a
  built-in option; stock `rotary_encoder` gives `on_clockwise`/
  `on_anticlockwise` triggers; CST816 touch is stock, CHSC5816 needs an
  external component (→ generated YAML must support
  `external_components:`); buffer_size <100% chunks lambda calls, so pin
  100% or make the render hook chunk-tolerant.
- [Grilling — Device profile architecture](tickets/03-grilling-device-profile-architecture.md):
  `device?: string` id on Project (absent = Guition), DisplayConfig stays
  and is validated against the profile; single TS registry module in
  codegen; profiles = typed header (id/label/dimensions/shape/hasEncoder)
  + raw YAML fragment body; ONE T-Encoder-Pro profile initially baking in
  SH8601+CHSC5816 fragments; invalid ids are hard validation errors.
- [Grilling — C++ input event abstraction](tickets/04-grilling-cpp-input-abstraction.md):
  new `ui_input.h` dispatcher (touch refactored through it); rotation =
  dashboard pages always, scrolls an open detail view (clamped), tab
  containers tap-only; push wired but no-op for now; direct YAML→C++
  calls; C++ hooks always compile, YAML input blocks gated on
  `profile.hasEncoder`.
- [Grilling — Editor UX: device picker & circular canvas mask](tickets/05-grilling-editor-device-picker-and-mask.md):
  device chosen at creation only, no switching; advisory corner overlay on
  circle-shaped canvases; zero cut-off warnings (by decision); on circle
  devices the pageHeader is not emitted and the page indicator stays at
  bottom; ProjectSettings shows read-only profile info.
- [Grilling — Schema migration & versioning](tickets/06-grilling-schema-migration.md):
  LATEST_VERSION → 1.1.0; on load migrate older projects (fill Guition
  device id when absent) and write back immediately; newer-than-editor
  versions open with a warning toast, no gate; single minimal migrate()
  chain.
- [Grilling — Firmware assembly refactor plan](tickets/07-grilling-firmware-assembly-refactor.md):
  profile YAML body written to the bundle as hardware.yaml (packages
  include unchanged); codegen-owned encoder block parameterized by typed
  pin fields; CHSC5816 component vendored locally (no compile-time
  network); screenshot feature omitted on T-Encoder-Pro; golden-file
  bundle tests per profile.

## Not yet specified

- Boot-sequence, calibration, or power differences the T-Encoder-Pro needs
- What "device" means for runtime features that assume 480x480 (image tiling
  budgets, dirty-rect escalation thresholds, chrome sizing, generated
  connection/boot screens with fixed layouts)
- When the physical T-Encoder-Pro arrives: identify its panel variant and
  swap the profile's display/touch fragments if it's the CO5300+CST816
  revision (single-profile bet from ticket 03)
- Possible future effort: focus/cursor model giving the encoder push button
  real activate semantics (explicitly deferred in ticket 04)

## Out of scope

- Boards other than Guition ESP32-S3-4848S040 and LILYGO T-Encoder-Pro
  (framework must not preclude them, but they are not targets here)
- Per-widget encoder bindings ("deep widget control", e.g. wheel adjusts a
  slider/gauge value) — global navigation only
- Web-preview simulation of rotary input in the editor canvas (physical
  testing only)
