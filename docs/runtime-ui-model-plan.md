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

Introduce a simple deterministic little-endian `VESPUI` format containing:

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
