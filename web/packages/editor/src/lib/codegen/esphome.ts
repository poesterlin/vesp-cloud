/**
 * ESPHome YAML Code Generator (LVGL)
 *
 * Generates ESPHome configuration with native LVGL widget-based UI.
 * Replaces the previous C++ header-based rendering pipeline.
 */

import type {
  Project,
  Component,
  Color,
  Theme,
  TextComponent,
  ButtonComponent,
  SliderComponent,
  GaugeComponent,
  ContainerComponent,
  ConditionalAreaComponent,
  ConditionalVariant,
  Condition,
  EntityCondition,
  BaseComponent,
} from "@esphome-designer/schema";
import { RETRO_THEME } from "../themes/retro";
import { getMdiCodepoint, generateIconFontYAML } from "./mdi-icons";

// --- ID helpers ---

function widgetId(componentId: string): string {
  return `w_${componentId.replace(/[^a-zA-Z0-9]/g, "_")}`;
}

function sensorId(entityId: string): string {
  return `ha_${entityId.replace(/\./g, "_")}`;
}

function scriptId(service: string, targetEntity?: string): string {
  const base = service.replace(/\./g, "_");
  if (targetEntity) return `script_${base}_${targetEntity.replace(/\./g, "_")}`;
  return `script_${base}`;
}

function colorToHex(color: Color): string {
  const hex = ((color.r << 16) | (color.g << 8) | color.b)
    .toString(16)
    .padStart(6, "0");
  return `0x${hex.toUpperCase()}`;
}

function fontSizeToLvgl(fontSize?: string): string {
  switch (fontSize) {
    case "small":
      return "montserrat_14";
    case "large":
      return "montserrat_28";
    case "medium":
    default:
      return "montserrat_18";
  }
}

// --- LVGL Theme Generation ---

function generateLvglTheme(theme: Theme): string[] {
  const lines: string[] = [];
  const colors = theme.colors;
  const values = theme.values;
  
  // Calculate border radius based on theme
  const radius = values?.borderRadius ?? 0;
  
  lines.push(`  theme:`);
  
  // Button styling
  lines.push(`    button:`);
  lines.push(`      bg_color: ${colorToHex(colors.backgroundSecondary ?? colors.background)}`);
  lines.push(`      text_color: ${colorToHex(colors.foreground)}`);
  lines.push(`      radius: ${radius}`);
  if (values?.shadowOffset && theme.style?.buttonShadow) {
    lines.push(`      shadow_width: ${values.shadowOffset}`);
    lines.push(`      shadow_ofs_x: ${values.shadowOffset}`);
    lines.push(`      shadow_ofs_y: ${values.shadowOffset}`);
    lines.push(`      shadow_color: 0x000000`);
    lines.push(`      shadow_opa: 80%`);
  }
  lines.push(`      pressed:`);
  lines.push(`        bg_color: ${colorToHex(colors.accent)}`);
  lines.push(`        text_color: ${colorToHex(colors.background)}`);
  lines.push(`      checked:`);
  lines.push(`        bg_color: ${colorToHex(colors.accent)}`);
  lines.push(`        text_color: ${colorToHex(colors.background)}`);
  lines.push(`      disabled:`);
  lines.push(`        bg_color: ${colorToHex(colors.foregroundMuted ?? { r: 64, g: 64, b: 64 })}`);
  lines.push(`        text_color: ${colorToHex(colors.background)}`);
  
  // Label styling
  lines.push(`    label:`);
  lines.push(`      text_color: ${colorToHex(colors.foreground)}`);
  
  // Slider styling
  lines.push(`    slider:`);
  lines.push(`      bg_color: ${colorToHex(colors.backgroundSecondary ?? colors.background)}`);
  lines.push(`      radius: ${radius}`);
  lines.push(`      indicator:`);
  lines.push(`        bg_color: ${colorToHex(colors.accent)}`);
  lines.push(`        radius: ${radius}`);
  lines.push(`      knob:`);
  lines.push(`        bg_color: ${colorToHex(colors.foreground)}`);
  lines.push(`        radius: ${Math.max(radius, 20)}`);
  
  // Arc styling (for gauges)
  lines.push(`    arc:`);
  lines.push(`      arc_color: ${colorToHex(colors.backgroundSecondary ?? colors.background)}`);
  lines.push(`      indicator:`);
  lines.push(`        arc_color: ${colorToHex(colors.accent)}`);
  lines.push(`      knob:`);
  lines.push(`        bg_color: ${colorToHex(colors.foreground)}`);
  
  // Switch styling
  lines.push(`    switch:`);
  lines.push(`      bg_color: ${colorToHex(colors.backgroundSecondary ?? colors.background)}`);
  lines.push(`      checked:`);
  lines.push(`        bg_color: ${colorToHex(colors.accent)}`);
  lines.push(`      knob:`);
  lines.push(`        bg_color: ${colorToHex(colors.foreground)}`);
  
  // Spinner styling
  lines.push(`    spinner:`);
  lines.push(`      arc_color: ${colorToHex(colors.foregroundMuted ?? { r: 64, g: 64, b: 64 })}`);
  lines.push(`      indicator:`);
  lines.push(`        arc_color: ${colorToHex(colors.accent)}`);
  
  // Bar styling (progress bars)
  lines.push(`    bar:`);
  lines.push(`      bg_color: ${colorToHex(colors.backgroundSecondary ?? colors.background)}`);
  lines.push(`      radius: ${radius}`);
  lines.push(`      indicator:`);
  lines.push(`        bg_color: ${colorToHex(colors.accent)}`);
        
  return lines;
}

// --- Binding extraction ---

interface SensorBinding {
  entityId: string;
  attribute?: string | null;
  widgetId: string;
  sensorType: "numeric" | "text" | "binary";
  widgetType: "label" | "arc" | "slider" | "button";
  unit?: string;
}

interface ScriptAction {
  id: string;
  service: string;
  targetEntityId?: string;
}

interface ToggleButton {
  widgetId: string;
  spinnerId: string;
  entityId: string;
  scriptId: string;
}

// --- Conditional Area tracking ---

interface ConditionalAreaInfo {
  areaId: string;
  componentId: string;
  defaultVariantId?: string;
  variants: {
    variantId: string;
    objId: string;
    condition?: Condition;
    isDefault: boolean;
  }[];
}

// Extracts all entity IDs referenced in a condition (recursively)
function extractConditionEntities(condition: Condition): string[] {
  const entities: string[] = [];
  
  if (condition.type === "entity") {
    entities.push(condition.entityId);
  } else if (condition.type === "compound") {
    for (const sub of condition.conditions) {
      entities.push(...extractConditionEntities(sub));
    }
  } else if (condition.type === "not") {
    entities.push(...extractConditionEntities(condition.condition));
  }
  // StateCondition and TimeCondition don't reference entities
  
  return entities;
}

// Generate C++ expression for evaluating a condition
function generateConditionExpression(condition: Condition): string {
  switch (condition.type) {
    case "entity": {
      const sId = sensorId(condition.entityId);
      const valueExpr = condition.attribute 
        ? `id(${sId}).state` // For now, just use state
        : `id(${sId}).state`;
      
      const value = typeof condition.value === "string" 
        ? `"${condition.value}"` 
        : String(condition.value);
      
      // For binary sensors, compare against true/false
      if (isBinaryDomain(condition.entityId)) {
        const boolVal = condition.value === true || condition.value === "on" || condition.value === "true";
        switch (condition.operator) {
          case "eq": return `(id(${sId}).state == ${boolVal})`;
          case "neq": return `(id(${sId}).state != ${boolVal})`;
          default: return `(id(${sId}).state == ${boolVal})`;
        }
      }
      
      // For numeric sensors
      if (isNumericDomain(condition.entityId)) {
        const numVal = Number(condition.value);
        switch (condition.operator) {
          case "eq": return `(id(${sId}).state == ${numVal})`;
          case "neq": return `(id(${sId}).state != ${numVal})`;
          case "gt": return `(id(${sId}).state > ${numVal})`;
          case "gte": return `(id(${sId}).state >= ${numVal})`;
          case "lt": return `(id(${sId}).state < ${numVal})`;
          case "lte": return `(id(${sId}).state <= ${numVal})`;
          default: return `(id(${sId}).state == ${numVal})`;
        }
      }
      
      // For text sensors (string comparison)
      switch (condition.operator) {
        case "eq": return `(id(${sId}).state == ${value})`;
        case "neq": return `(id(${sId}).state != ${value})`;
        case "contains": return `(id(${sId}).state.find(${value}) != std::string::npos)`;
        case "not_contains": return `(id(${sId}).state.find(${value}) == std::string::npos)`;
        default: return `(id(${sId}).state == ${value})`;
      }
    }
    
    case "compound": {
      const op = condition.operator === "and" ? " && " : " || ";
      const parts = condition.conditions.map(c => generateConditionExpression(c));
      return `(${parts.join(op)})`;
    }
    
    case "not": {
      return `!(${generateConditionExpression(condition.condition)})`;
    }
    
    case "time": {
      // Time conditions need special handling with time component
      // For now, return a placeholder - would need sntp_time integration
      return "true"; // TODO: implement time-based conditions
    }
    
    case "state": {
      // Internal state variables - would need globals
      return "true"; // TODO: implement state variable conditions
    }
    
    default:
      return "true";
  }
}

function isNumericDomain(entityId: string): boolean {
  const domain = entityId.split(".")[0];
  return ["sensor", "input_number", "number", "counter", "climate"].includes(
    domain,
  );
}

function isBinaryDomain(entityId: string): boolean {
  const domain = entityId.split(".")[0];
  return ["binary_sensor", "light", "switch", "input_boolean", "fan"].includes(
    domain,
  );
}

function extractBindingsAndActions(project: Project) {
  const sensorBindings: SensorBinding[] = [];
  const scriptActions: Map<string, ScriptAction> = new Map();
  const toggleButtons: ToggleButton[] = [];
  const conditionalAreas: ConditionalAreaInfo[] = [];
  const conditionEntityIds: Set<string> = new Set();

  const processComponent = (comp: Component) => {
    const wId = widgetId(comp.id);

    if (comp.type === "text" && comp.textBinding) {
      const entity = comp.textBinding.entityId;
      sensorBindings.push({
        entityId: entity,
        attribute: comp.textBinding.attribute,
        widgetId: wId,
        sensorType: isNumericDomain(entity) ? "numeric" : "text",
        widgetType: "label",
      });
    }

    if (comp.type === "gauge" && comp.valueBinding) {
      sensorBindings.push({
        entityId: comp.valueBinding.entityId,
        attribute: comp.valueBinding.attribute,
        widgetId: wId,
        sensorType: "numeric",
        widgetType: "arc",
        unit: comp.unit,
      });
    }

    if (comp.type === "slider" && comp.valueBinding) {
      sensorBindings.push({
        entityId: comp.valueBinding.entityId,
        attribute: comp.valueBinding.attribute,
        widgetId: wId,
        sensorType: "numeric",
        widgetType: "slider",
      });
    }

    // Process container children
    if (comp.type === "container" && comp.children) {
      for (const child of comp.children) {
        processComponent(child);
      }
    }

    if (comp.type === "button") {
      // Get the action - fallback to pressAction for backwards compatibility
      const tapAction = comp.onTap || (comp as any).pressAction;
      
      if (tapAction && tapAction.type === "SERVICE_CALL") {
        const sId = scriptId(
          tapAction.service,
          tapAction.target?.entityId,
        );
        if (!scriptActions.has(sId)) {
          scriptActions.set(sId, {
            id: sId,
            service: tapAction.service,
            targetEntityId: tapAction.target?.entityId,
          });
        }

        // Track binary state toggle buttons
        const targetEntity = tapAction.target?.entityId;
        if (targetEntity && isBinaryDomain(targetEntity)) {
          const wId = widgetId(comp.id);
          sensorBindings.push({
            entityId: targetEntity,
            widgetId: wId,
            sensorType: "binary",
            widgetType: "button",
          });
          // Track toggle button for loading spinner
          toggleButtons.push({
            widgetId: wId,
            spinnerId: `${wId}_spinner`,
            entityId: targetEntity,
            scriptId: sId,
          });
        }
      }
      
      // Handle hold actions
      const holdAction = comp.onHold || (comp as any).holdAction;
      if (holdAction && holdAction.type === "SERVICE_CALL") {
        const sId = scriptId(
          holdAction.service,
          holdAction.target?.entityId,
        );
        if (!scriptActions.has(sId)) {
          scriptActions.set(sId, {
            id: sId,
            service: holdAction.service,
            targetEntityId: holdAction.target?.entityId,
          });
        }
      }
    }

    if (comp.type === "conditional_area") {
      const areaId = wId;
      const areaInfo: ConditionalAreaInfo = {
        areaId,
        componentId: comp.id,
        defaultVariantId: comp.defaultVariantId,
        variants: [],
      };
      
      for (let vi = 0; vi < comp.variants.length; vi++) {
        const variant = comp.variants[vi];
        const variantObjId = `${areaId}_v${vi}`;
        const isDefault = variant.id === comp.defaultVariantId || 
                          (!comp.defaultVariantId && !variant.condition);
        
        areaInfo.variants.push({
          variantId: variant.id,
          objId: variantObjId,
          condition: variant.condition,
          isDefault,
        });
        
        // Extract entity IDs from conditions for sensor generation
        if (variant.condition) {
          for (const entityId of extractConditionEntities(variant.condition)) {
            conditionEntityIds.add(entityId);
          }
        }
        
        // Process child components
        for (const child of variant.components) {
          processComponent(child);
        }
      }
      
      conditionalAreas.push(areaInfo);
    }
  };

  for (const page of project.dashboardPages || []) {
    for (const comp of page.components) processComponent(comp);
  }
  for (const view of project.detailViews || []) {
    for (const comp of view.components) processComponent(comp);
  }

  return { 
    sensorBindings, 
    scriptActions: [...scriptActions.values()], 
    toggleButtons,
    conditionalAreas,
    conditionEntityIds: [...conditionEntityIds],
  };
}

// --- Widget generation ---

function ind(level: number): string {
  return "  ".repeat(level);
}

function generateBaseStyleLines(
  comp: BaseComponent,
  i: string,
): string[] {
  const lines: string[] = [];
  if (comp.borderRadius != null) {
    lines.push(`${i}    radius: ${comp.borderRadius}`);
  }
  if (comp.padding != null) {
    lines.push(`${i}    pad_all: ${comp.padding}`);
  }
  if (comp.opacity != null && comp.opacity < 1) {
    lines.push(`${i}    opa: ${Math.round(comp.opacity * 255)}`);
  }
  return lines;
}

/** Context passed to widget generators so they know which page they're on */
interface PageContext {
  /** Index of the dashboard page this widget is on, or -1 for detail view pages */
  pageIndex: number;
  /** Whether detail views exist in the project (to know if we need detail_view_active tracking) */
  hasDetailViews: boolean;
}

function generateWidgetLines(comp: Component, level: number, ctx?: PageContext): string[] {
  switch (comp.type) {
    case "text":
      return generateLabelWidget(comp as TextComponent, level);
    case "button":
      return generateButtonWidget(comp as ButtonComponent, level, ctx);
    case "slider":
      return generateSliderWidget(comp as SliderComponent, level);
    case "gauge":
      return generateArcWidget(comp as GaugeComponent, level);
    case "container":
      return generateObjWidget(comp as ContainerComponent, level, ctx);
    case "conditional_area":
      return generateConditionalAreaWidget(comp as ConditionalAreaComponent, level, ctx);
    default:
      return [];
  }
}

function generateLabelWidget(comp: TextComponent, level: number): string[] {
  const lines: string[] = [];
  const i = ind(level);
  const wId = widgetId(comp.id);
  const text = comp.text || (comp.textBinding ? "--" : "");

  lines.push(`${i}- label:`);
  lines.push(`${i}    id: ${wId}`);
  lines.push(`${i}    text: "${text}"`);
  lines.push(`${i}    x: ${comp.position.x}`);
  lines.push(`${i}    y: ${comp.position.y}`);
  if (comp.size) {
    lines.push(`${i}    width: ${comp.size.width}`);
  }
  if (comp.color) {
    lines.push(`${i}    text_color: ${colorToHex(comp.color)}`);
  }
  lines.push(`${i}    text_font: ${fontSizeToLvgl(comp.fontSize)}`);
  if (comp.align === "center") {
    lines.push(`${i}    text_align: CENTER`);
  } else if (comp.align === "right") {
    lines.push(`${i}    text_align: RIGHT`);
  }
  lines.push(...generateBaseStyleLines(comp, i));

  return lines;
}

function generateButtonWidget(comp: ButtonComponent, level: number, ctx?: PageContext): string[] {
  const lines: string[] = [];
  const i = ind(level);
  const wId = widgetId(comp.id);

  // Get the action - fallback to pressAction for backwards compatibility
  const tapAction = comp.onTap || (comp as any).pressAction;

  const isToggleButton =
    tapAction?.type === "SERVICE_CALL" &&
    tapAction.target?.entityId &&
    isBinaryDomain(tapAction.target.entityId);

  lines.push(`${i}- button:`);
  lines.push(`${i}    id: ${wId}`);
  lines.push(`${i}    x: ${comp.position.x}`);
  lines.push(`${i}    y: ${comp.position.y}`);
  if (comp.size) {
    lines.push(`${i}    width: ${comp.size.width}`);
    lines.push(`${i}    height: ${comp.size.height}`);
  }
  if (comp.backgroundColor) {
    lines.push(`${i}    bg_color: ${colorToHex(comp.backgroundColor)}`);
  }
  if (comp.borderColor) {
    lines.push(`${i}    border_color: ${colorToHex(comp.borderColor)}`);
    lines.push(`${i}    border_width: 1`);
  }
  lines.push(...generateBaseStyleLines(comp, i));

  if (isToggleButton) {
    lines.push(`${i}    checkable: true`);
    // Add checked state styling
    const checkedBg = comp.checkedBackgroundColor || { r: 0, g: 170, b: 0 }; // Default green
    const checkedFg = comp.checkedForegroundColor || comp.foregroundColor;
    lines.push(`${i}    checked:`);
    lines.push(`${i}      bg_color: ${colorToHex(checkedBg)}`);
    if (checkedFg) {
      lines.push(`${i}      text_color: ${colorToHex(checkedFg)}`);
    }
  }

  if (tapAction?.type === "SERVICE_CALL") {
    // Determine the script ID
    const sId = scriptId(
      tapAction.service,
      tapAction.target?.entityId,
    );
    lines.push(`${i}    on_click:`);
    lines.push(`${i}      - script.execute: ${sId}`);
  } else if (tapAction?.type === "NEXT_PAGE") {
    lines.push(`${i}    on_click:`);
    lines.push(`${i}      - lvgl.page.next:`);
  } else if (tapAction?.type === "PREV_PAGE") {
    lines.push(`${i}    on_click:`);
    lines.push(`${i}      - lvgl.page.previous:`);
  } else if (
    tapAction?.type === "OPEN_DETAIL" &&
    tapAction.targetId
  ) {
    const returnPageIdx = ctx?.pageIndex ?? 0;
    lines.push(`${i}    on_click:`);
    lines.push(`${i}      - globals.set:`);
    lines.push(`${i}          id: detail_view_active`);
    lines.push(`${i}          value: "true"`);
    lines.push(`${i}      - globals.set:`);
    lines.push(`${i}          id: return_page`);
    lines.push(`${i}          value: "${returnPageIdx}"`);
    lines.push(
      `${i}      - lvgl.page.show: detail_${tapAction.targetId.toLowerCase()}`,
    );
  } else if (tapAction?.type === "GO_BACK") {
    // Return to the stored page and clear detail view state
    lines.push(`${i}    on_click:`);
    lines.push(`${i}      - globals.set:`);
    lines.push(`${i}          id: detail_view_active`);
    lines.push(`${i}          value: "false"`);
    lines.push(`${i}      - lambda: |-`);
    lines.push(`${i}          id(my_lvgl)->show_page(id(return_page), LV_SCR_LOAD_ANIM_MOVE_RIGHT, 300);`);
  }

  // Always add widgets section for toggle buttons (need spinner) or if there's a label/icon
  if (comp.label || comp.icon || isToggleButton) {
    lines.push(`${i}    widgets:`);
    
    // Icon rendering (as a label with icon font)
    if (comp.icon) {
      const iconCodepoint = getMdiCodepoint(comp.icon);
      if (iconCodepoint) {
        lines.push(`${i}      - label:`);
        lines.push(`${i}          text: "${iconCodepoint}"`);
        lines.push(`${i}          text_font: mdi_icons_24`);
        // Position icon above center if there's also a label, otherwise center
        if (comp.label) {
          lines.push(`${i}          align: CENTER`);
          lines.push(`${i}          y: -14`);
        } else {
          lines.push(`${i}          align: CENTER`);
        }
        if (comp.foregroundColor) {
          lines.push(`${i}          text_color: ${colorToHex(comp.foregroundColor)}`);
        }
      }
    }
    
    // Text label
    if (comp.label) {
      lines.push(`${i}      - label:`);
      lines.push(`${i}          text: "${comp.label}"`);
      // Position text below center if there's also an icon, otherwise center
      if (comp.icon) {
        lines.push(`${i}          align: CENTER`);
        lines.push(`${i}          y: 14`);
        lines.push(`${i}          text_font: montserrat_14`);
      } else {
        lines.push(`${i}          align: CENTER`);
      }
      if (comp.foregroundColor) {
        lines.push(`${i}          text_color: ${colorToHex(comp.foregroundColor)}`);
      }
    }
    
    // Add hidden spinner for toggle buttons
    if (isToggleButton) {
      const spinnerId = `${wId}_spinner`;
      lines.push(`${i}      - spinner:`);
      lines.push(`${i}          id: ${spinnerId}`);
      lines.push(`${i}          align: CENTER`);
      lines.push(`${i}          width: 30`);
      lines.push(`${i}          height: 30`);
      lines.push(`${i}          arc_length: 60`);
      lines.push(`${i}          arc_width: 4`);
      lines.push(`${i}          hidden: true`);
      // Use foreground color for spinner if available
      if (comp.foregroundColor) {
        lines.push(`${i}          arc_color: ${colorToHex(comp.foregroundColor)}`);
      }
    }
  }

  return lines;
}

function generateSliderWidget(
  comp: SliderComponent,
  level: number,
): string[] {
  const lines: string[] = [];
  const i = ind(level);
  const wId = widgetId(comp.id);

  lines.push(`${i}- slider:`);
  lines.push(`${i}    id: ${wId}`);
  lines.push(`${i}    x: ${comp.position.x}`);
  lines.push(`${i}    y: ${comp.position.y}`);
  if (comp.size) {
    lines.push(`${i}    width: ${comp.size.width}`);
    lines.push(`${i}    height: ${comp.size.height}`);
  }
  lines.push(`${i}    min_value: ${comp.min ?? 0}`);
  lines.push(`${i}    max_value: ${comp.max ?? 100}`);
  if (comp.trackColor) {
    lines.push(`${i}    bg_color: ${colorToHex(comp.trackColor)}`);
  }
  if (comp.fillColor) {
    lines.push(`${i}    indicator:`);
    lines.push(`${i}      bg_color: ${colorToHex(comp.fillColor)}`);
  }
  if (comp.handleColor) {
    lines.push(`${i}    knob:`);
    lines.push(`${i}      bg_color: ${colorToHex(comp.handleColor)}`);
  }
  lines.push(...generateBaseStyleLines(comp, i));

  if (comp.onChange?.type === "SERVICE_CALL") {
    const service = comp.onChange.service;
    const targetEntityId = comp.onChange.target?.entityId;
    // on_change fires only on user interaction (not programmatic updates),
    // avoiding feedback loops when the slider also has a valueBinding
    lines.push(`${i}    on_change:`);
    lines.push(`${i}      - homeassistant.service:`);
    lines.push(`${i}          service: ${service}`);
    if (targetEntityId) {
      lines.push(`${i}          data:`);
      lines.push(`${i}            entity_id: ${targetEntityId}`);
      lines.push(`${i}            value: !lambda return (int)(x + 0.5);`);
    }
  }

  return lines;
}

function generateArcWidget(comp: GaugeComponent, level: number): string[] {
  const lines: string[] = [];
  const i = ind(level);
  const wId = widgetId(comp.id);

  lines.push(`${i}- arc:`);
  lines.push(`${i}    id: ${wId}`);
  lines.push(`${i}    x: ${comp.position.x}`);
  lines.push(`${i}    y: ${comp.position.y}`);
  if (comp.size) {
    const dim = Math.min(comp.size.width, comp.size.height);
    lines.push(`${i}    width: ${dim}`);
    lines.push(`${i}    height: ${dim}`);
  }
  lines.push(`${i}    min_value: ${comp.min}`);
  lines.push(`${i}    max_value: ${comp.max}`);
  lines.push(`${i}    adjustable: false`);
  if (comp.backgroundColor) {
    lines.push(`${i}    arc_color: ${colorToHex(comp.backgroundColor)}`);
  }
  if (comp.needleColor) {
    lines.push(`${i}    indicator:`);
    lines.push(`${i}      arc_color: ${colorToHex(comp.needleColor)}`);
  }
  lines.push(...generateBaseStyleLines(comp, i));

  return lines;
}

function generateObjWidget(
  comp: ContainerComponent,
  level: number,
  ctx?: PageContext,
): string[] {
  const lines: string[] = [];
  const i = ind(level);

  lines.push(`${i}- obj:`);
  lines.push(`${i}    x: ${comp.position.x}`);
  lines.push(`${i}    y: ${comp.position.y}`);
  if (comp.size) {
    lines.push(`${i}    width: ${comp.size.width}`);
    lines.push(`${i}    height: ${comp.size.height}`);
  }
  if (comp.backgroundColor) {
    lines.push(`${i}    bg_color: ${colorToHex(comp.backgroundColor)}`);
  }
  lines.push(`${i}    scrollbar_mode: auto`);
  lines.push(`${i}    layout:`);
  lines.push(`${i}      type: flex`);
  lines.push(`${i}      flex_flow: COLUMN`);
  lines.push(`${i}      flex_align_main: START`);
  lines.push(`${i}      flex_align_cross: CENTER`);
  if (comp.padding != null) {
    lines.push(`${i}    pad_all: ${comp.padding}`);
  } else {
    lines.push(`${i}    pad_all: 10`);
  }
  if (comp.borderRadius != null) {
    lines.push(`${i}    radius: ${comp.borderRadius}`);
  }
  if (comp.opacity != null && comp.opacity < 1) {
    lines.push(`${i}    opa: ${Math.round(comp.opacity * 255)}`);
  }

  const hasChildren = comp.children && comp.children.length > 0;
  if (comp.label || hasChildren) {
    lines.push(`${i}    widgets:`);
    if (comp.label) {
      lines.push(`${i}      - label:`);
      lines.push(`${i}          text: "${comp.label}"`);
      lines.push(`${i}          text_color: 0xFFFFFF`);
    }
    if (hasChildren) {
      for (const child of comp.children!) {
        lines.push(...generateWidgetLines(child, level + 2, ctx));
      }
    }
  }

  return lines;
}

function generateConditionalAreaWidget(
  comp: ConditionalAreaComponent,
  level: number,
  ctx?: PageContext,
): string[] {
  const lines: string[] = [];
  const i = ind(level);
  const areaId = widgetId(comp.id);
  
  // Create a parent container for all variants
  lines.push(`${i}- obj:`);
  lines.push(`${i}    id: ${areaId}`);
  lines.push(`${i}    x: ${comp.position.x}`);
  lines.push(`${i}    y: ${comp.position.y}`);
  if (comp.size) {
    lines.push(`${i}    width: ${comp.size.width}`);
    lines.push(`${i}    height: ${comp.size.height}`);
  }
  lines.push(`${i}    bg_opa: 0`);  // Transparent container
  lines.push(`${i}    border_width: 0`);
  if (comp.clipContent) {
    lines.push(`${i}    clip_corner: true`);
  }
  
  // Generate obj for each variant
  lines.push(`${i}    widgets:`);
  
  for (let vi = 0; vi < comp.variants.length; vi++) {
    const variant = comp.variants[vi];
    const variantObjId = `${areaId}_v${vi}`;
    const isDefault = variant.id === comp.defaultVariantId || 
                      (!comp.defaultVariantId && !variant.condition);
    
    // Each variant is an obj that fills the parent
    lines.push(`${i}      - obj:`);
    lines.push(`${i}          id: ${variantObjId}`);
    lines.push(`${i}          width: 100%`);
    lines.push(`${i}          height: 100%`);
    lines.push(`${i}          bg_opa: 0`);
    lines.push(`${i}          border_width: 0`);
    // Show default variant, hide others initially
    if (!isDefault) {
      lines.push(`${i}          hidden: true`);
    }
    
    // Render child components
    if (variant.components.length > 0) {
      lines.push(`${i}          widgets:`);
      for (const child of variant.components) {
        lines.push(...generateWidgetLines(child, level + 6, ctx));
      }
    }
  }
  
  return lines;
}

// --- Sensor update action generation ---

function generateSensorUpdateLines(binding: SensorBinding): string[] {
  const lines: string[] = [];
  switch (binding.widgetType) {
    case "label":
      if (binding.sensorType === "numeric") {
        lines.push(`      - lvgl.label.update:`);
        lines.push(`          id: ${binding.widgetId}`);
        lines.push(`          text:`);
        const fmt = binding.unit ? `%.1f ${binding.unit}` : "%.1f";
        lines.push(`            format: "${fmt}"`);
        lines.push(`            args: [x]`);
      } else {
        lines.push(`      - lvgl.label.update:`);
        lines.push(`          id: ${binding.widgetId}`);
        lines.push(`          text: !lambda return x;`);
      }
      break;
    case "arc":
      lines.push(`      - lvgl.arc.update:`);
      lines.push(`          id: ${binding.widgetId}`);
      lines.push(`          value: !lambda return (int)(x + 0.5);`);
      break;
    case "slider":
      lines.push(`      - lvgl.slider.update:`);
      lines.push(`          id: ${binding.widgetId}`);
      lines.push(`          value: !lambda return (int)(x + 0.5);`);
      break;
    case "button":
      lines.push(`      - lvgl.widget.update:`);
      lines.push(`          id: ${binding.widgetId}`);
      lines.push(`          state:`);
      lines.push(`            checked: !lambda return x;`);
      break;
  }
  return lines;
}

// --- Main generator ---

export function generateESPHomeYAML(project: Project): string {
  const lines: string[] = [];
  const { sensorBindings, scriptActions, toggleButtons, conditionalAreas, conditionEntityIds } =
    extractBindingsAndActions(project);
  const hasDetailViews = (project.detailViews?.length ?? 0) > 0;

  // Header
  lines.push(`# ============================================`);
  lines.push(`# Generated by ESPHome Designer`);
  lines.push(`# Project: ${project.name}`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push(`# ============================================`);
  lines.push(``);

  // Substitutions
  const deviceName = project.name.toLowerCase().replace(/\s+/g, "-");
  lines.push(`substitutions:`);
  lines.push(`  device_name: ${deviceName}`);
  lines.push(``);

  // ESPHome core
  lines.push(`esphome:`);
  lines.push(`  name: \${device_name}`);
  lines.push(`  on_boot:`);
  lines.push(`    priority: 800`);
  lines.push(`    then:`);
  lines.push(`      - lambda: |-`);
  lines.push(`          gpio_set_direction(GPIO_NUM_2, GPIO_MODE_OUTPUT);`);
  lines.push(`          gpio_set_level(GPIO_NUM_2, 0);`);
  lines.push(`          vTaskDelay(pdMS_TO_TICKS(20));`);
  lines.push(`          gpio_set_level(GPIO_NUM_2, 1);`);
  lines.push(`          vTaskDelay(pdMS_TO_TICKS(100));`);
  lines.push(``);

  // ESP32
  lines.push(`esp32:`);
  lines.push(`  board: esp32-s3-devkitc-1`);
  lines.push(`  framework:`);
  lines.push(`    type: esp-idf`);
  lines.push(``);

  // PSRAM
  lines.push(`psram:`);
  lines.push(`  mode: octal`);
  lines.push(``);

  // ============================================
  // Hardware Configuration (inline)
  // Guition ESP32-S3-4848S040 (4.0" 480x480)
  // ============================================

  // I2C for touchscreen
  lines.push(`i2c:`);
  lines.push(`  id: touch_i2c`);
  lines.push(`  frequency: 400kHz`);
  lines.push(`  sda: GPIO19`);
  lines.push(`  scl:`);
  lines.push(`    number: GPIO45`);
  lines.push(`    ignore_strapping_warning: true`);
  lines.push(``);

  // Touchscreen with swipe detection for page navigation
  lines.push(`touchscreen:`);
  lines.push(`  platform: gt911`);
  lines.push(`  id: touch_gt911`);
  lines.push(`  i2c_id: touch_i2c`);
  lines.push(`  display: main_display`);
  lines.push(`  on_touch:`);
  lines.push(`    - lambda: |-`);
  lines.push(`        id(touch_start_x) = touch.x;`);
  lines.push(`        id(touch_last_x) = touch.x;`);
  lines.push(`  on_update:`);
  lines.push(`    - lambda: |-`);
  lines.push(`        for (auto &t : touches) {`);
  lines.push(`          id(touch_last_x) = t.x;`);
  lines.push(`        }`);
  lines.push(`  on_release:`);
  lines.push(`    - lambda: |-`);
  lines.push(`        int dx = id(touch_last_x) - id(touch_start_x);`);
  if (hasDetailViews) {
    // Block swipe navigation while a detail view is open
    lines.push(`        if (id(detail_view_active)) return;`);
  }
  lines.push(`        if (dx < -50) {`);
  lines.push(`          id(my_lvgl)->show_next_page(LV_SCR_LOAD_ANIM_MOVE_LEFT, 300);`);
  lines.push(`        } else if (dx > 50) {`);
  lines.push(`          id(my_lvgl)->show_prev_page(LV_SCR_LOAD_ANIM_MOVE_RIGHT, 300);`);
  lines.push(`        }`);
  lines.push(``);

  // SPI for display initialization
  lines.push(`spi:`);
  lines.push(`  id: lcd_spi`);
  lines.push(`  clk_pin: GPIO48`);
  lines.push(`  mosi_pin: GPIO47`);
  lines.push(``);

  // Backlight PWM output
  lines.push(`output:`);
  lines.push(`  - platform: ledc`);
  lines.push(`    pin: GPIO38`);
  lines.push(`    frequency: 150Hz`);
  lines.push(`    id: backlight_pwm`);
  lines.push(`    min_power: 0.01`);
  lines.push(`    zero_means_zero: true`);
  lines.push(``);

  // Backlight light component
  lines.push(`light:`);
  lines.push(`  - platform: monochromatic`);
  lines.push(`    output: backlight_pwm`);
  lines.push(`    name: "Display Backlight"`);
  lines.push(`    id: display_backlight`);
  lines.push(`    restore_mode: ALWAYS_ON`);
  lines.push(`    default_transition_length: 1s`);
  lines.push(`    initial_state:`);
  lines.push(`      brightness: 100%`);
  lines.push(``);

  // ST7701S Display
  lines.push(`display:`);
  lines.push(`  - platform: st7701s`);
  lines.push(`    id: main_display`);
  lines.push(`    dimensions:`);
  lines.push(`      width: 480`);
  lines.push(`      height: 480`);
  lines.push(`    spi_mode: MODE3`);
  lines.push(`    data_rate: 2MHz`);
  lines.push(`    color_order: RGB`);
  lines.push(`    invert_colors: false`);
  lines.push(`    cs_pin: 39`);
  lines.push(`    de_pin: 18`);
  lines.push(`    hsync_pin: 16`);
  lines.push(`    vsync_pin: 17`);
  lines.push(`    pclk_pin: 21`);
  lines.push(`    pclk_frequency: 12MHz`);
  lines.push(`    pclk_inverted: true`);
  lines.push(`    hsync_pulse_width: 8`);
  lines.push(`    hsync_front_porch: 10`);
  lines.push(`    hsync_back_porch: 20`);
  lines.push(`    vsync_pulse_width: 8`);
  lines.push(`    vsync_front_porch: 10`);
  lines.push(`    vsync_back_porch: 10`);
  lines.push(`    update_interval: never`);
  lines.push(`    auto_clear_enabled: false`);
  lines.push(`    init_sequence:`);
  lines.push(`      # PAGE0`);
  lines.push(`      - [0xFF, 0x77, 0x01, 0x00, 0x00, 0x10]`);
  lines.push(`      - [0xC0, 0x3B, 0x00]`);
  lines.push(`      - [0xC1, 0x0D, 0x02]`);
  lines.push(`      - [0xC2, 0x31, 0x05]`);
  lines.push(`      - [0xCD, 0x00]`);
  lines.push(`      # Positive Voltage Gamma`);
  lines.push(`      - [0xB0, 0x00, 0x11, 0x18, 0x0E, 0x11, 0x06, 0x07, 0x08, 0x07, 0x22, 0x04, 0x12, 0x0F, 0xAA, 0x31, 0x18]`);
  lines.push(`      # Negative Voltage Gamma`);
  lines.push(`      - [0xB1, 0x00, 0x11, 0x19, 0x0E, 0x12, 0x07, 0x08, 0x08, 0x08, 0x22, 0x04, 0x11, 0x11, 0xA9, 0x32, 0x18]`);
  lines.push(`      # PAGE1`);
  lines.push(`      - [0xFF, 0x77, 0x01, 0x00, 0x00, 0x11]`);
  lines.push(`      - [0xB0, 0x60]`);
  lines.push(`      - [0xB1, 0x32]`);
  lines.push(`      - [0xB2, 0x07]`);
  lines.push(`      - [0xB3, 0x80]`);
  lines.push(`      - [0xB5, 0x49]`);
  lines.push(`      - [0xB7, 0x85]`);
  lines.push(`      - [0xB8, 0x21]`);
  lines.push(`      - [0xC1, 0x78]`);
  lines.push(`      - [0xC2, 0x78]`);
  lines.push(`      - [0xE0, 0x00, 0x1B, 0x02]`);
  lines.push(`      - [0xE1, 0x08, 0xA0, 0x00, 0x00, 0x07, 0xA0, 0x00, 0x00, 0x00, 0x44, 0x44]`);
  lines.push(`      - [0xE2, 0x11, 0x11, 0x44, 0x44, 0xED, 0xA0, 0x00, 0x00, 0xEC, 0xA0, 0x00, 0x00]`);
  lines.push(`      - [0xE3, 0x00, 0x00, 0x11, 0x11]`);
  lines.push(`      - [0xE4, 0x44, 0x44]`);
  lines.push(`      - [0xE5, 0x0A, 0xE9, 0xD8, 0xA0, 0x0C, 0xEB, 0xD8, 0xA0, 0x0E, 0xED, 0xD8, 0xA0, 0x10, 0xEF, 0xD8, 0xA0]`);
  lines.push(`      - [0xE6, 0x00, 0x00, 0x11, 0x11]`);
  lines.push(`      - [0xE7, 0x44, 0x44]`);
  lines.push(`      - [0xE8, 0x09, 0xE8, 0xD8, 0xA0, 0x0B, 0xEA, 0xD8, 0xA0, 0x0D, 0xEC, 0xD8, 0xA0, 0x0F, 0xEE, 0xD8, 0xA0]`);
  lines.push(`      - [0xEB, 0x02, 0x00, 0xE4, 0xE4, 0x88, 0x00, 0x40]`);
  lines.push(`      - [0xEC, 0x3C, 0x00]`);
  lines.push(`      - [0xED, 0xAB, 0x89, 0x76, 0x54, 0x02, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x20, 0x45, 0x67, 0x98, 0xBA]`);
  lines.push(`      # VAP & VAN`);
  lines.push(`      - [0xFF, 0x77, 0x01, 0x00, 0x00, 0x13]`);
  lines.push(`      - [0xE5, 0xE4]`);
  lines.push(`      # PAGE0`);
  lines.push(`      - [0xFF, 0x77, 0x01, 0x00, 0x00, 0x00]`);
  lines.push(`      - [0x3A, 0x60]  # RGB666`);
  lines.push(`      - delay 10ms`);
  lines.push(`      - [0x11]  # Sleep Out`);
  lines.push(`      - delay 120ms`);
  lines.push(`      - [0x29]  # Display On`);
  lines.push(`    data_pins:`);
  lines.push(`      red: [11, 12, 13, 14, 0]`);
  lines.push(`      green: [8, 20, 3, 46, 9, 10]`);
  lines.push(`      blue: [4, 5, 6, 7, 15]`);
  lines.push(``);

  // Globals for swipe detection and toggle button loading states
  lines.push(`globals:`);
  // Touch tracking for swipe gestures
  lines.push(`  - id: touch_start_x`);
  lines.push(`    type: int`);
  lines.push(`    initial_value: "0"`);
  lines.push(`  - id: touch_last_x`);
  lines.push(`    type: int`);
  lines.push(`    initial_value: "0"`);
  // Detail view navigation state
  if (hasDetailViews) {
    lines.push(`  - id: detail_view_active`);
    lines.push(`    type: bool`);
    lines.push(`    initial_value: "false"`);
    lines.push(`  - id: return_page`);
    lines.push(`    type: int`);
    lines.push(`    initial_value: "0"`);
  }
  // Toggle button loading states
  for (const tb of toggleButtons) {
    lines.push(`  - id: ${tb.widgetId}_loading`);
    lines.push(`    type: bool`);
    lines.push(`    initial_value: "false"`);
  }
  lines.push(``);

  // WiFi — credentials configured via the device's own AP/captive portal
  lines.push(`wifi:`);
  lines.push(`  ap:`);
  lines.push(`    ssid: "\${device_name}"`);
  lines.push(``);

  // Captive portal for WiFi setup
  lines.push(`captive_portal:`);
  lines.push(``);

  // Improv WiFi for easy provisioning via BLE
  lines.push(`esp32_improv:`);
  lines.push(`  authorizer: none`);
  lines.push(``);

  // Logger
  lines.push(`logger:`);
  lines.push(``);

  // API
  lines.push(`api:`);
  lines.push(`  reboot_timeout: 15min`);
  lines.push(``);

  // OTA — local ESPHome OTA + HTTP request for remote updates
  lines.push(`ota:`);
  lines.push(`  - platform: esphome`);
  lines.push(`  - platform: http_request`);
  lines.push(``);

  // HTTP request component (required by http_request OTA)
  lines.push(`http_request:`);
  lines.push(``);

  // Update entity — exposed to Home Assistant with "Install" button
  lines.push(`update:`);
  lines.push(`  - platform: http_request`);
  lines.push(`    name: Firmware`);
  lines.push(`    source: !secret firmware_update_url`);
  lines.push(``);

  // Time
  lines.push(`time:`);
  lines.push(`  - platform: sntp`);
  lines.push(`    id: sntp_time`);
  lines.push(``);

  // BLE
  lines.push(`esp32_ble_tracker:`);
  lines.push(`  scan_parameters:`);
  lines.push(`    active: true`);
  lines.push(``);
  lines.push(`bluetooth_proxy:`);
  lines.push(`  active: true`);
  lines.push(``);

  // Custom fonts + Icon fonts
  const icons = extractAllIcons(project);
  const hasCustomFonts = project.fonts && project.fonts.length > 0;
  const iconFontLines = icons.size > 0 ? generateIconFontYAML(icons, 24) : [];
  const hasIconFont = iconFontLines.length > 0;
  
  if (hasCustomFonts || hasIconFont) {
    lines.push(`font:`);
    
    // Custom fonts from project
    if (hasCustomFonts) {
      for (const font of project.fonts!) {
        lines.push(`  - file: "${font.file}"`);
        lines.push(`    id: ${font.id}`);
        lines.push(`    size: ${font.size}`);
      }
    }
    
    // Icon font with used glyphs
    if (hasIconFont) {
      lines.push(...iconFontLines);
    }
    
    lines.push(``);
  }

  // --- Sensors with LVGL widget updates ---
  const numericBindings = sensorBindings.filter(
    (b) => b.sensorType === "numeric",
  );
  const textBindings = sensorBindings.filter(
    (b) => b.sensorType === "text",
  );
  const binaryBindings = sensorBindings.filter(
    (b) => b.sensorType === "binary",
  );

  const sensorKey = (b: SensorBinding) =>
    b.attribute ? `${b.entityId}__${b.attribute}` : b.entityId;
  const sensorIdForBinding = (b: SensorBinding) =>
    b.attribute
      ? sensorId(b.entityId) + "_" + b.attribute.replace(/[^a-zA-Z0-9]/g, "_")
      : sensorId(b.entityId);

  // Create a set of entity IDs used in conditions for quick lookup
  const conditionEntitySet = new Set(conditionEntityIds);
  
  // Find condition entities that aren't already tracked as sensors
  const existingEntityIds = new Set(sensorBindings.map(b => b.entityId));
  const additionalConditionEntities = conditionalAreas.length > 0 
    ? conditionEntityIds.filter(id => !existingEntityIds.has(id))
    : [];
  
  // Group additional condition entities by sensor type
  const additionalNumeric = additionalConditionEntities.filter(isNumericDomain);
  const additionalBinary = additionalConditionEntities.filter(isBinaryDomain);
  const additionalText = additionalConditionEntities.filter(
    id => !isNumericDomain(id) && !isBinaryDomain(id)
  );

  // Generate sensor section (combining bindings + condition-only entities)
  if (numericBindings.length > 0 || additionalNumeric.length > 0) {
    lines.push(`sensor:`);
    
    // First, binding-based sensors
    const byEntity = groupBy(numericBindings, sensorKey);
    for (const [, bindings] of byEntity) {
      const first = bindings[0];
      lines.push(`  - platform: homeassistant`);
      lines.push(`    id: ${sensorIdForBinding(first)}`);
      lines.push(`    entity_id: ${first.entityId}`);
      if (first.attribute) {
        lines.push(`    attribute: ${first.attribute}`);
      }
      lines.push(`    on_value:`);
      for (const b of bindings) {
        lines.push(...generateSensorUpdateLines(b));
      }
      // Also trigger conditional area update if this entity is used in conditions
      if (conditionalAreas.length > 0 && conditionEntitySet.has(first.entityId)) {
        lines.push(`      - script.execute: update_conditional_areas`);
      }
    }
    
    // Then, condition-only sensors (no widget bindings)
    for (const entityId of additionalNumeric) {
      lines.push(`  - platform: homeassistant`);
      lines.push(`    id: ${sensorId(entityId)}`);
      lines.push(`    entity_id: ${entityId}`);
      lines.push(`    on_value:`);
      lines.push(`      - script.execute: update_conditional_areas`);
    }
    
    lines.push(``);
  }

  // Generate text_sensor section (combining bindings + condition-only entities)
  if (textBindings.length > 0 || additionalText.length > 0) {
    lines.push(`text_sensor:`);
    
    // First, binding-based sensors
    const byEntity = groupBy(textBindings, sensorKey);
    for (const [, bindings] of byEntity) {
      const first = bindings[0];
      lines.push(`  - platform: homeassistant`);
      lines.push(`    id: ${sensorIdForBinding(first)}`);
      lines.push(`    entity_id: ${first.entityId}`);
      if (first.attribute) {
        lines.push(`    attribute: ${first.attribute}`);
      }
      lines.push(`    on_value:`);
      for (const b of bindings) {
        lines.push(...generateSensorUpdateLines(b));
      }
      // Also trigger conditional area update if this entity is used in conditions
      if (conditionalAreas.length > 0 && conditionEntitySet.has(first.entityId)) {
        lines.push(`      - script.execute: update_conditional_areas`);
      }
    }
    
    // Then, condition-only sensors (no widget bindings)
    for (const entityId of additionalText) {
      lines.push(`  - platform: homeassistant`);
      lines.push(`    id: ${sensorId(entityId)}`);
      lines.push(`    entity_id: ${entityId}`);
      lines.push(`    on_value:`);
      lines.push(`      - script.execute: update_conditional_areas`);
    }
    
    lines.push(``);
  }

  // Generate binary_sensor section (combining bindings + condition-only entities)
  if (binaryBindings.length > 0 || additionalBinary.length > 0) {
    lines.push(`binary_sensor:`);
    
    // First, binding-based sensors
    const byEntity = groupBy(binaryBindings, sensorKey);
    for (const [, bindings] of byEntity) {
      const first = bindings[0];
      lines.push(`  - platform: homeassistant`);
      lines.push(`    id: ${sensorIdForBinding(first)}`);
      lines.push(`    entity_id: ${first.entityId}`);
      if (first.attribute) {
        lines.push(`    attribute: ${first.attribute}`);
      }
      lines.push(`    on_state:`);
      for (const b of bindings) {
        lines.push(...generateSensorUpdateLines(b));
        // Hide spinner for toggle buttons when state arrives
        const toggleBtn = toggleButtons.find((tb) => tb.entityId === b.entityId);
        if (toggleBtn) {
          lines.push(`      - globals.set:`);
          lines.push(`          id: ${toggleBtn.widgetId}_loading`);
          lines.push(`          value: "false"`);
          lines.push(`      - lvgl.widget.hide: ${toggleBtn.spinnerId}`);
        }
      }
      // Also trigger conditional area update if this entity is used in conditions
      if (conditionalAreas.length > 0 && conditionEntitySet.has(first.entityId)) {
        lines.push(`      - script.execute: update_conditional_areas`);
      }
    }
    
    // Then, condition-only sensors (no widget bindings)
    for (const entityId of additionalBinary) {
      lines.push(`  - platform: homeassistant`);
      lines.push(`    id: ${sensorId(entityId)}`);
      lines.push(`    entity_id: ${entityId}`);
      lines.push(`    on_state:`);
      lines.push(`      - script.execute: update_conditional_areas`);
    }
    
    lines.push(``);
  }

  // --- Scripts for service call actions and conditional areas ---
  const hasScripts = scriptActions.length > 0 || conditionalAreas.length > 0;
  if (hasScripts) {
    lines.push(`script:`);
    
    // Conditional area update script
    if (conditionalAreas.length > 0) {
      lines.push(`  - id: update_conditional_areas`);
      lines.push(`    then:`);
      lines.push(`      - lambda: |-`);
      
      // Generate C++ code to evaluate conditions and show/hide variants
      for (const area of conditionalAreas) {
        lines.push(`          // Conditional area: ${area.componentId}`);
        
        // Find the first matching variant (by priority/order)
        let firstCondition = true;
        for (const variant of area.variants) {
          if (variant.condition) {
            const condExpr = generateConditionExpression(variant.condition);
            if (firstCondition) {
              lines.push(`          if ${condExpr} {`);
              firstCondition = false;
            } else {
              lines.push(`          } else if ${condExpr} {`);
            }
            // Show this variant, hide others
            for (const v of area.variants) {
              if (v.objId === variant.objId) {
                lines.push(`            lv_obj_clear_flag(id(${v.objId}), LV_OBJ_FLAG_HIDDEN);`);
              } else {
                lines.push(`            lv_obj_add_flag(id(${v.objId}), LV_OBJ_FLAG_HIDDEN);`);
              }
            }
          }
        }
        
        // Handle default variant (else case)
        const defaultVariant = area.variants.find(v => v.isDefault);
        if (defaultVariant) {
          if (!firstCondition) {
            lines.push(`          } else {`);
          }
          for (const v of area.variants) {
            if (v.objId === defaultVariant.objId) {
              lines.push(`            lv_obj_clear_flag(id(${v.objId}), LV_OBJ_FLAG_HIDDEN);`);
            } else {
              lines.push(`            lv_obj_add_flag(id(${v.objId}), LV_OBJ_FLAG_HIDDEN);`);
            }
          }
          if (!firstCondition) {
            lines.push(`          }`);
          }
        } else if (!firstCondition) {
          lines.push(`          }`);
        }
      }
    }
    
    // Service call action scripts
    for (const action of scriptActions) {
      // Check if this script is for a toggle button (needs loading indicator)
      const toggleBtn = toggleButtons.find((tb) => tb.scriptId === action.id);
      lines.push(`  - id: ${action.id}`);
      lines.push(`    then:`);
      if (toggleBtn) {
        // Show loading spinner before service call
        lines.push(`      - globals.set:`);
        lines.push(`          id: ${toggleBtn.widgetId}_loading`);
        lines.push(`          value: "true"`);
        lines.push(`      - lvgl.widget.show: ${toggleBtn.spinnerId}`);
      }
      lines.push(`      - homeassistant.service:`);
      lines.push(`          service: ${action.service}`);
      if (action.targetEntityId) {
        lines.push(`          data:`);
        lines.push(`            entity_id: ${action.targetEntityId}`);
      }
    }
    lines.push(``);
  }

  // --- LVGL pages with widgets ---
  lines.push(`lvgl:`);
  lines.push(`  id: my_lvgl`);
  lines.push(`  touchscreens:`);
  lines.push(`    - touch_gt911`);
  lines.push(`  page_wrap: true`);
  
  // Add theme based on project theme
  const theme = project.theme ?? RETRO_THEME;
  lines.push(...generateLvglTheme(theme));
  
  lines.push(`  pages:`);

  // Dashboard pages
  for (let i = 0; i < project.dashboardPages.length; i++) {
    const page = project.dashboardPages[i];
    lines.push(`    # ${page.name}`);
    lines.push(`    - id: page_${i}`);
    // Always set background color - use page color or theme background
    const pageBgColor = page.backgroundColor ?? theme.colors.background;
    lines.push(`      bg_color: ${colorToHex(pageBgColor)}`);

    if (page.components.length > 0) {
      lines.push(`      widgets:`);
      const ctx: PageContext = { pageIndex: i, hasDetailViews };
      for (const comp of page.components) {
        lines.push(...generateWidgetLines(comp, 4, ctx));
      }
    }
  }

  // Detail views as pages (skipped in normal navigation)
  if (project.detailViews && project.detailViews.length > 0) {
    for (const view of project.detailViews) {
      const detailId = `detail_${view.id.toLowerCase()}`;
      const displayHeight = project.display?.height ?? 480;
      
      lines.push(`    # Detail: ${view.title}`);
      lines.push(`    - id: ${detailId}`);
      lines.push(`      skip: true`);
      lines.push(`      bg_color: ${colorToHex(theme.colors.background)}`);
      lines.push(`      widgets:`);
      
      // Header with title and back button
      lines.push(`        - obj:`);
      lines.push(`            width: 100%`);
      lines.push(`            height: ${view.headerHeight ?? 45}`);
      lines.push(`            bg_color: ${colorToHex(theme.colors.backgroundSecondary ?? theme.colors.background)}`);
      lines.push(`            pad_left: 10`);
      lines.push(`            pad_right: 10`);
      lines.push(`            layout:`);
      lines.push(`              type: flex`);
      lines.push(`              flex_flow: ROW`);
      lines.push(`              flex_align_main: SPACE_BETWEEN`);
      lines.push(`              flex_align_cross: CENTER`);
      lines.push(`            widgets:`);
      
      // Back button
      lines.push(`              - button:`);
      lines.push(`                  id: ${detailId}_back`);
      lines.push(`                  width: 40`);
      lines.push(`                  height: 35`);
      lines.push(`                  on_click:`);
      lines.push(`                    - globals.set:`);
      lines.push(`                        id: detail_view_active`);
      lines.push(`                        value: "false"`);
      lines.push(`                    - lambda: |-`);
      lines.push(`                        id(my_lvgl)->show_page(id(return_page), LV_SCR_LOAD_ANIM_MOVE_RIGHT, 300);`);
      lines.push(`                  widgets:`);
      lines.push(`                    - label:`);
      lines.push(`                        text: "<"`);
      lines.push(`                        align: CENTER`);
      lines.push(`                        text_color: ${colorToHex(theme.colors.foreground)}`);
      
      // Title
      lines.push(`              - label:`);
      lines.push(`                  text: "${view.title}"`);
      lines.push(`                  text_color: ${colorToHex(theme.colors.foreground)}`);
      lines.push(`                  text_font: montserrat_24`);
      
      // Spacer for centering title
      lines.push(`              - obj:`);
      lines.push(`                  width: 40`);
      lines.push(`                  height: 1`);
      lines.push(`                  bg_opa: 0`);
      
      // Content area
      if (view.components.length > 0) {
        lines.push(`        - obj:`);
        lines.push(`            y: ${view.headerHeight ?? 45}`);
        lines.push(`            width: 100%`);
        lines.push(`            height: ${displayHeight - (view.headerHeight ?? 45)}`);
        lines.push(`            bg_opa: 0`);
        lines.push(`            scrollbar_mode: auto`);
        lines.push(`            pad_all: 10`);
        lines.push(`            widgets:`);
        const detailCtx: PageContext = { pageIndex: -1, hasDetailViews };
        for (const comp of view.components) {
          lines.push(...generateWidgetLines(comp, 6, detailCtx)); // Indent appropriately for page widgets
        }
      }
    }
  }

  return lines.join("\n");
}

// --- Utility functions ---

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const arr = map.get(k) || [];
    arr.push(item);
    map.set(k, arr);
  }
  return map;
}

function extractAllIcons(project: Project): Set<string> {
  const icons = new Set<string>();
  const processComponents = (components: Component[]) => {
    for (const comp of components) {
      if ("icon" in comp && comp.icon) icons.add(comp.icon as string);
      if (comp.type === "conditional_area") {
        for (const variant of (comp as any).variants) {
          processComponents(variant.components);
        }
      }
    }
  };
  for (const page of project.dashboardPages || [])
    processComponents(page.components);
  for (const view of project.detailViews || [])
    processComponents(view.components);
  return icons;
}

function iconToId(icon: string): string {
  return (
    "icon_" +
    icon
      .replace(/^mdi:/, "")
      .replace(/^mdil:/, "")
      .replace(/^memory:/, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
  );
}

function entityToId(entity: string): string {
  return "ha_" + entity.replace(/\./g, "_");
}

export { entityToId };
