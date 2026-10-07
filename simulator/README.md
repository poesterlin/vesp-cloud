# Browser-accessible device simulator

Open **https://vesp.cloud/simulator/** on a phone or desktop.

This runs the actual manifest reader, runtime widgets, dirty-rectangle drawing,
and touch handling compiled for ESPHome's Linux host platform. SDL renders into
a 480×480 Xvfb display. noVNC streams that display and forwards browser taps as
mouse/touch input. It is a shared simulator session.

## Try it

1. Tap **Toggle light**. The bound state changes from `off` to `on`, and the
   conditional label appears.
2. Tap **Open detail screen**. The second screen shows the same bound state.
3. Tap **Back to dashboard**.
4. Toggle the light off. The label disappears and its background is restored.

Home Assistant is mocked: service calls never change real devices. The current
screen is a representative runtime demo, not an imported user project.

## Build and run

Install the web workspace dependencies first (`cd web && bun install`). Then:

```sh
cd simulator
cp .env.example .env
./deploy.sh
```

To load another project in the supported runtime subset:

```sh
./deploy.sh /absolute/path/to/project.json
```

Unsupported projects produce compiler diagnostics rather than an inaccurate
preview. Generated files stay in the ignored `generated/` directory. The Docker
build compiles the host executable in a build stage and runs as a non-root user.
Traefik serves `/simulator/` on `SIMULATOR_DOMAIN`; no host ports are published.
The fixture was checked in a 390×844 touch-enabled Chromium browser, including
state changes, conditional visibility, navigation/back and pixel restoration.

```sh
docker compose logs -f simulator
docker compose restart simulator  # resets screens and mock state
docker compose down              # stops only this simulator
```

This validates software behavior, not ST7701S timing, ESP32 memory limits or
physical GT911 input. Device runtime firmware now supports boot-only manifest
downloads with an NVS cache when `secrets.uiManifestUrl` is configured; the
simulator uses the file adapter described below.

## Reboot-only external manifests

The ordinary runtime simulator accepts `VESPUI_MANIFEST_PATH`, pointing to a
binary `.vespui` file inside the container. Mount a directory containing that
file and set the environment variable when starting an isolated instance. It is
read once at process boot, validated, and rendered by the production runtime.
Missing, oversized, unreadable or invalid files fall back to the embedded UI.
Changing the file has no effect until `/api/reset` or container restart.
Gallery and parity adapters use their own fixed fixtures.

Generate raw bytes with `bun run simulator/generate.ts project.json --output
simulator/generated/candidate`; the result includes `ui_manifest.vespui`.
Manifest changes must use the existing firmware theme/font/icon resources.

Run the reboot regression against a deterministic ordinary demo image built
with the matching theme:

```sh
python3 simulator/test-boot-manifest.py --image vesp-boot-retro --theme retro --output /tmp/opencode/boot-retro-captures
python3 simulator/test-boot-manifest.py --image vesp-boot-modern --theme modern --output /tmp/opencode/boot-modern-captures
```

Each check starts a disposable container from one fixed image, stages a different
manifest, verifies no pre-reboot change, checks activation after restart, and
checks exact embedded fallback for invalid/missing files. Six PNGs are saved.
This tests boot selection. The generated WiFi/NVS adapter compiles for ESP32-S3;
its physical-device download/persistence behavior still needs hardware testing.

## Widget test pages

### Two-theme regression testing

```sh
python3 simulator/visual_regression.py --baseline simulator/baselines/widgets --output /tmp/opencode/visual-regression
```

Builds both themes, captures 19 deterministic cases per theme, and produces an
HTML baseline/candidate/diff report and `results.json`. Any changed pixels or
case coverage return a failing exit status. Add `--parity` for generated-vs-
manifest comparison; its four cases per theme now match exactly, including
state restoration and separated-damage repainting. See
[baseline documentation](baselines/README.md) for setup, acceptance, parity
coverage and the full scenario coverage.

Collect all screenshots from an already-built widget-gallery image:

```sh
python3 simulator/capture-gallery.py --image vesp-gallery-check --build modern --output /tmp/opencode/screenshots-modern
# For a separately built retro image:
python3 simulator/capture-gallery.py --image vesp-gallery-retro --build retro --output /tmp/opencode/screenshots-retro
```

The script starts a temporary container on an automatically allocated localhost
port, waits for health, resets it, captures every page, validates native PNG
dimensions and page navigation, then removes the container. Output includes an
`index.html` gallery and `manifest.json` with build label, image ID and capture
time. `--build` labels the collection; the image determines the actual theme.
Clock and loading frames vary with time.

To capture a running gallery instead, use `--url http://127.0.0.1:6086/`.
This resets and navigates that session. `SIMULATOR_URL` and `GALLERY_OUTPUT`
remain supported. The source must be a gallery build with a `next` target on
every page. Adjust `--timeout` or `--settle-ms` for slower startup/rendering.

Deploy the interactive widget showcase and hosted screenshots with
`simulator/deploy.sh --gallery`. The screenshot page is served at
`/simulator/gallery.html`, with native PNGs under `/simulator/screenshots/`.

`bun run simulator/generate.ts --gallery` generates a desktop showcase using
the production C++ widgets, including those beyond current manifest support.
See [the screenshot gallery](screenshots/gallery/README.md) for all nine pages,
saved native PNGs, coverage, and isolated build/capture commands. Automate a full
page sweep with `simulator/capture-gallery.py` and `SIMULATOR_URL`.

## Inspection and automation tools

Local improvements add coordinate picking, pixel-color readout, a grid and
crosshair overlay, coordinate tap/drag forms, generated screen targets, native
PNG downloads, pixel-baseline comparison and firmware logs. Picking mode never
sends touch to the device. Reset restarts just the mock device executable.
Keyboard shortcuts: **S** screenshot, **B** baseline, **G** grid, **I** picker.
The controls and widget showcase are deployed at `https://vesp.cloud/simulator/`;
the hosted screenshot gallery is at `https://vesp.cloud/simulator/gallery.html`.

The CLI uses only the Python standard library:

```sh
python3 simulator/control.py tap 350 198
python3 simulator/control.py tap-widget light-toggle --capture /tmp/opencode/result.png
python3 simulator/control.py drag 240 360 240 120 --duration 700
python3 simulator/control.py screenshot /tmp/opencode/device.png
python3 simulator/control.py screenshot /tmp/opencode/annotated.png --grid --pointer
python3 simulator/control.py state
python3 simulator/control.py logs
python3 simulator/control.py reset
```

For browser automation, await `window.simulator.tapWidget('light-toggle')` or
`window.simulator.tap(350, 198)`. `state()` returns a screen index and framebuffer
hash; `waitForFrameChange(hash)` awaits changed device pixels. `screenshot()`
returns a native PNG Blob, and `screenshotDataUrl()` returns a serializable image
for browser tools. No CSS-coordinate conversion or hidden noVNC APIs are needed.
Browser action promises wait until the streamed canvas matches the device's
native RGBA pixel hash. Use `waitForDisplay()` after a manual touch. The CLI
supports `SIMULATOR_URL` and optional `--capture` on actions for one-command
interaction and screenshot collection.

To verify an isolated local test container rather than changing the live demo:

```sh
SIMULATOR_URL=http://127.0.0.1:6085/ python3 -m unittest discover -s simulator/tests
python3 simulator/control.py --url http://127.0.0.1:6085/ screenshot /tmp/opencode/local.png
```
# Experimental LVGL integration probe

Generate with `bun run simulator/generate-lvgl-probe.ts --theme retro` from the
repository root, then build this directory with `--build-arg
GENERATED_DIR=generated-lvgl`. Use `--theme modern` for the second probe style.
The probe creates label/button/slider objects at runtime after paused LVGL setup;
it does not yet load project manifests. See
[`docs/lvgl-migration-checklist.md`](../docs/lvgl-migration-checklist.md) for
commands, verified results and remaining migration gates.

## Manifest-driven LVGL runtime

Publish the experimental runtime at the configured simulator URL with
`./deploy.sh --lvgl modern` (or `retro`) from this directory; add a project path
to override the default `lvgl-demo.json`. Restore the custom widget gallery with
`./deploy.sh --gallery`.

`bun run simulator/generate-lvgl.ts --theme retro --output simulator/generated/lvgl-retro`
generates an experimental LVGL backend using the shared production manifest reader
and renderer-neutral session. Build with `GENERATED_DIR=generated/lvgl-retro`.
Repeat with `--theme modern` and a separate output/image tag.

`python3 simulator/test-lvgl-runtime.py --image <image> --theme retro|modern
--output /tmp/opencode/<captures>` launches an isolated container and verifies
bindings, conditional visibility, release-outside cancellation, navigation,
repeated pixel restoration, action counts and no additional idle redraw work.
It saves PNGs, logs and an HTML report, then stops the container.
Use `test-boot-manifest.py --project simulator/lvgl-fixture.json` for the same
image's reboot-only manifest checks. Host HA state is mocked. This does not
validate physical display performance, memory or production cloud compatibility.
