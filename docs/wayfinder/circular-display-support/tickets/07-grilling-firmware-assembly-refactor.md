---
id: 07-grilling-firmware-assembly-refactor
map: circular-display-support
title: Grilling — Firmware assembly refactor plan
type: grilling
status: closed
assignee: ox-alpha (session of 2026-08-21)
blocked-by:
  - 01-research-tencoder-hardware
  - 03-grilling-device-profile-architecture
blocks: []
---

## Question

How does firmware generation stop being one hardcoded board and become
base + per-device composition?

Current shape: `templates/hardware.yaml` is a single static file (ST7701S
pins, init sequence, GT911 assumptions baked in), and `esphome-yaml.ts`
emits touchscreen blocks referencing `touch_i2c` / `touch_gt911` ids.

Decisions to reach:

- Split strategy: per-device hardware template files selected by profile vs
  generator functions emitting YAML from typed profile data
- How generated sections stay consistent (id contracts like `main_display`,
  `touch_i2c`, `backlight_pwm` across base + device fragments)
- Where encoder YAML (rotary_encoder + binary_sensor) gets emitted and how
  its lambdas call into the C++ input path
- Impact on `compilation-service`: does the worker need per-board ESPHome
  component availability handling, or is stock ESPHome sufficient?
- Test strategy: golden-file tests per device profile?

Consult `grill-with-docs`. Blocked by T-Encoder-Pro hardware facts (what
we're composing toward) and the profile architecture (what we compose from).

Research input (from tickets 01–02):

- Target display platform is `mipi_spi` (`qspi_dbi` is deprecated);
  CO5300 variant is a native model, SH8601 variant needs
  `model: CUSTOM` + init sequence stored in the profile.
- Original-variant touch (CHSC5816) requires an `external_components:`
  entry → decide how generated YAML declares external components and how
  the compile worker gets them (GitHub at compile time vs vendored).
  This absorbs the former fog item "compile pipeline learns about per-board
  dependencies".
- `mipi_spi` `buffer_size` below 100% calls the drawing lambda once per
  chunk — either pin `buffer_size: 100%` (~304 KB RGB565, fits PSRAM
  easily) or make the render entry chunk-tolerant.
- Board boot-loops without `flash_mode: dio` + `memory_type: qio_opi` +
  octal PSRAM build settings; these belong in the profile.

## Resolution

Decided 2026-08-21 in grilling session with Philip.

Grounding: templates ship as static files copied verbatim into the
firmware bundle (`base.yaml`, `hardware.yaml`, `fonts.yaml`,
`includes/*.h`, `components/*`); `project.yaml` pulls them via ESPHome
`packages: !include`; `external_components:` already uses a local path
for the vendored framebuffer_camera component.

1. **Hardware mechanics: registry → hardware.yaml.** The profile's raw
   YAML body lives in the TS registry (per ticket 03); codegen writes it
   into the bundle as `hardware.yaml`. `project.yaml`'s
   `packages: hardware: !include hardware.yaml` line stays unchanged —
   bundler and compile flow untouched.
2. **Encoder YAML: codegen-owned template + typed pin fields.** One
   encoder block template in codegen (rotary_encoder sensor + push
   binary_sensor + lambdas calling the ui_input.h dispatcher, per ticket
   04); profiles contribute only pin numbers via small typed header
   fields (`encoderPinA`, `encoderPinB`, `encoderPush`). Chosen by user
   criterion: new codegen acceptable, duplication not. This amends
   ticket 03's typed-header field list (see addendum there).
3. **CHSC5816 touch component: vendored locally.** Copy
   `mvonweis/esphome-chsc5816` into `templates/components/chsc5816/`;
   profile emits an `external_components:` local-path entry alongside
   the existing one. Compile worker needs no network access; no
   per-board component-availability handling required.
4. **Screenshot feature: omitted on T-Encoder-Pro.**
   `camera_encoder` / `framebuffer_camera` blocks are emitted only for
   profiles declaring support (Guition). Porting to mipi_spi is future
   work if wanted.
5. **Id contracts across fragments:** device YAML must define
   `main_display` (and `touch_i2c` when a touch bus exists); optional
   sections (backlight light entity) are profile-declared capabilities,
   not assumed by base. Generated C++ continues to reference
   `main_display` only.
6. **Test strategy (recommendation):** golden-file tests per profile —
   full bundle snapshot (project.yaml + hardware.yaml + includes list)
   for Guition and T-Encoder-Pro fixture projects, extending the
   existing `codegen/__tests__` patterns.

Implementation sequence implied by this map (hand-off order):
profile registry + schema field → migration → editor picker/mask/chrome
gating → ui_input.h dispatcher → encoder YAML emission → T-Encoder-Pro
profile fragments → golden tests → on-hardware validation when the
board arrives.
