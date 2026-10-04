# Firmware visual regression baselines

`widgets/retro` and `widgets/modern` contain 19 deterministic cases each.
The initial captures were independently repeated: all 38 cases matched exactly.

Each collection includes native PNGs, `index.html`, and `manifest.json` with the
theme, renderer, Docker image ID and timestamp. The screenshot timestamps differ
between collections; they are metadata, not pixel-comparison input.

## Daily migration workflow

From the repository root, after modifying firmware templates or code generation:

```sh
python3 simulator/visual_regression.py \
  --baseline simulator/baselines/widgets \
  --output /tmp/opencode/visual-regression
```

This rebuilds both explicit theme configurations from the current workspace,
runs each in a disposable localhost-only container, executes all scenarios,
and compares exact decoded RGB pixels against the saved baselines. It produces
`index.html` (baseline/candidate/diff), `results.json`, build logs and candidate
capture collections. Exit status is 0 for exact matches, 1 for any visual change,
missing/added case, or dimension mismatch. Operational errors also exit nonzero.
Install Pillow if needed: `python3 -m pip install Pillow==12.1.1`.

Use `--skip-build` only to inspect/repeat already-built images. It does not test
new source changes. Use a fresh output directory for each run to retain reports.

To explicitly accept intentional changes after reviewing the report:

```sh
python3 simulator/visual_regression.py \
  --baseline simulator/baselines/widgets \
  --output /tmp/opencode/accepted-visuals \
  --update-baseline
```

Baseline acceptance is never automatic. Preserve the pre-migration baselines
in version control before starting work.

## Migration parity

```sh
python3 simulator/visual_regression.py \
  --baseline simulator/baselines/widgets \
  --output /tmp/opencode/migration-parity \
  --parity
```

This additionally generates the same `simulator/parity.json` through the real
TypeScript `generateUIScreensHeader`/`generateUIStateHeader` path and the binary
manifest compiler, in both themes. The desktop adapter delivers identical mock
state changes. It compares initial, state-on, state-off-restored and separated-
damage repaint captures. **All four cases in each theme now match exactly**.
State restoration and the repaint-only case must reproduce their initial pixels.

The first six mismatches exposed and led to fixes for large-font selection,
background painting across disjoint damage, and button color configuration/defaults.
Large labels now use a dedicated 32px style, independent from the 64px clock font.
Background erasers paint each dirty intersection instead of the bounding union
of separated regions. Generated buttons honor configured colors; manifest button
defaults match the production theme palette.

This is a starter fixture for the supported text/rectangle/button/icon subset,
not comprehensive layout/navigation parity. Expand it as additional features
migrate into manifest support. No tolerances or ignored pixels are used.

## Determinism and scenario coverage

- Explicit retro/modern theme presets and their production font selection.
- Clock/header time fixed to `2026-01-01 12:00:00 UTC` in desktop build copies.
- Loading animation phase fixed to 1200ms, with continuous repaint disabled in
  regression builds only. Normal simulator builds still animate normally.
- Fixed todo, calendar, climate, weather and notification data; no external HA.
- Deterministic captures wait for three repeated framebuffer hashes before
  saving, avoiding transient screenshots while SDL is still painting.
- Nine initial pages plus light off/restored, confirmation opened/cancelled,
  todo scrolling, second tab/restored, conditional off/restored and notification
  dismissal. Light and conditional state delivery use fixture controls; these
  validate rendering and invalidation, not a real HA connection/service call.

Generated regression inputs live under ignored `simulator/generated/` subfolders.
The runner neither deploys nor modifies the live simulator. Temporary containers
are removed on success and failure. Ctrl+C also executes capture cleanup.

Comparator tests:

```sh
python3 -m unittest discover -s simulator/tests -p test_visual_regression.py -v
```

Tests cover single-pixel detection and exact bounds, PNG compression differences,
missing/added cases, dimension changes, and incompatible themes.
