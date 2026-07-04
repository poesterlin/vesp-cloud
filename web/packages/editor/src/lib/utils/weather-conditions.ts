import type { Color } from "@vesp-cloud/schema";

export interface WeatherConditionInfo {
  label: string;
  color: Color;
  icon: string;
}

export const WEATHER_CONDITION_COLORS: Record<string, Color> = {
  sunny: { r: 255, g: 200, b: 50 },
  "clear-night": { r: 70, g: 90, b: 160 },
  cloudy: { r: 160, g: 170, b: 185 },
  "partlycloudy": { r: 180, g: 190, b: 210 },
  partly_cloudy: { r: 180, g: 190, b: 210 },
  rainy: { r: 70, g: 130, b: 200 },
  pouring: { r: 40, g: 90, b: 170 },
  snowy: { r: 215, g: 235, b: 250 },
  "snowy-rainy": { r: 150, g: 195, b: 220 },
  snowing: { r: 210, g: 230, b: 245 },
  snow: { r: 210, g: 230, b: 245 },
  fog: { r: 150, g: 160, b: 175 },
  hail: { r: 170, g: 200, b: 220 },
  lightning: { r: 200, g: 180, b: 80 },
  lightning_rainy: { r: 200, g: 180, b: 80 },
  windy: { r: 130, g: 200, b: 180 },
  "windy-variant": { r: 140, g: 180, b: 185 },
  exceptional: { r: 200, g: 100, b: 100 },
};

export const WEATHER_CONDITION_ICONS: Record<string, string> = {
  sunny: "weather-sunny",
  "clear-night": "weather-night",
  cloudy: "weather-cloudy",
  partlycloudy: "weather-partly-cloudy",
  partly_cloudy: "weather-partly-cloudy",
  rainy: "weather-rainy",
  pouring: "weather-pouring",
  snowy: "weather-snowy",
  "snowy-rainy": "weather-snowy-rainy",
  snowing: "weather-snowy",
  snow: "weather-snowy",
  fog: "weather-fog",
  hail: "weather-hail",
  lightning: "weather-lightning",
  lightning_rainy: "weather-lightning-rainy",
  windy: "weather-windy",
  "windy-variant": "weather-windy-variant",
  exceptional: "weather-tornado",
};

export const WEATHER_DEFAULT_COLOR: Color = { r: 180, g: 190, b: 210 };
export const WEATHER_DEFAULT_ICON = "weather-partly-cloudy";
export const WEATHER_DEFAULT_LABEL = "Unknown";

export function getWeatherConditionColor(condition: string | undefined): Color {
  if (!condition) return WEATHER_DEFAULT_COLOR;
  return WEATHER_CONDITION_COLORS[condition] ?? WEATHER_DEFAULT_COLOR;
}

export function getWeatherConditionIcon(condition: string | undefined): string {
  if (!condition) return WEATHER_DEFAULT_ICON;
  return WEATHER_CONDITION_ICONS[condition] ?? WEATHER_DEFAULT_ICON;
}

export function getWeatherConditionLabel(condition: string | undefined): string {
  if (!condition) return WEATHER_DEFAULT_LABEL;
  return condition
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function colorToCss(color: Color): string {
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
}
