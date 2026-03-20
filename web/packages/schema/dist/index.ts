/**
 * ESPHome Designer Schema Types
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
  | "image"
  | "todo_list"
  | "conditional_area";

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

import type {
  Component,
  TextComponent,
  ButtonComponent,
  SliderComponent,
  GaugeComponent,
  IconComponent,
} from "./types.js";
