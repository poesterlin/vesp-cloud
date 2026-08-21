---
id: 03-grilling-device-profile-architecture
map: circular-display-support
title: Grilling — Device profile architecture
type: grilling
status: closed
assignee: ox-alpha (session of 2026-08-21)
blocked-by:
  - 01-research-tencoder-hardware
  - 02-research-esphome-round-encoder
blocks:
  - 04-grilling-cpp-input-abstraction
  - 06-grilling-schema-migration
  - 07-grilling-firmware-assembly-refactor
---

## Question

Where does the device abstraction live, and what exactly varies per device?

Locked context: framework + T-Encoder-Pro both ship; existing projects
auto-default to Guition.

Decisions to reach:

- Schema: new `device` field on Project (id reference) vs richer inline
  config; how `DisplayConfig {width,height}` relates to it
- Registry: where profiles are defined (codegen-side TS registry of known
  boards? data files?) and what a profile contains: dimensions, shape
  (rect/circle), display YAML fragment, touch YAML fragment, input
  capabilities (encoder present?), pins, init sequences
- Do profiles carry raw YAML fragments, typed structures the generator
  renders, or a mix?
- How unknown/custom devices fail (validation error message shape)
- Naming/ids for the two launch profiles

Consult `grill-with-docs`. Blocked by the two research tickets because the
profile shape depends on what actually varies between ST7701S+GT911+no-encoder
and QSPI-panel+CST816+encoder boards.

Research input (from ticket 01): the T-Encoder-Pro itself ships in **two
panel variants** (SH8601+CHSC5816 vs CO5300+CST816) — decide whether a
device id covers a board with variant sub-selection, or variants are
distinct profiles.

## Resolution

Decided 2026-08-21 in grilling session with Philip.

1. **Schema:** Project gains `device?: string` — an id referencing the
   registry. `DisplayConfig {width,height}` stays on the project and is
   validated against the profile's dimensions. Absent id = Guition
   profile (auto-migrate decision from charting).
2. **Registry home:** single TypeScript module in
   `web/packages/editor/src/lib/codegen/` exporting typed
   `DeviceProfile` records. Editor imports it (canvas, device picker);
   codegen consumes it for YAML emission.
3. **Profile anatomy: typed header + raw YAML body.**
   - Typed header (read by editor + codegen): `id`, `label`,
     `width`, `height`, `shape: "rect" | "circle"`,
     `hasEncoder: boolean`.
   - Body: raw YAML fragment blocks per section (display, touch,
     inputs/encoder, power/build) spliced into generated firmware.
     Rationale: fastest to author and diff against working community
     configs; validation lives in the typed header + compile step.
4. **Panel variants: ONE profile for now.** The two T-Encoder-Pro
   variants are electrically identical; user opts to start with a single
   `lilygo-t-encoder-pro` profile and split only if problems appear.
   Initial fragments bake in the **SH8601 + CHSC5816** path (only
   variant with an end-to-end community-proven ESPHome config).
   Hardware is on order — revisit on arrival (see map fog).
5. **Invalid device id:** hard validation error
   (`Unknown device <id>. Known devices: …`); project will not compile.
6. **Launch profile ids:** `guition-esp32-s3-4848s040`,
   `lilygo-t-encoder-pro`.

Consequences for downstream tickets:

- Ticket 06 (migration): migration = write `device:
  "guition-esp32-s3-4848s040"` when absent; nothing else moves.
- Ticket 07 (firmware assembly): hardware.yaml dissolves into profile
  YAML fragment blocks; generator splices by section; typed header feeds
  canvas/validation.
- Editor (ticket 05): shape/dimensions/capabilities come from the typed
  header only — never parsed out of YAML.

Addendum (from ticket 07): the typed header also carries encoder pin
fields (`encoderPinA`, `encoderPinB`, `encoderPush`) so the codegen-owned
encoder block template can be parameterized without duplicating lambda
YAML per profile.
