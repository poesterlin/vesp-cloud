import type { Theme, Color } from "@vesp-cloud/schema";

export function colorToRgb(c: Color): string {
  return `rgb(${c.r}, ${c.g}, ${c.b})`;
}

export function generateThemedBox(
  x: number,
  y: number,
  width: number,
  height: number,
  theme: Theme,
  label?: string
) {
  const { colors, style, values } = theme;
  const cornerSize = values?.cornerSize ?? 10;
  const stroke = colorToRgb(colors.foreground);
  const fill = colorToRgb(colors.background);

  let paths = [];

  if (style?.containerCorners) {
    // Double lines corner decoration
    // Top-left
    paths.push(`M ${x} ${y + cornerSize} L ${x} ${y} L ${x + cornerSize} ${y}`);
    paths.push(`M ${x + 3} ${y + cornerSize} L ${x + 3} ${y + 3} L ${x + cornerSize} ${y + 3}`);

    // Top-right
    paths.push(`M ${x + width - cornerSize} ${y} L ${x + width} ${y} L ${x + width} ${y + cornerSize}`);
    paths.push(`M ${x + width - cornerSize} ${y + 3} L ${x + width - 3} ${y + 3} L ${x + width - 3} ${y + cornerSize}`);

    // Bottom-left
    paths.push(`M ${x} ${y + height - cornerSize} L ${x} ${y + height} L ${x + cornerSize} ${y + height}`);
    paths.push(`M ${x + 3} ${y + height - cornerSize} L ${x + 3} ${y + height - 3} L ${x + cornerSize} ${y + height - 3}`);

    // Bottom-right
    paths.push(`M ${x + width - cornerSize} ${y + height} L ${x + width} ${y + height} L ${x + width} ${y + height - cornerSize}`);
    paths.push(`M ${x + width - cornerSize} ${y + height - 3} L ${x + width - 3} ${y + height - 3} L ${x + width - 3} ${y + height - cornerSize}`);
  } else {
    // Simple rectangle if no corner accents
    paths.push(`M ${x} ${y} L ${x + width} ${y} L ${x + width} ${y + height} L ${x} ${y + height} Z`);
  }

  return {
    paths,
    stroke,
    fill,
    label
  };
}

export function generateThemedButton(
  x: number,
  y: number,
  width: number,
  height: number,
  theme: Theme,
  pressed: boolean = false
) {
  const { colors, style, values } = theme;
  const offset = pressed ? 0 : (values?.shadowOffset ?? 3);
  const stroke = colorToRgb(colors.foreground);
  const shadow = colorToRgb(colors.backgroundSecondary ?? colors.background);
  const accent = colorToRgb(colors.accent ?? colors.foreground);

  return {
    rect: { x, y, width, height },
    shadowRect: style?.buttonShadow ? { x: x + offset, y: y + offset, width, height } : null,
    cornerAccents: style?.buttonCornerAccents ? [
      { x1: x + 2, y1: y + 2, x2: x + 12, y2: y + 2 }, // Top-left horizontal
      { x1: x + 2, y1: y + 2, x2: x + 2, y2: y + 12 },  // Top-left vertical
      { x1: x + width - 12, y1: y + height - 2, x2: x + width - 2, y2: y + height - 2 }, // Bottom-right horizontal
      { x1: x + width - 2, y1: y + height - 12, x2: x + width - 2, y2: y + height - 2 }  // Bottom-right vertical
    ] : [],
    stroke,
    shadow,
    accent
  };
}
