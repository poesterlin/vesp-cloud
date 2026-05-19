import type { Project, LightStateComponent, StateField, TodoListComponent } from "@esphome-designer/schema";
import { sanitizeDeviceName, stateVarFromEntity, collectAllComponents, collectProjectIconNames, todoItemsVarFromBinding } from "./utils";
import { collectConditionEntities, type ConditionEntityType } from "./condition-expr";
import { ICON_FONT_ID, getIconGlyphs } from "./mdi-icons";

const BINDER_BY_TYPE: Record<string, string> = {
  'bool': 'bind_ha_bool',
  'int': 'bind_ha_int',
  'float': 'bind_ha_float',
  'std::string': 'bind_ha_string',
};

function generateBindings(project: Project): string {
  const lines: string[] = [];
  const claimed = new Set<string>();

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
    if (claimed.has(stateVar)) continue;
    claimed.add(stateVar);
    lines.push(`          bind_ha_bool("${entityId}", &g_ui_app.state().${stateVar});`);
  }

  for (const c of allComponents) {
    if (c.type !== "todo_list") continue;
    const tc = c as TodoListComponent;
    const entityId = tc.itemsBinding?.entityId;
    if (!entityId) continue;
    const stateVar = todoItemsVarFromBinding(tc.itemsBinding, tc.id);
    if (claimed.has(stateVar)) continue;
    claimed.add(stateVar);
    const attribute = tc.itemsBinding?.attribute ?? "all_items";
    lines.push(`          bind_ha_string_attr("${entityId}", "${attribute}", &g_ui_app.state().${stateVar});`);
  }

  for (const f of (project.state?.fields ?? []) as StateField[]) {
    if (!f.haEntity) continue;
    if (claimed.has(f.name)) continue;
    const binder = BINDER_BY_TYPE[f.cppType];
    if (!binder) continue;
    claimed.add(f.name);
    lines.push(`          ${binder}("${f.haEntity}", &g_ui_app.state().${f.name});`);
  }

  for (const e of collectConditionEntities(project)) {
    if (claimed.has(e.varName)) continue;
    const cppType: ConditionEntityType = e.cppType;
    const binder = BINDER_BY_TYPE[cppType];
    if (!binder) continue;
    claimed.add(e.varName);
    lines.push(`          ${binder}("${e.entityId}", &g_ui_app.state().${e.varName});`);
  }

  return lines.join('\n');
}

export function generateESPHomeYAML(project: Project, _firmwareVersion?: string): string {
  const deviceName = sanitizeDeviceName(project.name);
  const friendlyName = project.name;
  const bindings = generateBindings(project);
  const iconGlyphs = getIconGlyphs(collectProjectIconNames(project));
  const iconFontAssignment = iconGlyphs.size > 0
    ? `\n          g_theme.icon.font = id(${ICON_FONT_ID});`
    : '';

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
          g_theme.success.font = id(font_small);${iconFontAssignment}
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

          auto bind_ha_string = [](const std::string& entity_id, Observable<std::string>* target) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(),
                [target](esphome::StringRef state) {
                  target->set(std::string(state.c_str(), state.size()));
                  UiRedraw::trigger_display_update();
                });
          };

          auto bind_ha_string_attr = [](const std::string& entity_id, const std::string& attribute,
                                        Observable<std::string>* target) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(attribute),
                [target](esphome::StringRef state) {
                  target->set(std::string(state.c_str(), state.size()));
                  UiRedraw::trigger_display_update();
                });
          };

          auto bind_ha_float = [](const std::string& entity_id, Observable<float>* target) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(),
                [target](esphome::StringRef state) {
                  std::string s(state.c_str(), state.size());
                  if (s.empty()) return;
                  char *end = nullptr;
                  float v = strtof(s.c_str(), &end);
                  if (end == s.c_str()) return;
                  target->set(v);
                  UiRedraw::trigger_display_update();
                });
          };

          auto bind_ha_int = [](const std::string& entity_id, Observable<int>* target) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(),
                [target](esphome::StringRef state) {
                  std::string s(state.c_str(), state.size());
                  if (s.empty()) return;
                  char *end = nullptr;
                  long v = strtol(s.c_str(), &end, 10);
                  if (end == s.c_str()) return;
                  target->set(static_cast<int>(v));
                  UiRedraw::trigger_display_update();
                });
          };
${bindings ? bindings + '\n' : ''}  includes:
    - includes/ui_types.h
    - includes/ui_state.h
    - includes/ui_invalidation.h
    - includes/ui_redraw.h
    - includes/ui_widgets.h
    - includes/ui_chrome.h
    - includes/ui_screen_base.h
    - includes/ui_screens.h
    - includes/ui_app.h
    - includes/ui_touch.h
    - includes/ui_renderer.h
    - includes/ui_tab_container.h
    - includes/ui_scrollable_detail.h

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
        if (UiInvalidation::needs_redraw()) {
          id(main_display).update();
        }
  on_update:
    - lambda: |-
        for (auto &t : touches) {
          id(touch_last_x) = t.x;
          id(touch_last_y) = t.y;
          BasicTouchHandler::handle_raw_touch(t.x, t.y, true);
        }
        if (UiInvalidation::needs_redraw()) {
          id(main_display).update();
        }
  on_release:
    - lambda: |-
        BasicTouchHandler::handle_raw_touch(id(touch_last_x), id(touch_last_y), false);
        if (UiInvalidation::needs_redraw()) {
          id(main_display).update();
        }

interval:
  - interval: 10s
    then:
      - lambda: |-
          uint32_t now = millis();
          if (now - g_ui_app.last_interaction_time > 20000) {
            auto screen_id = g_ui_app.screens().current_id();
            if (screen_id == UiScreenId::Home
                && g_ui_app.state().home_page_index != 0) {
              g_ui_app.state().home_page_index = 0;
              UiInvalidation::request_full();
            } else if (screen_id != UiScreenId::Home) {
              g_ui_app.screens().navigate_to(UiScreenId::Home);
            }
            // else: idle on home page 0 -- let widgets poll for changes
            // (HeaderWidget detects minute changes) and self-mark dirty.
          }
          // Trigger an update so widgets get a chance to poll their bound
          // state. If nothing actually changed, render_basic_ui() returns
          // early at the needs_redraw() check.
          id(main_display).update();

# Dummy: forces ESPHome to compile api::HomeAssistantServiceCallAction
# so the generic C++ lambda in on_boot can use it for dynamic service calls.
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
