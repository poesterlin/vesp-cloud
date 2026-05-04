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
  TodoListComponent,
  ConditionalAreaComponent,
  TabContainerComponent,
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

function scriptId(service: string, targetEntity?: string, targetDevice?: string): string {
  const base = service.replace(/\./g, "_");
  if (targetEntity) return `script_${base}_${targetEntity.replace(/\./g, "_")}`;
  if (targetDevice) return `script_${base}_${targetDevice.replace(/[^a-zA-Z0-9]/g, "_")}`;
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
  lines.push(`      shadow_width: 0`);
  lines.push(`      shadow_ofs_x: 0`);
  lines.push(`      shadow_ofs_y: 0`);
  lines.push(`      shadow_opa: TRANSP`);
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
  widgetType: "label" | "arc" | "slider" | "button" | "todo_list";
  unit?: string;
  maxItems?: number;
  listWidth?: number;
}

interface ScriptAction {
  id: string;
  service: string;
  targetEntityId?: string;
  targetDeviceId?: string;
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

interface TabContainerInfo {
  containerId: string;
  componentId: string;
  defaultTabId?: string;
  tabs: {
    tabId: string;
    objId: string;
    buttonId: string;
    isDefault: boolean;
  }[];
}

interface AutoLayoutListInfo {
  listId: string;
  componentId: string;
  direction: "horizontal" | "vertical";
  gap: number;
  padding: number;
  crossAxisAlign: "start" | "center" | "end" | "stretch";
  mainAxisJustify: "start" | "center" | "end" | "space_between";
  itemSizeMode: "content" | "fixed";
  itemWidth?: number;
  itemHeight?: number;
  items: {
    itemId: string;
    containerId: string;
    condition?: Condition;
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
  const tabContainers: TabContainerInfo[] = [];
  const autoLayoutLists: AutoLayoutListInfo[] = [];
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

    if (comp.type === "todo_list" && comp.itemsBinding) {
      sensorBindings.push({
        entityId: comp.itemsBinding.entityId,
        attribute: comp.itemsBinding.attribute ?? "all_items",
        widgetId: wId,
        sensorType: "text",
        widgetType: "todo_list",
        maxItems: Math.max(1, Math.min(10, comp.maxItems ?? 4)),
        listWidth: comp.size?.width ?? 220,
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
          tapAction.target?.deviceId,
        );
        if (!scriptActions.has(sId)) {
          scriptActions.set(sId, {
            id: sId,
            service: tapAction.service,
            targetEntityId: tapAction.target?.entityId,
            targetDeviceId: tapAction.target?.deviceId,
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
          holdAction.target?.deviceId,
        );
        if (!scriptActions.has(sId)) {
          scriptActions.set(sId, {
            id: sId,
            service: holdAction.service,
            targetEntityId: holdAction.target?.entityId,
            targetDeviceId: holdAction.target?.deviceId,
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

    if (comp.type === "tab_container") {
      const containerId = wId;
      const containerInfo: TabContainerInfo = {
        containerId,
        componentId: comp.id,
        defaultTabId: comp.defaultTabId,
        tabs: [],
      };

      for (let ti = 0; ti < comp.tabs.length; ti++) {
        const tab = comp.tabs[ti];
        const tabObjId = `${containerId}_t${ti}`;
        const isDefault = tab.id === comp.defaultTabId || (!comp.defaultTabId && ti === 0);

        containerInfo.tabs.push({
          tabId: tab.id,
          objId: tabObjId,
          buttonId: `${containerId}_btn_t${ti}`,
          isDefault,
        });

        for (const child of tab.components) {
          processComponent(child);
        }
      }

      tabContainers.push(containerInfo);
    }

    if ((comp as any).type === "auto_layout_list") {
      const autoLayoutComp = comp as any;
      const listInfo: AutoLayoutListInfo = {
        listId: wId,
        componentId: autoLayoutComp.id,
        direction: autoLayoutComp.direction ?? "horizontal",
        gap: Math.max(0, autoLayoutComp.gap ?? 6),
        padding: Math.max(0, autoLayoutComp.padding ?? 0),
        crossAxisAlign: autoLayoutComp.crossAxisAlign ?? "center",
        mainAxisJustify: autoLayoutComp.mainAxisJustify ?? "start",
        itemSizeMode: autoLayoutComp.itemSizeMode ?? "content",
        itemWidth: autoLayoutComp.itemWidth,
        itemHeight: autoLayoutComp.itemHeight,
        items: [],
      };

      for (let li = 0; li < autoLayoutComp.items.length; li++) {
        const item = autoLayoutComp.items[li];
        const containerId = `${wId}_item_${li}`;
        listInfo.items.push({
          itemId: item.id,
          containerId,
          condition: item.condition,
        });

        if (item.condition) {
          for (const entityId of extractConditionEntities(item.condition)) {
            conditionEntityIds.add(entityId);
          }
        }
      }

      autoLayoutLists.push(listInfo);
    }
  };

  // Process page header components (shared across all dashboard pages)
  if (project.pageHeader) {
    for (const comp of project.pageHeader.components) processComponent(comp);
  }

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
    tabContainers,
    autoLayoutLists,
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
  if ((comp as any).type === "auto_layout_list") {
    return generateAutoLayoutListWidget(comp as any, level);
  }

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
    case "todo_list":
      return generateTodoListWidget(comp as TodoListComponent, level);
    case "conditional_area":
      return generateConditionalAreaWidget(comp as ConditionalAreaComponent, level, ctx);
    case "tab_container":
      return generateTabContainerWidget(comp as TabContainerComponent, level, ctx);
    default:
      return [];
  }
}

function generateAutoLayoutListWidget(comp: any, level: number): string[] {
  const lines: string[] = [];
  const i = ind(level);
  const listId = widgetId(comp.id);
  const width = comp.size?.width ?? 140;
  const height = comp.size?.height ?? 32;
  const direction = comp.direction ?? "horizontal";
  const gap = Math.max(0, comp.gap ?? 6);
  const padding = Math.max(0, comp.padding ?? 0);
  const crossAxisAlign = comp.crossAxisAlign ?? "center";
  const mainAxisJustify = comp.mainAxisJustify ?? "start";
  const itemSizeMode = comp.itemSizeMode ?? "content";
  const itemWidth = Math.max(1, comp.itemWidth ?? 24);
  const itemHeight = Math.max(1, comp.itemHeight ?? 24);

  lines.push(`${i}- obj:`);
  lines.push(`${i}    id: ${listId}`);
  lines.push(`${i}    x: ${comp.position.x}`);
  lines.push(`${i}    y: ${comp.position.y}`);
  lines.push(`${i}    width: ${width}`);
  lines.push(`${i}    height: ${height}`);
  lines.push(`${i}    bg_opa: 0`);
  lines.push(`${i}    border_width: 0`);
  lines.push(`${i}    pad_all: ${padding}`);
  lines.push(`${i}    layout:`);
  lines.push(`${i}      type: flex`);
  lines.push(`${i}      flex_flow: ${direction === "horizontal" ? "ROW" : "COLUMN"}`);
  lines.push(`${i}      pad_row: ${gap}`);
  lines.push(`${i}      pad_column: ${gap}`);
  lines.push(`${i}      flex_align_main: ${autoLayoutMainToLvgl(mainAxisJustify)}`);
  lines.push(`${i}      flex_align_cross: ${autoLayoutCrossToLvgl(crossAxisAlign)}`);
  lines.push(`${i}    widgets:`);

  for (let index = 0; index < comp.items.length; index++) {
    const item = comp.items[index];
    const itemId = `${listId}_item_${index}`;
    const iconCodepoint = item.icon ? getMdiCodepoint(item.icon) : undefined;
    const iconColor = item.color ? colorToHex(item.color) : "0xFFFFFF";

    lines.push(`${i}      - obj:`);
    lines.push(`${i}          id: ${itemId}`);
    lines.push(`${i}          bg_opa: 0`);
    lines.push(`${i}          border_width: 0`);
    if (itemSizeMode === "fixed") {
      lines.push(`${i}          width: ${itemWidth}`);
      lines.push(`${i}          height: ${itemHeight}`);
    }
    lines.push(`${i}          widgets:`);
    lines.push(`${i}            - label:`);
    lines.push(`${i}                text: "${iconCodepoint ?? item.icon ?? "?"}"`);
    lines.push(`${i}                align: CENTER`);
    lines.push(`${i}                text_color: ${iconColor}`);
    if (iconCodepoint) {
      lines.push(`${i}                text_font: mdi_icons_24`);
    } else {
      lines.push(`${i}                text_font: montserrat_14`);
    }
  }

  return lines;
}

function autoLayoutMainToLvgl(value: "start" | "center" | "end" | "space_between"): string {
  if (value === "center") return "CENTER";
  if (value === "end") return "END";
  if (value === "space_between") return "SPACE_BETWEEN";
  return "START";
}

function autoLayoutCrossToLvgl(value: "start" | "center" | "end" | "stretch"): string {
  if (value === "center") return "CENTER";
  if (value === "end") return "END";
  if (value === "stretch") return "STRETCH";
  return "START";
}

function todoRowWidgetId(listWidgetId: string, rowIndex: number, part: "cb" | "summary" | "due"): string {
  return `${listWidgetId}_r${rowIndex}_${part}`;
}

function generateTodoListWidget(comp: TodoListComponent, level: number): string[] {
  const lines: string[] = [];
  const i = ind(level);
  const wId = widgetId(comp.id);
  const width = comp.size?.width ?? 220;
  const height = comp.size?.height ?? 140;
  const maxItems = Math.max(1, Math.min(10, comp.maxItems ?? 4));
  const rowHeight = Math.max(20, Math.min(80, comp.rowHeight ?? 30));
  const dueWidth = 78;
  const summaryX = 30;
  const summaryWidth = Math.max(40, width - summaryX - dueWidth - 8);
  const summaryWidthNoDue = Math.max(40, width - summaryX - 4);
  const dueX = width - dueWidth - 4;

  lines.push(`${i}- obj:`);
  lines.push(`${i}    id: ${wId}`);
  lines.push(`${i}    x: ${comp.position.x}`);
  lines.push(`${i}    y: ${comp.position.y}`);
  lines.push(`${i}    width: ${width}`);
  lines.push(`${i}    height: ${height}`);
  lines.push(`${i}    bg_color: 0x000000`);
  lines.push(`${i}    bg_opa: 100%`);
  lines.push(`${i}    border_color: 0x3A3A3A`);
  lines.push(`${i}    border_width: 1`);
  lines.push(`${i}    pad_all: 2`);
  lines.push(`${i}    radius: 4`);
  lines.push(`${i}    scrollbar_mode: "OFF"`);
  lines.push(...generateBaseStyleLines(comp, i));
  lines.push(`${i}    widgets:`);

  for (let row = 0; row < maxItems; row++) {
    const rowY = row * rowHeight;
    const cbId = todoRowWidgetId(wId, row, "cb");
    const summaryId = todoRowWidgetId(wId, row, "summary");
    const dueId = todoRowWidgetId(wId, row, "due");

    lines.push(`${i}      - obj:`);
    lines.push(`${i}          x: 0`);
    lines.push(`${i}          y: ${rowY}`);
    lines.push(`${i}          width: 100%`);
    lines.push(`${i}          height: ${rowHeight}`);
    lines.push(`${i}          bg_opa: 0`);
    lines.push(`${i}          border_width: 0`);
    lines.push(`${i}          scrollbar_mode: "OFF"`);
    lines.push(`${i}          widgets:`);

    lines.push(`${i}            - label:`);
    lines.push(`${i}                id: ${cbId}`);
    lines.push(`${i}                x: 4`);
    lines.push(`${i}                y: 6`);
    lines.push(`${i}                text: ""`);
    lines.push(`${i}                text_font: montserrat_14`);
    lines.push(`${i}                text_color: 0x86D37F`);

    lines.push(`${i}            - label:`);
    lines.push(`${i}                id: ${summaryId}`);
    lines.push(`${i}                x: ${summaryX}`);
    lines.push(`${i}                y: 6`);
    lines.push(`${i}                width: ${summaryWidth}`);
    lines.push(`${i}                text: ""`);
    lines.push(`${i}                long_mode: SCROLL`);
    lines.push(`${i}                anim_time: 7000ms`);
    lines.push(`${i}                text_font: montserrat_14`);
    lines.push(`${i}                text_color: 0xFFFFFF`);

    lines.push(`${i}            - label:`);
    lines.push(`${i}                id: ${dueId}`);
    lines.push(`${i}                x: ${dueX}`);
    lines.push(`${i}                y: 6`);
    lines.push(`${i}                width: ${dueWidth}`);
    lines.push(`${i}                text: ""`);
    lines.push(`${i}                text_align: RIGHT`);
    lines.push(`${i}                text_font: montserrat_12`);
    lines.push(`${i}                text_color: 0xFFC857`);
    lines.push(`${i}                hidden: true`);
  }

  return lines;
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
      tapAction.target?.deviceId,
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
      lines.push(`${i}          id(my_lvgl)->show_page(id(return_page), LV_SCR_LOAD_ANIM_NONE, 0);`);
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
    const targetDeviceId = comp.onChange.target?.deviceId;
    // on_change fires only on user interaction (not programmatic updates),
    // avoiding feedback loops when the slider also has a valueBinding
    lines.push(`${i}    on_change:`);
    const actionLog = targetEntityId
      ? `Calling HA action: ${service} (${targetEntityId})`
      : targetDeviceId
      ? `Calling HA action: ${service} (device: ${targetDeviceId})`
      : `Calling HA action: ${service}`;
    lines.push(`${i}      - logger.log: "${actionLog}"`);
    lines.push(`${i}      - homeassistant.action:`);
    lines.push(`${i}          action: ${service}`);
    if (targetEntityId || targetDeviceId) {
      lines.push(`${i}          data:`);
      if (targetEntityId) {
        lines.push(`${i}            entity_id: ${targetEntityId}`);
      }
      if (targetDeviceId) {
        lines.push(`${i}            device_id: ${targetDeviceId}`);
      }
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
  lines.push(`${i}    scrollbar_mode: "OFF"`);
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

function generateTabContainerWidget(
  comp: TabContainerComponent,
  level: number,
  ctx?: PageContext,
): string[] {
  const lines: string[] = [];
  const i = ind(level);
  const containerId = widgetId(comp.id);
  const tabsHeaderHeight = 22;
  const width = comp.size?.width ?? 150;
  const height = comp.size?.height ?? 100;

  lines.push(`${i}- obj:`);
  lines.push(`${i}    id: ${containerId}`);
  lines.push(`${i}    x: ${comp.position.x}`);
  lines.push(`${i}    y: ${comp.position.y}`);
  lines.push(`${i}    width: ${width}`);
  lines.push(`${i}    height: ${height}`);
  lines.push(`${i}    bg_color: 0x1E2630`);
  lines.push(`${i}    bg_opa: 45%`);
  lines.push(`${i}    border_color: 0x3D4B5A`);
  lines.push(`${i}    border_width: 1`);
  lines.push(`${i}    radius: 4`);
  lines.push(`${i}    pad_all: 0`);
  lines.push(...generateBaseStyleLines(comp, i));
  lines.push(`${i}    widgets:`);

  lines.push(`${i}      - obj:`);
  lines.push(`${i}          width: 100%`);
  lines.push(`${i}          height: ${tabsHeaderHeight}`);
  lines.push(`${i}          bg_color: 0x151C24`);
  lines.push(`${i}          bg_opa: 80%`);
  lines.push(`${i}          border_width: 0`);
  lines.push(`${i}          pad_all: 2`);
  lines.push(`${i}          layout:`);
  lines.push(`${i}            type: flex`);
  lines.push(`${i}            flex_flow: ROW`);
  lines.push(`${i}            flex_align_main: START`);
  lines.push(`${i}            flex_align_cross: CENTER`);
  lines.push(`${i}          widgets:`);

  for (let ti = 0; ti < comp.tabs.length; ti++) {
    const tab = comp.tabs[ti];
    const isDefault = tab.id === comp.defaultTabId || (!comp.defaultTabId && ti === 0);
    const tabBtnId = `${containerId}_btn_t${ti}`;
    lines.push(`${i}            - button:`);
    lines.push(`${i}                id: ${tabBtnId}`);
    lines.push(`${i}                width: SIZE_CONTENT`);
    lines.push(`${i}                height: 18`);
    lines.push(`${i}                bg_color: ${isDefault ? "0x4A9EFF" : "0x44505C"}`);
    lines.push(`${i}                bg_opa: 100%`);
    lines.push(`${i}                border_width: 0`);
    lines.push(`${i}                radius: 3`);
    lines.push(`${i}                pad_left: 8`);
    lines.push(`${i}                pad_right: 8`);
    lines.push(`${i}                on_click:`);
    lines.push(`${i}                  - script.execute: ${containerId}_show_t${ti}`);
    lines.push(`${i}                widgets:`);
    lines.push(`${i}                  - label:`);
    lines.push(`${i}                      text: "${tab.name}"`);
    lines.push(`${i}                      text_color: 0xFFFFFF`);
    lines.push(`${i}                      text_font: montserrat_12`);
  }

  lines.push(`${i}      - obj:`);
  lines.push(`${i}          y: ${tabsHeaderHeight}`);
  lines.push(`${i}          width: 100%`);
  lines.push(`${i}          height: ${Math.max(0, height - tabsHeaderHeight)}`);
  lines.push(`${i}          bg_opa: 0`);
  lines.push(`${i}          border_width: 0`);
  if (comp.clipContent !== false) {
    lines.push(`${i}          clip_corner: true`);
  }
  lines.push(`${i}          widgets:`);

  for (let ti = 0; ti < comp.tabs.length; ti++) {
    const tab = comp.tabs[ti];
    const tabObjId = `${containerId}_t${ti}`;
    const isDefault = tab.id === comp.defaultTabId || (!comp.defaultTabId && ti === 0);

    lines.push(`${i}            - obj:`);
    lines.push(`${i}                id: ${tabObjId}`);
    lines.push(`${i}                width: 100%`);
    lines.push(`${i}                height: 100%`);
    lines.push(`${i}                bg_opa: 0`);
    lines.push(`${i}                border_width: 0`);
    if (!isDefault) {
      lines.push(`${i}                hidden: true`);
    }

    if (tab.components.length > 0) {
      lines.push(`${i}                widgets:`);
      for (const child of tab.components) {
        lines.push(...generateWidgetLines(child, level + 8, ctx));
      }
    }
  }

  return lines;
}

function generatePageIndicatorWidgets(
  pageIndex: number,
  pageCount: number,
  level: number,
  theme: Theme,
  displayHeight: number,
): string[] {
  const lines: string[] = [];
  const i = ind(level);
  const activeColor = colorToHex(theme.colors.accent);
  const inactiveColor = colorToHex(theme.colors.foregroundMuted ?? { r: 128, g: 128, b: 128 });

  // Calculate indicator width: (dot_size * count) + (gap * (count-1))
  const dotSize = 6;
  const dotGap = 8;
  const indicatorWidth = dotSize * pageCount + dotGap * (pageCount - 1);

  lines.push(`${i}- obj:`);
  lines.push(`${i}    id: page_indicator_${pageIndex}`);
  lines.push(`${i}    align: TOP_MID`);
  lines.push(`${i}    y: ${Math.max(0, displayHeight - 14)}`);
  lines.push(`${i}    width: ${indicatorWidth}`);
  lines.push(`${i}    bg_opa: 0`);
  lines.push(`${i}    border_width: 0`);
  lines.push(`${i}    pad_all: 0`);
  lines.push(`${i}    layout:`);
  lines.push(`${i}      type: flex`);
  lines.push(`${i}      flex_flow: ROW`);
  lines.push(`${i}      flex_align_main: SPACE_BETWEEN`);
  lines.push(`${i}      flex_align_cross: CENTER`);
  lines.push(`${i}    widgets:`);

  for (let dot = 0; dot < pageCount; dot++) {
    lines.push(`${i}      - obj:`);
    lines.push(`${i}          width: ${dotSize}`);
    lines.push(`${i}          height: ${dotSize}`);
    lines.push(`${i}          radius: 3`);
    lines.push(`${i}          border_width: 0`);
    lines.push(`${i}          bg_color: ${dot === pageIndex ? activeColor : inactiveColor}`);
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
    case "todo_list": {
      const maxItems = Math.max(1, Math.min(10, binding.maxItems ?? 4));
      const dueNormalHex = "0xFFC857";
      const dueOverdueHex = "0xFF5555";
      const dueWidth = 78;
      const summaryX = 30;
      const listWidth = binding.listWidth ?? 220;
      const summaryWidth = Math.max(40, listWidth - summaryX - dueWidth - 8);
      const summaryWidthNoDue = Math.max(40, listWidth - summaryX - 4);

      lines.push(`      - lambda: |-`);
      lines.push(`          auto trim = [](std::string &s) {`);
      lines.push(`            const char *ws = " \\t\\r\\n";`);
      lines.push(`            size_t start = s.find_first_not_of(ws);`);
      lines.push(`            if (start == std::string::npos) {`);
      lines.push(`              s.clear();`);
      lines.push(`              return;`);
      lines.push(`            }`);
      lines.push(`            size_t end = s.find_last_not_of(ws);`);
      lines.push(`            s = s.substr(start, end - start + 1);`);
      lines.push(`          };`);
      lines.push(`          auto humanize_due = [](const std::string &raw_due) -> std::string {`);
      lines.push(`            std::string due = raw_due;`);
      lines.push(`            size_t t_pos = due.find('T');`);
      lines.push(`            if (t_pos != std::string::npos) {`);
      lines.push(`              due = due.substr(0, t_pos);`);
      lines.push(`            }`);
      lines.push(`            if (due.size() >= 10 && due[4] == '-' && due[7] == '-') {`);
      lines.push(`              int month = atoi(due.substr(5, 2).c_str());`);
      lines.push(`              int day = atoi(due.substr(8, 2).c_str());`);
      lines.push(`              static const char *months[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};`);
      lines.push(`              if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {`);
      lines.push(`                return std::string(months[month - 1]) + " " + std::to_string(day);`);
      lines.push(`              }`);
      lines.push(`            }`);
      lines.push(`            return due;`);
      lines.push(`          };`);
      lines.push(``);
      lines.push(`          std::string input = x;`);
      lines.push(`          std::string summaries[${maxItems}];`);
      lines.push(`          std::string dues[${maxItems}];`);
      lines.push(`          std::string statuses[${maxItems}];`);
      lines.push(`          int item_count = 0;`);
      lines.push(`          size_t cursor = 0;`);
      lines.push(``);
      lines.push(`          while (item_count < ${maxItems} && cursor != std::string::npos) {`);
      lines.push(`            size_t next = input.find('\\n', cursor);`);
      lines.push(`            std::string line = next == std::string::npos ? input.substr(cursor) : input.substr(cursor, next - cursor);`);
      lines.push(`            cursor = next == std::string::npos ? std::string::npos : next + 1;`);
      lines.push(`            trim(line);`);
      lines.push(`            if (line.empty()) continue;`);
      lines.push(``);
      lines.push(`            std::string summary = line;`);
      lines.push(`            std::string due = "";`);
      lines.push(`            std::string status = "";`);
      lines.push(``);
      lines.push(`            size_t p1 = line.find('|');`);
      lines.push(`            if (p1 != std::string::npos) {`);
      lines.push(`              summary = line.substr(0, p1);`);
      lines.push(`              std::string rest = line.substr(p1 + 1);`);
      lines.push(`              size_t p2 = rest.find('|');`);
      lines.push(`              if (p2 != std::string::npos) {`);
      lines.push(`                due = rest.substr(0, p2);`);
      lines.push(`                status = rest.substr(p2 + 1);`);
      lines.push(`              } else {`);
      lines.push(`                due = rest;`);
      lines.push(`              }`);
      lines.push(`            }`);
      lines.push(``);
      lines.push(`            trim(summary);`);
      lines.push(`            trim(due);`);
      lines.push(`            trim(status);`);
      lines.push(`            if (summary.empty()) continue;`);
      lines.push(``);
      lines.push(`            if (due == "no-date" || due == "none") {`);
      lines.push(`              due.clear();`);
      lines.push(`            } else if (!due.empty()) {`);
      lines.push(`              due = humanize_due(due);`);
      lines.push(`            }`);
      lines.push(``);
      lines.push(`            summaries[item_count] = summary;`);
      lines.push(`            dues[item_count] = due;`);
      lines.push(`            statuses[item_count] = status;`);
      lines.push(`            item_count++;`);
      lines.push(`          }`);
      lines.push(``);
      lines.push(`          // Debug fallback: if parsing produced no rows, show raw payload.`);
      lines.push(`          if (item_count == 0 && !input.empty()) {`);
      lines.push(`            std::string raw = input;`);
      lines.push(`            for (size_t i = 0; i < raw.size(); i++) {`);
      lines.push(`              if (raw[i] == '\\n' || raw[i] == '\\r') raw[i] = ' ';`);
      lines.push(`            }`);
      lines.push(`            trim(raw);`);
      lines.push(`            if (!raw.empty()) {`);
      lines.push(`              summaries[0] = raw.substr(0, 60);`);
      lines.push(`              dues[0].clear();`);
      lines.push(`              statuses[0].clear();`);
      lines.push(`              item_count = 1;`);
      lines.push(`            }`);
      lines.push(`          }`);
      lines.push(``);

      for (let row = 0; row < maxItems; row++) {
        const cbId = todoRowWidgetId(binding.widgetId, row, "cb");
        const summaryId = todoRowWidgetId(binding.widgetId, row, "summary");
        const dueId = todoRowWidgetId(binding.widgetId, row, "due");

        lines.push(`          if (item_count > ${row}) {`);
        lines.push(`            lv_label_set_text(id(${cbId}), "[ ]");`);
        lines.push(`            lv_label_set_text(id(${summaryId}), summaries[${row}].c_str());`);
        lines.push(`            if (!dues[${row}].empty()) {`);
        lines.push(`              lv_obj_set_width(id(${summaryId}), ${summaryWidth});`);
        lines.push(`              lv_label_set_text(id(${dueId}), dues[${row}].c_str());`);
        lines.push(`              lv_obj_clear_flag(id(${dueId}), LV_OBJ_FLAG_HIDDEN);`);
        lines.push(`            } else {`);
        lines.push(`              lv_obj_set_width(id(${summaryId}), ${summaryWidthNoDue});`);
        lines.push(`              lv_label_set_text(id(${dueId}), "");`);
        lines.push(`              lv_obj_add_flag(id(${dueId}), LV_OBJ_FLAG_HIDDEN);`);
        lines.push(`            }`);
        lines.push(`            lv_obj_set_style_text_color(`);
        lines.push(`              id(${dueId}),`);
        lines.push(`              lv_color_hex(statuses[${row}] == "overdue" ? ${dueOverdueHex} : ${dueNormalHex}),`);
        lines.push(`              LV_PART_MAIN | LV_STATE_DEFAULT`);
        lines.push(`            );`);
        lines.push(`          } else {`);
        lines.push(`            lv_label_set_text(id(${cbId}), "");`);
        lines.push(`            lv_label_set_text(id(${summaryId}), "");`);
        lines.push(`            lv_label_set_text(id(${dueId}), "");`);
        lines.push(`            lv_obj_add_flag(id(${dueId}), LV_OBJ_FLAG_HIDDEN);`);
        lines.push(`          }`);
      }

      break;
    }
  }
  return lines;
}

// --- Main generator ---

export function generateESPHomeYAML(project: Project): string {
  const lines: string[] = [];
  const { sensorBindings, scriptActions, toggleButtons, conditionalAreas, tabContainers, autoLayoutLists, conditionEntityIds } =
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
  lines.push(`          id(my_lvgl)->show_next_page(LV_SCR_LOAD_ANIM_NONE, 0);`);
  lines.push(`        } else if (dx > 50) {`);
  lines.push(`          id(my_lvgl)->show_prev_page(LV_SCR_LOAD_ANIM_NONE, 0);`);
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
  lines.push(`  power_save_mode: none`);
  lines.push(``);

  // Allow provisioning WiFi credentials through fallback AP
  lines.push(`captive_portal:`);
  lines.push(``);

  // Logger
  lines.push(`logger:`);
  lines.push(`  level: WARN`);
  lines.push(`  baud_rate: 0`);
  lines.push(``);

  // API
  lines.push(`api:`);
  lines.push(`  reboot_timeout: 15min`);
  lines.push(``);

  // OTA
  lines.push(`ota:`);
  lines.push(`  - platform: esphome`);
  lines.push(`  - platform: http_request`);
  lines.push(``);

  // HTTP client for OTA update checks/downloads
  lines.push(`http_request:`);
  lines.push(``);

  // Managed OTA updates from published firmware URL
  lines.push(`update:`);
  lines.push(`  - platform: http_request`);
  lines.push(`    name: Firmware`);
  lines.push(`    source: !secret firmware_update_url`);
  lines.push(``);

  // Time source used by update component scheduling/status
  lines.push(`time:`);
  lines.push(`  - platform: sntp`);
  lines.push(`    id: sntp_time`);
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
  const additionalConditionEntities = (conditionalAreas.length > 0 || autoLayoutLists.length > 0)
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
      if ((conditionalAreas.length > 0 || autoLayoutLists.length > 0) && conditionEntitySet.has(first.entityId)) {
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
      if ((conditionalAreas.length > 0 || autoLayoutLists.length > 0) && conditionEntitySet.has(first.entityId)) {
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
      if ((conditionalAreas.length > 0 || autoLayoutLists.length > 0) && conditionEntitySet.has(first.entityId)) {
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
  const hasScripts =
    scriptActions.length > 0 ||
    conditionalAreas.length > 0 ||
    autoLayoutLists.length > 0 ||
    tabContainers.length > 0;
  if (hasScripts) {
    lines.push(`script:`);

    for (const tabContainer of tabContainers) {
      for (let ti = 0; ti < tabContainer.tabs.length; ti++) {
        lines.push(`  - id: ${tabContainer.containerId}_show_t${ti}`);
        lines.push(`    then:`);
        lines.push(`      - lambda: |-`);
        for (let si = 0; si < tabContainer.tabs.length; si++) {
          const tab = tabContainer.tabs[si];
          if (si === ti) {
            lines.push(`          lv_obj_clear_flag(id(${tab.objId}), LV_OBJ_FLAG_HIDDEN);`);
            lines.push(`          lv_obj_set_style_bg_color(id(${tab.buttonId}), lv_color_hex(0x4A9EFF), LV_PART_MAIN | LV_STATE_DEFAULT);`);
          } else {
            lines.push(`          lv_obj_add_flag(id(${tab.objId}), LV_OBJ_FLAG_HIDDEN);`);
            lines.push(`          lv_obj_set_style_bg_color(id(${tab.buttonId}), lv_color_hex(0x44505C), LV_PART_MAIN | LV_STATE_DEFAULT);`);
          }
        }
      }
    }
    
    // Conditional area update script
    if (conditionalAreas.length > 0 || autoLayoutLists.length > 0) {
      lines.push(`  - id: update_conditional_areas`);
      lines.push(`    then:`);
      lines.push(`      - lambda: |-`);
      lines.push(`          auto set_visible = [](lv_obj_t *obj, bool visible) {`);
      lines.push(`            const bool hidden = lv_obj_has_flag(obj, LV_OBJ_FLAG_HIDDEN);`);
      lines.push(`            if (visible) {`);
      lines.push(`              if (hidden) lv_obj_clear_flag(obj, LV_OBJ_FLAG_HIDDEN);`);
      lines.push(`            } else {`);
      lines.push(`              if (!hidden) lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);`);
      lines.push(`            }`);
      lines.push(`          };`);
      lines.push(``);
      
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
                lines.push(`            set_visible(id(${v.objId}), true);`);
              } else {
                lines.push(`            set_visible(id(${v.objId}), false);`);
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
              lines.push(`            set_visible(id(${v.objId}), true);`);
            } else {
              lines.push(`            set_visible(id(${v.objId}), false);`);
            }
          }
          if (!firstCondition) {
            lines.push(`          }`);
          }
        } else if (!firstCondition) {
          lines.push(`          }`);
        }
      }

      for (const list of autoLayoutLists) {
        lines.push(`          // Auto layout list: ${list.componentId}`);
        for (const item of list.items) {
          if (item.condition) {
            const condExpr = generateConditionExpression(item.condition);
            lines.push(`          if ${condExpr} {`);
            lines.push(`            set_visible(id(${item.containerId}), true);`);
            lines.push(`          } else {`);
            lines.push(`            set_visible(id(${item.containerId}), false);`);
            lines.push(`          }`);
          } else {
            lines.push(`          set_visible(id(${item.containerId}), true);`);
          }
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
      const actionLog = action.targetEntityId
        ? `Calling HA action: ${action.service} (${action.targetEntityId})`
        : action.targetDeviceId
        ? `Calling HA action: ${action.service} (device: ${action.targetDeviceId})`
        : `Calling HA action: ${action.service}`;
      lines.push(`      - logger.log: "${actionLog}"`);
      lines.push(`      - homeassistant.action:`);
      lines.push(`          action: ${action.service}`);
      if (action.targetEntityId || action.targetDeviceId) {
        lines.push(`          data:`);
        if (action.targetEntityId) {
          lines.push(`            entity_id: ${action.targetEntityId}`);
        }
        if (action.targetDeviceId) {
          lines.push(`            device_id: ${action.targetDeviceId}`);
        }
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
  const headerHeight = project.pageHeader?.height ?? 0;
  const hasHeader = project.pageHeader && project.pageHeader.components.length > 0;
  const displayHeight = project.display?.height ?? 480;
  for (let i = 0; i < project.dashboardPages.length; i++) {
    const page = project.dashboardPages[i];
    lines.push(`    # ${page.name}`);
    lines.push(`    - id: page_${i}`);
    // Always set background color - use page color or theme background
    const pageBgColor = page.backgroundColor ?? theme.colors.background;
    lines.push(`      bg_color: ${colorToHex(pageBgColor)}`);

    const pageWidgets: string[] = [];
    const hasAnyWidgets = (hasHeader) || page.components.length > 0;
    if (hasAnyWidgets) {
      lines.push(`      widgets:`);
      const ctx: PageContext = { pageIndex: i, hasDetailViews };

      // Generate header widgets first (positions are relative to page origin, used as-is)
      if (hasHeader) {
        // Optional: header background
        if (project.pageHeader!.backgroundColor) {
          const bgHex = colorToHex(project.pageHeader!.backgroundColor);
          pageWidgets.push(`${ind(4)}- obj:`);
          pageWidgets.push(`${ind(4)}    id: page_${i}_header_bg`);
          pageWidgets.push(`${ind(4)}    x: 0`);
          pageWidgets.push(`${ind(4)}    y: 0`);
          pageWidgets.push(`${ind(4)}    width: 100%`);
          pageWidgets.push(`${ind(4)}    height: ${headerHeight}`);
          pageWidgets.push(`${ind(4)}    bg_color: ${bgHex}`);
          pageWidgets.push(`${ind(4)}    bg_opa: 100%`);
          pageWidgets.push(`${ind(4)}    border_width: 0`);
          pageWidgets.push(`${ind(4)}    pad_all: 0`);
        }

        for (const comp of project.pageHeader!.components) {
          pageWidgets.push(...generateWidgetLines(comp, 4, ctx));
        }
      }

      // Generate page content widgets with Y-offset if header exists
      for (const comp of page.components) {
        if (headerHeight > 0) {
          // Clone component with Y-offset applied
          const offsetComp = {
            ...comp,
            position: { ...comp.position, y: comp.position.y + headerHeight },
          } as Component;
          pageWidgets.push(...generateWidgetLines(offsetComp, 4, ctx));
        } else {
          pageWidgets.push(...generateWidgetLines(comp, 4, ctx));
        }
      }
    }

    if (project.dashboardPages.length > 1) {
      if (pageWidgets.length === 0) {
        lines.push(`      widgets:`);
      }
      pageWidgets.push(...generatePageIndicatorWidgets(i, project.dashboardPages.length, 4, theme, displayHeight));
    }

    lines.push(...pageWidgets);
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
      lines.push(`                        id(my_lvgl)->show_page(id(return_page), LV_SCR_LOAD_ANIM_NONE, 0);`);
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
      if ((comp as any).type === "auto_layout_list") {
        for (const item of (comp as any).items) {
          if (item.icon) icons.add(item.icon);
        }
      }
      if (comp.type === "conditional_area") {
        for (const variant of (comp as any).variants) {
          processComponents(variant.components);
        }
      }
    }
  };
  if (project.pageHeader) {
    processComponents(project.pageHeader.components);
  }
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
