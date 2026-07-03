/**
 * AUTO-GENERATED - DO NOT EDIT
 *
 * Generated from components.json schema
 * Run: bun run generate:types
 */

export type Component =
  | TextComponent
  | DigitalClockComponent
  | ButtonComponent
  | SliderComponent
  | GaugeComponent
  | IconComponent
  | ProceduralIconComponent
  | ContainerComponent
  | RectangleComponent
  | ImageComponent
  | TodoListComponent
  | LightStateComponent
  | HvacComponent
  | WeatherComponent
  | CalendarComponent
  | AutoLayoutListComponent
  | ConditionalAreaComponent
  | TabContainerComponent;
export type TextComponent = BaseComponent & {
  type: "text";
  /**
   * Label text. May contain `{{entity.id}}` or `{{entity.id.attribute}}` placeholders that are resolved at runtime; the referenced bindings are derived from this string.
   */
  text?: string;
  textBinding?: EntityBinding1;
  fontSize?: "small" | "medium" | "large";
  color?: Color;
  align?: "left" | "center" | "right";
};
export type OnTapAction = ServiceAction | NavigationAction;
export type DigitalClockComponent = BaseComponent & {
  type: "digital_clock";
  color?: Color;
};
export type ButtonComponent = BaseComponent & {
  type: "button";
  label?: string;
  icon?: string;
  backgroundColor?: Color;
  foregroundColor?: Color;
  borderColor?: Color;
  checkedBackgroundColor?: Color1;
  checkedForegroundColor?: Color2;
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
  /**
   * Child components rendered inside this container
   */
  children?: Component[];
};
export type RectangleComponent = BaseComponent & {
  type: "rectangle";
  backgroundColor?: Color;
};
export type ImageComponent = BaseComponent & {
  type: "image";
  /**
   * Whether the image comes from a static ESPHome image entry or a Home Assistant image/camera entity.
   */
  imageSource?: "static" | "ha";
  file: string;
  imageBinding?: EntityBinding2;
  /**
   * Encoded format expected from the online image URL when imageBinding is used.
   */
  onlineFormat?: "png" | "jpeg";
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
export type TodoListComponent = BaseComponent & {
  type: "todo_list";
  itemsBinding?: EntityBinding;
  /**
   * Home Assistant todo entity used for check-off actions
   */
  todoEntityId?: string;
  maxItems?: number;
  rowHeight?: number;
  scrollable?: boolean;
  checkable?: boolean;
};
export type LightStateComponent = BaseComponent & {
  type: "light_state";
  label?: string;
  stateBinding?: EntityBinding;
  targetDevice?: {
    deviceId: string;
    deviceName?: string;
  };
  showBrightnessControl?: boolean;
  onText?: string;
  offText?: string;
  showIcon?: boolean;
  icon?: string;
  onColor?: Color;
  offColor?: Color;
};
export type HvacComponent = BaseComponent & {
  type: "hvac";
  label?: string;
  stateBinding?: EntityBinding3;
  tempStep?: number;
  minTemp?: number;
  maxTemp?: number;
  /**
   * HA hvac_mode to set when turning on (heat, cool, etc.)
   */
  onMode?: string;
  onColor?: Color;
  offColor?: Color;
};
export type WeatherComponent = BaseComponent & {
  type: "weather";
  label?: string;
  /**
   * today = single-day view, forecast = 3-day forecast view
   */
  mode?: "today" | "forecast";
  stateBinding?: EntityBinding4;
};
export type CalendarComponent = BaseComponent & {
  type: "calendar";
  label?: string;
  entityBinding?: EntityBinding5;
  maxItems?: number;
  scrollable?: boolean;
  /**
   * Calendar event fetch window in days. Converted to hours for Home Assistant service call.
   */
  durationDays?: number;
};
export type AutoLayoutListComponent = BaseComponent & {
  type: "auto_layout_list";
  direction?: "horizontal" | "vertical";
  gap?: number;
  padding?: number;
  crossAxisAlign?: "start" | "center" | "end" | "stretch";
  mainAxisJustify?: "start" | "center" | "end" | "space_between";
  itemSizeMode?: "content" | "fixed";
  itemWidth?: number;
  itemHeight?: number;
  /**
   * @minItems 1
   */
  items: [AutoLayoutListItem, ...AutoLayoutListItem[]];
};
export type Condition = EntityCondition | StateCondition | TimeCondition | CompoundCondition | NotCondition;
export type ComparisonOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "contains" | "not_contains" | "matches";
export type LogicalOperator = "and" | "or";
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
export type TabContainerComponent = BaseComponent & {
  type: "tab_container";
  tabs: TabItem[];
  /**
   * ID of tab shown when first rendered
   */
  defaultTabId?: string;
  /**
   * Whether to clip child components to tab content bounds
   */
  clipContent?: boolean;
};

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
  secrets?: SecretsConfig;
  pageHeader?: PageHeader;
  notificationOverlay?: NotificationOverlayConfig;
  /**
   * IANA timezone identifier (e.g. America/New_York, Europe/Berlin)
   */
  timezone?: string;
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
  /**
   * Corner radius in pixels
   */
  borderRadius?: number;
  /**
   * Padding in pixels (all sides)
   */
  padding?: number;
  /**
   * Widget opacity (0-1)
   */
  opacity?: number;
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
   * Detail view ID. Required for OPEN_DETAIL.
   */
  targetId?: string;
}
/**
 * Legacy single-binding field. Prefer embedding `{{...}}` placeholders in `text`. Kept for backward compat with older projects.
 */
export interface EntityBinding1 {
  entityId: string;
  attribute?: string | null;
}
/**
 * Background color when button is in checked/active state (for toggle buttons)
 */
export interface Color1 {
  r: number;
  g: number;
  b: number;
}
/**
 * Text/icon color when button is in checked/active state
 */
export interface Color2 {
  r: number;
  g: number;
  b: number;
}
/**
 * Home Assistant image/camera entity. The entity_picture attribute is used by default and loaded with online_image.
 */
export interface EntityBinding2 {
  entityId: string;
  attribute?: string | null;
}
/**
 * Home Assistant climate entity (climate.xxx)
 */
export interface EntityBinding3 {
  entityId: string;
  attribute?: string | null;
}
/**
 * Home Assistant weather entity (weather.xxx). The state string is the condition (sunny, cloudy, rainy, ...); the 8 numeric attributes (temperature, dew_point, humidity, cloud_coverage, uv_index, pressure, wind_bearing, wind_speed) are read-only.
 */
export interface EntityBinding4 {
  entityId: string;
  attribute?: string | null;
}
/**
 * Home Assistant calendar entity (calendar.xxx). Events are loaded via calendar.get_events service calls.
 */
export interface EntityBinding5 {
  entityId: string;
  attribute?: string | null;
}
export interface AutoLayoutListItem {
  id: string;
  name: string;
  condition?: Condition;
  icon?: string;
  color?: Color;
  scale?: number;
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
 * A single tab inside a tab container
 */
export interface TabItem {
  id: string;
  /**
   * Tab label shown in the editor
   */
  name: string;
  /**
   * Components rendered when this tab is active
   */
  components: Component[];
}
export interface DetailView {
  /**
   * Stable detail view ID. Codegen sanitizes this into a C++ enum name.
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
/**
 * OTA update configuration
 */
export interface SecretsConfig {
  /**
   * Firmware update URL for OTA via HTTP (auto-populated from server)
   */
  firmwareUpdateUrl?: string;
  /**
   * Optional base URL used to resolve relative Home Assistant entity_picture URLs
   */
  homeAssistantBaseUrl?: string;
}
/**
 * Project-level page header shown on all dashboard pages
 */
export interface PageHeader {
  /**
   * Height of the header region in pixels
   */
  height: number;
  backgroundColor?: Color3;
  /**
   * Components rendered in the header region (positions relative to header origin)
   */
  components: Component[];
}
/**
 * Background color of the header region (falls back to theme background)
 */
export interface Color3 {
  r: number;
  g: number;
  b: number;
}
/**
 * Global high-priority Home Assistant notification overlay settings
 */
export interface NotificationOverlayConfig {
  enabled?: boolean;
  titleEntityId?: string;
  bodyEntityId?: string;
  severityEntityId?: string;
}
