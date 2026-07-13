"""PlatformIO pre-build patch for PNGLE 1.1.0 destination sampling."""

Import("env")  # type: ignore[name-defined]  # Provided by PlatformIO/SCons.

from pathlib import Path
import subprocess
import sys


library_dir = Path(env.subst("$PROJECT_LIBDEPS_DIR")) / env.subst("$PIOENV") / "pngle"
source_path = library_dir / "src" / "pngle.c"
header_path = library_dir / "src" / "pngle.h"

if not source_path.is_file() or not header_path.is_file():
    subprocess.run(
        [
            sys.executable,
            "-m",
            "platformio",
            "pkg",
            "install",
            "--project-dir",
            env.subst("$PROJECT_DIR"),
            "--environment",
            env.subst("$PIOENV"),
            "--library",
            "pngle@1.1.0",
            "--no-save",
        ],
        check=True,
    )
if not source_path.is_file() or not header_path.is_file():
    raise RuntimeError(f"PNGLE 1.1.0 installation missing under {library_dir}")

source = source_path.read_text()
header = header_path.read_text()

struct_anchor = """\tpngle_done_callback_t done_callback;

\t// misc
"""
struct_replacement = """\tpngle_done_callback_t done_callback;

\t// Optional destination boundary maps. When set, pixels which cannot
\t// contribute to the resized output skip color conversion and callbacks.
\tconst uint16_t *target_x_for_source_boundary;
\tconst uint16_t *target_y_for_source_boundary;

\t// misc
"""

function_anchor = """void pngle_destroy(pngle_t *pngle)
{
\tif (pngle) {
\t\tpngle_reset(pngle);
\t\tfree(pngle);
\t}
}
"""
function_replacement = function_anchor + """
void pngle_set_draw_boundaries(pngle_t *pngle,
\tconst uint16_t *target_x_for_source_boundary,
\tconst uint16_t *target_y_for_source_boundary)
{
\tpngle->target_x_for_source_boundary = target_x_for_source_boundary;
\tpngle->target_y_for_source_boundary = target_y_for_source_boundary;
}
"""

draw_anchor = """\t\tconst uint8_t *rgba = adjust_color(pngle, v);
\t\tif (!rgba) return -1;

\t\tif (pngle->draw_callback) {
\t\t\tpngle->draw_callback(pngle, pngle->drawing_x, pngle->drawing_y
\t\t\t\t, MIN(interlace_div_x[pngle->interlace_pass] - interlace_off_x[pngle->interlace_pass], pngle->hdr.width  - pngle->drawing_x)
\t\t\t\t, MIN(interlace_div_y[pngle->interlace_pass] - interlace_off_y[pngle->interlace_pass], pngle->hdr.height - pngle->drawing_y)
\t\t\t\t, rgba
\t\t\t);
\t\t}
"""
draw_replacement = """\t\tconst uint32_t draw_width = MIN(interlace_div_x[pngle->interlace_pass] - interlace_off_x[pngle->interlace_pass], pngle->hdr.width - pngle->drawing_x);
\t\tconst uint32_t draw_height = MIN(interlace_div_y[pngle->interlace_pass] - interlace_off_y[pngle->interlace_pass], pngle->hdr.height - pngle->drawing_y);
\t\tif (pngle->target_x_for_source_boundary && pngle->target_y_for_source_boundary &&
\t\t\t(pngle->target_x_for_source_boundary[pngle->drawing_x] ==
\t\t\t pngle->target_x_for_source_boundary[pngle->drawing_x + draw_width] ||
\t\t\t pngle->target_y_for_source_boundary[pngle->drawing_y] ==
\t\t\t pngle->target_y_for_source_boundary[pngle->drawing_y + draw_height])) {
\t\t\tcontinue;
\t\t}

\t\tconst uint8_t *rgba = adjust_color(pngle, v);
\t\tif (!rgba) return -1;

\t\tif (pngle->draw_callback) {
\t\t\tpngle->draw_callback(pngle, pngle->drawing_x, pngle->drawing_y,
\t\t\t\tdraw_width, draw_height, rgba);
\t\t}
"""

header_anchor = "void pngle_destroy(pngle_t *pngle);\n"
header_replacement = header_anchor + """void pngle_set_draw_boundaries(pngle_t *pngle,
\tconst uint16_t *target_x_for_source_boundary,
\tconst uint16_t *target_y_for_source_boundary);
"""

if "pngle_set_draw_boundaries" not in source:
    for path, text, anchor in (
        (source_path, source, struct_anchor),
        (source_path, source, function_anchor),
        (source_path, source, draw_anchor),
        (header_path, header, header_anchor),
    ):
        if anchor not in text:
            raise RuntimeError(f"PNGLE 1.1.0 layout changed in {path}; refusing partial patch")

    source = source.replace(struct_anchor, struct_replacement, 1)
    source = source.replace(function_anchor, function_replacement, 1)
    source = source.replace(draw_anchor, draw_replacement, 1)
    header = header.replace(header_anchor, header_replacement, 1)
    source_path.write_text(source)
    header_path.write_text(header)
