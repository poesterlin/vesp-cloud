import type { Project, LightStateComponent, Component, TodoListComponent, TextComponent, HvacComponent, WeatherComponent, CalendarComponent } from "@vesp-cloud/schema";
import { toCppIdentifier, firstScreenId, cppDefaultValue, cppTypeFor, stateVarFromEntity, collectAllComponents, todoItemsVarFromBinding, todoItemsVarFromTodoEntity, textBindingVar, calendarEventsVarFromEntity, todoEntityIdFromComponent } from "./utils";
import { collectConditionEntities } from "./condition-expr";
import { extractBindings, parseTemplate } from "../utils/template-utils";

function collectLightStateVars(project: Project): string[] {
  const vars = new Set<string>();
  const allComponents = collectAllComponents([
    ...project.dashboardPages.flatMap(p => p.components),
    ...project.detailViews.flatMap(v => v.components),
  ]);
  for (const c of allComponents) {
    if (c.type !== 'light_state') continue;
    const lc = c as LightStateComponent;
    const entityId = lc.stateBinding?.entityId ?? lc.id;
    vars.add(stateVarFromEntity(entityId));
  }
  return [...vars];
}

function collectTodoItemsVars(project: Project): string[] {
  const vars = new Set<string>();
  const allComponents = collectAllComponents([
    ...project.dashboardPages.flatMap(p => p.components),
    ...project.detailViews.flatMap(v => v.components),
  ]);
  for (const c of allComponents) {
    if (c.type !== "todo_list") continue;
    const tc = c as TodoListComponent;
    const todoEntityId = todoEntityIdFromComponent(tc);
    if (todoEntityId) {
      vars.add(todoItemsVarFromTodoEntity(todoEntityId));
    } else {
      vars.add(todoItemsVarFromBinding(tc.itemsBinding, tc.id));
    }
  }
  return [...vars];
}

function collectHvacStateVars(project: Project): { varName: string; cppType: string; initValue: string }[] {
  const result: { varName: string; cppType: string; initValue: string }[] = [];
  const allComponents = collectAllComponents([
    ...project.dashboardPages.flatMap(p => p.components),
    ...project.detailViews.flatMap(v => v.components),
  ]);
  for (const c of allComponents) {
    if (c.type !== 'hvac') continue;
    const hc = c as HvacComponent;
    const entityId = hc.stateBinding?.entityId ?? hc.id;
    const base = stateVarFromEntity(entityId);
    result.push({ varName: `${base}_hvac_mode`, cppType: 'std::string', initValue: '"off"' });
    result.push({ varName: `${base}_current_temp`, cppType: 'float', initValue: '0.0f' });
    result.push({ varName: `${base}_target_temp`, cppType: 'float', initValue: '20.0f' });
    result.push({ varName: `${base}_hvac_action`, cppType: 'std::string', initValue: '""' });
  }
  return result;
}

const WEATHER_FORECAST_FIELDS = [
  { suffix: 'condition',    cppType: 'std::string', initValue: '""' },
  { suffix: 'temperature',  cppType: 'float',       initValue: '0.0f' },
  { suffix: 'humidity',     cppType: 'float',       initValue: '0.0f' },
  { suffix: 'wind_speed',   cppType: 'float',       initValue: '0.0f' },
  { suffix: 'precipitation', cppType: 'float',       initValue: '0.0f' },
] as const;

const WEATHER_DAY_PREFIXES = ['day1', 'day2', 'day3'] as const;

function collectWeatherStateVars(project: Project): { varName: string; cppType: string; initValue: string }[] {
  const result: { varName: string; cppType: string; initValue: string }[] = [];
  const seen = new Set<string>();
  const allComponents = collectAllComponents([
    ...project.dashboardPages.flatMap(p => p.components),
    ...project.detailViews.flatMap(v => v.components),
  ]);
  for (const c of allComponents) {
    if (c.type !== 'weather') continue;
    const wc = c as WeatherComponent;
    const entityId = wc.stateBinding?.entityId ?? wc.id;
    const base = stateVarFromEntity(entityId);
    const mode = wc.mode ?? 'today';
    if (mode === 'forecast') {
      for (const day of WEATHER_DAY_PREFIXES) {
        for (const field of WEATHER_FORECAST_FIELDS) {
          const varName = `${base}_${day}_${field.suffix}`;
          if (!seen.has(varName)) {
            seen.add(varName);
            result.push({ varName, cppType: field.cppType, initValue: field.initValue });
          }
        }
      }
    } else {
      for (const field of WEATHER_FORECAST_FIELDS) {
        const varName = `${base}_${field.suffix}`;
        if (!seen.has(varName)) {
          seen.add(varName);
          result.push({ varName, cppType: field.cppType, initValue: field.initValue });
        }
      }
    }
  }
  return result;
}

function collectCalendarStateVars(project: Project): { varName: string; cppType: string; initValue: string }[] {
  const result: { varName: string; cppType: string; initValue: string }[] = [];
  const seen = new Set<string>();
  const allComponents = collectAllComponents([
    ...project.dashboardPages.flatMap(p => p.components),
    ...project.detailViews.flatMap(v => v.components),
  ]);
  for (const c of allComponents) {
    if (c.type !== 'calendar') continue;
    const cc = c as CalendarComponent;
    const entityId = cc.entityBinding?.entityId ?? cc.id;
    const varName = calendarEventsVarFromEntity(entityId, cc.durationDays);
    if (seen.has(varName)) continue;
    seen.add(varName);
    result.push({ varName, cppType: 'std::string', initValue: '"NO EVENTS"' });
  }
  return result;
}

function collectTextEntityVars(project: Project): string[] {
  const vars = new Set<string>();
  const allComponents = collectAllComponents([
    ...project.dashboardPages.flatMap(p => p.components),
    ...project.detailViews.flatMap(v => v.components),
  ]);
  for (const c of allComponents) {
    if (c.type !== "text") continue;
    const tc = c as TextComponent;
    // Bindings are derived from the `{{...}}` placeholders in the
    // template text itself, so the declared Observables always match
    // what the runtime will reference. The legacy single-binding
    // `textBinding` is honoured for backward compat with older
    // projects.
    if (tc.textBinding) {
      vars.add(textBindingVar(tc.textBinding));
    }
    for (const b of extractBindings(parseTemplate(tc.text ?? ""))) {
      vars.add(textBindingVar(b));
    }
  }
  return [...vars];
}

export function generateUIStateHeader(project: Project): string {
  const fields = project.state?.fields ?? [];
  const screenName = firstScreenId(project);
  const existingNames = new Set(fields.map(f => f.name));
  const lightVars = collectLightStateVars(project).filter(v => !existingNames.has(v));
  for (const v of lightVars) existingNames.add(v);
  const todoItemsVars = collectTodoItemsVars(project).filter(v => !existingNames.has(v));
  for (const v of todoItemsVars) existingNames.add(v);
  const textVars = collectTextEntityVars(project).filter(v => !existingNames.has(v));
  for (const v of textVars) existingNames.add(v);
  const hvacVars = collectHvacStateVars(project).filter(v => !existingNames.has(v.varName));
  for (const v of hvacVars) existingNames.add(v.varName);
  const weatherVars = collectWeatherStateVars(project).filter(v => !existingNames.has(v.varName));
  for (const v of weatherVars) existingNames.add(v.varName);
  const calendarVars = collectCalendarStateVars(project).filter(v => !existingNames.has(v.varName));
  for (const v of calendarVars) existingNames.add(v.varName);
  const conditionEntities = collectConditionEntities(project).filter(e => !existingNames.has(e.varName));

  const overlayEnabled = project.notificationOverlay != null && project.notificationOverlay.enabled !== false;
  const overlayVars: string[] = [];
  if (overlayEnabled) {
    overlayVars.push('  Observable<std::string> notification_title{""};');
    overlayVars.push('  Observable<std::string> notification_body{""};');
    overlayVars.push('  Observable<std::string> notification_severity{""};');
    overlayVars.push('  Observable<std::string> notification_dismissed{""};');
  }

  const allFields: string[] = [
    ...fields.map(f => `  Observable<${cppTypeFor(f.cppType)}> ${f.name}{${cppDefaultValue(f.cppType)}};`),
    ...lightVars.map(v => `  Observable<bool> ${v}{false};`),
    ...todoItemsVars.map(v => `  Observable<std::string> ${v}{"LIST EMPTY"};`),
    ...textVars.map(v => `  Observable<std::string> ${v}{""};`),
    ...conditionEntities.map(e => `  Observable<${cppTypeFor(e.cppType)}> ${e.varName}{${cppDefaultValue(e.cppType)}};`),
    ...hvacVars.map(v => `  Observable<${cppTypeFor(v.cppType)}> ${v.varName}{${v.initValue}};`),
    ...weatherVars.map(v => `  Observable<${cppTypeFor(v.cppType)}> ${v.varName}{${v.initValue}};`),
    ...calendarVars.map(v => `  Observable<${cppTypeFor(v.cppType)}> ${v.varName}{${v.initValue}};`),
    ...overlayVars,
  ];

  const observableFields = allFields.length > 0 ? allFields.join('\n') : '';

  return `#pragma once

#include "esphome.h"
#include "ui_types.h"
#include "ui_invalidation.h"

template<typename T>
class Observable {
 public:
  Observable() : value_(T{}) {}
  explicit Observable(const T &v) : value_(v) {}

  Observable &operator=(const T &v) {
    if (value_ != v) {
      value_ = v;
      // No invalidation here: bound widgets poll their values in update()
      // and self-mark dirty via mark_dirty(). The render is still triggered
      // by whoever owns the state change (HA callback -> trigger_display_update,
      // touch handler -> main_display.update()).
    }
    return *this;
  }

  operator T() const { return value_; }

  const T *ptr() const { return &value_; }

  void set(const T &v) { *this = v; }

 private:
  T value_;
};

struct RenderScheduler {
  bool full_redraw = true;
  uint32_t last_frame = 0;
  uint32_t active_interval_ms = 33;
  uint32_t idle_interval_ms = 300;
  bool active_animation = false;

  void invalidate_all() { full_redraw = true; }

  bool should_draw(uint32_t now) const {
    if (full_redraw) {
      return true;
    }
    const uint32_t interval = active_animation ? active_interval_ms : idle_interval_ms;
    return (now - last_frame) >= interval;
  }

  void did_draw(uint32_t now) {
    last_frame = now;
    full_redraw = false;
  }
};

struct UiState {
  UiScreenId current_screen = UiScreenId::${screenName};
  int home_page_index = 0;
  int home_total_pages = ${Math.max(1, project.dashboardPages.length)};
  Observable<bool> ha_connected{false};
${observableFields}
  bool image_bootstrap_active = false;
  uint32_t image_bootstrap_started_at = 0;
  int online_images_expected = 0;
  int online_images_completed = 0;
  int online_images_failed = 0;
  static constexpr uint32_t ONLINE_IMAGE_BOOTSTRAP_TIMEOUT_MS = 30000;

  bool should_show_loading() const {
    if (loading_done) return false;
    if (!ha_connected) return true;
    if (!image_bootstrap_active) { loading_done = true; return false; }
    if (online_images_expected <= 0) { loading_done = true; return false; }
    const int done = online_images_completed + online_images_failed;
    if (done >= online_images_expected) { loading_done = true; return false; }
    if (millis() - image_bootstrap_started_at >= ONLINE_IMAGE_BOOTSTRAP_TIMEOUT_MS) {
      loading_done = true;
      return false;
    }
    return true;
  }

  mutable bool loading_done = false;

  int images_rendered_this_frame = 0;
  static constexpr int MAX_IMAGES_PER_FRAME = 2;
  int image_fetches_in_flight = 0;
  static constexpr int MAX_CONCURRENT_IMAGE_FETCHES = 1;
};
`;
}
