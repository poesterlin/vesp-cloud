import type { Color } from "@vesp-cloud/schema";

export interface HvacModeInfo {
  label: string;
  color: Color;
}

export const HVAC_OFF_COLOR: Color = { r: 80, g: 80, b: 80 };

export const HVAC_MODES: Record<string, HvacModeInfo> = {
  heat:       { label: "Heat",      color: { r: 255, g: 110, b: 40 } },
  cool:       { label: "Cool",      color: { r: 70,  g: 170, b: 255 } },
  heat_cool:  { label: "Heat/Cool", color: { r: 200, g: 110, b: 220 } },
  auto:       { label: "Auto",      color: { r: 90,  g: 200, b: 130 } },
  fan_only:   { label: "Fan Only",  color: { r: 120, g: 210, b: 230 } },
  dry:        { label: "Dry",       color: { r: 100, g: 220, b: 200 } },
};

export const HVAC_MODE_LIST = Object.entries(HVAC_MODES).map(([value, info]) => ({
  value,
  ...info,
}));

export function getHvacModeColor(mode: string | undefined): Color {
  return HVAC_MODES[mode ?? "heat"]?.color ?? HVAC_MODES.heat.color;
}

export function getHvacOffColor(): Color {
  return HVAC_OFF_COLOR;
}

export function colorToCss(color: Color): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}