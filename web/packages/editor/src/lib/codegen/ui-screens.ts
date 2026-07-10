import type {
  Project,
  Component,
  LightStateComponent,
  TabContainerComponent,
  ConditionalAreaComponent,
  ConditionalVariant,
  TextComponent,
  DigitalClockComponent,
  ButtonComponent,
  IconComponent,
  ImageComponent,
  RectangleComponent,
  TodoListComponent,
  HvacComponent,
  WeatherComponent,
  CalendarComponent,
  RangeSliderComponent,
  Color,
  OnTapAction,
} from "@vesp-cloud/schema";
import {
  toCppIdentifier,
  detailScreenId,
  escapeCString,
  stateVarFromEntity,
  calendarEventsVarFromEntity,
  todoItemsVarFromBinding,
  todoItemsVarFromTodoEntity,
  todoEntityIdFromComponent,
  textBindingVar,
  imageIdFromComponentId,
  imageFallbackIdFromComponentId,
  safeCppIdentifier,
  type ScreenDescriptor,
  type WidgetFactory,
} from "./utils";
import { HVAC_MODES, HVAC_OFF_COLOR } from "../utils/hvac-modes";
import { emitConditionExpression } from "./condition-expr";
import { getMdiUtf8CEscape } from "./mdi-icons";
import { parseTemplate } from "../utils/template-utils";

const fontMap: Record<string, string> = {
  small: 'g_theme.label',
  medium: 'g_theme.header',
  large: 'g_theme.header',
};

const textAlignMap: Record<NonNullable<TextComponent['align']>, string> = {
  left: 'TextAlign::TOP_LEFT',
  center: 'TextAlign::TOP_CENTER',
  right: 'TextAlign::TOP_RIGHT',
};

type LabelPart =
  | { kind: 'text'; value: string }
  | { kind: 'binding'; varName: string };

/**
 * Walk the parsed template + legacy `textBinding` and produce a flat
 * sequence of static text / binding parts. Empty static text segments
 * are dropped to keep the generated lambda body compact.
 */
function collectLabelParts(c: TextComponent): LabelPart[] {
  const parts: LabelPart[] = [];
  for (const seg of parseTemplate(c.text ?? "")) {
    if (seg.type === 'text') {
      if (seg.value.length > 0) parts.push({ kind: 'text', value: seg.value });
    } else {
      parts.push({ kind: 'binding', varName: textBindingVar(seg.value) });
    }
  }
  // Treat the legacy `textBinding` as an extra binding appended after
  // the parsed template, so older projects that stored their dynamic
  // value in `textBinding` keep rendering the same way.
  if (c.textBinding) {
    parts.push({ kind: 'binding', varName: textBindingVar(c.textBinding) });
  }
  return parts;
}

function hasAnyBinding(parts: LabelPart[]): boolean {
  return parts.some(p => p.kind === 'binding');
}

/**
 * Emit a `bind_text_fn` call for a text component, or an empty string
 * if the component has no bindings at all (caller emits static text).
 *
 * Design notes:
 *  - The lambda captures `state` (the reference parameter of the
 *    enclosing `setup_ui_screens`) by reference. We can't reach for
 *    the global `g_ui_app` directly here because `ui_app.h` includes
 *    `ui_screens.h`, so `g_ui_app` isn't yet declared at the point
 *    where this lambda's body is parsed.
 *    Because `state` itself aliases `g_ui_app.state_` (a member of
 *    the program-lifetime global), the captured reference is stable
 *    long after `setup_ui_screens` returns.
 *  - Instead of chaining `+` operators (which materialises one
 *    temporary `std::string` per join), we build the result in-place
 *    with `reserve()` + `append()`. This drops per-frame heap churn
 *    to a single allocation, which matters because `update()` polls
 *    the function on every redraw.
 */
function emitLabelBindings(c: TextComponent, idSafe: string, indent: string): string {
  const parts = collectLabelParts(c);
  if (!hasAnyBinding(parts)) return '';

  // Heuristic capacity: every literal char + a guess for each binding.
  // The actual std::string will still grow if needed, this just avoids
  // the small-allocation churn for the typical short-value case.
  const literalLen = parts
    .filter((p): p is { kind: 'text'; value: string } => p.kind === 'text')
    .reduce((n, p) => n + p.value.length, 0);
  const bindingCount = parts.filter(p => p.kind === 'binding').length;
  const reserveBytes = literalLen + bindingCount * 16;

  const body: string[] = [];
  body.push(`std::string out;`);
  if (reserveBytes > 0) body.push(`out.reserve(${reserveBytes});`);
  for (const p of parts) {
    if (p.kind === 'text') {
      body.push(`out.append("${escapeCString(p.value)}");`);
    } else {
      body.push(`out.append(*state.${p.varName}.ptr());`);
    }
  }
  body.push(`return out;`);
  const inner = body.map(l => `${indent}  ${l}`).join('\n');
  return `${indent}${idSafe}->bind_text_fn([&state]() {\n${inner}\n${indent}});\n`;
}

/**
 * The static text passed to the LabelWidget constructor. When the
 * component has any bindings we emit an empty string so the displayed
 * value is exclusively controlled by `bind_text_fn`; otherwise the
 * raw text is used as-is.
 */
function labelStaticText(c: TextComponent): string {
  if (hasAnyBinding(collectLabelParts(c))) return '';
  return c.text ?? '';
}

function emitLabelAlign(c: TextComponent, idSafe: string, indent: string): string {
  const align = c.align ?? 'left';
  if (align === 'left') return '';
  return `${indent}${idSafe}->set_align(${textAlignMap[align]});\n`;
}

function emitLabelColor(c: TextComponent, idSafe: string, indent: string): string {
  if (!c.color) return '';
  return `${indent}${idSafe}->set_color(${emitColor(c.color)});\n`;
}

function emitColor(c: Color): string {
  return `Color(${c.r}, ${c.g}, ${c.b})`;
}

function emitButtonBorderColor(c: ButtonComponent, idSafe: string, indent: string): string {
  if (!c.borderColor) return '';
  return `${indent}${idSafe}->set_border_color(${emitColor(c.borderColor)});\n`;
}

function hasDigitalClockInComponents(components: Component[]): boolean {
  for (const c of components) {
    if (c.type === 'digital_clock') return true;
    if (c.type === 'tab_container') {
      if (c.tabs.some(tab => hasDigitalClockInComponents(tab.components))) return true;
    } else if (c.type === 'conditional_area') {
      if (c.variants.some(variant => hasDigitalClockInComponents(variant.components))) return true;
    }
  }
  return false;
}

const TAB_BAR_HEIGHT = 36;
const HEADER_RENDER_HEIGHT = 49;

function rect(x: number, y: number, w: number, h: number): string {
  return `UiRect{${Math.round(x)}, ${Math.round(y)}, ${Math.round(w)}, ${Math.round(h)}}`;
}

function cppLineCommentText(s: string): string {
  return s.replace(/[\r\n]/g, ' ');
}

function componentBottom(c: Component): number {
  const selfBottom = c.position.y + (c.size?.height ?? 0);
  if (c.type === 'tab_container') {
    const childBottom = Math.max(0, ...c.tabs.flatMap(tab =>
      tab.components.map(child => c.position.y + TAB_BAR_HEIGHT + componentBottom(child))
    ));
    return Math.max(selfBottom, childBottom);
  }
  if (c.type === 'conditional_area') {
    const childBottom = Math.max(0, ...c.variants.flatMap(variant =>
      variant.components.map(child => c.position.y + componentBottom(child))
    ));
    return Math.max(selfBottom, childBottom);
  }
  return selfBottom;
}

function detailContentHeight(view: { height?: number; components: Component[] }): number {
  return Math.max(view.height ?? 0, 0, ...view.components.map(componentBottom));
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
    return `make_ha_callback("${escapeCString(entity)}", "${escapeCString(action.service)}")`;
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
  return `make_ha_callback("${escapeCString(entityId)}", "${escapeCString(`${domain}.toggle`)}")`;
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
  const idSafe = safeCppIdentifier(c.id, 'component');
  const dirtyLine = (name: string) => dirtyBoundsExpr
    ? `${indent}${name}->set_dirty_bounds(${dirtyBoundsExpr});\n`
    : '';

  let out = '';
  if (useImageToggle) {
    out += `${indent}auto *light_toggle_${idSafe} = ${factory('ImageToggleWidget', `${rect(x, y, w, h)}, "${escapeCString(label)}", state.${stateVar}.ptr(), "${iconGlyph ?? ''}", ${callback || '[](){}'}, ${onColor}, ${offColor}`)};\n`;
    if (visibilityExpr) {
      out += `${indent}light_toggle_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
    }
    out += dirtyLine(`light_toggle_${idSafe}`);
    return out;
  }

  out += `${indent}auto *light_bg_${idSafe} = ${factory('RectWidget', `${rect(x, y, w, 20)}, g_theme.info_bg`)};\n`;
  if (visibilityExpr) {
    out += `${indent}light_bg_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  out += dirtyLine(`light_bg_${idSafe}`);
  out += `${indent}auto *light_lbl_${idSafe} = ${factory('LabelWidget', `${rect(x, y, w, 20)}, "", g_theme.label`)};\n`;
  out += `${indent}light_lbl_${idSafe}->bind(state.${stateVar}.ptr(), "${escapeCString(onText)}", "${escapeCString(offText)}");\n`;
  if (visibilityExpr) {
    out += `${indent}light_lbl_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  out += dirtyLine(`light_lbl_${idSafe}`);
  if (callback) {
    out += `${indent}auto *light_btn_${idSafe} = ${factory('ButtonWidget', `${rect(x + 10, y + 30, w - 20, h - 30)}, "${escapeCString(label)}", ${callback}, g_theme.primary`)};\n`;
    if (visibilityExpr) {
      out += `${indent}light_btn_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
    }
    out += dirtyLine(`light_btn_${idSafe}`);
  }
  return out;
}

function generateHvacWidget(c: HvacComponent,
    factory: WidgetFactory, indent: string, offX = 0, offY = 0, visibilityExpr?: string,
    dirtyBoundsExpr?: string): string {
  const x = c.position.x + offX;
  const y = c.position.y + offY;
  const w = c.size?.width ?? 225;
  const h = c.size?.height ?? 158;
  const label = c.label ?? 'Climate';
  const entityId = c.stateBinding?.entityId ?? c.id;
  const base = stateVarFromEntity(entityId);
  const tempStep = c.tempStep ?? 0.5;
  const minTemp = c.minTemp ?? 10;
  const maxTemp = c.maxTemp ?? 30;
  const onMode = c.onMode ?? 'heat';
  const modeInfo = HVAC_MODES[onMode] ?? HVAC_MODES.heat;
  const onColor = emitColor(modeInfo.color);
  const offColor = emitColor(HVAC_OFF_COLOR);
  const iconDown = getMdiUtf8CEscape('minus') ?? '\\-';
  const iconUp = getMdiUtf8CEscape('plus') ?? '\\+';
  const iconPower = getMdiUtf8CEscape('power') ?? '?';
  const idSafe = safeCppIdentifier(c.id, 'component');
  const fmtFloat = (v: number) => Number.isInteger(v) ? `${v}.0f` : `${v}f`;
  let out = `${indent}auto *hvac_${idSafe} = ${factory('HvacWidget', `${rect(x, y, w, h)}, "${escapeCString(label)}", state.${base}_hvac_mode.ptr(), state.${base}_current_temp.ptr(), state.${base}_target_temp.ptr(), state.${base}_hvac_action.ptr(), "${escapeCString(entityId)}", "${iconDown}", "${iconUp}", "${iconPower}", ${fmtFloat(tempStep)}, ${fmtFloat(minTemp)}, ${fmtFloat(maxTemp)}, "${escapeCString(onMode)}", ${onColor}, ${offColor}`)};\n`;
  if (visibilityExpr) {
    out += `${indent}hvac_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  if (dirtyBoundsExpr) {
    out += `${indent}hvac_${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
  }
  return out;
}

function generateWeatherWidget(c: WeatherComponent,
    factory: WidgetFactory, indent: string, offX = 0, offY = 0, visibilityExpr?: string,
    dirtyBoundsExpr?: string): string {
  const x = c.position.x + offX;
  const y = c.position.y + offY;
  const w = c.size?.width ?? 225;
  const h = c.size?.height ?? 200;
  const label = c.label ?? 'Weather';
  const entityId = c.stateBinding?.entityId ?? c.id;
  const base = stateVarFromEntity(entityId);
  const idSafe = safeCppIdentifier(c.id, 'component');
  const mode = c.mode ?? 'today';
  const callback = emitTapAction(c.onTap) || '[](){}';

  if (mode === 'forecast') {
    const dayPtrs = (day: string) =>
      `WeatherDayPointers{state.${base}_${day}_condition.ptr(), state.${base}_${day}_temperature.ptr(), state.${base}_${day}_humidity.ptr(), state.${base}_${day}_wind_speed.ptr(), state.${base}_${day}_precipitation.ptr()}`;

    let out = `${indent}auto *weather_${idSafe} = ${factory('WeatherWidget', `${rect(x, y, w, h)}, "${escapeCString(label)}", "${escapeCString(entityId)}", true, ${dayPtrs('day1')}, ${dayPtrs('day2')}, ${dayPtrs('day3')}, ${callback}`)};\n`;
    if (visibilityExpr) {
      out += `${indent}weather_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
    }
    if (dirtyBoundsExpr) {
      out += `${indent}weather_${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
    }
    return out;
  }

  const todayPtrs = `WeatherDayPointers{state.${base}_condition.ptr(), state.${base}_temperature.ptr(), state.${base}_humidity.ptr(), state.${base}_wind_speed.ptr(), state.${base}_precipitation.ptr()}`;
  let out = `${indent}auto *weather_${idSafe} = ${factory('WeatherWidget', `${rect(x, y, w, h)}, "${escapeCString(label)}", "${escapeCString(entityId)}", false, ${todayPtrs}, WeatherDayPointers{}, WeatherDayPointers{}, ${callback}`)};\n`;
  if (visibilityExpr) {
    out += `${indent}weather_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  if (dirtyBoundsExpr) {
    out += `${indent}weather_${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
  }
  return out;
}

function generateCalendarWidget(
    c: CalendarComponent,
    factory: WidgetFactory,
    indent: string,
    offX = 0,
    offY = 0,
    visibilityExpr?: string,
    dirtyBoundsExpr?: string,
): string {
  const x = c.position.x + offX;
  const y = c.position.y + offY;
  const w = c.size?.width ?? 225;
  const h = c.size?.height ?? 180;
  const label = c.label ?? 'Calendar';
  const entityId = c.entityBinding?.entityId ?? c.id;
  const eventsVar = calendarEventsVarFromEntity(entityId, c.durationDays);
  const idSafe = safeCppIdentifier(c.id, 'component');
  const maxItems = Math.max(1, Math.min(10, c.maxItems ?? 4));
  const rowHeight = 46;
  const scrollable = c.scrollable === true ? 'true' : 'false';
  const callback = emitTapAction(c.onTap) || '[](){}';

  let out = `${indent}auto *calendar_${idSafe} = ${factory('CalendarListWidget', `${rect(x, y, w, h)}, state.${eventsVar}.ptr(), "${escapeCString(label)}", "${escapeCString(entityId)}", ${maxItems}, ${rowHeight}, ${scrollable}, ${callback}`)};\n`;
  if (visibilityExpr) {
    out += `${indent}calendar_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  if (dirtyBoundsExpr) {
    out += `${indent}calendar_${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
  }
  return out;
}

function generateRangeSliderWidget(
    c: RangeSliderComponent,
    factory: WidgetFactory,
    indent: string,
    offX = 0,
    offY = 0,
    visibilityExpr?: string,
    dirtyBoundsExpr?: string,
): string {
  const x = c.position.x + offX;
  const y = c.position.y + offY;
  const w = c.size?.width ?? 320;
  const h = c.size?.height ?? 96;
  const label = c.label ?? 'RANGE';
  const unit = c.unit ?? '';
  const min = c.min ?? 0;
  const max = c.max ?? 100;
  const step = c.step ?? 1;
  const value = c.value ?? min + (max - min) / 2;
  const decimals = Math.max(0, Math.min(3, c.valueDecimals ?? 1));
  const idSafe = safeCppIdentifier(c.id, 'component');

  let out = `${indent}auto *${idSafe} = ${factory('RangeSliderWidget', `${rect(x, y, w, h)}, "${escapeCString(label)}", ${min}f, ${max}f, ${step}f, ${value}f, "${escapeCString(unit)}", ${decimals}`)};\n`;
  if (c.color) {
    out += `${indent}${idSafe}->set_accent(${emitColor(c.color)});\n`;
  }
  if (c.valueBinding?.entityId) {
    const stateVar = stateVarFromEntity(c.valueBinding.entityId);
    out += `${indent}${idSafe}->bind(state.${stateVar}.ptr());\n`;
  }
  if (visibilityExpr) {
    out += `${indent}${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  if (dirtyBoundsExpr) {
    out += `${indent}${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
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
  const todoEntity = todoEntityIdFromComponent(c) ?? "";
  const bridgeEntity = todoEntity ? "" : (c.itemsBinding?.entityId ?? "");
  const idSafe = safeCppIdentifier(c.id, 'component');
  let out = `${indent}auto *todo_${idSafe} = ${factory('TodoPreviewWidget', `${rect(x, y, w, h)}, state.${itemsVar}.ptr(), ${maxItems}, ${rowHeight}, ${scrollable}, ${checkable}, ${onTap || '[](){}'}, "${incompleteIcon}", "${completeIcon}", "${escapeCString(todoEntity)}", "${escapeCString(bridgeEntity)}"`)};\n`;
  if (c.color) {
    out += `${indent}todo_${idSafe}->set_color(${emitColor(c.color)});\n`;
  }
  if (visibilityExpr) {
    out += `${indent}todo_${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  if (dirtyBoundsExpr) {
    out += `${indent}todo_${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
  }
  return out;
}

function generateImageWidget(
    c: ImageComponent,
    factory: WidgetFactory,
    indent: string,
    offX = 0,
    offY = 0,
    visibilityExpr?: string,
    dirtyBoundsExpr?: string,
    defaultBgColor?: string,
): string {
  const x = c.position.x + offX;
  const y = c.position.y + offY;
  const w = c.size?.width ?? 100;
  const h = c.size?.height ?? 100;
  const idSafe = safeCppIdentifier(c.id, 'component');
  const imageId = imageIdFromComponentId(c.id);
  const fallbackImageId = imageFallbackIdFromComponentId(c.id);
  const isHaImage = c.imageSource === "ha" || (c.imageSource == null && !!c.imageBinding?.entityId);
  const bounds = rect(x, y, w, h);
  const ctorArgs = isHaImage ? `${bounds}, id(${imageId}), id(${fallbackImageId})` : `${bounds}, id(${imageId})`;
  let out = `${indent}auto *${idSafe} = ${factory('ImageWidget', ctorArgs)};\n`;
  const bgColor = c.backgroundColor ? emitColor(c.backgroundColor) : defaultBgColor;
  if (bgColor) {
    out += `${indent}${idSafe}->set_bg_color(${bgColor});\n`;
  }
  if (c.foregroundColor || c.backgroundColor) {
    out += `${indent}${idSafe}->set_tint(${c.foregroundColor ? emitColor(c.foregroundColor) : 'display::COLOR_ON'}, ${c.backgroundColor ? emitColor(c.backgroundColor) : 'display::COLOR_OFF'});\n`;
  }
  const callback = emitTapAction(c.onTap);
  if (callback) {
    out += `${indent}${idSafe}->on_tap(${callback});\n`;
  }
  if (visibilityExpr) {
    out += `${indent}${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  if (dirtyBoundsExpr) {
    out += `${indent}${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
  }
  return out;
}

function generateRectangleWidget(
    c: RectangleComponent,
    factory: WidgetFactory,
    indent: string,
    offX = 0,
    offY = 0,
    visibilityExpr?: string,
    dirtyBoundsExpr?: string,
    defaultBgColor = 'g_theme.info_bg',
): string {
  const x = c.position.x + offX;
  const y = c.position.y + offY;
  const w = c.size?.width ?? 100;
  const h = c.size?.height ?? 60;
  const colorExpr = c.backgroundColor ? emitColor(c.backgroundColor) : defaultBgColor;
  const idSafe = safeCppIdentifier(c.id, 'component');

  let out = `${indent}auto *${idSafe} = ${factory('RectWidget', `${rect(x, y, w, h)}, ${colorExpr}`)};\n`;
  if (visibilityExpr) {
    out += `${indent}${idSafe}->set_visibility_condition(${visibilityExpr});\n`;
  }
  if (dirtyBoundsExpr) {
    out += `${indent}${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});\n`;
  }
  return out;
}

function sortComponentsForWidgetLayering(components: Component[]): Component[] {
  return [...components].sort((a, b) => {
    const aIsBackground = a.type === 'rectangle';
    const bIsBackground = b.type === 'rectangle';
    if (aIsBackground === bIsBackground) return 0;
    return aIsBackground ? -1 : 1;
  });
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
      const fontSize = tc.fontSize ?? 'small';
      const staticText = labelStaticText(tc);
      let out = `${indent}auto *${idSafe} = ${factory('LabelWidget', `${rect(c.position.x + offsetX, c.position.y + offsetY, c.size?.width ?? 100, c.size?.height ?? 40)}, "${escapeCString(staticText)}", ${fontMap[fontSize]}`)};${visLine}${dirtyLine}\n`;
      out += emitLabelAlign(tc, idSafe, indent);
      out += emitLabelColor(tc, idSafe, indent);
      out += emitLabelBindings(tc, idSafe, indent);
      return out;
    }
    case 'digital_clock': {
      return generateDigitalClockWidget(c as DigitalClockComponent, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'button': {
      const label = c.label ?? '';
      const callback = emitTapAction(c.onTap ?? c.pressAction);
      const bounds = rect(c.position.x + offsetX, c.position.y + offsetY, c.size?.width ?? 80, c.size?.height ?? 36);
      let out = `${indent}auto *${idSafe} = ${factory('ButtonWidget', `${bounds}, "${escapeCString(label)}", ${callback || '[](){}'}, g_theme.primary`)};${visLine}${dirtyLine}\n`;
      out += emitButtonBorderColor(c, idSafe, indent);
      const iconGlyph = c.icon ? getMdiUtf8CEscape(c.icon) : null;
      if (iconGlyph) {
        out += `${indent}${idSafe}->set_icon("${iconGlyph}", &g_theme.icon);\n`;
      }
      return out;
    }
    case 'icon': {
      return generateIconWidget(c, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'image': {
      return generateImageWidget(c, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'rectangle': {
      return generateRectangleWidget(c, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'light_state': {
      const stateVar = stateVarFromEntity(c.stateBinding?.entityId ?? c.id);
      return generateLightWidget(c, stateVar, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'hvac': {
      return generateHvacWidget(c as HvacComponent, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'weather': {
      return generateWeatherWidget(c as WeatherComponent, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'calendar': {
      return generateCalendarWidget(c as CalendarComponent, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'todo_list': {
      const tc = c as TodoListComponent;
      const todoEntityId = todoEntityIdFromComponent(tc);
      const itemsVar = todoEntityId ? todoItemsVarFromTodoEntity(todoEntityId) : todoItemsVarFromBinding(tc.itemsBinding, c.id);
      return generateTodoListWidget(tc, itemsVar, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'tab_container':
      return generateTabContainerWidget(c, screenVar, indent, visibilityExpr, offsetX, offsetY, dirtyBoundsExpr);
    case 'range_slider':
      return generateRangeSliderWidget(c as RangeSliderComponent, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
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
  const bounds = rect(c.position.x + offsetX, c.position.y + offsetY, c.size?.width ?? 32, c.size?.height ?? 32);
  let out = `${indent}auto *${idSafe} = ${factory('IconWidget', `${bounds}, "${glyph}", g_theme.icon`)};\n`;
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

function generateDigitalClockWidget(
    c: DigitalClockComponent,
    factory: WidgetFactory,
    indent: string,
    offsetX = 0,
    offsetY = 0,
    visibilityExpr?: string,
    dirtyBoundsExpr?: string,
): string {
  const x = c.position.x + offsetX;
  const y = c.position.y + offsetY;
  const w = c.size?.width ?? 210;
  const h = c.size?.height ?? 92;
  const idSafe = c.id.replace(/[^a-zA-Z0-9_]/g, '_');
  const callback = emitTapAction(c.onTap);
  let out = `${indent}auto *${idSafe} = ${factory('DigitalClockWidget', `${rect(x, y, w, h)}, ${callback || '[](){}'}`)};\n`;
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
  const areaIdSafe = safeCppIdentifier(c.id, 'area');
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
    ? rect(areaX, areaY, areaW, areaH)
    : undefined;

  let out = '';
  out += `${indent}// Conditional area: ${c.id}\n`;
  if (areaW > 0 && areaH > 0) {
    const bgVar = `ca_bg_${areaIdSafe}`;
    out += `${indent}auto *${bgVar} = ${screenVar}->emplace_widget<RectWidget>(${rect(areaX, areaY, areaW, areaH)}, g_theme.info_bg);\n`;
    if (parentVisibilityExpr) {
      out += `${indent}${bgVar}->set_visibility_condition(${parentVisibilityExpr});\n`;
    }
    // bg's own bounds == area, so default mark_dirty() invalidates the
    // right rect on parent-visibility flip; no set_dirty_bounds needed.
  }

  for (let i = 0; i < variantsInOrder.length; i++) {
    const variant = variantsInOrder[i]!;
    if (variant.components.length === 0) continue;
    const variantIdSafe = safeCppIdentifier(variant.id, 'variant');
    const variantLambdaVar = `cv_${areaIdSafe}_${variantIdSafe}`;
    const activeExpr = variantActiveExpression(variantsInOrder, i, defaultIndex);

    if (parentVisibilityExpr) {
      out += `${indent}auto ${variantLambdaVar} = [&state, ${parentVisibilityExpr}]() { return ${parentVisibilityExpr}() && (${activeExpr}); };\n`;
    } else {
      out += `${indent}auto ${variantLambdaVar} = [&state]() { return ${activeExpr}; };\n`;
    }

    const orderedChildren = sortComponentsForWidgetLayering(variant.components);
    for (const child of orderedChildren) {
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
  const varName = `tc_${safeCppIdentifier(c.id, 'tab_container')}`;
  const bgVar = `${varName}_bg`;

  let out = '';
  out += `${indent}auto *${varName} = ${screenVar}->emplace_widget<TabContainerWidget>(${rect(x, y, w, h)}, g_theme.info_bg, g_theme.primary, ${clip});\n`;
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
    const orderedChildren = sortComponentsForWidgetLayering(c.tabs[i]!.components);
    for (const child of orderedChildren) {
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
  const idSafe = safeCppIdentifier(c.id, 'component');

  const factory: WidgetFactory = (typeName, args) =>
    `${containerVar}->emplace_child<${typeName}>(${tabIndex}, ${args})`;

  const visLine = visibilityExpr ? `\n${indent}${idSafe}->set_visibility_condition(${visibilityExpr});` : '';
  const dirtyLine = dirtyBoundsExpr ? `\n${indent}${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});` : '';

  switch (c.type) {
    case 'text': {
      const fontSize = c.fontSize ?? 'small';
      const staticText = labelStaticText(c);
      const wargs = `${rect(x, y, w, h)}, "${escapeCString(staticText)}", ${fontMap[fontSize]}`;
      const bodyIndent = tabBgVar ? `${indent}  ` : indent;
      const alignLine = emitLabelAlign(c, idSafe, bodyIndent);
      const bindLines = emitLabelBindings(c, idSafe, bodyIndent);
      let out: string;
      if (tabBgVar) {
        const visInner = visibilityExpr ? `\n${indent}  ${idSafe}->set_visibility_condition(${visibilityExpr});` : '';
        const dirtyInner = dirtyBoundsExpr ? `\n${indent}  ${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});` : '';
        out = `${indent}{\n${indent}  auto *${idSafe} = ${factory('LabelWidget', wargs)};\n${indent}  ${idSafe}->set_bg_color(${tabBgVar});${visInner}${dirtyInner}\n`;
      } else if (visibilityExpr || dirtyBoundsExpr) {
        out = `${indent}auto *${idSafe} = ${factory('LabelWidget', wargs)};${visLine}${dirtyLine}\n`;
      } else {
        out = `${indent}auto *${idSafe} = ${factory('LabelWidget', wargs)};\n`;
      }

      out += alignLine;
      out += emitLabelColor(c, idSafe, bodyIndent);
      out += bindLines;

      if (tabBgVar) {
        out += `${indent}}\n`;
      }
      return out;
    }
    case 'digital_clock': {
      return generateDigitalClockWidget(c as DigitalClockComponent, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'button': {
      const label = c.label ?? '';
      const callback = emitTapAction(c.onTap ?? c.pressAction);
      const wargs = `${rect(x, y, w, h)}, "${escapeCString(label)}", ${callback || '[](){}'}, g_theme.primary`;
      const iconGlyph = c.icon ? getMdiUtf8CEscape(c.icon) : null;
      if (visibilityExpr || iconGlyph || dirtyBoundsExpr || c.borderColor) {
        let out = `${indent}auto *${idSafe} = ${factory('ButtonWidget', wargs)};`;
        if (visibilityExpr) out += `\n${indent}${idSafe}->set_visibility_condition(${visibilityExpr});`;
        if (dirtyBoundsExpr) out += `\n${indent}${idSafe}->set_dirty_bounds(${dirtyBoundsExpr});`;
        if (iconGlyph) out += `\n${indent}${idSafe}->set_icon("${iconGlyph}", &g_theme.icon);`;
        out += emitButtonBorderColor(c, idSafe, indent);
        return `${out}\n`;
      }
      return `${indent}${factory('ButtonWidget', wargs)};\n`;
    }
    case 'icon': {
      const glyph = getMdiUtf8CEscape(c.icon);
      if (!glyph) {
        return `${indent}// Unknown icon '${c.icon}' (id: ${c.id}) - skipped\n`;
      }
      const wargs = `${rect(x, y, w, h)}, "${glyph}", g_theme.icon`;
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
    case 'image': {
      return generateImageWidget(c, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr, tabBgVar);
    }
    case 'rectangle': {
      const defaultBg = tabBgVar ?? 'g_theme.info_bg';
      return generateRectangleWidget(c, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr, defaultBg);
    }
    case 'light_state': {
      const stateVar = stateVarFromEntity(c.stateBinding?.entityId ?? c.id);
      return generateLightWidget(c, stateVar, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'hvac': {
      return generateHvacWidget(c as HvacComponent, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'weather': {
      return generateWeatherWidget(c as WeatherComponent, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'calendar': {
      return generateCalendarWidget(c as CalendarComponent, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'todo_list': {
      const tc = c as TodoListComponent;
      const todoEntityId = todoEntityIdFromComponent(tc);
      const itemsVar = todoEntityId ? todoItemsVarFromTodoEntity(todoEntityId) : todoItemsVarFromBinding(tc.itemsBinding, c.id);
      return generateTodoListWidget(tc, itemsVar, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
    }
    case 'conditional_area':
      return generateConditionalAreaNested(c, containerVar, tabIndex, indent, visibilityExpr, offsetX, offsetY, tabBgVar);
    case 'range_slider':
      return generateRangeSliderWidget(c as RangeSliderComponent, factory, indent, offsetX, offsetY, visibilityExpr, dirtyBoundsExpr);
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
  const areaIdSafe = safeCppIdentifier(c.id, 'area');
  const areaX = c.position.x + offsetX;
  const areaY = c.position.y + offsetY;
  const areaW = c.size?.width ?? 0;
  const areaH = c.size?.height ?? 0;
  const variantsInOrder = orderVariants(c);
  const defaultIndex = findDefaultVariantIndex(variantsInOrder, c.defaultVariantId);
  // See generateConditionalAreaWidget for why variant children dirty the
  // whole area instead of their own bounds.
  const dirtyBoundsExpr = (areaW > 0 && areaH > 0)
    ? rect(areaX, areaY, areaW, areaH)
    : undefined;

  let out = '';
  out += `${indent}// Conditional area (nested): ${c.id}\n`;
  if (areaW > 0 && areaH > 0) {
    const bgVar = `ca_bg_${areaIdSafe}`;
    const bgColor = tabBgVar ?? 'g_theme.info_bg';
    out += `${indent}auto *${bgVar} = ${containerVar}->emplace_child<RectWidget>(${tabIndex}, ${rect(areaX, areaY, areaW, areaH)}, ${bgColor});\n`;
    if (parentVisibilityExpr) {
      out += `${indent}${bgVar}->set_visibility_condition(${parentVisibilityExpr});\n`;
    }
  }

  for (let i = 0; i < variantsInOrder.length; i++) {
    const variant = variantsInOrder[i]!;
    if (variant.components.length === 0) continue;
    const variantIdSafe = safeCppIdentifier(variant.id, 'variant');
    const variantLambdaVar = `cv_${areaIdSafe}_${variantIdSafe}`;
    const activeExpr = variantActiveExpression(variantsInOrder, i, defaultIndex);

    if (parentVisibilityExpr) {
      out += `${indent}auto ${variantLambdaVar} = [&state, ${parentVisibilityExpr}]() { return ${parentVisibilityExpr}() && (${activeExpr}); };\n`;
    } else {
      out += `${indent}auto ${variantLambdaVar} = [&state]() { return ${activeExpr}; };\n`;
    }

    const orderedChildren = sortComponentsForWidgetLayering(variant.components);
    for (const child of orderedChildren) {
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
  const overlayEnabled = project.notificationOverlay != null && project.notificationOverlay.enabled !== false;
  const dw = project.display.width ?? 480;
  const dh = project.display.height ?? 480;

  const screenCtor = `    // Pre-create all screen slots
    for (int i = 0; i <= static_cast<int>(UiScreenId::${lastScreen}); i++) {
      auto id = static_cast<UiScreenId>(i);
      auto screen = std::make_unique<GenericScreen>();
      screens_[id] = screen.get();
      owned_screens_.push_back(std::move(screen));
    }
    current_ = screens_.at(UiScreenId::${firstScreen});`

  const overlayMember = overlayEnabled
    ? '\n  std::unique_ptr<NotificationOverlayWidget> notification_overlay_;'
    : '';

  const overlayPostUpdate = overlayEnabled
    ? '\n    if (notification_overlay_) notification_overlay_->update(now);'
    : '';

  const overlayPreTouch = overlayEnabled
    ? `    if (notification_overlay_ && notification_overlay_->is_visible(state)) {
      if (notification_overlay_->handle_touch(event, now)) return true;
    }
`
    : '';

  const overlayPostDraw = overlayEnabled
    ? '\n    if (notification_overlay_) notification_overlay_->draw(it, state);'
    : '';

  let setupBody = '';
  if (project.dashboardPages.length > 0) {
    const dashboardOffsetY = project.pageHeader
      ? Math.max(project.pageHeader.height, HEADER_RENDER_HEIGHT)
      : 0;
    setupBody += `  auto *home = screens.get_screen(UiScreenId::Home);\n`;
    if (project.pageHeader) {
      setupBody += `  auto *home_header = home->emplace_widget<HeaderWidget>(g_theme.header.font, g_theme.label.font, nullptr, nullptr);\n`;
      const pagesWithClock = project.dashboardPages
        .map((page, index) => hasDigitalClockInComponents(page.components) ? index : -1)
        .filter((index) => index >= 0);
      if (pagesWithClock.length > 0) {
        const clockPageExpression = pagesWithClock
          .map((index) => `state.home_page_index == ${index}`)
          .join(' || ');
        setupBody += `  home_header->set_visibility_condition([&state]() { return !(${clockPageExpression}); });\n`;
      }
    }
    for (const [index, page] of project.dashboardPages.entries()) {
      setupBody += `  {\n`;
      setupBody += `    auto p${index} = [&state]() { return state.home_page_index == ${index}; };\n`;
      setupBody += `    // Page: ${cppLineCommentText(page.name)}\n`;
      const orderedComponents = sortComponentsForWidgetLayering(page.components);
      const pageOffsetY = project.pageHeader && !hasDigitalClockInComponents(page.components)
        ? dashboardOffsetY
        : 0;
      for (const c of orderedComponents) {
        setupBody += generateComponentSetup(c, 'home', '    ', `p${index}`, 0, pageOffsetY);
        setupBody += '\n';
      }
      setupBody += `  }\n\n`;
    }
    setupBody += `  home->emplace_widget<PageIndicatorWidget>(460);\n`;
    setupBody += `  home->emplace_widget<LoadingWidget>();\n\n`;
  }

  for (const view of project.detailViews) {
    const cppName = detailScreenId(view.id, view.title);
    const screenVar = cppName.toLowerCase();
    const headerHeight = 50;
    const visibleContentHeight = Math.max(0, dh - headerHeight);
    // Detail view `height` is treated as full page height (including header),
    // while set_scroll_area expects scrollable content height below header.
    const contentHeight = Math.max(0, Math.round(detailContentHeight(view) - headerHeight));
    setupBody += `  auto *${screenVar} = screens.get_screen(UiScreenId::${cppName});\n`;
    setupBody += `  ${screenVar}->set_scroll_area(${headerHeight}, ${visibleContentHeight}, ${contentHeight});\n`;
    setupBody += `  auto *${screenVar}_header = ${screenVar}->emplace_widget<DetailHeaderWidget>(g_theme.header.font, g_theme.label.font, "${escapeCString(view.title)}",\n`;
    setupBody += `      [&screens]() { screens.navigate_to(UiScreenId::Home); });\n`;
    setupBody += `  ${screenVar}_header->set_scroll_exempt(true);\n`;
    if (view.components.length === 0) {
      setupBody += '\n';
      continue;
    }
    setupBody += `  // Detail: ${cppLineCommentText(view.title)}\n`;
    const orderedComponents = sortComponentsForWidgetLayering(view.components);
    for (const c of orderedComponents) {
      setupBody += generateComponentSetup(c, screenVar, '  ');
      setupBody += '\n';
    }
    setupBody += '\n';
  }

  let overlaySetup = '';
  if (overlayEnabled) {
    overlaySetup = `
  screens.notification_overlay_ = std::make_unique<NotificationOverlayWidget>(
      state.notification_title.ptr(),
      state.notification_body.ptr(),
      state.notification_severity.ptr(),
      state.notification_dismissed.ptr(),
      ${dw}, ${dh});
  screens.notification_overlay_->set_dismiss_callback([&state, dismiss_notification]() {
      state.notification_dismissed = *state.notification_body.ptr();
      UiInvalidation::request_full();
      if (dismiss_notification) dismiss_notification();
    });
`;
  }

  if (!setupBody.trim() && !overlaySetup.trim()) {
    setupBody = `  (void)state;\n  (void)on_action;\n  (void)dismiss_notification;\n  // No components\n`;
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
#include <string>
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

  void update(uint32_t now, const UiState &state) {
    current_->update(now, state);${overlayPostUpdate}
  }

  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) {
    (void)state;
${overlayPreTouch}    if (current_id_ == UiScreenId::Home &&
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

  void draw(display::Display &it, const UiState &state) {
    current_->draw(it, state);${overlayPostDraw}
  }

  Screen* current() { return current_; }
${overlayMember}

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
                           std::function<void(const std::string&, const std::string&)> on_action,
                           std::function<void()> dismiss_notification = nullptr) {
  auto make_ha_callback = [on_action](const char* entity, const char* service) {
    return [on_action, entity, service]() {
      if (on_action) on_action(entity, service);
    };
  };

${setupBody}${overlaySetup}}
`;
}
