export const FONT_MAPPINGS = {
  small: {
    id: "font_small",
    size: 14,
    lineHeight: 16
  },
  medium: {
    id: "font_medium",
    size: 20,
    lineHeight: 24
  },
  large: {
    id: "font_large",
    size: 28,
    lineHeight: 32
  },
  xlarge: {
    id: "font_xlarge",
    size: 42,
    lineHeight: 48
  }
};

export type FontSize = keyof typeof FONT_MAPPINGS;

export function getFontId(size: FontSize | string): string {
  if (size in FONT_MAPPINGS) {
    return FONT_MAPPINGS[size as FontSize].id;
  }
  return FONT_MAPPINGS.medium.id;
}

export function getFontSizePixels(size: FontSize | string): number {
  if (size in FONT_MAPPINGS) {
    return FONT_MAPPINGS[size as FontSize].size;
  }
  return FONT_MAPPINGS.medium.size;
}
