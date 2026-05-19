import type {
  Project,
  Component,
  LightStateComponent,
  TabContainerComponent,
  ConditionalAreaComponent,
  ConditionalVariant,
  TextComponent,
  ButtonComponent,
  IconComponent,
  TodoListComponent,
  Color,
  OnTapAction,
} from "@esphome-designer/schema";
import {
  toCppIdentifier,
  escapeCString,
  stateVarFromEntity,
  todoItemsVarFromBinding,
  type ScreenDescriptor,
  type WidgetFactory,
} from "./utils";
import { emitConditionExpression } from "./condition-expr";
import { getMdiUtf8CEscape } from "./mdi-icons";

function emitColor(c: Color): string {
  return `Color(${c.r}, ${c.g}, ${c.b})`;
}

const TAB_BAR_HEIGHT = 36;

function detailScreenId(id: string, title: string): string {
  return 'Detail' + (toCppIdentifier(id) || toCppIdentifier(title) || 'View');
}

function collectScreens(project: Project): ScreenDescriptor[] {
  const screens: ScreenDescriptor[] = [];
  const seen = new Set<string>();
  seen.add('Home');
  screens.push({ cppName: 'Home', name: 'Home' });
  for (const view of project.detailViews) {
    const cppName = detailScreenId(view.id, view.title);
    if (seen.has(cppName)) continue;
    seen.add(cppName);
    screens.push({ cppName, name: view.title });
  }
  if (screens.length === 0) {
    screens.push({ cppName: 'Home', name: 'Home' });
  }
  return screens;
}

function emitTapAction(action: OnTapAction | undefined): string {
  if (!action) return '';
  if (action.type === 'SERVICE_CALL') {
    const entity = action.target?.entityId ?? action.target?.deviceId ?? '';
    return `make_ha_callback("${entity}", "${action.service}")`;
  }
  if (action.type === 'OPEN_DETAIL') {
    const detailId = detailScreenId(action.targetId ?? '', '');
    return `[&screens]() { screens.navigate_to(UiScreenId::${detailId}); }`;
  }
  if (action.type === 'GO_BACK') {
    return `[&screens]() { screens.navigate_to(UiScreenId::Home); }`;
  }
  if (action.type === 'NEXT_PAGE') {
    return `[&state]() {
      state.home_page_index = (state.home_page_index + 1) % state.home_total_pages;
      UiInvalidation::request_full();
    }`;
  }
  if (action.type === 'PREV_PAGE') {
    return `[&state]() {
      state.home_page_index = (state.home_page_index - 1 + state.home_total_pages) % state.home_total_pages;
      UiInvalidation::request_full();
    }`;
  }
  return '';
}

function emitLightToggleAction(c: LightStateComponent): string {
  const explicit = emitTapAction(c.onTap);
  if (explicit) return explicit;

  const entityId = c.stateBinding?.entityId;
  if (!entityId) return '';
  const domain = entityId.split('.')[0];
  if (!domain) return '';

  // Default behavior for light-state components:
  // if no explicit onTap is configured, toggle the bound entity.
  return `make_ha_callback("${entityId}", "${domain}.toggle")`;
}

function generateLightWidget(c: LightStateComponent, stateVar: string,
    factory: WidgetFactory, indent: string, offX = 0, offY = 0, visibilityExpr?: string,
    dirtyBoundsExpr?: string): string {
  const x = c.position.x + offX;
  const y = c.position.y + offY;
  const w = c.size?.width ?? 200;
  const h = c.size?.height ?? 90;
  const label = c.label ?? 'Light';
  const onText = c.onText ?? 'ON';
  const offText = c.offText ?? 'OFF';
  const callback = emitLightToggleAction(c);
  const useImageToggle = c.showIcon !== false;
  const onColor = c.onColor ? emitColor(c.onColor) : 'Color(255, 180, 0)';
  const offColor = c.offColor ? emitColor(c.offColor) : 'Color(80, 80, 80)';
  const iconName = c.icon ?? 'lightbulb';
  const iconGlyph = getMdiUtf8CEscape(iconName);
  const idSafe = c.id.replace(/[^a-zA-Z0-9_]/g, '_');
  const dirtyLine = (name: string) => dirtyBoundsExpr
    ? `${indent}${name}->set_dirty_bounds(${dirtyBoundsExpr});\n`
    : '';

  let out = '';
  if (useImageToggle) {
    out += `${indent}auto *light_toggle_${idSafe} = ${factory('ImageToggleWidget', `UiRect{${x}, ${y}, ${w}, ${h}}, "${escapeCString(label)}", state.${stateVar}.ptr(), "${iconGlyph ?? ''}", ${callback || '[](){}'}, ${onColor}, ${offColor}`)};\n`;
    if (visibilityExpr) {
      out += `${indent}light_toggle_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
    }
    out += dirtyLine(`light_toggle_${idSafe}`);
    return out;
  }

  out += `${indent}auto *light_bg_${idSafe} = ${factory('RectWidget', `UiRect{${x}, ${y}, ${w}, 20}, g_theme.info_bg`)};\n`;
  if (visibilityExpr) {
    out += `${indent}light_bg_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  out += dirtyLine(`light_bg_${idSafe}`);
  out += `${indent}auto *light_lbl_${idSafe} = ${factory('LabelWidget', `UiRect{${x}, ${y}, ${w}, 20}, "", g_theme.label`)};\n`;
  out += `${indent}light_lbl_${idSafe}->bind(state.${stateVar}.ptr(), "${escapeCString(onText)}", "${escapeCString(offText)}");\n`;
  if (visibilityExpr) {
    out += `${indent}light_lbl_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  out += dirtyLine(`light_lbl_${idSafe}`);
  if (callback) {
    out += `${indent}auto *light_btn_${idSafe} = ${factory('ButtonWidget', `UiRect{${x + 10}, ${y + 30}, ${w - 20}, ${h - 30}}, "${escapeCString(label)}", ${callback}, g_theme.primary`)};\n`;
    if (visibilityExpr) {
      out += `${indent}light_btn_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
    }
    out += dirtyLine(`light_btn_${idSafe}`);
  }
  return out;
}

function generateTodoListWidget(
    c: TodoListComponent,
    itemsVar: string,
    factory: WidgetFactory,
    indent: string,
    offX = 0,
    offY = 0,
    visibilityExpr?: string,
    dirtyBoundsExpr?: string,
): string {
  const x = c.position.x + offX;
  const y = c.position.y + offY;
  const w = c.size?.width ?? 220;
  const h = c.size?.height ?? 140;
  const maxItems = Math.max(1, Math.min(10, c.maxItems ?? 4));
  const rowHeight = Math.max(20, Math.min(80, c.rowHeight ?? 30));
  const scrollable = c.scrollable === true ? 'true' : 'false';
  const checkable = c.checkable === true ? 'true' : 'false';
  const onTap = (!c.checkable && c.onTap) ? emitTapAction(c.onTap) : '';
  const incompleteIcon = getMdiUtf8CEscape("checkbox-blank-outline") ?? "";
  const completeIcon = getMdiUtf8CEscape("checkbox-marked") ?? "";
  const todoEntity = c.todoEntityId ?? "";
  const idSafe = c.id.replace(/[^a-zA-Z0-9_]/g, '_');
  let out = `${indent}auto *todo_${idSafe} = ${factory('TodoPreviewWidget', `UiRect{${x}, ${y}, ${w}, ${h}}, state.${itemsVar}.ptr(), ${maxItems}, ${rowHeight}, ${scrollable}, ${checkable}, ${onTap || '[](){}'}, "${incompleteIcon}", "${completeIcon}", "${escapeCString(todoEntity)}"`)};\n`;
  if (visibilityExpr) {
    out += `${indent}todo_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  if (dirtyBoundsExpr) {
    out += `${indent}todo_${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
  }
  return out;
}

function generateComponentSetup(
    c: Component,
    screenVar: string,
    indent: string,
    visibilityExpr?: string,
    offsetX = 0,
    offsetY = 0,
    // When set, every top-level widget this function creates will call
    // set_dirty_bounds(dirtyBoundsExpr). Used by conditional areas so that
    // any variant child marking itself dirty (visibility flip OR internal
    // state change) invalidates the WHOLE area rect, forcing the shared bg +
    // currently-visible sibling widgets to repaint together. Without this, a
    // small per-widget dirty rect would cause the area bg to fill and erase
    // siblings whose own bounds don't intersect the dirty rect.
    dirtyBoundsExpr?: string,
): string {
  const factory: WidgetFactory = (typeName, args) =>
    `${screenVar}->emplace_widget<${typeName}>(${args})`;
  const idSafe = c.id.replace(/[^a-zA-Z0-9_]/g, '_');
  const visLine = visibilityExpr ? `\n${indent}${idSafe}->set_visibility_condition(${visibilityExpr});` : '';
  const dirtyLine = dirtyBoundsExpr ? `\n${indent}${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});` : '';

  switch (c.type) {
    case 'text': {
      const tc = c;
      const text = tc.text ?? '';
      const fontSize = tc.fontSize ?? 'small';
      const fontMap: Record<string, string> = {
        small: 'g_theme.label',
        medium: 'g_theme.header',
        large: 'g_theme.header',
      };
      return `${indent}auto *${idSafe} = ${factory('LabelWidget', `UiRect{${c.position.x + offsetX}, ${c.position.y + offsetY}, ${c.size?.width ?? 100}, ${c.size?.height ?? 40}}, "${escapeCString(text)}", ${fontMap[fontSize]}`)};${visLine}${dirtyLine}\n`;
    }
    case 'button': {
      const label = c.label ?? '';
      const callback = emitTapAction(c.onTap ?? c.pressAction);
      const rect = `UiRect{${c.position.x + offsetX}, ${c.position.y + offsetY}, ${c.size?.width ?? 80}, ${c.size?.height ?? 36}}`;
      let out = `${indent}auto *${idSafe} = ${factory('ButtonWidget', `${rect}, "${escapeCString(label)}", ${callback || '[](){}'}, g_theme.primary`)};${visLine}${dirtyLine}\n`;
      const iconGlyph = c.icon ? getMdiUtf8CEscape(c.icon) : null;
      if (iconGlyph) {
        out += `${indent}${idSafe}->set_icon("${iconGlyph}", &g_theme.icon);\n`;
      }
      return out;
    }
    case 'icon': {
      return generateIconWidget(c, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'light_state': {
      const stateVar = stateVarFromEntity(c.stateBinding?.entityId ?? c.id);
      return generateLightWidget(c, stateVar, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'todo_list': {
      const itemsVar = todoItemsVarFromBinding(c.itemsBinding, c.id);
      return generateTodoListWidget(c, itemsVar, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'tab_container':
      return generateTabContainerWidget(c, screenVar, indent, visibilityExpr, offsetX, offsetY, dirtyBoundsExpr);
    case 'conditional_area':
      return generateConditionalAreaWidget(c, screenVar, indent, visibilityExpr, offsetX, offsetY);
    default:
      return `${indent}// TODO: component type '${c.type}' (id: ${c.id})\n`;
  }
}

function generateIconWidget(
    c: IconComponent,
    factory: WidgetFactory,
    indent: string,
    offsetX: number,
    offsetY: number,
    visibilityExpr?: string,
    dirtyBoundsExpr?: string,
): string {
  const idSafe = c.id.replace(/[^a-zA-Z0-9_]/g, '_');
  const glyph = getMdiUtf8CEscape(c.icon);
  if (!glyph) {
    // Unknown icon - skip emission so firmware does not render tofu.
    return `${indent}// Unknown icon '${c.icon}' (id: ${c.id}) - skipped\n`;
  }
  const rect = `UiRect{${c.position.x + offsetX}, ${c.position.y + offsetY}, ${c.size?.width ?? 32}, ${c.size?.height ?? 32}}`;
  let out = `${indent}auto *${idSafe} = ${factory('IconWidget', `${rect}, "${glyph}", g_theme.icon`)};\n`;
  if (c.color) {
    out += `${indent}${idSafe}->set_color(${emitColor(c.color)});\n`;
  }
  if (visibilityExpr) {
    out += `${indent}${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  if (dirtyBoundsExpr) {
    out += `${indent}${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
  }
  return out;
}

function orderVariants(c: ConditionalAreaComponent): ConditionalVariant[] {
  const mode = c.evaluationMode ?? 'first_match';
  if (mode === 'priority') {
    return [...c.variants].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  }
  return [...c.variants];
}

function findDefaultVariantIndex(
  variantsInOrder: ConditionalVariant[],
  defaultVariantId: string | undefined,
): number {
  if (defaultVariantId) {
    const idx = variantsInOrder.findIndex(v => v.id === defaultVariantId);
    if (idx >= 0) return idx;
  }
  return variantsInOrder.findIndex(v => !v.condition);
}

function variantMatchExpression(variant: ConditionalVariant): string {
  return variant.condition ? emitConditionExpression(variant.condition) : 'true';
}

function variantActiveExpression(
  variantsInOrder: ConditionalVariant[],
  index: number,
  defaultIndex: number,
): string {
  const variant = variantsInOrder[index]!;
  const isDefault = index === defaultIndex;
  const guard = variantsInOrder
    .slice(0, index)
    .filter((_, j) => j !== defaultIndex)
    .map(v => `!${variantMatchExpression(v)}`);
  const own = variantMatchExpression(variant);

  if (isDefault) {
    const noneMatch = variantsInOrder
      .map((v, j) => (j === index ? null : `!${variantMatchExpression(v)}`))
      .filter((s): s is string => s !== null);
    if (noneMatch.length === 0) {
      return 'true';
    }
    return noneMatch.join(' && ');
  }

  const parts = [...guard];
  if (own !== 'true') parts.push(own);
  if (parts.length === 0) return 'true';
  return parts.join(' && ');
}

function generateConditionalAreaWidget(
  c: ConditionalAreaComponent,
  screenVar: string,
  indent: string,
  parentVisibilityExpr?: string,
  offsetX = 0,
  offsetY = 0,
): string {
  const areaIdSafe = c.id.replace(/[^a-zA-Z0-9_]/g, '_');
  const areaX = c.position.x + offsetX;
  const areaY = c.position.y + offsetY;
  const areaW = c.size?.width ?? 0;
  const areaH = c.size?.height ?? 0;
  const variantsInOrder = orderVariants(c);
  const defaultIndex = findDefaultVariantIndex(variantsInOrder, c.defaultVariantId);
  // Children of a conditional area variant treat the whole area as their
  // dirty rect: when any of them marks itself dirty (visibility flip on a
  // variant change, or an internal value change), the area bg + every
  // currently-visible sibling repaints together. Without this, a small per-
  // child dirty rect would cause the bg RectWidget to fill the whole area
  // and erase siblings whose own bounds don't intersect the dirty rect.
  const dirtyBoundsExpr = (areaW > 0 && areaH > 0)
    ? `UiRect{${areaX}, ${areaY}, ${areaW}, ${areaH}}`
    : undefined;

  let out = '';
  out += `${indent}// Conditional area: ${c.id}\n`;
  if (areaW > 0 && areaH > 0) {
    const bgVar = `ca_bg_${areaIdSafe}`;
    out += `${indent}auto *${bgVar} = ${screenVar}->emplace_widget<RectWidget>(UiRect{${areaX}, ${areaY}, ${areaW}, ${areaH}}, g_theme.info_bg);\n`;
    if (parentVisibilityExpr) {
      out += `${indent}${bgVar}->set_visibility_condition(${parentVisibilityExpr});\n`;
    }
    // bg's own bounds == area, so default mark_dirty() invalidates the
    // right rect on parent-visibility flip; no set_dirty_bounds needed.
  }

  for (let i = 0; i < variantsInOrder.length; i++) {
    const variant = variantsInOrder[i]!;
    const variantIdSafe = variant.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const variantLambdaVar = `cv_${areaIdSafe}_${variantIdSafe}`;
    const activeExpr = variantActiveExpression(variantsInOrder, i, defaultIndex);

    if (parentVisibilityExpr) {
      out += `${indent}auto ${variantLambdaVar} = [&state, ${parentVisibilityExpr}]() { return ${parentVisibilityExpr}() && (${activeExpr}); };\n`;
    } else {
      out += `${indent}auto ${variantLambdaVar} = [&state]() { return ${activeExpr}; };\n`;
    }

    for (const child of variant.components) {
      out += generateComponentSetup(child, screenVar, indent, variantLambdaVar, areaX, areaY, dirtyBoundsExpr);
    }
  }

  return out;
}

function generateTabContainerWidget(
    c: TabContainerComponent,
    screenVar: string,
    indent: string,
    visibilityExpr?: string,
    offX = 0,
    offY = 0,
    dirtyBoundsExpr?: string,
): string {
  const x = c.position.x + offX;
  const y = c.position.y + offY;
  const w = c.size?.width ?? 200;
  const h = c.size?.height ?? 200;
  const clip = c.clipContent ?? false;
  const varName = `tc_${c.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  const bgVar = `${varName}_bg`;

  let out = '';
  out += `${indent}auto *${varName} = ${screenVar}->emplace_widget<TabContainerWidget>(UiRect{${x}, ${y}, ${w}, ${h}}, g_theme.info_bg, g_theme.primary, ${clip});\n`;
  if (visibilityExpr) {
    out += `${indent}${varName}->set_visibility_condition(${visibilityExpr});\n`;
  }
  if (dirtyBoundsExpr) {
    out += `${indent}${varName}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
  }
  out += `${indent}const Color ${bgVar} = g_theme.info_bg;\n`;

  for (const tab of c.tabs) {
    out += `${indent}${varName}->add_tab("${escapeCString(tab.name)}");\n`;
  }

  if (c.defaultTabId) {
    const defaultIdx = c.tabs.findIndex(t => t.id === c.defaultTabId);
    if (defaultIdx >= 0) {
      out += `${indent}${varName}->set_default_tab(${defaultIdx});\n`;
    }
  }

  for (let i = 0; i < c.tabs.length; i++) {
    for (const child of c.tabs[i]!.components) {
      out += generateNestedComponent(child, varName, i, indent, x, y + TAB_BAR_HEIGHT, bgVar, undefined, dirtyBoundsExpr);
    }
  }

  return out;
}

function generateNestedComponent(c: Component, containerVar: string, tabIndex: number, indent: string,
    offsetX: number, offsetY: number, tabBgVar?: string, visibilityExpr?: string,
    dirtyBoundsExpr?: string): string {
  const x = c.position.x + offsetX;
  const y = c.position.y + offsetY;
  const w = c.size?.width ?? 60;
  const h = c.size?.height ?? 20;
  const idSafe = c.id.replace(/[^a-zA-Z0-9_]/g, '_');

  const factory: WidgetFactory = (typeName, args) =>
    `${containerVar}->emplace_child<${typeName}>(${tabIndex}, ${args})`;

  const visLine = visibilityExpr ? `\n${indent}${idSafe}->set_visibility_condition(${visibilityExpr});` : '';
  const dirtyLine = dirtyBoundsExpr ? `\n${indent}${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});` : '';

  switch (c.type) {
    case 'text': {
      const text = c.text ?? '';
      const fontSize = c.fontSize ?? 'small';
      const fontMap: Record<string, string> = {
        small: 'g_theme.label',
        medium: 'g_theme.header',
        large: 'g_theme.header',
      };
      const wargs = `UiRect{${x}, ${y}, ${w}, ${h}}, "${escapeCString(text)}", ${fontMap[fontSize]}`;
      if (tabBgVar) {
        const visInner = visibilityExpr ? `\n${indent}  ${idSafe}->set_visibility_condition(${visibilityExpr});` : '';
        const dirtyInner = dirtyBoundsExpr ? `\n${indent}  ${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});` : '';
        return `${indent}{\n${indent}  auto *${idSafe} = ${factory('LabelWidget', wargs)};\n${indent}  ${idSafe}->set_bg_color(${tabBgVar});${visInner}${dirtyInner}\n${indent}}\n`;
      }
      if (visibilityExpr || dirtyBoundsExpr) {
        return `${indent}auto *${idSafe} = ${factory('LabelWidget', wargs)};${visLine}${dirtyLine}\n`;
      }
      return `${indent}${factory('LabelWidget', wargs)};\n`;
    }
    case 'button': {
      const label = c.label ?? '';
      const callback = emitTapAction(c.onTap ?? c.pressAction);
      const wargs = `UiRect{${x}, ${y}, ${w}, ${h}}, "${escapeCString(label)}", ${callback || '[](){}'}, g_theme.primary`;
      const iconGlyph = c.icon ? getMdiUtf8CEscape(c.icon) : null;
      if (visibilityExpr || iconGlyph || dirtyBoundsExpr) {
        let out = `${indent}auto *${idSafe} = ${factory('ButtonWidget', wargs)};`;
        if (visibilityExpr) out += `\n${indent}${idSafe}->set_visibility_condition(${visibilityExpr});`;
        if (dirtyBoundsExpr) out += `\n${indent}${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});`;
        if (iconGlyph) out += `\n${indent}${idSafe}->set_icon("${iconGlyph}", &g_theme.icon);`;
        return `${out}\n`;
      }
      return `${indent}${factory('ButtonWidget', wargs)};\n`;
    }
    case 'icon': {
      const glyph = getMdiUtf8CEscape(c.icon);
      if (!glyph) {
        return `${indent}// Unknown icon '${c.icon}' (id: ${c.id}) - skipped\n`;
      }
      const wargs = `UiRect{${x}, ${y}, ${w}, ${h}}, "${glyph}", g_theme.icon`;
      let out = `${indent}auto *${idSafe} = ${factory('IconWidget', wargs)};\n`;
      if (c.color) {
        out += `${indent}${idSafe}->set_color(${emitColor(c.color)});\n`;
      }
      if (visibilityExpr) {
        out += `${indent}${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
      }
      if (dirtyBoundsExpr) {
        out += `${indent}${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
      }
      return out;
    }
    case 'light_state': {
      const stateVar = stateVarFromEntity(c.stateBinding?.entityId ?? c.id);
      return generateLightWidget(c, stateVar, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'todo_list': {
      const itemsVar = todoItemsVarFromBinding(c.itemsBinding, c.id);
      return generateTodoListWidget(c, itemsVar, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'conditional_area':
      return generateConditionalAreaNested(c, containerVar, tabIndex, indent, visibilityExpr, offsetX, offsetY, tabBgVar);
    default:
      return `${indent}// TODO: nested ${c.type} (id: ${c.id}) in tab ${tabIndex}\n`;
  }
}

function generateConditionalAreaNested(
  c: ConditionalAreaComponent,
  containerVar: string,
  tabIndex: number,
  indent: string,
  parentVisibilityExpr: string | undefined,
  offsetX: number,
  offsetY: number,
  tabBgVar?: string,
): string {
  const areaIdSafe = c.id.replace(/[^a-zA-Z0-9_]/g, '_');
  const areaX = c.position.x + offsetX;
  const areaY = c.position.y + offsetY;
  const areaW = c.size?.width ?? 0;
  const areaH = c.size?.height ?? 0;
  const variantsInOrder = orderVariants(c);
  const defaultIndex = findDefaultVariantIndex(variantsInOrder, c.defaultVariantId);
  // See generateConditionalAreaWidget for why variant children dirty the
  // whole area instead of their own bounds.
  const dirtyBoundsExpr = (areaW > 0 && areaH > 0)
    ? `UiRect{${areaX}, ${areaY}, ${areaW}, ${areaH}}`
    : undefined;

  let out = '';
  out += `${indent}// Conditional area (nested): ${c.id}\n`;
  if (areaW > 0 && areaH > 0) {
    const bgVar = `ca_bg_${areaIdSafe}`;
    const bgColor = tabBgVar ?? 'g_theme.info_bg';
    out += `${indent}auto *${bgVar} = ${containerVar}->emplace_child<RectWidget>(${tabIndex}, UiRect{${areaX}, ${areaY}, ${areaW}, ${areaH}}, ${bgColor});\n`;
    if (parentVisibilityExpr) {
      out += `${indent}${bgVar}->set_visibility_condition(${parentVisibilityExpr});\n`;
    }
  }

  for (let i = 0; i < variantsInOrder.length; i++) {
    const variant = variantsInOrder[i]!;
    const variantIdSafe = variant.id.replace(/[^a-zA-Z0-9_]/g, '_');
    const variantLambdaVar = `cv_${areaIdSafe}_${variantIdSafe}`;
    const activeExpr = variantActiveExpression(variantsInOrder, i, defaultIndex);

    if (parentVisibilityExpr) {
      out += `${indent}auto ${variantLambdaVar} = [&state, ${parentVisibilityExpr}]() { return ${parentVisibilityExpr}() && (${activeExpr}); };\n`;
    } else {
      out += `${indent}auto ${variantLambdaVar} = [&state]() { return ${activeExpr}; };\n`;
    }

    for (const child of variant.components) {
      out += generateNestedComponent(child, containerVar, tabIndex, indent, areaX, areaY, tabBgVar, variantLambdaVar, dirtyBoundsExpr);
    }
  }

  return out;
}

export function generateUIScreensHeader(project: Project): string {
  const screens = collectScreens(project);
  const screenIds = screens.map(s => s.cppName);
  const firstScreen = screens[0]?.cppName ?? 'Home';
  const lastScreen = screenIds.length > 0 ? screenIds[screenIds.length - 1] : 'Home';

  const screenCtor = `    // Pre-create all screen slots
    for (int i = 0; i <= static_cast<int>(UiScreenId::${lastScreen}); i++) {
      auto id = static_cast<UiScreenId>(i);
      auto screen = std::make_unique<GenericScreen>();
      screens_[id] = screen.get();
      owned_screens_.push_back(std::move(screen));
    }
    current_ = screens_.at(UiScreenId::${firstScreen});`

  let setupBody = '';
  if (project.dashboardPages.length > 0) {
    const dashboardOffsetY = project.pageHeader?.height ?? 0;
    setupBody += `  auto *home = screens.get_screen(UiScreenId::Home);\n`;
    if (project.pageHeader) {
      setupBody += `  home->emplace_widget<HeaderWidget>(g_theme.header.font, g_theme.label.font, nullptr, nullptr);\n`;
    }
    for (const [index, page] of project.dashboardPages.entries()) {
      setupBody += `  {\n`;
      setupBody += `    auto p${index} = [&state]() { return state.home_page_index == ${index}; };\n`;
      setupBody += `    // Page: ${page.name}\n`;
      for (const c of page.components) {
        setupBody += generateComponentSetup(c, 'home', '    ', `p${index}`, 0, dashboardOffsetY);
        setupBody += '\n';
      }
      setupBody += `  }\n\n`;
    }
    setupBody += `  home->emplace_widget<PageIndicatorWidget>(460);\n\n`;
  }

  for (const view of project.detailViews) {
    const cppName = detailScreenId(view.id, view.title);
    const screenVar = cppName.toLowerCase();
    setupBody += `  auto *${screenVar} = screens.get_screen(UiScreenId::${cppName});\n`;
    setupBody += `  ${screenVar}->emplace_widget<DetailHeaderWidget>(g_theme.header.font, g_theme.label.font, "${escapeCString(view.title)}",\n`;
    setupBody += `      [&screens]() { screens.navigate_to(UiScreenId::Home); });\n`;
    if (view.components.length === 0) {
      setupBody += '\n';
      continue;
    }
    setupBody += `  // Detail: ${view.title}\n`;
    for (const c of view.components) {
      setupBody += generateComponentSetup(c, screenVar, '  ');
      setupBody += '\n';
    }
    setupBody += '\n';
  }

  if (!setupBody.trim()) {
    setupBody = `  (void)state;\n  (void)on_action;\n  // No components\n`;
  }

  return `#pragma once

#include "esphome.h"
#include "ui_state.h"
#include "ui_types.h"
#include "ui_widgets.h"
#include "ui_screen_base.h"
#include "ui_invalidation.h"
#include "ui_redraw.h"
#include "ui_scrollable_detail.h"
#include <memory>
#include <vector>
#include <map>

namespace esphome {
namespace font {
class Font;
}
}  // namespace esphome

class ScreenController {
 public:
  ScreenController() {
${screenCtor}
  }

  GenericScreen* get_screen(UiScreenId id) {
    auto it = screens_.find(id);
    if (it != screens_.end()) {
      return static_cast<GenericScreen*>(it->second);
    }
    return nullptr;
  }

  GenericScreen* create_screen(UiScreenId id) {
    auto screen = std::make_unique<GenericScreen>();
    auto *ptr = screen.get();
    screens_[id] = ptr;
    owned_screens_.push_back(std::move(screen));
    return ptr;
  }

  void register_screen(UiScreenId id, Screen *screen) {
    screens_[id] = screen;
  }

  void set_current(UiScreenId id) {
    current_->exit();
    current_id_ = id;
    current_ = screens_.at(id);
    current_->enter();
    current_->layout();
    UiRedraw::request_full();
  }

  void navigate_to(UiScreenId id) {
    set_current(id);
  }

  UiScreenId current_id() const { return current_id_; }

  void update(uint32_t now) { current_->update(now); }

  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) {
    (void)state;
    if (current_id_ == UiScreenId::Home &&
        event.type == TouchType::Up &&
        abs(event.dx) > 60 && abs(event.dx) > abs(event.dy)) {
      UiState& s = const_cast<UiState&>(state);
      if (event.dx < 0) {
        s.home_page_index = (s.home_page_index + 1) % s.home_total_pages;
      } else {
        s.home_page_index = (s.home_page_index - 1 + s.home_total_pages) % s.home_total_pages;
      }
      UiInvalidation::request_full();
      return true;
    }

    return current_->handle_touch(event, now, state);
  }

  void draw(display::Display &it, const UiState &state) { current_->draw(it, state); }

  Screen* current() { return current_; }

 private:
  UiScreenId current_id_ = UiScreenId::${firstScreen};
  Screen *current_ = nullptr;
  std::map<UiScreenId, Screen*> screens_;
  std::vector<std::unique_ptr<GenericScreen>> owned_screens_;
};

struct EntityAction {
  const char *entity_id;
  const char *service;
};

inline void setup_ui_screens(ScreenController &screens, UiState &state,
                           std::function<void(const std::string&, const std::string&)> on_action) {
  auto make_ha_callback = [on_action](const char* entity, const char* service) {
    return [on_action, entity, service]() {
      if (on_action) on_action(entity, service);
    };
  };

${setupBody}}
`;
}
