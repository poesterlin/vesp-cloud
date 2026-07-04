import type { Theme } from "@vesp-cloud/schema";

export const RETRO_THEME: Theme = {
  id: "retro",
  name: "Retro",
  colors: {
    background: { r: 0, g: 0, b: 0 },
    backgroundSecondary: { r: 26, g: 26, b: 26 },
    foreground: { r: 255, g: 255, b: 255 },
    foregroundMuted: { r: 128, g: 128, b: 128 },
    accent: { r: 0, g: 255, b: 255 },       // Cyan
    accentSecondary: { r: 255, g: 0, b: 255 }, // Magenta
    success: { r: 0, g: 255, b: 0 },
    warning: { r: 255, g: 191, b: 0 },
    error: { r: 255, g: 0, b: 0 },
  },
  style: {
    buttonShadow: false,
    buttonCornerAccents: false,
    containerCorners: false,
    headerBorders: true,
  },
  values: {
    shadowOffset: 3,
    cornerSize: 10,
    borderRadius: 0,
  },
};
