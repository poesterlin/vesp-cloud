import type { Color } from "@vesp-cloud/schema";

/**
 * Converts a schema Color object to a CSS rgb() string
 */
export function colorToCss(color: Color | undefined, fallback = "white"): string {
  if (!color) return fallback;
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

/**
 * Converts a schema Color object to a CSS rgba() string with alpha
 */
export function colorToCssAlpha(color: Color | undefined, alpha: number, fallback = "white"): string {
  if (!color) return fallback;
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
}
