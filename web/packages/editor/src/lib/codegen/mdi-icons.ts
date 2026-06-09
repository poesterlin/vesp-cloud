/**
 * Material Design Icons (MDI) codepoint mapping
 *
 * Maps icon names (without mdi: prefix) to their Unicode codepoints.
 * Codepoints from: https://pictogrammers.com/library/mdi/
 *
 * ESPHome font glyphs accept Python/YAML-style unicode escapes prefixed
 * with `\U` and 8 hex digits, e.g., F0335 -> "\U000F0335".
 *
 * For C++ source rendering via `display::Display::printf`, the icon font
 * uses UTF-8 bytes. We emit those bytes as `\xHH` escapes inside C string
 * literals so the source is plain ASCII.
 */

import type { Project } from "@esphome-designer/schema";
import { collectProjectIconNames, normalizeIconName } from "./utils";
import mdiCodepoints from "./mdi-codepoints.json" with { type: "json" };

/** Pixel size of the default MDI icon font generated in fonts.yaml. */
export const ICON_FONT_SIZE = 24;

/** Generated ESPHome font id for the default MDI icon font. */
export const ICON_FONT_ID = `mdi_icons_${ICON_FONT_SIZE}`;

/**
 * Full icon name -> codepoint map sourced from
 * `@mdi/font`'s `scss/_variables.scss` (version 7.4.47, ~7400 icons).
 * Names are kebab-case without the `mdi:` prefix. Codepoints are hex
 * strings (e.g., "F0244"). See `mdi-codepoints.json` for the data.
 */
export const MDI_ICONS: Record<string, string> = mdiCodepoints as Record<string, string>;

/**
 * Get the YAML-compatible unicode escape sequence for an MDI icon glyph.
 * Returns null when the icon name is not in `MDI_ICONS` so callers can
 * skip the glyph gracefully instead of crashing.
 *
 * @example
 *   getMdiCodepoint("mdi:lightbulb") // "\\U000F0335"
 */
export function getMdiCodepoint(iconName: string): string | null {
  const name = normalizeIconName(iconName);
  const codepoint = MDI_ICONS[name];
  if (!codepoint) return null;
  return `\\U000${codepoint}`;
}

/**
 * Subset the icon map to glyphs that are referenced and known.
 * Returns a map of normalized icon name -> YAML escape sequence.
 */
export function getIconGlyphs(iconNames: Set<string>): Map<string, string> {
  const glyphs = new Map<string, string>();
  for (const iconName of iconNames) {
    const name = normalizeIconName(iconName);
    const codepoint = MDI_ICONS[name];
    if (codepoint) {
      glyphs.set(name, `\\U000${codepoint}`);
    }
  }
  return glyphs;
}

/**
 * Convert a 21-bit unicode codepoint to a sequence of `\xHH` escapes
 * matching its UTF-8 byte encoding, suitable for embedding in a C/C++
 * string literal (e.g., `printf("%s", "\xF3\xB0\x8C\xB5")`).
 */
function codepointToCEscape(cp: number): string {
  const bytes: number[] = [];
  if (cp <= 0x7f) {
    bytes.push(cp);
  } else if (cp <= 0x7ff) {
    bytes.push(0xc0 | (cp >> 6));
    bytes.push(0x80 | (cp & 0x3f));
  } else if (cp <= 0xffff) {
    bytes.push(0xe0 | (cp >> 12));
    bytes.push(0x80 | ((cp >> 6) & 0x3f));
    bytes.push(0x80 | (cp & 0x3f));
  } else {
    bytes.push(0xf0 | (cp >> 18));
    bytes.push(0x80 | ((cp >> 12) & 0x3f));
    bytes.push(0x80 | ((cp >> 6) & 0x3f));
    bytes.push(0x80 | (cp & 0x3f));
  }
  return bytes.map(b => `\\x${b.toString(16).toUpperCase().padStart(2, "0")}`).join("");
}

/**
 * Get a C string literal body of UTF-8 byte escapes for an MDI icon,
 * suitable for embedding inside a quoted C++ string literal. Returns
 * null when the icon is unknown so codegen can skip emitting the widget.
 *
 * @example
 *   getMdiUtf8CEscape("mdi:lightbulb") // "\\xF3\\xB0\\x8C\\xB5"
 */
export function getMdiUtf8CEscape(iconName: string): string | null {
  const name = normalizeIconName(iconName);
  const codepoint = MDI_ICONS[name];
  if (!codepoint) return null;
  const cp = parseInt(codepoint, 16);
  if (Number.isNaN(cp)) return null;
  return codepointToCEscape(cp);
}

/**
 * Build the icon font YAML block for the given icon names. Returns an
 * empty array when no icons are known so callers can decide whether to
 * skip emitting a `font:` section entirely.
 */
export function generateIconFontYAML(
  iconNames: Set<string>,
  fontSize: number = ICON_FONT_SIZE,
): string[] {
  const lines: string[] = [];
  const glyphs = getIconGlyphs(iconNames);
  if (glyphs.size === 0) return lines;

  lines.push(`  - file: "https://github.com/Templarian/MaterialDesign-Webfont/raw/master/fonts/materialdesignicons-webfont.ttf"`);
  lines.push(`    id: mdi_icons_${fontSize}`);
  lines.push(`    size: ${fontSize}`);
  lines.push(`    glyphs:`);
  for (const [name, codepoint] of glyphs) {
    lines.push(`      - "${codepoint}"  # ${name}`);
  }
  return lines;
}

/**
 * Combine an existing base fonts.yaml content with a per-project MDI icon
 * font block. Returns the original content unchanged when the project
 * does not reference any known icons.
 */
export function generateFontsYAML(project: Project, baseFontsYaml: string): string {
  const icons = collectProjectIconNames(project);
  const iconLines = generateIconFontYAML(icons);
  if (iconLines.length === 0) return baseFontsYaml;

  const base = baseFontsYaml.replace(/\s+$/, "");
  return `${base}\n\n${iconLines.join("\n")}\n`;
}
