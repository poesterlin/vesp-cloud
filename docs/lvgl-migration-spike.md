# LVGL migration architectural spike

Date: 2026-10-04. Status: source/documentation investigation; proposed architecture.
The architectural investigation itself included no firmware measurements.
The subsequent host integration probe now compiles and renders both themes;
physical-device compilation and memory measurements remain pending.

Execution progress is tracked in the [migration checklist](lvgl-migration-checklist.md).

## Decision

Proceed with an opt-in LVGL manifest backend using ESPHome's existing LVGL
component for display, touch, scheduling, allocation and font integration.
Construct project objects dynamically in C++ from the reboot-selected manifest.
Start with separate custom/LVGL firmware variants, one renderer per build.

This permits incremental product migration: existing installations retain the
custom renderer, selected projects test LVGL, and the cloud negotiates each
firmware's supported layouts. It avoids making shared-display engine switching
a prerequisite. Same-firmware screen-by-screen coexistence is deferred until
there is evidence it is necessary and affordable.

Generating project-specific LVGL YAML alone would lose the existing ability to
publish layout changes without compilation. YAML should configure the generic
LVGL platform and compiled resource inventory, not the project object tree.

## Verified integration facts

The repository simulator and prior firmware verification use ESPHome 2026.7.1.
Its tagged `components/lvgl/__init__.py` sets `LVGL_VERSION = "9.5.0"`.
Do not implement against LVGL 8 examples or assume a major-version upgrade is
required. Reconfirm the effective worker image version during implementation.

The same source rejects display metadata with a writer: `lambda`, display
pages, automatic clearing, or a test card. Current generated firmware uses a
display lambda and custom touch automations. Adding `lvgl:` to that YAML is
therefore insufficient; the LVGL build needs its own display/touch generation.

ESPHome exposes `LvglComponent::get_disp()`, `get_screen_active()` and
`set_paused(bool, bool)`. Its setup priority is PROCESSOR; generated object
configuration executes after component setup. Runtime construction must happen
after LVGL setup and after boot manifest selection, with a failed-component check.
Use the explicit display handle for multiple-display safety.

ESPHome generates `lv_conf.h` from YAML feature usage and disables unused widget
types. Dynamically calling a widget constructor does not tell the Python
generator to enable it. The generic platform configuration must explicitly
enable a fixed supported feature inventory. Tagged generation recognizes
`LV_USE_*` build flags and excludes them from its unused-feature definitions;
compile probes must verify both the LVGL define and any required ESPHome
`USE_LVGL_*` adapter define. A small external component can register these uses
if flags prove insufficient. Do not enable everything indiscriminately.

ESPHome's font adapter exposes `Font::get_lv_font()` when LVGL font integration
is enabled. Declare the actual 16/22/32px text and icon fonts through LVGL
configuration so code generation includes the adapter. Merely emitting normal
ESPHome fonts is not sufficient evidence that the integration was enabled.

## Current seams and changes

| Existing file | Migration responsibility |
| --- | --- |
| `ui_runtime_manifest.h` | Keep portable parsing, conditions and text evaluation |
| `ui_boot_manifest.h`, `ui_manifest_storage.h` | Keep bounded reboot selection and cache semantics |
| `ui_runtime.h` | Extract session state, subscription ownership, action dispatch and bounded navigation from custom widget construction |
| `ui_runtime_app.h` | Retain HA/service adapters and boot reporting; initialize the selected backend once |
| `ui_renderer.h`, `ui_redraw.h`, `ui_invalidation.h` | Custom-backend implementation; LVGL owns its own damage/render schedule |
| `codegen/esphome-yaml.ts` | Add explicit LVGL platform generation and backend selection |
| `codegen/ui-capabilities.ts` | Version capabilities and record renderer/features/resource inventory |
| `server/ui-manifests.ts` | Negotiate required semantics against installed firmware before delivery/publication |
| `simulator/` | Add opt-in LVGL build and object-ID inspection while retaining current regression runs |

Paths above are relative to `web/packages/editor/src/lib/`, except `simulator/`.

### Proposed internal boundary

```text
Project → manifest compiler → immutable bytes
                              ↓ reboot only
download / cache / embedded → validated candidate + capability validation
                              ↓
RuntimeSession (owns model, bindings, actions, navigation, boot identity)
                              ↓
CustomBackend OR LvglBackend
                              ↓
ESPHome display + touchscreen + native API
```

The session must not depend on `GenericScreen`, `UiState`, `UiInvalidation` or
`display::Display`. Backend operations are mount, activate-screen, update visible
values and shutdown; custom draw/touch entrypoints remain backend-specific.
Do not force LVGL to implement a custom `draw()` method or drive it through
`id(main_display).update()`.

Subscriptions update stable session storage and mark semantic values changed.
Backend polling compares cached visible values before calling setters. LVGL
setters then invalidate their objects. Preserve the existing 50ms semantic poll
initially, with LVGL owning its refresh timer. All LVGL object mutation occurs
on the ESPHome main loop; callbacks from other execution contexts must queue
updates. HA state changes never rebuild the object tree.

Event callback data must have stable addresses for the lifetime of its objects.
Reserve/finalize widget handle storage before installing callbacks, or use
individually owned records. Destroy objects before their callback contexts;
remove timers and callbacks before session destruction. Bindings must outlive
subscriptions, consistent with the current reboot-only session lifetime.

## Platform and lifecycle

1. Configure the existing ST7701S driver/pins, RGB timing, PSRAM, backlight and
   GT911. Remove the custom display lambda, set automatic clearing false and
   display update interval to never in the LVGL variant.
2. Configure LVGL initially paused, with resume-on-input disabled. Use an explicit
   bootstrap root to avoid ESPHome's implicit hello-world page.
3. Select and validate boot bytes through the existing download/cache/embedded
   path. Validate backend support before accepting or persisting a candidate.
4. After the component is ready, construct all four supported screens at most,
   while rendering is paused. Subscribe once, activate the initial screen, then
   resume LVGL. Do not let touch wake an incomplete UI during network waiting.
5. Report the selected fingerprint only after successful backend construction.
   If component setup or allocation fails, report initialization failure rather
   than successful activation. Define construction-failure recovery explicitly:
   clean up a partial external tree before trying embedded; if embedded also
   fails, remain in a bounded diagnostic state. Reader fallback alone does not
   cover object allocation failures.

Keep navigation in the session. Load LVGL screens through the selected display
API rather than mixing ESPHome's generated page index with manifest screen IDs.
Avoid animated transitions initially. Keep the 16-entry history bound.

## Widget mapping and semantic parity

Compatibility means preserving product semantics, not reproducing legacy pixels
or renderer algorithms. Keep service payloads, offline gating, loading timeouts,
visibility, navigation and declared layout bounds. Review and document native
LVGL text, stacking and input differences explicitly rather than rebuilding the
custom renderer inside LVGL.

| Manifest widget | LVGL implementation | Important checks |
| --- | --- | --- |
| Rectangle | Base object | Remove default padding/borders/radius; disable scrolling and clicking |
| Text | Label, optionally within clipping container | Fixed bounds, 16/22/32px font, native alignment and ellipsis/wrap policy, literal/binding segments |
| Icon | Label with MDI font | UTF-8 glyph inventory, placement and clipping |
| Button | Button plus label | Offline service gating versus local navigation, pressed feedback, 350ms loading semantics, hit slop |

Preserve rectangle-first layering; LVGL creation order establishes sibling
stacking. Explicitly reset inherited/default theme styles and widget flags.
Use visual-stack hit priority: the topmost eligible object receives input. Do
not restore manifest-order hit arbitration over visually overlapping objects.
Visibility conditions must change both painting and hit testing. Native LVGL
hidden objects may affect layout, so start with absolute positioning and no
flex/grid on existing manifest screens.

Do not carry the custom label's opaque erasing trick into LVGL automatically.
LVGL recomposes intersecting layers. Decide whether a label background is a
semantic surface or only a legacy clearing implementation detail and verify
overlapping/conditional rectangles with screenshots.

Use native label ellipsis (`LV_LABEL_LONG_DOT`) and LVGL text alignment within
declared bounds instead of manual font measurement, UTF-8 prefix truncation and
synthetic dot objects. Review narrow labels, all supported font sizes and UTF-8
content; decide single-line versus wrapping policy explicitly. Ellipsis pixels
and font rasterization need not match the custom renderer.

LVGL owns layout resolution, invalidation, refresh scheduling and input routing.
Do not introduce per-widget forced layout, custom redraw scheduling or legacy
press-distance algorithms. LVGL click-on-release differs from custom touch
semantics: test release outside, drag cancellation, rapid taps, nested objects
and expanded touch areas. Configure native input behavior deliberately and
verify exactly-once semantic dispatch rather than assuming defaults suffice.

Express ordinary backgrounds, borders, radii, padding and pressed/disabled
feedback through LVGL styles. Deliberate theme artwork, such as retro chamfered
outlines and decorative rails, may use LVGL draw callbacks; custom artwork is
not a reason to retain legacy rendering infrastructure. Review which ornaments
belong to each product theme instead of requiring pixel-identical decoration.

Later mappings: tabs → tabview/container, todo/calendar → bounded scrolling
containers, notification → top layer, slider → slider, gauge → arc/scale.
Their HA payloads, loading behavior and editor schema still require product code.

## Compatibility and wire format

Keep VESPUI v2 bytes unchanged for the first parity probe. Backend is selected by
the experimental firmware build, and both backends consume the same subset.
Do not retrofit an optional renderer field into v2 records silently.

Before production LVGL-only widgets, introduce a versioned manifest contract
with required feature identifiers and, where semantics differ, an explicit
backend/profile requirement. Firmware capabilities advertise supported format
versions, backend/profile, feature set, fonts/icons and image resources.
LVGL library version is useful diagnostic metadata, not a substitute for those
semantic capabilities.

Existing capability rows lack these fields. Treat them as legacy custom/v2,
not as supporting LVGL. Update server validation, exports, workers, publication
and device-side candidate acceptance together. Server checks alone do not cover
standalone URLs or old cached manifests. Unsupported external bytes must fall
back without overwriting a compatible cache. Layout publication remains free of
compilation; compiled features and resources still require firmware installation.

## Memory and hardware constraints

A 480×480 RGB565 image is 460,800 bytes (450 KiB). LVGL draw storage is additional
to the RGB driver's framebuffer/bounce buffers, object tree, fonts, network/TLS,
manifest model and decoded images. No zero-copy saving is established here.

Tagged ESPHome generation quantizes buffer percentages to divisors. Compare:

| Setting | Effective fraction | Pixel payload before allocator alignment |
| --- | --- | --- |
| 12% | 1/8 | 57,600 bytes |
| 25% | 1/4 | 115,200 bytes |
| 50% | 1/2 | 230,400 bytes |
| 100% | full | 460,800 bytes |

Start at 12% and 25%; log actual allocation location and size. Explicit buffer
sizes do not get the documented automatic allocation fallback. Measure minimum
free internal heap, largest allocatable block and PSRAM at boot, construction,
TLS download, image decode and steady state. Linker RAM percentages are not
runtime headroom measurements.

Keep the board's flash/cache and RGB DMA hardening until physical evidence
supports changes. LVGL cannot fix PSRAM access during flash-disabled windows.
Check NVS writes, OTA and WiFi reconnection for corruption and watchdog resets.
Dirty rendering reduces CPU painting and framebuffer writes; the RGB panel
still scans its framebuffer continuously.

Online images are a separate workstream. Verify decoder ownership, asynchronous
download completion, descriptor lifetime and cache invalidation. The existing
32px progressive image drawing and two-images-per-frame limit cannot simply be
ported as LVGL setters. Keep image migration behind a measured acceptance gate.

## Execution plan and exit criteria

### A. Compile/integration probe

- Generate isolated host and ESP32-S3 LVGL builds at the pinned ESPHome version.
- Dynamically create a label and button after paused bootstrap; exercise a
  runtime-only widget enable flag and all four font resources.
- Confirm display flush, color byte order, GT911 coordinates and initialization
  after boot download. Record build RAM/flash deltas against the same fixture.
- Exit: both targets compile; host renders; physical panel displays correct
  colors and accepts touch. Without physical access, label the result host-only.

### B. Shared v2 parity probe

- Run the existing four parity fixtures per theme through both backends.
- Capture before/after state updates, visibility, service action and navigation.
- Add no-op state-update checks: no setter/flush work after stabilization.
- Preserve existing exact custom baselines. Keep LVGL captures separate; font
  rasterization differences require explicit review, not baseline replacement.
- Exit: matching declared bounds, clipping, text content, action counts and
  navigation; reviewed native ellipsis, visual-stack hit priority and input
  behavior; deliberate retro/modern artwork; no idle full-screen repaint.
  Semantic compatibility does not require legacy pixel or algorithm parity.

### C. Boot/cloud probe

- Same binary: embedded, downloaded, cached, offline and corrupt-manifest boots.
- Changing staged bytes does nothing until reboot. Subscription count and object
  count remain constant across state updates. Report active only after mount.
- Inject unsupported features and allocation failure; confirm cleanup, fallback
  and truthful reporting. Add renderer compatibility tests across old/new rows.

### D. Product-value probe

- Implement one slider and one bounded scrolling list in an experimental new
  manifest version. Verify throttled slider service dispatch and HA pushback.
- Exercise image loading separately. Measure touch-to-visible latency and
  update-to-flush latency (median/p95), flush pixels and minimum heap using the
  same hardware/workload as custom. Target <=100ms p95 touch feedback as an
  initial product goal; agree acceptable regression and heap margin from measured
  baseline before rollout.
- Exit: useful reduction in widget-specific infrastructure, stable memory over
  repeated navigation/state/image cycles, and OTA partition capacity retained.

## Follow-up decision

Adopt LVGL for new supported projects if A–D pass. Keep generated/custom fallback
for unsupported projects during migration. Only investigate dual-engine firmware
if users require unmigrated custom screens inside the same device project.
That option needs an external display coordinator because stock LVGL validation
rejects the custom writer, plus exclusive input routing, suppressed background
timers/flushes and a forced repaint at ownership transfer. Pause alone is not
proof of safe coexistence.

## Sources

- [ESPHome LVGL documentation](https://esphome.io/components/lvgl/) (current
  documentation; tagged source below establishes the repository version).
- [ESPHome 2026.7.1 LVGL generation](https://github.com/esphome/esphome/blob/2026.7.1/esphome/components/lvgl/__init__.py).
- [ESPHome 2026.7.1 LVGL C++ integration](https://github.com/esphome/esphome/blob/2026.7.1/esphome/components/lvgl/lvgl_esphome.h).
- Repository: `docs/runtime-ui-model-plan.md`, `docs/cloud-manifest-publishing.md`,
  current runtime headers, `templates/base.yaml` and YAML generator.
