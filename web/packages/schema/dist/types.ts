/**
 * AUTO-GENERATED - DO NOT EDIT
 *
 * Generated from components.json schema
 * Run: bun run generate:types
 */

export type Component =
  | TextComponent
  | ButtonComponent
  | SliderComponent
  | GaugeComponent
  | IconComponent
  | ProceduralIconComponent
  | ContainerComponent
  | ImageComponent
  | ConditionalAreaComponent;
export type TextComponent = BaseComponent & {
  type: "text";
  text?: string;
  textBinding?: EntityBinding;
  fontSize?: "small" | "medium" | "large";
  color?: Color;
  align?: "left" | "center" | "right";
};
export type OnTapAction = ServiceAction | NavigationAction;
export type ButtonComponent = BaseComponent & {
  type: "button";
  label?: string;
  icon?: string;
  backgroundColor?: Color;
  foregroundColor?: Color;
  borderColor?: Color;
  pressAction?: ActionBinding;
  holdAction?: ActionBinding;
};
export type ActionBinding = ServiceAction | NavigationAction;
export type SliderComponent = BaseComponent & {
  type: "slider";
  min?: number;
  max?: number;
  step?: number;
  valueBinding?: EntityBinding;
  onChange?: ActionBinding;
  orientation?: "horizontal" | "vertical";
  trackColor?: Color;
  fillColor?: Color;
  handleColor?: Color;
};
export type GaugeComponent = BaseComponent & {
  type: "gauge";
  min: number;
  max: number;
  valueBinding?: EntityBinding;
  unit?: string;
  backgroundColor?: Color;
  needleColor?: Color;
  valueColor?: Color;
  segments?: {
    from: number;
    to: number;
    color: Color;
  }[];
};
export type IconComponent = BaseComponent & {
  type: "icon";
  icon: string;
  color?: Color;
  scale?: number;
};
export type ProceduralIconComponent = BaseComponent & {
  type: "procedural_icon";
  iconType: "bulb" | "window" | "vacuum" | "climate";
  stateBinding?: EntityBinding;
  color?: Color;
};
export type ContainerComponent = BaseComponent & {
  type: "container";
  label?: string;
  backgroundColor?: Color;
};
export type ImageComponent = BaseComponent & {
  type: "image";
  file: string;
  /**
   * Specifies how to encode image internally.
   */
  image_type: "BINARY" | "GRAYSCALE" | "RGB565" | "RGB";
  resize?: string;
  transparency?: "opaque" | "chroma_key" | "alpha_channel";
  invert_alpha?: boolean;
  dither?: "NONE" | "FLOYDSTEINBERG";
  byte_order?: "big_endian" | "little_endian";
  foregroundColor?: Color;
  backgroundColor?: Color;
};
export type ConditionalAreaComponent = BaseComponent & {
  type: "conditional_area";
  variants: ConditionalVariant[];
  /**
   * ID of variant to show when no conditions match
   */
  defaultVariantId?: string;
  /**
   * How to select variant when multiple conditions are true
   */
  evaluationMode?: "first_match" | "priority";
  /**
   * Whether to clip child components to area bounds
   */
  clipContent?: boolean;
};
export type ComparisonOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "not_contains" | "matches";
export type LogicalOperator = "and" | "or";
export type Condition = EntityCondition | StateCondition | TimeCondition | CompoundCondition | NotCondition;

export interface Project {
  /**
   * Schema version. ALWAYS increment this if there are breaking changes to the JSON structure.
   */
  version?: string;
  id?: string;
  name: string;
  theme?: Theme;
  display: DisplayConfig;
  state?: StateConfig;
  dashboardPages: Page[];
  detailViews: DetailView[];
  fonts?: FontDefinition[];
}
export interface Theme {
  id: string;
  name: string;
  colors: {
    background: Color;
    backgroundSecondary?: Color;
    foreground: Color;
    foregroundMuted?: Color;
    accent: Color;
    accentSecondary?: Color;
    success?: Color;
    warning?: Color;
    error?: Color;
  };
  style?: {
    buttonShadow?: boolean;
    buttonCornerAccents?: boolean;
    containerCorners?: boolean;
    headerBorders?: boolean;
  };
  values?: {
    shadowOffset?: number;
    cornerSize?: number;
    borderRadius?: number;
  };
}
export interface Color {
  r: number;
  g: number;
  b: number;
}
export interface DisplayConfig {
  width: number;
  height: number;
  platform: "ili9xxx" | "st7789" | "ssd1306" | "waveshare_epaper";
}
export interface StateConfig {
  /**
   * Sensor fields to include in DisplayState
   */
  fields?: StateField[];
}
export interface StateField {
  /**
   * Variable name in gState (e.g., outsideTemp)
   */
  name: string;
  /**
   * C++ type
   */
  cppType: "float" | "int" | "bool" | "std::string";
  /**
   * Home Assistant entity (sensor.outside_temp)
   */
  haEntity: string;
  /**
   * Initial value (e.g., 0, false, '')
   */
  defaultValue?: string | number | boolean;
}
export interface Page {
  id: string;
  name: string;
  backgroundColor?: Color;
  components: Component[];
}
export interface BaseComponent {
  id: string;
  type: string;
  position: Position;
  size?: Size;
  visible?: boolean;
  visibleWhen?: EntityBinding;
  loadingBinding?: EntityBinding;
  onTap?: OnTapAction;
  onHold?: OnTapAction;
  onDragStart?: OnTapAction;
  onDragEnd?: OnTapAction;
  variant?: "default" | "retro" | "minimal";
}
export interface Position {
  x: number;
  y: number;
}
export interface Size {
  width: number;
  height: number;
}
export interface EntityBinding {
  entityId: string;
  attribute?: string | null;
}
export interface ServiceAction {
  type: "SERVICE_CALL";
  service: string;
  target?: ServiceTarget;
}
export interface ServiceTarget {
  entityId?: string;
  deviceId?: string;
}
export interface NavigationAction {
  type: "OPEN_DETAIL" | "GO_BACK" | "NEXT_PAGE" | "PREV_PAGE";
  /**
   * Detail view ID (without VIEW_DETAIL_ prefix). Required for OPEN_DETAIL.
   */
  targetId?: string;
}
/**
 * A single variant/state within a conditional area
 */
export interface ConditionalVariant {
  id: string;
  /**
   * Human-readable name for the editor UI
   */
  name: string;
  /**
   * When null/undefined, this is the default/fallback variant
   */
  condition?: EntityCondition | StateCondition | TimeCondition | CompoundCondition | NotCondition;
  /**
   * Higher priority variants are evaluated first
   */
  priority?: number;
  /**
   * Components rendered when this variant is active
   */
  components: Component[];
  transition?: {
    type?: "none" | "fade" | "slide";
    /**
     * milliseconds
     */
    duration?: number;
  };
}
/**
 * Condition based on a Home Assistant entity state
 */
export interface EntityCondition {
  type: "entity";
  entityId: string;
  /**
   * Optional attribute to check instead of state
   */
  attribute?: string | null;
  operator: ComparisonOperator;
  value: string | number | boolean;
}
/**
 * Condition based on internal state variable
 */
export interface StateCondition {
  type: "state";
  variable: string;
  operator: ComparisonOperator;
  value: string | number | boolean;
}
/**
 * Condition based on time of day
 */
export interface TimeCondition {
  type: "time";
  /**
   * HH:MM format
   */
  after?: string;
  before?: string;
}
/**
 * Combines multiple conditions with AND/OR
 */
export interface CompoundCondition {
  type: "compound";
  operator: LogicalOperator;
  conditions: Condition[];
}
/**
 * Negates a condition
 */
export interface NotCondition {
  type: "not";
  condition: Condition;
}
export interface DetailView {
  /**
   * Short view name in UPPER_SNAKE_CASE (e.g., TEMPS, VACUUM). Generator prepends VIEW_DETAIL_ prefix for enum.
   */
  id: string;
  title: string;
  /**
   * Total virtual height in pixels; maxScrollY = height - headerHeight
   */
  height: number;
  /**
   * Height of the detail view header (default: 45px)
   */
  headerHeight?: number;
  components: Component[];
}
export interface FontDefinition {
  id: string;
  file: string;
  size: number;
}
