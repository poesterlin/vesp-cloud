# Limitations & Known Issues

Current limitations, known issues, and planned features.

## Hardware

- **Single display model:** Only the Guition ESP32-S3-4848S040 (480&times;480,
  ST7701S + GT911) is supported. Other ESP32 display boards will not work
  without code modifications.
- **Resolution fits the display:** The editor canvas and all firmware
  rendering are locked to 480&times;480 pixels. Different panel sizes or
  aspect ratios are not supported.

## Browser support

- **USB flashing requires Chrome or Edge.** Firefox and Safari do not support
  the Web Serial API. All other editor features work in any modern browser.

## Performance considerations

- **Display hardware is constrained.** The ESP32-S3 has limited CPU and
  memory. Placing many Home Assistant-bound widgets on a single page (30+) may
  cause the display to feel slow.
- **Images load progressively.** HA entity images and camera feeds render in
  32-pixel tile strips over multiple frames to avoid stuttering. Large images
  may take a couple of seconds to fully appear.
- **Rendering Differences.** Even after a lot of work, the editor and the device are not showing the exact same view. 
  Please report this if it causes you to rerun the build. The effort to keeping the two aligned are ongoing.

## Known issues

<!-- ### Time conditions not yet active

Time-of-day conditions (`after`/`before` with `HH:MM` format) are accepted in
the editor but evaluate as `true` in the current firmware. They will be wired
up in a future firmware update.

### Notification severity: `critical` not recognized

The Home Assistant setup example in the editor lists `critical` as a severity
option, but the firmware only recognizes `info`, `warning` (or `warn`), and
`error` (or `alert`). Use `error` or `alert` for critical notifications. -->

### Single language

The firmware supports English text only. Non-Latin character sets may not
render correctly because the bundled fonts cover a limited glyph range.
