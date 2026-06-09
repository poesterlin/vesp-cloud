import type { TextComponent, ButtonComponent, SliderComponent, GaugeComponent, IconComponent, ProceduralIconComponent, ContainerComponent, ImageComponent, TodoListComponent, LightStateComponent, AutoLayoutListComponent, ConditionalAreaComponent, TabContainerComponent } from "@esphome-designer/schema";

/**
 * Simple assertion function that throws an error if the condition is false.
 * @param condition 
 * @param message 
 */
export function assert<T>(condition: T | null | undefined, message?: string): asserts condition {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

/**
 * Converts a string to UPPER_SNAKE_CASE.
 * e.g., "My Detail View 1" -> "MY_DETAIL_VIEW_1"
 */
export function toUpperSnakeCase(str: string): string {
  return str
    .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_')           // Replace spaces with underscores
    .toUpperCase();                 // Convert to uppercase
}


export type ComponentMap = {
  text: TextComponent;
  button: ButtonComponent;
  slider: SliderComponent;
  gauge: GaugeComponent;
  icon: IconComponent;
  procedural_icon: ProceduralIconComponent;
  container: ContainerComponent;
  image: ImageComponent;
  todo_list: TodoListComponent;
  light_state: LightStateComponent;
  auto_layout_list: AutoLayoutListComponent;
  conditional_area: ConditionalAreaComponent;
  tab_container: TabContainerComponent;
};