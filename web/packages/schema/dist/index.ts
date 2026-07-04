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
  | "slider"
  | "gauge"
  | "icon"
  | "procedural_icon"
  | "container"
  | "rectangle"
  | "image"
  | "todo_list"
  | "light_state"
  | "hvac"
  | "weather"
  | "auto_layout_list"
  | "conditional_area"
  | "tab_container";

export function isTextComponent(c: Component): c is TextComponent {
  return c.type === "text";
}

export function isButtonComponent(c: Component): c is ButtonComponent {
  return c.type === "button";
}

export function isSliderComponent(c: Component): c is SliderComponent {
  return c.type === "slider";
}

export function isGaugeComponent(c: Component): c is GaugeComponent {
  return c.type === "gauge";
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
  SliderComponent,
  GaugeComponent,
  IconComponent,
  HvacComponent,
  WeatherComponent,
} from "./types.js";
