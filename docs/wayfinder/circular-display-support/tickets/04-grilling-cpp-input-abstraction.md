---
id: 04-grilling-cpp-input-abstraction
map: circular-display-support
title: Grilling — C++ input event abstraction
type: grilling
status: closed
assignee: ox-alpha (session of 2026-08-21)
blocked-by:
  - 02-research-esphome-round-encoder
  - 03-grilling-device-profile-architecture
blocks: []
---

## Question

How do encoder events join touch events in the firmware's navigation model?

Locked context: wheel = global navigation only (rotate = switch dashboard
pages/tabs / scroll detail views; push = activate/select).

Current shape: all input enters through `BasicTouchHandler::handle_raw_touch`
(`templates/includes/ui_touch.h`) fed by GT911 lambdas in generated YAML;
screens/tabs are driven from there.

Decisions to reach:

- Input router shape: extend `BasicTouchHandler` vs new `ui_input.h`
  dispatcher both device input sources feed
- Event vocabulary: do encoder ticks become synthetic "next/prev page"
  commands directly, or generic focus/cursor movement over widgets?
- What "push = activate" means concretely on each screen type (dashboard
  pages, tab containers, detail views) without per-widget bindings
- Scrollable detail views: encoder-driven scrolling interacting with the
  existing scroll viewport invalidation rules
- How YAML lambdas hand events into C++ (direct function calls on g_ui_app?
  queued events processed in loop?)
- Device capability gating: profiles without an encoder generate none of
  this

Consult `grill-with-docs`.

Research input (from ticket 02): stock `rotary_encoder` exposes
`on_clockwise`/`on_anticlockwise` automation triggers whose lambdas can call
C++ directly — the YAML→C++ handoff question above is about where those calls
land, not whether they're possible. Also note `mipi_spi` buffer chunking
(see ticket 07) affects the render entry contract this router sits beside.

## Resolution

Decided 2026-08-21 in grilling session with Philip.

1. **Push button: no-op for now.** No focus system exists and none is
   added; the push event is wired end-to-end (YAML binary_sensor →
   dispatcher entry point) but performs no navigation action. Reserved
   for a future effort (possible focus/cursor model — see map fog).
2. **Rotation semantics (final):**
   - Dashboard pages: rotation always switches dashboard pages. Tab
     containers stay tap-only.
   - Scrollable detail view open: rotation scrolls its content, clamped
     at both ends (no wrap), reusing the existing drag-scroll viewport
     invalidation path (`GenericScreen` scroll machinery).
   - Closing detail views stays tap-only.
3. **Router architecture: new `ui_input.h` dispatcher from day one.**
   Touch input is refactored through it too (BasicTouchHandler's
   send() path becomes a dispatcher client). Encoder enters via the same
   dispatcher. Rationale (user override of "methods on UiApp" option):
   clean symmetry across input sources now, one place to add push/focus
   semantics later.
4. **YAML→C++ handoff: direct calls.** Generated encoder triggers call
   the dispatcher directly, e.g.
   `g_ui_app.encoder_step(1); id(main_display).update();` — same pattern
   as today's touch lambdas. No event queue.
5. **Capability gating: always-compile C++, conditional YAML.** The
   dispatcher + encoder entry points compile on every device (few bytes
   unused on Guition); `rotary_encoder` / push `binary_sensor` YAML
   blocks are emitted only when the profile header says `hasEncoder`.
6. **Activity feed:** encoder activity resets the idle/wake timer via the
   same mechanism as `touch_activity()`.

Implementation notes for downstream tickets:

- Ticket 07 emits the encoder YAML blocks; they reference the ui_input.h
  dispatcher entry points by name.
- ui_input.h must be added to the template includes list in
  `esphome-yaml.ts` (and AGENTS.md template table) when implemented.
- Scroll step size per detent is an implementation detail (fixed pixel
  step is fine to start); clamping behavior above is the contract.
