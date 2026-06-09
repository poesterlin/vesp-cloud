import type { EntityBinding, Project, LightStateComponent, StateField, TodoListComponent, TextComponent, ImageComponent } from "@esphome-designer/schema";
import { sanitizeDeviceName, stateVarFromEntity, collectAllComponents, collectProjectIconNames, todoItemsVarFromBinding, textBindingVar, bindingKey, imageIdFromComponentId, escapeCString } from "./utils";
import { collectConditionEntities, type ConditionEntityType } from "./condition-expr";
import { ICON_FONT_ID, getIconGlyphs } from "./mdi-icons";
import { extractBindings, parseTemplate } from "../utils/template-utils";

/**
 * Collect every EntityBinding referenced by a text component. The source
 * of truth is the `{{...}}` template embedded in `tc.text` (parsed via
 * the shared template-utils); the legacy `tc.textBinding` field is also
 * honoured for backward compat with older projects.
 */
function collectTextBindings(tc: TextComponent): EntityBinding[] {
  const seen = new Set<string>();
  const out: EntityBinding[] = [];
  const push = (b: EntityBinding | undefined) => {
    if (!b?.entityId) return;
    const key = bindingKey(b);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(b);
  };
  if (tc.textBinding) push(tc.textBinding);
  for (const b of extractBindings(parseTemplate(tc.text ?? ""))) push(b);
  return out;
}

function collectProjectComponents(project: Project) {
  return collectAllComponents([
    ...project.dashboardPages.flatMap(p => p.components),
    ...project.detailViews.flatMap(v => v.components),
  ]);
}

function collectImageComponents(project: Project): ImageComponent[] {
  return collectProjectComponents(project)
    .filter((c): c is ImageComponent => c.type === "image");
}

function imageResize(c: ImageComponent): string {
  return c.resize ?? `${c.size?.width ?? 100}x${c.size?.height ?? 100}`;
}

function isHomeAssistantImage(c: ImageComponent): boolean {
  return c.imageSource === "ha" || (c.imageSource == null && !!c.imageBinding?.entityId);
}

function generateStaticImagesYAML(project: Project): string {
  const lines: string[] = [];
  for (const c of collectImageComponents(project)) {
    if (isHomeAssistantImage(c)) continue;
    lines.push(`  - file: "${escapeCString(c.file)}"`);
    lines.push(`    id: ${imageIdFromComponentId(c.id)}`);
    lines.push(`    type: ${c.image_type}`);
    lines.push(`    resize: ${imageResize(c)}`);
    if (c.transparency) lines.push(`    transparency: ${c.transparency}`);
    if (c.invert_alpha != null) lines.push(`    invert_alpha: ${c.invert_alpha}`);
    if (c.dither) lines.push(`    dither: ${c.dither}`);
    if (c.byte_order) lines.push(`    byte_order: ${c.byte_order}`);
  }
  return lines.length > 0 ? `\nimage:\n${lines.join('\n')}\n` : '';
}

function generateOnlineImagesYAML(project: Project): string {
  const lines: string[] = [];
  for (const c of collectImageComponents(project)) {
    if (!isHomeAssistantImage(c) || !c.imageBinding?.entityId) continue;
    lines.push(`  - url: "http://127.0.0.1/"`);
    lines.push(`    id: ${imageIdFromComponentId(c.id)}`);
    lines.push(`    format: ${c.onlineFormat ?? "png"}`);
    lines.push(`    type: ${c.image_type}`);
    lines.push(`    resize: ${imageResize(c)}`);
    if (c.transparency) lines.push(`    transparency: ${c.transparency}`);
    if (c.byte_order) lines.push(`    byte_order: ${c.byte_order}`);
    lines.push(`    on_download_finished:`);
    lines.push(`      then:`);
    lines.push(`        - lambda: |-`);
    lines.push(`            g_ui_app.state().online_images_completed++;`);
    lines.push(`            if (g_ui_app.state().image_bootstrap_active) {`);
    lines.push(`              const int done = g_ui_app.state().online_images_completed + g_ui_app.state().online_images_failed;`);
    lines.push(`              if (done >= g_ui_app.state().online_images_expected) {`);
    lines.push(`                g_ui_app.state().image_bootstrap_active = false;`);
    lines.push(`              }`);
    lines.push(`            }`);
    lines.push(`            UiRedraw::request_full();`);
    lines.push(`            UiRedraw::trigger_display_update();`);
    lines.push(`    on_error:`);
    lines.push(`      then:`);
    lines.push(`        - lambda: |-`);
    lines.push(`            g_ui_app.state().online_images_failed++;`);
    lines.push(`            if (g_ui_app.state().image_bootstrap_active) {`);
    lines.push(`              const int done = g_ui_app.state().online_images_completed + g_ui_app.state().online_images_failed;`);
    lines.push(`              if (done >= g_ui_app.state().online_images_expected) {`);
    lines.push(`                g_ui_app.state().image_bootstrap_active = false;`);
    lines.push(`              }`);
    lines.push(`            }`);
    lines.push(`            UiRedraw::request_full();`);
    lines.push(`            UiRedraw::trigger_display_update();`);
  }
  return lines.length > 0 ? `\nonline_image:\n${lines.join('\n')}\n` : '';
}

function hasOnlineImages(project: Project): boolean {
  return collectImageComponents(project).some(c => isHomeAssistantImage(c) && !!c.imageBinding?.entityId);
}

function countOnlineImages(project: Project): number {
  return collectImageComponents(project).filter(c => isHomeAssistantImage(c) && !!c.imageBinding?.entityId).length;
}

const BINDER_BY_TYPE: Record<string, string> = {
  'bool': 'bind_ha_bool',
  'int': 'bind_ha_int',
  'float': 'bind_ha_float',
  'std::string': 'bind_ha_string',
};

function generateBindings(project: Project): string {
  const lines: string[] = [];
  const claimed = new Set<string>();

  const allComponents = collectProjectComponents(project);

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

  for (const c of allComponents) {
    if (c.type !== "text") continue;
    const tc = c as TextComponent;
    for (const b of collectTextBindings(tc)) {
      const stateVar = textBindingVar(b);
      if (claimed.has(stateVar)) continue;
      claimed.add(stateVar);
      if (b.attribute) {
        lines.push(`          bind_ha_string_attr("${b.entityId}", "${b.attribute}", &g_ui_app.state().${stateVar});`);
      } else {
        lines.push(`          bind_ha_string("${b.entityId}", &g_ui_app.state().${stateVar});`);
      }
    }
  }

  for (const c of allComponents) {
    if (c.type !== "image") continue;
    const ic = c as ImageComponent;
    if (!isHomeAssistantImage(ic)) continue;
    const entityId = ic.imageBinding?.entityId;
    if (!entityId) continue;
    const attribute = ic.imageBinding?.attribute ?? "entity_picture";
    const key = `${entityId}::${attribute}::${imageIdFromComponentId(ic.id)}`;
    if (claimed.has(key)) continue;
    claimed.add(key);
    lines.push(`          bind_ha_image_url("${entityId}", "${attribute}", id(${imageIdFromComponentId(ic.id)}));`);
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

function generateNotificationSubscriptions(project: Project): string {
  const overlay = project.notificationOverlay;
  if (!overlay || overlay.enabled === false) return '';
  const lines: string[] = [];
  if (overlay.titleEntityId) {
    lines.push(`          bind_ha_string("${overlay.titleEntityId}", &g_ui_app.state().notification_title);`);
  }
  if (overlay.bodyEntityId) {
    lines.push(`          bind_ha_string("${overlay.bodyEntityId}", &g_ui_app.state().notification_body);`);
  }
  if (overlay.severityEntityId) {
    lines.push(`          bind_ha_string("${overlay.severityEntityId}", &g_ui_app.state().notification_severity);`);
  }
  // Dismiss action: clears HA title/body entities via input_text.set_value
  if (overlay.titleEntityId || overlay.bodyEntityId) {
    const clearLines: string[] = [];
    if (overlay.titleEntityId) {
      clearLines.push(`          clear_text_entity("${overlay.titleEntityId}");`);
    }
    if (overlay.bodyEntityId) {
      clearLines.push(`          clear_text_entity("${overlay.bodyEntityId}");`);
    }
    lines.push('');
    lines.push('          auto clear_text_entity = [](const std::string& entity_id) {');
    lines.push('            auto *api = esphome::api::global_api_server;');
    lines.push('            if (api == nullptr || !api->is_connected()) return;');
    lines.push('            esphome::api::HomeAssistantServiceCallAction<> call(api, false);');
    lines.push('            call.set_service("input_text.set_value");');
    lines.push('            call.init_data(2);');
    lines.push('            call.add_data("entity_id", entity_id);');
    lines.push('            call.add_data("value", "");');
    lines.push('            call.play();');
    lines.push('          };');
    lines.push('');
    lines.push('          g_ui_app.dismiss_notification = [&clear_text_entity]() {');
    for (const l of clearLines) {
      lines.push(l);
    }
    lines.push('          };');
  }
  return lines.join('\n');
}

export function generateESPHomeYAML(project: Project, _firmwareVersion?: string): string {
  const deviceName = sanitizeDeviceName(project.name);
  const friendlyName = project.name;
  const onlineImagesEnabled = hasOnlineImages(project);
  const onlineImageCount = countOnlineImages(project);
  const httpOtaEnabled = !!(project.secrets?.firmwareUpdateUrl);
  const httpRequestEnabled = onlineImagesEnabled || httpOtaEnabled;
  const bindings = generateBindings(project);
  const notificationSubs = generateNotificationSubscriptions(project);
  const notificationBindings = notificationSubs ? `\n${notificationSubs}` : '';
  const iconGlyphs = getIconGlyphs(collectProjectIconNames(project));
  const iconFontAssignment = iconGlyphs.size > 0
    ? `\n          g_theme.icon.font = id(${ICON_FONT_ID});`
    : '';
  const homeAssistantBaseUrlSubstitution = onlineImagesEnabled
    ? `\n  home_assistant_base_url: !secret home_assistant_base_url`
    : '';
  const imageYaml = generateStaticImagesYAML(project);
  const onlineImageYaml = generateOnlineImagesYAML(project);
  const httpRequestYaml = httpRequestEnabled
    ? `\nhttp_request:\n  verify_ssl: false\n  timeout: 10s\n`
    : '';
  const httpOtaYaml = httpOtaEnabled
    ? `\nota:\n  - platform: http_request\n`
    : '';
  const haBaseUrlLocal = onlineImagesEnabled
    ? `\n          const std::string ha_base_url = "\${home_assistant_base_url}";\n`
    : '';
  const imageBindingHelper = onlineImagesEnabled
    ? `
          auto bind_ha_image_url = [ha_base_url](const std::string& entity_id, const std::string& attribute, auto *target) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(attribute),
                [target, ha_base_url](esphome::StringRef state) {
                  std::string url(state.c_str(), state.size());
                  if (url.empty() || url == "unknown" || url == "unavailable") return;
                  if (!ha_base_url.empty() && url.rfind("/", 0) == 0) {
                    url = ha_base_url + url;
                  }
                  target->set_url(url);
                  target->update();
                  UiRedraw::trigger_display_update();
                });
          };
`
    : '';

  return `substitutions:
  device_name: ${deviceName}
  friendly_name: "${friendlyName}"
  timezone: "${project.timezone || "UTC"}"${homeAssistantBaseUrlSubstitution}

packages:
  base: !include base.yaml
  fonts: !include fonts.yaml
  hardware: !include hardware.yaml
${imageYaml}${onlineImageYaml}${httpRequestYaml}${httpOtaYaml}

esphome:
  on_boot:
    priority: -100
    then:
      - lambda: |-
          g_theme.header.font = id(font_medium);
          g_theme.label.font = id(font_small);
          g_theme.primary.font = id(font_small);
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
          g_ui_app.state().online_images_expected = ${onlineImageCount};
          g_ui_app.state().online_images_completed = 0;
          g_ui_app.state().online_images_failed = 0;
          g_ui_app.state().image_bootstrap_active = false;
          g_ui_app.state().image_bootstrap_started_at = 0;
          UiRedraw::request_full();
          id(main_display).update();
${haBaseUrlLocal}

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

          // Numbers from Home Assistant can arrive with absurd precision
          // (e.g. a sensor reporting "21.3442857142857"). The display has
          // no horizontal room for that, so we trim purely-numeric strings
          // with more than one fractional digit down to one decimal. Non-
          // numeric strings pass through unchanged.
          auto trim_numeric = [](esphome::StringRef state) -> std::string {
            std::string s(state.c_str(), state.size());
            if (s.empty()) return s;
            const char *c = s.c_str();
            char *end = nullptr;
            float v = strtof(c, &end);
            if (end == c || *end != '\\0') return s;
            auto dot = s.find('.');
            if (dot == std::string::npos || s.size() - dot <= 2) return s;
            char buf[32];
            snprintf(buf, sizeof(buf), "%.1f", v);
            std::string out(buf);
            // Strip trailing ".0" so "21.0" becomes "21"
            if (out.size() >= 2 && out.compare(out.size() - 2, 2, ".0") == 0) {
              out.resize(out.size() - 2);
            }
            return out;
          };

          auto bind_ha_string = [trim_numeric](const std::string& entity_id, Observable<std::string>* target) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(),
                [target, trim_numeric](esphome::StringRef state) {
                  target->set(trim_numeric(state));
                  UiRedraw::trigger_display_update();
                });
          };

          auto bind_ha_string_attr = [trim_numeric](const std::string& entity_id, const std::string& attribute,
                                        Observable<std::string>* target) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(attribute),
                [target, trim_numeric](esphome::StringRef state) {
                  target->set(trim_numeric(state));
                  UiRedraw::trigger_display_update();
                });
          };
${imageBindingHelper}

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
${bindings ? bindings + '\n' : ''}${notificationBindings ? notificationBindings + '\n' : ''}  includes:
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
    - includes/ui_retro.h
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
  - interval: 50ms
    then:
      - lambda: |-
          auto *api = esphome::api::global_api_server;
          bool connected = (api != nullptr && api->is_connected());
          if (connected != g_ui_app.state().ha_connected) {
            g_ui_app.state().ha_connected = connected;
            if (!connected) {
              g_ui_app.state().image_bootstrap_active = false;
              g_ui_app.state().online_images_completed = 0;
              g_ui_app.state().online_images_failed = 0;
              g_ui_app.screens().navigate_to(UiScreenId::Home);
            } else {
              if (g_ui_app.state().online_images_expected > 0) {
                g_ui_app.state().image_bootstrap_active = true;
                g_ui_app.state().image_bootstrap_started_at = millis();
                g_ui_app.state().online_images_completed = 0;
                g_ui_app.state().online_images_failed = 0;
              } else {
                g_ui_app.state().image_bootstrap_active = false;
              }
            }
            UiRedraw::request_full();
            id(main_display).update();
            return;
          }
          if (connected && g_ui_app.state().image_bootstrap_active) {
            if (millis() - g_ui_app.state().image_bootstrap_started_at
                >= UiState::ONLINE_IMAGE_BOOTSTRAP_TIMEOUT_MS) {
              g_ui_app.state().image_bootstrap_active = false;
              UiRedraw::request_full();
              id(main_display).update();
              return;
            }
          }
          if (!connected) {
            id(main_display).update();
          }
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
