import type {
  Project,
  Color,
  Theme,
  Page,
  DetailView,
  Component,
  LightStateComponent,
  TabContainerComponent,
  TextComponent,
  ButtonComponent,
  OnTapAction,
  ServiceAction,
  NavigationAction,
} from "@esphome-designer/schema";
import { RETRO_THEME } from "../themes/retro";

function toCppIdentifier(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function generateUITypesHeader(project: Project): string {
  const screenIds: string[] = [];

  for (const page of project.dashboardPages) {
    const id = toCppIdentifier(page.name);
    if (id && !screenIds.includes(id)) {
      screenIds.push(id);
    }
  }

  for (const view of project.detailViews) {
    const id = 'Detail' + toCppIdentifier(view.title);
    if (id && !screenIds.includes(id)) {
      screenIds.push(id);
    }
  }

  if (screenIds.length === 0) {
    screenIds.push('Home');
  }

  const screenEnum = screenIds.map(id => `  ${id}`).join(',\n');

  return `#pragma once

enum class TouchType {
  Down,
  Move,
  Up,
  Tap
};

struct TouchEvent {
  TouchType type;
  int x;
  int y;
  int start_x;
  int start_y;
  int dx;
  int dy;
};

enum class UiScreenId {
${screenEnum}
};
`;
}

function firstScreenId(project: Project): string {
  if (project.dashboardPages.length > 0) {
    return toCppIdentifier(project.dashboardPages[0].name) || 'Home';
  }
  return 'Home';
}

function cppDefaultValue(cppType: string): string {
  switch (cppType) {
    case 'bool': return 'false';
    case 'int': return '0';
    case 'float': return '0.0f';
    case 'std::string': return '""';
    default: return '{}';
  }
}

function cppTypeFor(cppType: string): string {
  switch (cppType) {
    case 'std::string': return 'std::string';
    default: return cppType;
  }
}

function collectAllComponents(components: Component[]): Component[] {
  const result: Component[] = [];
  for (const c of components) {
    result.push(c);
    if (c.type === 'tab_container') {
      const tc = c as TabContainerComponent;
      for (const tab of tc.tabs) {
        result.push(...collectAllComponents(tab.components));
      }
    }
  }
  return result;
}

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

export function generateUIStateHeader(project: Project): string {
  const fields = project.state?.fields ?? [];
  const screenName = firstScreenId(project);
  const existingNames = new Set(fields.map(f => f.name));
  const lightVars = collectLightStateVars(project).filter(v => !existingNames.has(v));

  const allFields: string[] = [
    ...fields.map(f => `  Observable<${cppTypeFor(f.cppType)}> ${f.name}{${cppDefaultValue(f.cppType)}};`),
    ...lightVars.map(v => `  Observable<bool> ${v}{false};`),
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
      UiInvalidation::request_partial();
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
${observableFields}
};
`;
}

function sanitizeDeviceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// TODO: this should be expanded to handle numeric/list/string entity bindings as well
function generateBindings(project: Project): string {
  const lines: string[] = [];
  const allComponents = collectAllComponents([
    ...project.dashboardPages.flatMap(p => p.components),
    ...project.detailViews.flatMap(v => v.components),
  ]);
  for (const c of allComponents) {
    if (c.type !== 'light_state') continue;
    const lc = c as LightStateComponent;
    const entityId = lc.stateBinding?.entityId;
    if (!entityId) continue;
    const stateVar = stateVarFromEntity(entityId);
    lines.push(`          bind_ha_bool("${entityId}", &g_ui_app.state().${stateVar});`);
  }
  return lines.join('\n');
}

export function generateESPHomeYAML(project: Project, _firmwareVersion?: string): string {
  const deviceName = sanitizeDeviceName(project.name);
  const friendlyName = project.name;
  const bindings = generateBindings(project);

  return `substitutions:
  device_name: ${deviceName}
  friendly_name: "${friendlyName}"

packages:
  base: !include base.yaml
  fonts: !include fonts.yaml
  hardware: !include hardware.yaml

esphome:
  on_boot:
    priority: -100
    then:
      - lambda: |-
          g_theme.header.font = id(font_medium);
          g_theme.label.font = id(font_small);
          g_theme.primary.font = id(font_medium);
          g_theme.accent.font = id(font_small);
          g_theme.neutral.font = id(font_small);
          g_theme.success.font = id(font_small);
          g_ui_app.on_action = [](const std::string& entity_id, const std::string& service) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr || !api->is_connected()) return;

            esphome::api::HomeAssistantServiceCallAction<> call(api, false);
            call.set_service(service);
            call.init_data(1);
            call.add_data("entity_id", entity_id);
            call.play();
          };
          UiRedraw::set_display_updater([]() { id(main_display).update(); });
          UiRedraw::request_full();
          id(main_display).update();

          auto bind_ha_bool = [](const std::string& entity_id, Observable<bool>* target) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(),
                [target](esphome::StringRef state) {
                  bool on = (state.size() == 2 && state.c_str()[0] == 'o'
                             && state.c_str()[1] == 'n');
                  target->set(on);
                  UiRedraw::trigger_display_update();
                });
          };
${bindings ? bindings + '\n' : ''}  includes:
    - includes/ui_types.h
    - includes/ui_state.h
    - includes/ui_invalidation.h
    - includes/ui_redraw.h
    - includes/ui_widgets.h
    - includes/ui_tab_container.h
    - includes/ui_chrome.h
    - includes/ui_screens.h
    - includes/ui_app.h
    - includes/ui_touch.h
    - includes/ui_renderer.h

globals:
  - id: touch_last_x
    type: int
    restore_value: no
    initial_value: "0"
  - id: touch_last_y
    type: int
    restore_value: no
    initial_value: "0"

touchscreen:
  platform: gt911
  id: touch_gt911
  i2c_id: touch_i2c
  display: main_display
  update_interval: 16ms
  on_touch:
    - lambda: |-
        id(touch_last_x) = touch.x;
        id(touch_last_y) = touch.y;
        BasicTouchHandler::handle_raw_touch(touch.x, touch.y, true);
  on_update:
    - lambda: |-
        for (auto &t : touches) {
          id(touch_last_x) = t.x;
          id(touch_last_y) = t.y;
          BasicTouchHandler::handle_raw_touch(t.x, t.y, true);
        }
  on_release:
    - lambda: |-
        BasicTouchHandler::handle_raw_touch(id(touch_last_x), id(touch_last_y), false);
        if (UiInvalidation::needs_redraw()) {
          id(main_display).update();
        }

script:
  - id: _ha_flag
    then:
      - homeassistant.service:
          service: switch.toggle
          data:
            entity_id: none

binary_sensor:
  - platform: homeassistant
    entity_id: sun.sun
    id: _ha_state_flag
    internal: true
`;
}

interface ScreenDescriptor {
  cppName: string;
  name: string;
}

function collectScreens(project: Project): ScreenDescriptor[] {
  const screens: ScreenDescriptor[] = [];
  for (const page of project.dashboardPages) {
    const cppName = toCppIdentifier(page.name) || 'Page';
    screens.push({ cppName, name: page.name });
  }
  for (const view of project.detailViews) {
    const cppName = 'Detail' + (toCppIdentifier(view.title) || 'View');
    screens.push({ cppName, name: view.title });
  }
  if (screens.length === 0) {
    screens.push({ cppName: 'Home', name: 'Home' });
  }
  return screens;
}

function stateVarFromEntity(entityId: string): string {
  return entityId.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

function escapeCString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function emitTapAction(action: OnTapAction | undefined): string {
  if (!action) return '';
  if (action.type === 'SERVICE_CALL') {
    const entity = action.target?.entityId ?? action.target?.deviceId ?? '';
    return `make_ha_callback("${entity}", "${action.service}")`;
  }
  if (action.type === 'OPEN_DETAIL') {
    const detailId = 'Detail' + (toCppIdentifier(action.targetId ?? '') || 'View');
    return `[&screens]() { screens.navigate_to(UiScreenId::${detailId}); }`;
  }
  return '';
}

type WidgetFactory = (typeName: string, args: string) => string;

function generateLightWidget(c: LightStateComponent, stateVar: string,
    factory: WidgetFactory, indent: string): string {
  const x = c.position.x;
  const y = c.position.y;
  const w = c.size?.width ?? 200;
  const h = c.size?.height ?? 90;
  const label = c.label ?? 'Light';
  const onText = c.onText ?? 'ON';
  const offText = c.offText ?? 'OFF';
  const callback = emitTapAction(c.onTap);

  let out = '';
  out += `${indent}${factory('RectWidget', `UiRect{${x}, ${y}, ${w}, 20}, g_theme.info_bg`)};\n`;
  out += `${indent}{\n`;
  out += `${indent}  auto *lbl = ${factory('LabelWidget', `UiRect{${x}, ${y}, ${w}, 20}, "", g_theme.label`)};\n`;
  out += `${indent}  lbl->bind(state.${stateVar}.ptr(), "${onText}", "${offText}");\n`;
  out += `${indent}}\n`;
  if (callback) {
    out += `${indent}${factory('ButtonWidget', `UiRect{${x + 10}, ${y + 30}, ${w - 20}, ${h - 30}}, "${escapeCString(label)}", ${callback}, g_theme.primary`)};\n`;
  }
  return out;
}

function generateComponentSetup(c: Component, screenVar: string, indent: string): string {
  const factory: WidgetFactory = (typeName, args) =>
    `${screenVar}->emplace_widget<${typeName}>(${args})`;

  switch (c.type) {
    case 'light_state': {
      const lc = c as LightStateComponent;
      const stateVar = stateVarFromEntity(lc.stateBinding?.entityId ?? lc.id);
      return generateLightWidget(lc, stateVar, factory, indent);
    }
    case 'tab_container':
      return generateTabContainerWidget(c as TabContainerComponent, screenVar, indent);
    default:
      return `${indent}// TODO: component type '${c.type}' (id: ${c.id})\n`;
  }
}

function generateTabContainerWidget(c: TabContainerComponent, screenVar: string, indent: string): string {
  const x = c.position.x;
  const y = c.position.y;
  const w = c.size?.width ?? 200;
  const h = c.size?.height ?? 200;
  const clip = c.clipContent ?? false;
  const varName = `tc_${c.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;

  let out = '';
  out += `${indent}auto *${varName} = ${screenVar}->emplace_widget<TabContainerWidget>(UiRect{${x}, ${y}, ${w}, ${h}}, Color(0,0,0), g_theme.primary, ${clip});\n`;

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
    for (const child of c.tabs[i].components) {
      out += generateNestedComponent(child, varName, i, indent);
    }
  }

  return out;
}

function generateNestedComponent(c: Component, containerVar: string, tabIndex: number, indent: string): string {
  const x = c.position.x;
  const y = c.position.y;
  const w = c.size?.width ?? 60;
  const h = c.size?.height ?? 20;

  const factory: WidgetFactory = (typeName, args) =>
    `${containerVar}->emplace_child<${typeName}>(${tabIndex}, ${args})`;

  switch (c.type) {
    case 'text': {
      const tc = c as TextComponent;
      const text = tc.text ?? '';
      const fontSize = tc.fontSize ?? 'small';
      const fontMap: Record<string, string> = {
        small: 'g_theme.label',
        medium: 'g_theme.header',
        large: 'g_theme.header',
      };
      return `${indent}${factory('LabelWidget', `UiRect{${x}, ${y}, ${w}, ${h}}, "${escapeCString(text)}", ${fontMap[fontSize]}`)};\n`;
    }
    case 'button': {
      const bc = c as ButtonComponent;
      const label = bc.label ?? '';
      const callback = emitTapAction(bc.pressAction);
      return `${indent}${factory('ButtonWidget', `UiRect{${x}, ${y}, ${w}, ${h}}, "${escapeCString(label)}", ${callback || '[](){}'}, g_theme.primary`)};\n`;
    }
    case 'light_state': {
      const lc = c as LightStateComponent;
      const stateVar = stateVarFromEntity(lc.stateBinding?.entityId ?? lc.id);
      return generateLightWidget(lc, stateVar, factory, indent);
    }
    default:
      return `${indent}// TODO: nested ${c.type} (id: ${c.id}) in tab ${tabIndex}\n`;
  }
}

export function generateUIScreensHeader(project: Project): string {
  const screens = collectScreens(project);

  const screenCtor = screens.map(s =>
    `    {\n      auto ${s.cppName.toLowerCase()} = std::make_unique<GenericScreen>();\n      screens_[UiScreenId::${s.cppName}] = ${s.cppName.toLowerCase()}.get();\n      owned_screens_.push_back(std::move(${s.cppName.toLowerCase()}));\n    }`
  ).join('\n');

  const firstScreen = screens[0]?.cppName ?? 'Home';

  let setupBody = '';
  for (const page of project.dashboardPages) {
    const cppName = toCppIdentifier(page.name) || 'Page';
    const screenVar = cppName.toLowerCase();
    if (page.components.length === 0) continue;
    setupBody += `  auto *${screenVar} = screens.get_screen(UiScreenId::${cppName});\n`;
    setupBody += `  // Page: ${page.name}\n`;
    for (const c of page.components) {
      setupBody += generateComponentSetup(c, screenVar, '  ');
      setupBody += '\n';
    }
    setupBody += '\n';
  }

  for (const view of project.detailViews) {
    const cppName = 'Detail' + (toCppIdentifier(view.title) || 'View');
    const screenVar = cppName.toLowerCase();
    if (view.components.length === 0) continue;
    setupBody += `  auto *${screenVar} = screens.get_screen(UiScreenId::${cppName});\n`;
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
#include "ui_tab_container.h"
#include "ui_chrome.h"
#include "ui_invalidation.h"
#include "ui_redraw.h"
#include <memory>
#include <vector>
#include <map>

namespace esphome {
namespace font {
class Font;
}
}  // namespace esphome

class Screen {
 public:
  virtual ~Screen() = default;
  virtual void enter() {}
  virtual void exit() {}
  virtual void layout() {}
  virtual void update(uint32_t now) = 0;
  virtual bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) = 0;
  virtual void draw(display::Display &it, const UiState &state) = 0;
};

class GenericScreen : public Screen {
 public:
  GenericScreen() = default;

  void add_widget(std::unique_ptr<Widget> widget) {
    widgets_.push_back(std::move(widget));
  }

  template<typename T, typename... Args>
  T* emplace_widget(Args&&... args) {
    auto widget = std::make_unique<T>(std::forward<Args>(args)...);
    T* ptr = widget.get();
    widgets_.push_back(std::move(widget));
    return ptr;
  }

  void enter() override {
    for (auto &w : widgets_) w->enter();
  }

  void exit() override {
    for (auto &w : widgets_) w->exit();
  }

  void layout() override {
    for (auto &w : widgets_) w->layout();
  }

  void update(uint32_t now) override {
    for (auto &w : widgets_) w->update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) override {
    for (auto &w : widgets_) {
      if (w->is_visible(state) && w->handle_touch(event, now)) return true;
    }
    return false;
  }

  void draw(display::Display &it, const UiState &state) override {
    for (auto &w : widgets_) {
      if (w->is_visible(state)) w->draw(it, state);
    }
  }

 private:
  std::vector<std::unique_ptr<Widget>> widgets_;
};

class ScreenController {
 public:
  ScreenController() {
${screenCtor}
    current_ = screens_.at(UiScreenId::${firstScreen});
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

  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) { return current_->handle_touch(event, now, state); }

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
