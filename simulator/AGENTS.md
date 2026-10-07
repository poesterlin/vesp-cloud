# Runtime simulator

Runs the shared firmware runtime on ESPHome's host platform and SDL. Xvfb,
x11vnc, and noVNC expose its display and mouse/touch input to a phone browser.
Home Assistant service calls are mocked; no real devices are changed.

## Commands
- Generate: `bun run simulator/generate.ts [project.json]` from repository root
- Build/run: `docker compose --env-file .env up -d --build --wait` here
- Check: `curl -fsS https://$SIMULATOR_DOMAIN/simulator/health`
- Logs: `docker compose logs -f simulator`
- Stop: `docker compose down`

## Ergonomic controls

The CLI needs only Python's standard library. All coordinates are native device
pixels, regardless of browser viewport or phone scaling:

```sh
python3 simulator/control.py state
python3 simulator/control.py tap 350 198
python3 simulator/control.py tap-widget light-toggle --capture /tmp/opencode/after-tap.png
python3 simulator/control.py drag 240 360 240 120 --duration 700
python3 simulator/control.py screenshot /tmp/opencode/device.png
python3 simulator/control.py screenshot /tmp/opencode/coordinates.png --grid --pointer
python3 simulator/control.py logs
python3 simulator/control.py reset
```

Use `--url http://127.0.0.1:6085/` before the subcommand for an isolated local test.
Browser automation can use `window.simulator.tap(x,y)`, `.drag(x,y,toX,toY)`,
`.tapWidget(id)`, `.state()`, `.logs()`, `.reset()`, and `.screenshot()` (PNG Blob).
Await calls: actions include a default 450ms settle period for button loading.
Browser action promises also wait for the streamed canvas's SHA-256 pixel hash
to match the native framebuffer. Use `.waitForDisplay()` after manual touches;
`.screenshotDataUrl()` provides a serializable PNG for browser tools.
API actions serialize; coordinate/duration inputs are validated before mutation.
The browser inspector can pick coordinates without touching the device. PNGs
exclude browser chrome; annotated captures add a grid/last API pointer. Baseline
comparison reports exact changed pixel count and bounds. Reset restarts only the
simulated executable, preserving Xvfb, VNC and the browser connection.

Set `SIMULATOR_URL` to avoid repeating `--url`. `tap-widget` selects a center
coordinate from the generated layout on the current screen; missing targets
fail explicitly. Use `--capture path.png` on actions to save their result.

`GET /api/state` includes `screen`, `frameHash`, `lastPointer`, and readiness.
`POST /api/tap`, `/api/drag`, `/api/reset` accept JSON; `/api/screenshot.png` and
`/api/logs` are GETs. Browser POSTs must be same-origin. Body limits are 4KiB.

## Visual migration regression workflow

Run `python3 simulator/visual_regression.py --baseline simulator/baselines/widgets
--output /tmp/opencode/visual-regression` from the repository root after firmware
changes. This rebuilds both themes and tests 38 deterministic screenshots.
Inspect `index.html`, changed PNGs and `results.json`. Never accept a changed
baseline implicitly; `--update-baseline` is an explicit acceptance command.
`--skip-build` reuses images and will not verify modified firmware source.
Add `--parity` for a strict generated/manifest comparison of a shared fixture;
all four cases in each theme now match, including state restoration and repainting
separated damage without erasing unchanged content. This covers only the current
shared subset, not every layout/action/navigation feature. Complete details
and tests are in `baselines/README.md`. These commands use disposable localhost
containers and do not deploy the live simulator.

## Production-widget gallery

For a complete build capture, prefer `python3 simulator/capture-gallery.py
--image <image> --build <label> --output /tmp/opencode/<collection>`. This starts
and cleans up an isolated container automatically, saving every native PNG plus
an HTML gallery and metadata manifest. Build labels do not select a theme;
capture the actual retro and modern images into separate directories.

Hosted simulator: `https://vesp.cloud/simulator/`. Hosted screenshot gallery:
`https://vesp.cloud/simulator/gallery.html`. Deploy the showcase with
`./deploy.sh --gallery` from this directory.

Generate with `bun run simulator/generate.ts --gallery`, then build/run an
isolated container. `capture-gallery.py` checks each page and saves native PNGs;
set `SIMULATOR_URL` and `GALLERY_OUTPUT`. Coverage, screenshots, and complete
commands are in `screenshots/gallery/README.md`. This desktop-only fixture uses
the production classes directly for widgets not supported by the manifest yet.

## Deployment
Copy `.env.example` to `.env`. Set `SIMULATOR_DOMAIN` to a hostname pointing at
the existing Traefik proxy. Open `https://$SIMULATOR_DOMAIN/simulator/`.
Uses external network `traefik_web`, internal port
6080, and no published host ports. Generated build inputs are ignored by git.
The build pins ESPHome 2026.7.1. The browser runs the compiled C++ UI, not a
JavaScript imitation. This simulator does not model LCD timing or device RAM.

## Reboot-only manifest checks

Ordinary runtime builds read `VESPUI_MANIFEST_PATH` once at boot; mount a directory
containing the binary manifest. Staging bytes does not change the active UI.
`control.py reset` restarts the process and selects the staged manifest, falling
back to embedded bytes for missing/invalid files. Gallery/parity fixtures do not
use this adapter. `test-boot-manifest.py --image <deterministic-demo-image> --theme
retro|modern --output /tmp/opencode/<captures>` checks staging isolation,
reboot activation and exact fallback using an unchanged image. Run for both
themes after changing boot selection. Fonts/icons/theme remain firmware resources.

## Experimental LVGL backend

Deploy the manifest runtime with `./deploy.sh --lvgl modern|retro [project.json]`;
it uses `generated/live-lvgl` as the compose build input. It defaults to
`lvgl-demo.json`, a clean demo layout; pass `lvgl-fixture.json` to publish the
regression fixture. Restore the custom showcase with `./deploy.sh --gallery`.

Generate `bun run simulator/generate-lvgl.ts --theme retro|modern --output
simulator/generated/lvgl-<theme>` from the repository root. Build isolated images
with the matching `GENERATED_DIR` Docker argument. `test-lvgl-runtime.py --image
<image> --theme <theme> --output /tmp/opencode/<captures>` checks widget-ID actions,
bindings, input cancellation, navigation and idle mutation/flush counters; it
starts and cleans up its own container. Run `test-boot-manifest.py` with
`--project simulator/lvgl-fixture.json` against these images. Keep screenshots
separate from established custom-renderer baselines; LVGL styling parity is still
under development. The generator and backend support projects without icons: the
icon font is generated and referenced only when the manifest contains icon
widgets. See `docs/lvgl-migration-checklist.md` for progress and commands.
