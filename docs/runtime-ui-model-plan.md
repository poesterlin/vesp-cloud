# Runtime UI Model Firmware — Proof of Concept

## Goal

Prove that an ESPHome firmware build can load a compact UI manifest at boot and
construct a working UI without generating project-specific screen, state,
binding, condition, or action C++.

The proof of concept is successful when one representative project can:

- Load a manifest embedded in the firmware.
- Construct screens and widgets at runtime.
- Subscribe widgets to Home Assistant state.
- Evaluate a basic visibility condition.
- Dispatch a Home Assistant action and navigate between screens.
- Preserve the existing dirty-rectangle drawing and touch behavior.

Production publishing, remote manifest downloads, live editing, rollback,
security, billing, migration, and full component parity are outside the proof of
concept.

## Current implementation and validation

The branch implements the binary compiler, host-testable reader, runtime widget
factory, Home Assistant adapters, and automatic runtime/generated selection in
the compilation queue and ZIP export. Firmware includes an embedded fallback
and now accepts a validated external manifest through a boot-source adapter.
Generated runtime firmware can download a configured binary URL at boot and
persist validated bytes in NVS for offline starts.
Manifest activation is reboot-only; live replacement is out of scope.

Compatibility checks deliberately fall back to generated firmware for unsupported
display sizes, scrolling, headers, button styling/confirmation,
scaled icons, and page cycling that would otherwise include detail views. Invalid
geometry, dangling references, and exceeded resource limits remain errors.

The runtime polls widgets every 50ms before checking damage, so loading timeouts
can invalidate their paint regions even when no external update arrives.
Navigation history is bounded to avoid unbounded heap growth.

### Text migration (local changes; not deployed)

The compiler now emits VESPUI format version 2. The reader accepts both versions;
version-1 records keep their original small/left-aligned text defaults. Version 2
adds widget font size, alignment, and up to 32 literal/binding segments per label.
Small, medium, and large fonts use 16/22/32-pixel font resources. Text templates
use the editor's existing parser, deduplicate entity/attribute subscriptions, and
preserve legacy `textBinding` append semantics. Labels erase using the last
fully containing rectangle's color, falling back to the screen background.

Compiler and host C++ tests cover all size/alignment combinations, template
evaluation, invalid styles and segment references, segment limits, truncation,
and version-1 compatibility. Runtime builds and ZIP exports also write the raw
`ui_manifest.vespui` alongside the embedded header, providing the data artifact
needed for manifest updates. No app or simulator deployment is part of this
migration step.

### Reboot-only manifest selection (local changes; not deployed)

`ui_boot_manifest.h` defines `BootManifestSource`, a bounded byte-reader adapter.
`RuntimeContext.boot_manifest_source` supplies optional external bytes before
widgets, bindings, actions or subscriptions are constructed. The reader validates
the complete candidate and falls back to embedded bytes when the source fails
or the candidate is invalid. Source failures remain available for diagnostics.
The parsed model owns its strings/records; temporary byte buffers are released.

Generic device firmware exposes `g_ui_app.set_boot_manifest_source(source)`.
Generated YAML configures its device source with `prepare_boot_manifest(scope)`
before `init()` at priority -100. A custom adapter must bound reads to 32KiB and
finish before returning. Initialization is attempted once, including failure,
and the setter rejects changes after that attempt. The active UI and
subscriptions are fixed until reboot. `RuntimeUi::load()` also continues to
reject a second load.

The desktop adapter reads `VESPUI_MANIFEST_PATH` once at startup. It bounds file
size before allocation and uses the same production reader/runtime. Simulator
generation now writes `ui_manifest.vespui` as well as the embedded header.
`simulator/test-boot-manifest.py` proves with one unchanged image per theme that:

- Staged bytes do not change the running display.
- Restarting activates changed manifest content without rebuilding the image.
- Corrupt staged bytes do not affect the active UI.
- Invalid or absent files restore the exact embedded framebuffer after restart.

Both themes passed these checks, all 38 widget baselines and eight parity cases
matched exactly, and real ESP32-S3 compilation passed. This establishes boot-time
selection/rendering. Remote publishing and font/icon capability negotiation are
now implemented in [Cloud manifest publishing](cloud-manifest-publishing.md).
External manifests must fit the fonts, glyphs and theme already
compiled into that firmware; they cannot add firmware resources.

### Code-generation integration: boot download and NVS cache

The project schema now accepts optional `secrets.uiManifestUrl`, an HTTP(S) URL
serving raw `ui_manifest.vespui` bytes. The compiler worker and ZIP export use the
same runtime YAML generator; secrets generation writes `ui_manifest_url` when
configured. Hosted builds and source exports assign cloud URLs automatically.
Standalone deployments can configure the URL in project JSON:

```json
{
  "secrets": {
    "uiManifestUrl": "https://example.com/panel/ui_manifest.vespui"
  }
}
```

Generated firmware sets fonts and the display bridge, configures its cache
adapter, waits up to 15 seconds for WiFi when a URL is configured, and makes one
HTTP request with a 5-second per-operation timeout. TLS verification is enabled;
capture is capped at 32KiB. Only a status-200, reader-valid body is accepted.
Then it constructs the UI once from downloaded bytes, cached bytes, or the
embedded fallback, in that order. No interval, HA update or touch can initialize
the runtime while that boot sequence is pending, and later network reconnection
does not trigger another request or replacement.

`ui_manifest_storage.h` stores validated bytes as an NVS blob, avoids writes for
identical content, and stores source scope and bytes in one replaceable blob.
Read failures and invalid/oversized cached bytes fall back to embedded data.
Write failures are logged; a valid download can still render during that boot.
This uses the existing NVS partition and does not erase it, add flash partitions,
or implement A/B confirmation/rollback. Cache capacity and physical-device flash
behavior still require hardware validation.

Without a URL there is no network wait/request. Unsupported projects retain the
generated C++ fallback. ZIP export now includes the actual shared templates and
generated `secrets.yaml`; its previous route-relative template glob was empty.
Simulator builds explicitly use their file adapter instead of WiFi/NVS delivery.

Verification includes host C++ cache tests for validation, unchanged-content
write suppression, namespace isolation, size bounds and simulated storage errors;
ESP32-S3 compilation of generated YAML with boot HTTPS enabled; production web
build and Svelte checking; and both-theme widget/parity regression. Actual HTTPS
fetch, NVS persistence across physical reboots, and flash/display interaction
remain hardware checks. Remote publishing and resource-capability negotiation
are documented in the cloud extension linked above.

Run compiler and host parser checks from `web/packages/editor`:

```sh
bun test src/lib/codegen
```

The real ESPHome compilation test is opt-in. With a repository-local ESPHome
virtualenv at `.venv/bin/esphome`:

```sh
VESPUI_ESPHOME_COMPILE=1 bun test src/lib/codegen/__tests__/ui-runtime-firmware.test.ts
```

Alternatively, use a Docker image containing the project's ESPHome version:

```sh
VESPUI_ESPHOME_COMPILE=1 \
VESPUI_ESPHOME_DOCKER_IMAGE=debug-esphome-vesp-cloud:latest \
VESPUI_ESPHOME_DOCKER_ENTRYPOINT=/opt/esphome-venv/bin/esphome \
bun test src/lib/codegen/__tests__/ui-runtime-firmware.test.ts
```

### Device UI simulation

The representative runtime fixture has compiled successfully for ESP32-S3 with
ESPHome 2026.7.1 in Docker after the rebase. The build reported 117,355 bytes
static RAM (34.3%) and 1,066,311 bytes flash (58.1%). These are linker/build
figures, not measurements of free heap after manifest construction. Rendering,
touch, HA round trips, and dynamic heap headroom still need hardware validation.

ESPHome's `host` platform plus its SDL display and SDL touchscreen can run the
same C++ widgets on Linux/macOS with mouse input, and the native API can connect
the host device to Home Assistant. This would provide a more faithful behavioral
simulator than the editor's Svelte preview.

The browser-accessible target is implemented in `simulator/`. It generates a
host YAML configuration and embedded manifest, builds the real runtime widgets
with ESPHome 2026.7.1 and SDL, and exposes a 480x480 Xvfb desktop through noVNC.
The shared fast-fill helper has a host-native RGB565 bulk path with the same
manual clipping. Only the Home Assistant adapter is replaced with mock state;
service calls do not reach real devices.

Open `https://vesp.cloud/simulator/`. A 390x844 touch-enabled browser check passed
for state toggling, conditional visibility, detail navigation/back, and exact
restoration of the hidden label's pixels. The service is a shared demo session.
Generate a different supported project with `simulator/deploy.sh project.json`.
Desktop simulation cannot validate LCD bus timing, PSRAM constraints, GT911
behavior, or physical-device memory headroom.

## Scope

### Representative components

Support only the smallest set needed to exercise the architecture:

- Text
- Rectangle
- Button
- Icon
- One container or multi-screen navigation example

Add one online image or one HA response job only after the basic runtime works.
These are feasibility experiments, not initial requirements.

### Manifest

Use a simple deterministic little-endian `VESPUI` format containing:

- Magic and format version
- Payload length
- String table
- Typed state bindings
- Screens
- Widgets
- Actions
- Basic conditions

Use type-discriminated, length-prefixed records. Validate lengths, indices,
types, geometry, and resource counts before constructing the UI.

The proof-of-concept compiler may use fixed limits and a single format version.
Compatibility hashes, release sequences, signatures, optional-record
negotiation, and forward compatibility are deferred.

### Compiler API

Add:

```ts
type CompileUiManifestResult =
  | {
      ok: true;
      bytes: Uint8Array;
      metadata: UiManifestMetadata;
      warnings: ManifestDiagnostic[];
    }
  | {
      ok: false;
      errors: ManifestDiagnostic[];
    };

function compileUiManifest(project: Project): CompileUiManifestResult;
```

The compiler will:

- Flatten layout offsets.
- Determine widget paint order.
- Deduplicate strings and state bindings.
- Assign numeric state, screen, and action IDs.
- Compile the supported condition subset.
- Reject unsupported project features with clear diagnostics.

## Firmware Runtime

Add:

- A manifest reader.
- A typed state registry with stable storage.
- A numeric screen registry.
- A widget factory for the supported components.
- Shared action and condition dispatchers.
- A small runtime context passed to widgets.

The runtime must preserve:

- Dirty bounds and partial redraws
- Normal widget layering
- Clipped drawing
- Touch-consumption behavior
- Widget state polling through stable state references

Use fixed proof-of-concept limits, for example:

- 32 widgets
- 4 screens
- 16 state bindings
- 16 actions
- 16 conditions
- 32 KiB manifest

Record measured firmware size, internal heap, PSRAM use, and free heap after UI
construction. Do not build configurable resource pools until the measurements
show they are needed.

## ESPHome Feasibility Checks

Prove these items early:

1. Home Assistant subscriptions can be registered from manifest records and
   update stable runtime state slots.
2. Runtime-created widgets can use the existing display, fonts, invalidation,
   and touch infrastructure.
3. Actions can call Home Assistant services through a shared runtime
   dispatcher.

After the basic proof works, separately test whether ESPHome supports:

- Dynamically configured service calls with captured responses.
- Dynamically created and updated `OnlineImage` instances.

If either experiment requires substantial ESPHome changes, leave that feature
on the generated path for the prototype rather than expanding the proof of
concept.

## Development Flow

- Generate `ui_manifest.vespui` from a fixture project.
- Embed it in the firmware build as a byte array or binary resource.
- Parse and construct it once during boot.
- Keep the current generated firmware path unchanged.
- Use the current generator as a visual and behavioral reference.

No database tables, API endpoints, object storage, device update protocol,
flash partitions, release management, or deploy UI are needed.

## Tests

Add only the tests needed to establish viability:

- A deterministic compiler fixture for the representative project.
- Parser rejection tests for truncation, invalid lengths, bad indices, unknown
  required types, and exceeded fixed limits.
- A host-side C++ parser test that verifies screens, widget properties, state
  references, paint order, conditions, and actions.
- One full ESPHome compilation test.
- One hardware test covering rendering, touch, a Home Assistant state update,
  an action, navigation, and partial redraw behavior.

## Exit Criteria

The proof of concept is complete when:

- Editing the fixture project and regenerating only the manifest changes the
  device UI without changing project-specific C++.
- The generic firmware constructs the fixture UI successfully.
- A Home Assistant state update changes only the affected rendered region.
- A button dispatches an action and navigation works.
- Invalid manifests fail safely without constructing a partial UI.
- Memory measurements leave enough headroom to justify continuing.

## Deferred Production Work

If the proof of concept succeeds, a separate production plan can cover:

- Full widget, condition, action, image, weather, calendar, and todo parity
- Remote publishing and device downloads
- Authentication and integrity protection
- Firmware capability negotiation
- A/B manifest storage, confirmation, and rollback
- Multiple firmware versions within one project
- Resource sizing and hard ceilings
- Immutable release history and server endpoints
- Exported project ZIP changes
- Existing-device migration
- Live editing or hot runtime replacement
- Exhaustive malformed-input, server, flash, and hardware testing
# Local two-theme visual regression harness

`simulator/visual_regression.py` rebuilds explicit retro and modern desktop
images, captures 19 deterministic scenarios per theme, and compares against
`simulator/baselines/widgets`. Repeated independent capture matched all 38 cases
exactly. Clock/header time and loading phase are fixed only in copied regression
build inputs; production templates retain real time/animation behavior.

```sh
python3 simulator/visual_regression.py --baseline simulator/baselines/widgets --output /tmp/opencode/visual-regression
python3 simulator/visual_regression.py --baseline simulator/baselines/widgets --output /tmp/opencode/migration-parity --parity
```

The runner emits side-by-side HTML, highlighted diffs, exact changed-pixel counts
and bounds, JSON results, build logs, and candidate PNGs. Baseline replacement
requires `--update-baseline`. All execution uses disposable localhost containers;
the deployed simulator is not updated by these commands.

The parity option runs the same `simulator/parity.json` through actual generated
screens/state and the binary manifest runtime, with identical mock state input.
All four cases per theme now match exactly, including a separated-damage repaint
case and exact restoration of initial pixels. The original six mismatches led
to fixes for large-label font selection, background clipping across disjoint
damage, and generated/manifest button colors. Captures also wait for stable
framebuffer hashes to avoid recording incomplete host draw passes. This establishes
parity only for the shared fixture's supported subset. Expand the fixture as
the manifest gains layout/action/navigation support. See
`simulator/baselines/README.md` for full usage and scenario limitations.
