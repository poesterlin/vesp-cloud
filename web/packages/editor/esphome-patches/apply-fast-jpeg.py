#!/usr/bin/env python3
"""Install the project-owned fast runtime-image paths into pinned ESPHome."""

from importlib.metadata import version
from pathlib import Path
import shutil


EXPECTED_ESPHOME_VERSION = "2026.5.2"
PACKAGE_VERSION = version("esphome")

if PACKAGE_VERSION != EXPECTED_ESPHOME_VERSION:
    raise SystemExit(
        f"fast JPEG patch targets ESPHome {EXPECTED_ESPHOME_VERSION}, "
        f"but {PACKAGE_VERSION} is installed"
    )

import esphome  # noqa: E402  (validate the installed distribution first)


PATCH_DIR = Path(__file__).resolve().parent
RUNTIME_IMAGE_DIR = Path(esphome.__file__).resolve().parent / "components" / "runtime_image"
JPEG_DECODER = RUNTIME_IMAGE_DIR / "jpeg_decoder.cpp"
PNG_DECODER = RUNTIME_IMAGE_DIR / "png_decoder.cpp"
PNG_DECODER_HEADER = RUNTIME_IMAGE_DIR / "png_decoder.h"
RUNTIME_IMAGE_HEADER = RUNTIME_IMAGE_DIR / "runtime_image.h"
RUNTIME_IMAGE_CODEGEN = RUNTIME_IMAGE_DIR / "__init__.py"

if not all(
    path.is_file()
    for path in (
        JPEG_DECODER,
        PNG_DECODER,
        PNG_DECODER_HEADER,
        RUNTIME_IMAGE_HEADER,
        RUNTIME_IMAGE_CODEGEN,
    )
):
    raise SystemExit(f"ESPHome runtime_image sources not found under {RUNTIME_IMAGE_DIR}")

shutil.copyfile(PATCH_DIR / "jpeg_decoder.cpp", JPEG_DECODER)
shutil.copyfile(PATCH_DIR / "png_decoder.cpp", PNG_DECODER)
shutil.copyfile(PATCH_DIR / "png_decoder.h", PNG_DECODER_HEADER)

header = RUNTIME_IMAGE_HEADER.read_text()
anchor = """  int get_buffer_width() const { return this->buffer_width_; }
  int get_buffer_height() const { return this->buffer_height_; }
"""
replacement = anchor + """
  // Internal decoder accessors used by the project-owned image fast paths.
  // The buffer remains private to RuntimeImage outside decoder code.
  uint8_t *get_decode_buffer() { return this->buffer_; }
  bool get_decode_buffer_big_endian() const { return this->is_big_endian_; }
"""

if "get_decode_buffer()" not in header:
    if anchor not in header:
        raise SystemExit("ESPHome runtime_image.h layout changed; refusing a partial patch")
    RUNTIME_IMAGE_HEADER.write_text(header.replace(anchor, replacement, 1))

# JPEGDEC 1.8.4 guards its ESP32-S3 assembly with Arduino architecture
# macros. ESPHome's ESP-IDF build installs esp-dsp but emits neither macro,
# leaving the color-conversion objects empty. Add both only when a JPEG
# runtime image enables this component; this project exclusively targets S3.
codegen = RUNTIME_IMAGE_CODEGEN.read_text()
define_anchor = '        cg.add_define("USE_RUNTIME_IMAGE_JPEG")\n'
define_replacement = define_anchor + """        if CORE.is_esp32:
            cg.add_build_flag("-DARDUINO_ARCH_ESP32")
            cg.add_build_flag("-DARDUINO_ESP32S3_DEV")
"""
codegen = codegen.replace(
    '            cg.add_define("ARDUINO_ARCH_ESP32")\n'
    '            cg.add_define("ARDUINO_ESP32S3_DEV")\n',
    '            cg.add_build_flag("-DARDUINO_ARCH_ESP32")\n'
    '            cg.add_build_flag("-DARDUINO_ESP32S3_DEV")\n',
)
if 'cg.add_build_flag("-DARDUINO_ARCH_ESP32")' not in codegen:
    if define_anchor not in codegen:
        raise SystemExit("ESPHome runtime_image codegen changed; refusing a partial SIMD patch")
    codegen = codegen.replace(define_anchor, define_replacement, 1)

png_anchor = '        cg.add_library("pngle", "1.1.0")\n'
png_patch_option = (
    png_anchor
    + f'        cg.add_platformio_option("extra_scripts", '
      f'["pre:{PATCH_DIR / "patch-pngle.py"}"])\n'
)
if "patch-pngle.py" not in codegen:
    if png_anchor not in codegen:
        raise SystemExit("ESPHome PNG codegen changed; refusing a partial PNGLE patch")
    codegen = codegen.replace(png_anchor, png_patch_option, 1)
RUNTIME_IMAGE_CODEGEN.write_text(codegen)

print(f"Installed fast JPEG and PNG decoders into ESPHome {PACKAGE_VERSION}")
