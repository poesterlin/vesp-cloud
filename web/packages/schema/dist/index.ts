/**
 * vESP.cloud Schema Types
 *
 * Re-exports all generated types for convenient importing.
 */

export * from "./types.js";

// Re-export component type discriminators for type guards
export type ComponentType =
  | "text"
  | "button"
  | "icon"
  | "rectangle"
  | "image"
  | "todo_list"
  | "light_state"
  | "hvac"
  | "weather"
  | "conditional_area"
  | "tab_container";

export function isTextComponent(c: Component): c is TextComponent {
  return c.type === "text";
}

export function isButtonComponent(c: Component): c is ButtonComponent {
  return c.type === "button";
}

export function isIconComponent(c: Component): c is IconComponent {
  return c.type === "icon";
}

export function isHvacComponent(c: Component): c is HvacComponent {
  return c.type === "hvac";
}

export function isWeatherComponent(c: Component): c is WeatherComponent {
  return c.type === "weather";
}

import type {
  Component,
  TextComponent,
  ButtonComponent,
  IconComponent,
  HvacComponent,
  WeatherComponent,
} from "./types.js";
