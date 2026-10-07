# Incremental LVGL migration checklist

Architecture: [LVGL spike](lvgl-migration-spike.md). Each phase requires evidence
before selecting LVGL for production projects. Layout activation stays reboot-only.

## Required migration contracts

These are acceptance requirements for the production backend, not optional
follow-up optimizations. Complete each at the phase indicated below.

### Widget support and resource inventory (phases 1–2)

- [ ] Define a shared widget-support registry consumed by compilation and
      compatibility validation: widget kind, backend/profile, supported
      properties/actions, required semantic features and compiled resources.
- [ ] Reject unsupported properties explicitly or select the existing generated
      fallback; never silently discard an editor setting in the LVGL backend.
- [ ] Verify schema, editor defaults, compiler and runtime agree on the supported
      subset. Add a conformance check when the registry is introduced.
- [ ] Declare a bounded font/icon/resource profile, initially the existing
      16/22/32px text sizes and MDI resources. New fonts, glyphs and image formats
      must update build configuration and capability checks together.
- [ ] Verify dynamic widget enablement includes dependencies and required ESPHome
      adapters, not only the primary `LV_USE_*` define.

### State, events and object lifetime (phases 2–3)

- [ ] Keep entity bindings, service payloads, loading timeouts, visibility and
      navigation in the renderer-neutral session; LVGL callbacks dispatch
      semantic actions rather than owning separate HA behavior.
- [ ] Mount once per boot, subscribe once, and retain the bounded screen object
      tree. Entity updates must not recreate widgets or register subscriptions.
- [ ] Compare cached visible values before text/style/state setters. Unchanged
      updates must produce no additional setter or flush work after stabilization.
- [ ] Mutate LVGL only on the ESPHome main loop; queue updates from other execution
      contexts. Callback contexts, font pointers and image descriptors must remain
      valid for every object that references them.
- [ ] Clean up partial construction, callbacks and timers before releasing their
      contexts. An external mount failure must not leak objects into embedded
      fallback or result in a successful activation report.
- [ ] Avoid forced layout updates per widget and keep initial transitions
      non-animated. Any later animation needs device latency/redraw measurements.

### Compatibility and bounded memory (phases 1, 4–5)

- [ ] Negotiate compiled widget/resource support, semantic behavior (for example
      scrolling or confirmation) and capacity limits separately. LVGL presence or
      a library version alone does not establish layout compatibility.
- [ ] Apply the same requirements to publication, device delivery and device-side
      boot acceptance, including standalone URLs and cached bytes. Unsupported
      candidates must not replace a compatible cache.
- [ ] Preserve old capability-row interpretation as custom/v2 and version any
      contract that adds new widget records or backend-specific semantics.
- [ ] Measure minimum free internal heap, largest free internal block, PSRAM and
      allocation failures during TLS, mount, HA initialization, navigation, image
      decode and OTA. Establish a measured reserve before production selection;
      total free PSRAM and linker RAM figures are insufficient.
- [ ] Bound object counts and image/cache storage. Decoded images must have owned
      storage whose lifetime exceeds all LVGL references; downloads must not
      overwrite pixels still displayed. Require these checks before image support
      is enabled, including replacement and failure paths.

### Visual and behavioral evidence (phases 3–5)

- [ ] Check firmware geometry against editor expectations: bounds, alignment,
      clipping, stacking, hidden-widget hit testing and production font metrics.
- [ ] Capture the first visible boot frame, visibility changes and screen
      transitions as well as settled screenshots, in both retro and modern.
- [ ] Verify release outside a button, drag cancellation, rapid taps and action
      counts. When images are enabled, test navigation during image loading.
- [ ] Exercise construction failure followed by fallback and ensure no partially
      mounted external screen is exposed or reported active.
- [ ] Instrument content updates, layout/render/flush durations, flushed pixels,
      main-loop gaps and touch-to-visible latency separately. Define acceptance
      thresholds against the physical-device baseline before rollout.
- [ ] Keep existing custom baselines unchanged. Review LVGL differences explicitly
      and record host versus physical-device evidence separately.

## 1. Platform probe — started

- [x] Verify pinned ESPHome LVGL version and writer/feature-generation constraints.
- [x] Add isolated host generator with paused initialization and dynamic objects.
- [x] Compile probe against ESPHome 2026.7.1; prove runtime-only widget flags work.
- [x] Capture retro and modern host screens and verify button events/slider input.
- [x] Add 16/22/32px text and MDI font adapters; verify glyph rendering on host.
- [ ] Generate/compile corresponding ST7701S + GT911 device probe.
- [ ] Verify colors, touch coordinates, NVS/OTA behavior on physical hardware.
- [ ] Compare 1/8 and 1/4 draw buffers; record internal heap, largest block,
      PSRAM and flash/OTA capacity under TLS and steady-state workloads.

Probe commands from repository root:

```sh
bun run simulator/generate-lvgl-probe.ts --theme retro
docker build -f simulator/Dockerfile --build-arg GENERATED_DIR=generated-lvgl \
  -t vesp-lvgl-probe:retro simulator
```

Use isolated localhost containers with `simulator/control.py` for captures.
Repeat generation/build with `--theme modern` and a distinct image tag.
This probe establishes integration, not production-theme parity or manifest support.

Initial host evidence (2026-10-04): both Docker images compiled; runtime-created
label/button/slider rendered; button text changed after a widget-ID tap in both
themes; modern slider moved after a drag. Captures: `/tmp/opencode/lvgl-retro.png`,
`lvgl-retro-clicked.png`, `lvgl-modern.png`, `lvgl-modern-clicked.png`,
`lvgl-modern-slider.png` in the same directory. Build logs:
`/tmp/opencode/lvgl-probe-build.log`, `/tmp/opencode/lvgl-probe-modern-build.log`.
Runtime widget inventory explicitly enables LABEL, BUTTON, SLIDER and BAR;
SLIDER alone fails compilation because BAR is a dependency. These screenshots
use LVGL's default font and probe styles, not the production theme/font adapters.

## 2. Backend boundary

- [x] Extract model/binding/action/navigation ownership into a renderer-neutral session.
- [x] Preserve existing custom rendering and all existing regression baselines.
- [ ] Add LVGL backend with stable callbacks and explicit object/timer cleanup.
- [ ] Keep backend selection explicit and one renderer per firmware initially.

## 3. Existing manifest parity

- [ ] Mount existing v2 text/rectangle/button/icon records dynamically.
- [ ] Preserve bounds, stacking, visibility, templates and font sizes/alignment.
- [ ] Preserve service offline gating, loading feedback and bounded navigation.
- [ ] Compare four fixtures per theme; review separate LVGL screenshots.
- [ ] Verify unchanged state produces no redraw work after stabilization.

## 4. Reboot/cloud compatibility

- [ ] Gate mount after LVGL setup and boot manifest selection; subscribe once.
- [ ] Validate backend/features before accepting and caching external bytes.
- [ ] Handle partial allocation failure and embedded fallback; report truthfully.
- [ ] Version capabilities, treating existing rows as custom/v2.
- [ ] Verify download/cache/embedded, offline/corrupt/unsupported fallback.
- [ ] Verify staged changes activate only after reboot with unchanged firmware.

## 5. New widgets and rollout

- [ ] Add versioned feature contract for slider and bounded scrolling list.
- [ ] Implement editor/schema/codegen/validation and throttled HA actions.
- [ ] Measure online-image ownership, decoding, invalidation and peak memory.
- [ ] Measure latency and memory stability over repeated workload cycles.
- [ ] Enable selected projects only after hardware and both-theme gates pass.
- [ ] Migrate remaining widgets; retire custom backend after coverage is complete.
- [ ] Consider dual-engine firmware only if a concrete project requires it.

## Manifest backend implementation evidence (2026-10-06)

`ui_runtime_session.h` now owns boot selection, stable binding storage,
deduplicated state-change notification, action dispatch and bounded navigation.
Both the custom `RuntimeUi` and experimental `LvglRuntime` use this session.
Mount completes before subscriptions are registered. A failed external mount can
fall back to embedded data after backend cleanup; a portable C++ test injects
that failure and checks activation ordering, fingerprint, subscriptions and
rejected reload. Physical allocation-failure behavior remains unverified.

`ui_lvgl_runtime.h` dynamically constructs the v2 text/rectangle/button/icon
subset. Host generation is in `simulator/generate-lvgl.ts`, with isolated mock HA
adapters in `simulator/lvgl-app.h`. The backend is not selected by hosted builds
or source exports. Full visual/touch parity and production capability negotiation
remain open gates; the experimental button styling is not yet identical to the
custom backend.

Implemented optimizations:

- Retain all bounded screen objects; navigation does not rebuild widgets.
- Binding revision tracking skips text assembly and condition evaluation on
  unchanged idle polls, except buttons with active loading timeouts.
- Compare visible values before text/visibility setters; no per-widget forced
  layout pass or animated screen transitions.
- Stable pre-sized callback storage, clipped widget containers and a 1/8 draw
  buffer. Release-point bounds guard cancels drags outside a button.
- Text/visibility mutation and flush counters; idle simulator assertions verify
  counters and subscription counts stop changing after stabilization.

Verification completed:

- 181 codegen tests passed (one optional device test skipped in the standard run).
- Separate real ESP32-S3 compilation of the custom shared-session firmware passed.
- Svelte checking passed; `git diff --check` passed.
- All 38 existing widget baselines and eight generated/custom manifest parity
  cases matched exactly. The simulator-only forecast clock was made deterministic
  after discovering weekday labels still followed wall-clock time. Baselines were
  not updated.
- Seven LVGL interaction captures per theme: initial, release outside, state on,
  detail, back, state off restored and repeated restoration. Checks verify exact
  restored pixels, expected service count, stable binding count and idle counters.
- Six reboot captures per theme: embedded, staged, external, corrupt staged,
  invalid fallback and missing fallback, using the same unchanged image per theme.

Reproduce from repository root:

```sh
bun run simulator/generate-lvgl.ts --theme retro --output simulator/generated/lvgl-retro
docker build -f simulator/Dockerfile --build-arg GENERATED_DIR=generated/lvgl-retro \
  -t vesp-lvgl-runtime:retro simulator
python3 simulator/test-lvgl-runtime.py --image vesp-lvgl-runtime:retro --theme retro \
  --output /tmp/opencode/lvgl-runtime-retro-checks
python3 simulator/test-boot-manifest.py --image vesp-lvgl-runtime:retro --theme retro \
  --project simulator/lvgl-fixture.json --output /tmp/opencode/lvgl-runtime-boot-retro
```

Repeat with modern theme, output directory and image tag. Interaction reports:
`/tmp/opencode/lvgl-runtime-{retro,modern}-checks/index.html`. Existing renderer
regression report: `/tmp/opencode/lvgl-session-regression/index.html`.

Native LVGL semantics cleanup (2026-10-06): labels use LVGL single-line dots
and clipping, font line height and native text alignment. Buttons use native
border/radius and pressed/disabled styles, with at least 48px extended click
targets. Background rectangles are ordered before foreground widgets; overlapping
buttons follow native topmost priority. There are no synthetic dot objects,
font-descriptor casts, custom decoration painting or manifest-order hit-test
arbitration. Release-outside cancellation, HA gating, loading timeout and guarded
text/visibility setters remain. Raster identity with the legacy renderer is not
an acceptance requirement for this cleanup; native styling differences require
explicit screenshot review.

Cleanup verification: both isolated images compiled successfully against pinned
ESPHome 2026.7.1/LVGL 9.5. Both `test-lvgl-runtime.py` runs passed, producing
11 captures per theme, including overlapping-button topmost dispatch, a 16px
button activated outside its object through the extended target, and narrow UTF-8
labels at 16/22/32px. Both native text/stacking captures were visually inspected.
Both reboot suites passed. The first modern reboot run failed its invalid-fallback
pixel comparison: its saved initial frame had the reversed external title while
the fallback frame had the normal embedded title. A fresh rerun passed all checks;
the transient capture/boot sequencing discrepancy remains unexplained and is not
evidence of a clean first run. Background-first ordering is implemented but is not
directly covered by this fixture. No custom-renderer baselines were updated.

Build logs: `/tmp/opencode/lvgl-native-{retro,modern}-build.log`. Interaction
reports: `/tmp/opencode/lvgl-native-{retro,modern}-checks/index.html`. Reboot
captures: `/tmp/opencode/lvgl-native-boot-{retro,modern}/`. These checks use the
reproduction commands above with these output directories; they do not establish
physical-device performance or production parity.

Verified native images `vesp-lvgl-native:retro` and `vesp-lvgl-native:modern`:
both interaction suites pass, including narrow UTF-8 labels, topmost overlap,
expanded small-button targets, release cancellation, restoration and idle counters.
Reports: `/tmp/opencode/lvgl-native-{retro,modern}-checks/index.html`.
Both reboot suites pass staging isolation, activation and invalid/missing fallback;
captures: `/tmp/opencode/lvgl-native-boot-{retro,modern}/`.
The custom regression/parity suite also passes without baseline changes:
`/tmp/opencode/lvgl-native-custom-regression/index.html`.

Icon-free manifest fix (2026-10-06): the generator previously referenced
`mdi_icons_24` unconditionally, so a project with no icons generated firmware
that failed validation. The generator now generates and references the icon font
only when the project has known icons, and `LvglRuntime::mount` requires an icon
font only when the manifest contains icon widgets. Verified by generating an
icon-free variant of the demo, compiling `vesp-lvgl-native:no-icons`, and
confirming it boots and renders (`Loaded LVGL runtime: 2 screens, 9 widgets`).
The themed retro/modern images were rebuilt with zero errors and both interaction
and reboot suites still pass; icon-path output is byte-identical to the previous
build. Logs: `/tmp/opencode/lvgl-no-icons-build.log`,
`/tmp/opencode/lvgl-icons-{retro,modern}-checks/`. Not yet covered by an
automated regression test.

Next gates: production theme/text/touch acceptance, construction-failure/transition
captures, device LVGL compilation and HA adapter, resource/feature compatibility,
then physical memory, latency, flash/NVS and OTA measurements. Idle counters are
not substitutes for layout/render/flush timing or hardware performance evidence.
