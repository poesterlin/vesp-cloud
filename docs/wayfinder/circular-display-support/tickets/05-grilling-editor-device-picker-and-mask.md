---
id: 05-grilling-editor-device-picker-and-mask
map: circular-display-support
title: Grilling — Editor UX: device picker & circular canvas mask
type: grilling
status: closed
assignee: ox-alpha (session of 2026-08-21)
blocked-by: []
blocks: []
---

## Question

How does device selection and the circular mask actually look and behave in
the editor?

Locked context: masked square canvas (not true-circular); auto-migration
means old projects silently gain a device.

Decisions to reach:

- Device picker placement: CreateProjectModal choice at creation,
  ProjectSettings switcher later, or both — and what happens to layouts when
  switching devices mid-project (dimensions change!)
- Mask rendering: overlay style on canvas, whether masked regions block
  drops/selection or are advisory-only
- Corner-content warnings: does validation flag widgets fully/partially
  outside the circle, at edit time, compile time, or both?
- How the canvas scales for a different resolution (T-Encoder-Pro panel is
  smaller than 480x480) while keeping WYSIWYG fidelity
- Whether chrome (pageHeader, page indicator) needs per-shape defaults

Consider spawning a prototype ticket if a cheap artifact would settle the
mask/warning debate. Consult `grill-with-docs`.

## Resolution

Decided 2026-08-21 in grilling session with Philip. Overall direction:
minimal editor UI — the designer is trusted, tooling stays out of the way.

1. **Device picker: creation only.** Device is chosen in
   `CreateProjectModal` (device cards replacing today's hardcoded Guition
   text) and never changes afterwards.
2. **No device switching.** There is no switch UI; a project is bound to
   its device for life. (Layout-migration question moot.)
3. **Circular mask: advisory overlay.** Square canvas keeps working as
   today; when `profile.shape === "circle"`, corners outside the inscribed
   circle get a darkened overlay. Widgets in the zone remain fully
   selectable/movable — purely visual guidance.
4. **No cut-off warnings anywhere.** No edit-time badges, no compile-time
   validation for corner-clipped widgets. (Resolves the corresponding map
   fog item as "none, by decision".)
5. **Chrome on circular devices:** the pageHeader is **not emitted at
   all**; the page indicator stays at the bottom. Shape-gated: Guition
   (rect) projects keep current header behavior. Editor canvas mirrors
   this (no header rendered/edited for circle devices).
6. **ProjectSettings:** static Guition hardware text replaced with
   read-only info from the chosen profile (label + dimensions + shape).

Grounded fact (no decision needed): canvas scaling needs no work —
`DesignCanvas.svelte` already binds dimensions from
`projectStore.display` and zooms via `canvasZoomStore`, so 390×390
designing works at whatever zoom fits.

Implementation notes:

- Codegen gates header emission on profile shape (ticket 07 territory).
- Hide/disable the pageHeader settings section in the sidebar when shape
  is circle.
- Connection/boot screens are generated chrome too but their fixed-layout
  behavior on non-480 displays remains a runtime concern (map fog).
