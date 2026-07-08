import type { Theme } from "@vesp-cloud/schema";

export const MODERN_THEME: Theme = {
  id: "modern",
  name: "Modern",
  colors: {
    background: { r: 18, g: 18, b: 18 },
    backgroundSecondary: { r: 30, g: 30, b: 30 },
    foreground: { r: 245, g: 245, b: 245 },
    foregroundMuted: { r: 160, g: 160, b: 160 },
    accent: { r: 74, g: 158, b: 254 },
    accentSecondary: { r: 156, g: 39, b: 176 },
    success: { r: 76, g: 175, b: 80 },
    warning: { r: 255, g: 152, b: 0 },
    error: { r: 244, g: 67, b: 54 },
  },
  chromeAccent: { r: 0, g: 230, b: 118 },
  style: {
    buttonShadow: false,
    buttonCornerAccents: false,
    containerCorners: false,
    headerBorders: false,
  },
  values: {
    shadowOffset: 0,
    cornerSize: 0,
    borderRadius: 8,
  },
};
