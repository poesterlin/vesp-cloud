# ESPHome fast runtime-image patches

The compiler images install this patch into the pinned ESPHome 2026.7.1
package before running the shared `warmup.sh` build.

For opaque RGB565 runtime images, `jpeg_decoder.cpp` asks JPEGDEC to:

- decode directly to RGB565 instead of expanding every pixel through RGB888;
- use its native 1/2, 1/4, or 1/8 IDCT scale when the source is larger than
  the configured image bounds;
- write each destination pixel once, directly into the RuntimeImage buffer;
- enable JPEGDEC's ESP32-S3 SIMD color conversion and dequantization code.

Other image types and transparency modes keep ESPHome's compatibility path.
The existing UI image tiling is unchanged and still limits display painting to
32-pixel strips across frames.

For opaque RGB565 PNG images, the PNGLE callbacks write packed RGB565
rectangles directly into the RuntimeImage buffer. Integer destination maps
handle configured resizing without ESPHome's per-pixel `Color` construction,
floating-point scaling, chroma-key mapping, and repeated bounds checks. PNG
decoding remains progressive; transparent and non-RGB565 images retain the
stock compatibility path.

For PlatformIO builds, a pinned PNGLE 1.1.0 pre-build patch receives the
decoder's integer boundary maps. PNGLE still inflates and unfilters every
source byte, as required by PNG, but source pixels that cannot contribute to
the destination skip RGBA conversion and callback dispatch entirely. ESPHome
2026.7's native ESP-IDF backend ignores PlatformIO pre-build scripts, so it
keeps the direct RGB565 path while safely omitting this optional early-skip
optimization.

After installing firmware, a successful fast decode logs a line like:

```text
[I][image_decoder.jpeg]: Fast RGB565: source=... native=... target=... scale=... alloc=...us decode=...us total=...us
[I][image_decoder.png]: Fast RGB565: source=... target=... alloc=...us decode=...us
```

The installer intentionally rejects any other ESPHome version. Review and
rebase the patch before changing `ESPHOME_VERSION` in the Dockerfiles.

ESPHome 2026.7 also marks `ST7701S` as `final`. The same guarded installer adds
a narrow framebuffer accessor used by the project-owned screenshot camera,
replacing the older subclass-based access shim.
