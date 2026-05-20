import type { Project, LightStateComponent, Component, TodoListComponent, TextComponent } from "@esphome-designer/schema";
import { toCppIdentifier, firstScreenId, cppDefaultValue, cppTypeFor, stateVarFromEntity, collectAllComponents, todoItemsVarFromBinding, textBindingVar } from "./utils";
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
    vars.add(todoItemsVarFromBinding(tc.itemsBinding, tc.id));
  }
  return [...vars];
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
${observableFields}
};
`;
}
