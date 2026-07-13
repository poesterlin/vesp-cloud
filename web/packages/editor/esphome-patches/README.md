# ESPHome fast JPEG patch

The compiler images install this patch into the pinned ESPHome 2026.5.2
package before running the shared `warmup.sh` PlatformIO build.

For opaque RGB565 runtime images, `jpeg_decoder.cpp` asks JPEGDEC to:

- decode directly to RGB565 instead of expanding every pixel through RGB888;
- use its native 1/2, 1/4, or 1/8 IDCT scale when the source is larger than
  the configured image bounds;
- write each destination pixel once, directly into the RuntimeImage buffer;
- enable JPEGDEC's ESP32-S3 SIMD color conversion and dequantization code.

Other image types and transparency modes keep ESPHome's compatibility path.
The existing UI image tiling is unchanged and still limits display painting to
32-pixel strips across frames.

After installing firmware, a successful fast decode logs a line like:

```text
[I][image_decoder.jpeg]: Fast RGB565: source=... native=... target=... scale=... alloc=...us decode=...us total=...us
```

The installer intentionally rejects any other ESPHome version. Review and
rebase the patch before changing `ESPHOME_VERSION` in the Dockerfiles.
