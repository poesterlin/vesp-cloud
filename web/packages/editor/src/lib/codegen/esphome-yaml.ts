import type { EntityBinding, Project, LightStateComponent, StateField, TodoListComponent, TextComponent, ImageComponent, HvacComponent, WeatherComponent, CalendarComponent, RangeSliderComponent } from "@vesp-cloud/schema";
import { sanitizeDeviceName, stateVarFromEntity, collectAllComponents, collectProjectIconNames, todoItemsVarFromBinding, todoItemsVarFromTodoEntity, textBindingVar, bindingKey, imageIdFromComponentId, imageFallbackIdFromComponentId, escapeCString, escapeYAMLDoubleQuoted, calendarEventsVarFromEntity, todoEntityIdFromComponent, toCppIdentifier, detailScreenId } from "./utils";
import { collectConditionEntities, type ConditionEntityType } from "./condition-expr";
import { ICON_FONT_ID, WEATHER_ICON_FONT_ID, getIconGlyphs, projectHasWeather } from "./mdi-icons";
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
  const sortForCodegen = <T extends { type: string }>(components: T[]): T[] =>
    [...components].sort((a, b) => {
      const aIsBackground = a.type === "rectangle";
      const bIsBackground = b.type === "rectangle";
      if (aIsBackground === bIsBackground) return 0;
      return aIsBackground ? -1 : 1;
    });

  return collectAllComponents([
    ...project.dashboardPages.flatMap(p => sortForCodegen(p.components)),
    ...project.detailViews.flatMap(v => sortForCodegen(v.components)),
  ]);
}

function resolveDefaultEntityForDomain(project: Project, domain: string): string | undefined {
  const entities = new Set<string>();
  const allComponents = collectProjectComponents(project);

  for (const f of (project.state?.fields ?? []) as StateField[]) {
    if (!f.haEntity) continue;
    if (f.haEntity.startsWith(`${domain}.`)) entities.add(f.haEntity);
  }

  for (const c of allComponents) {
    if (c.type === "light_state") {
      const entityId = (c as LightStateComponent).stateBinding?.entityId;
      if (entityId?.startsWith(`${domain}.`)) entities.add(entityId);
    } else if (c.type === "todo_list") {
      const entityId = (c as TodoListComponent).itemsBinding?.entityId;
      if (entityId?.startsWith(`${domain}.`)) entities.add(entityId);
    } else if (c.type === "text") {
      for (const b of collectTextBindings(c as TextComponent)) {
        if (b.entityId.startsWith(`${domain}.`)) entities.add(b.entityId);
      }
    } else if (c.type === "image") {
      const entityId = (c as ImageComponent).imageBinding?.entityId;
      if (entityId?.startsWith(`${domain}.`)) entities.add(entityId);
    }
  }

  for (const e of collectConditionEntities(project)) {
    if (e.entityId.startsWith(`${domain}.`)) entities.add(e.entityId);
  }

  if (entities.size !== 1) return undefined;
  return Array.from(entities)[0];
}

function collectImageComponents(project: Project): ImageComponent[] {
  return collectProjectComponents(project)
    .filter((c): c is ImageComponent => c.type === "image");
}

function imageResize(c: ImageComponent): string {
  const sizeResize = `${c.size?.width ?? 100}x${c.size?.height ?? 100}`;
  if (!c.resize || c.resize === "100x100") return sizeResize;
  return c.resize;
}

function isHomeAssistantImage(c: ImageComponent): boolean {
  return c.imageSource === "ha" || (c.imageSource == null && !!c.imageBinding?.entityId);
}

function buildImageScreenMap(project: Project): Map<string, string> {
  const map = new Map<string, string>();
  for (const page of project.dashboardPages) {
    for (const c of page.components) {
      if (c.type === "image") map.set(c.id, "Home");
    }
  }
  for (const view of project.detailViews) {
    const id = detailScreenId(view.id, view.title);
    if (!id) continue;
    for (const c of view.components) {
      if (c.type === "image") map.set(c.id, id);
    }
  }
  return map;
}

function generateStaticImagesYAML(project: Project): string {
  const lines: string[] = [];
  for (const c of collectImageComponents(project)) {
    if (isHomeAssistantImage(c)) continue;
    lines.push(`  - file: "${escapeYAMLDoubleQuoted(c.file)}"`);
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

function generateOnlineImagesYAML(project: Project, imageScreenMap: Map<string, string>): string {
  const lines: string[] = [];
  for (const c of collectImageComponents(project)) {
    if (!isHomeAssistantImage(c) || !c.imageBinding?.entityId) continue;
    const primaryFormat = c.onlineFormat === "jpeg" ? "jpeg" : "png";
    const fallbackFormat = primaryFormat === "jpeg" ? "png" : "jpeg";
    const primaryId = imageIdFromComponentId(c.id);
    const fallbackId = imageFallbackIdFromComponentId(c.id);
    const preferFallbackId = `${primaryId}_prefer_fallback`;
    const pendingFetchId = `${primaryId}_pending_fetch`;
    const screenId = imageScreenMap.get(c.id) ?? "Home";
    const x = c.position.x;
    const y = c.position.y;
    const w = c.size?.width ?? 100;
    const h = c.size?.height ?? 100;
    lines.push(`  - url: "http://127.0.0.1/"`);
    lines.push(`    id: ${primaryId}`);
    lines.push(`    format: ${primaryFormat}`);
    lines.push(`    type: ${c.image_type}`);
    lines.push(`    resize: ${imageResize(c)}`);
    if (c.transparency) lines.push(`    transparency: ${c.transparency}`);
    if (c.byte_order) lines.push(`    byte_order: ${c.byte_order}`);
    lines.push(`    on_download_finished:`);
    lines.push(`      then:`);
    lines.push(`        - lambda: |-`);
    lines.push(`            id(${preferFallbackId}) = false;`);
    lines.push(`            if (g_ui_app.state().image_fetches_in_flight > 0)`);
    lines.push(`              g_ui_app.state().image_fetches_in_flight--;`);
    lines.push(`            if (g_ui_app.state().image_bootstrap_active) {`);
    lines.push(`              g_ui_app.state().online_images_completed++;`);
    lines.push(`              const int done = g_ui_app.state().online_images_completed + g_ui_app.state().online_images_failed;`);
    lines.push(`              if (done >= g_ui_app.state().online_images_expected) {`);
    lines.push(`                g_ui_app.state().image_bootstrap_active = false;`);
    lines.push(`                UiRedraw::request_full();`);
    lines.push(`                UiRedraw::trigger_display_update();`);
    lines.push(`              }`);
    lines.push(`            }`);
    lines.push(`            if (g_ui_app.screens().current_id() != UiScreenId::${screenId})`);
    lines.push(`              return;`);
    lines.push(`            UiInvalidation::request_rect(UiDirtyRect{${x}, ${y}, ${w}, ${h}}, "img_${primaryId}_done");`);
    lines.push(`            UiRedraw::trigger_display_update();`);
    lines.push(`    on_error:`);
    lines.push(`      then:`);
    lines.push(`        - lambda: |-`);
    lines.push(`            id(${preferFallbackId}) = true;`);
    lines.push(`            if (g_ui_app.state().image_fetches_in_flight > 0)`);
    lines.push(`              g_ui_app.state().image_fetches_in_flight--;`);
    lines.push(`            id(${pendingFetchId}) = true;`);

    lines.push(`  - url: "http://127.0.0.1/"`);
    lines.push(`    id: ${fallbackId}`);
    lines.push(`    format: ${fallbackFormat}`);
    lines.push(`    type: ${c.image_type}`);
    lines.push(`    resize: ${imageResize(c)}`);
    if (c.transparency) lines.push(`    transparency: ${c.transparency}`);
    if (c.byte_order) lines.push(`    byte_order: ${c.byte_order}`);
    lines.push(`    on_download_finished:`);
    lines.push(`      then:`);
    lines.push(`        - lambda: |-`);
    lines.push(`            id(${preferFallbackId}) = true;`);
    lines.push(`            if (g_ui_app.state().image_fetches_in_flight > 0)`);
    lines.push(`              g_ui_app.state().image_fetches_in_flight--;`);
    lines.push(`            if (g_ui_app.state().image_bootstrap_active) {`);
    lines.push(`              g_ui_app.state().online_images_completed++;`);
    lines.push(`              const int done = g_ui_app.state().online_images_completed + g_ui_app.state().online_images_failed;`);
    lines.push(`              if (done >= g_ui_app.state().online_images_expected) {`);
    lines.push(`                g_ui_app.state().image_bootstrap_active = false;`);
    lines.push(`                UiRedraw::request_full();`);
    lines.push(`                UiRedraw::trigger_display_update();`);
    lines.push(`              }`);
    lines.push(`            }`);
    lines.push(`            if (g_ui_app.screens().current_id() != UiScreenId::${screenId})`);
    lines.push(`              return;`);
    lines.push(`            UiInvalidation::request_rect(UiDirtyRect{${x}, ${y}, ${w}, ${h}}, "img_${primaryId}_done");`);
    lines.push(`            UiRedraw::trigger_display_update();`);
    lines.push(`    on_error:`);
    lines.push(`      then:`);
    lines.push(`        - lambda: |-`);
    lines.push(`            id(${preferFallbackId}) = false;`);
    lines.push(`            if (g_ui_app.state().image_fetches_in_flight > 0)`);
    lines.push(`              g_ui_app.state().image_fetches_in_flight--;`);
    lines.push(`            if (g_ui_app.state().image_bootstrap_active) {`);
    lines.push(`              g_ui_app.state().online_images_failed++;`);
    lines.push(`              const int done = g_ui_app.state().online_images_completed + g_ui_app.state().online_images_failed;`);
    lines.push(`              if (done >= g_ui_app.state().online_images_expected) {`);
    lines.push(`                g_ui_app.state().image_bootstrap_active = false;`);
    lines.push(`                UiRedraw::request_full();`);
    lines.push(`                UiRedraw::trigger_display_update();`);
    lines.push(`              }`);
    lines.push(`            }`);
  }
  return lines.length > 0 ? `\nonline_image:\n${lines.join('\n')}\n` : '';
}

function generateOnlineImageFormatGlobals(project: Project): string {
  const lines: string[] = [];
  for (const c of collectImageComponents(project)) {
    if (!isHomeAssistantImage(c) || !c.imageBinding?.entityId) continue;
    const imgId = imageIdFromComponentId(c.id);
    lines.push(`  - id: ${imgId}_prefer_fallback`);
    lines.push(`    type: bool`);
    lines.push(`    restore_value: no`);
    lines.push(`    initial_value: "false"`);
    lines.push(`  - id: ${imgId}_pending_fetch`);
    lines.push(`    type: bool`);
    lines.push(`    restore_value: no`);
    lines.push(`    initial_value: "false"`);
  }
  return lines.length > 0 ? `\n${lines.join('\n')}` : '';
}

function generateFetchPump(project: Project, imageScreenMap: Map<string, string>): string {
  const images = collectImageComponents(project).filter(
    c => isHomeAssistantImage(c) && !!c.imageBinding?.entityId
  );
  if (images.length === 0) return '';

  const lines: string[] = [];
  lines.push(`          // --- Image fetch pump (at most one decode at a time) ---`);
  lines.push(`          if (connected && g_ui_app.state().image_fetches_in_flight < UiState::MAX_CONCURRENT_IMAGE_FETCHES) {`);
  lines.push(`            auto &st = g_ui_app.state();`);
  lines.push(`            const auto cur = g_ui_app.screens().current_id();`);
  lines.push(`            bool started = false;`);

  // Group images by screen
  const byScreen = new Map<string, typeof images>();
  for (const img of images) {
    const sid = imageScreenMap.get(img.id) ?? "Home";
    if (!byScreen.has(sid)) byScreen.set(sid, []);
    byScreen.get(sid)!.push(img);
  }

  // Pass 1: visible screen images first
  lines.push(``);
  lines.push(`            // Pass 1: visible screen images`);
  for (const [sid, comps] of byScreen) {
    lines.push(`            if (!started && cur == UiScreenId::${sid}) {`);
    for (const c of comps) {
      const imgId = imageIdFromComponentId(c.id);
      const fallbackId = imageFallbackIdFromComponentId(c.id);
      lines.push(`              if (id(${imgId}_pending_fetch)) {`);
      lines.push(`                id(${imgId}_pending_fetch) = false;`);
      lines.push(`                st.image_fetches_in_flight++;`);
      lines.push(`                started = true;`);
      lines.push(`                if (id(${imgId}_prefer_fallback))`);
      lines.push(`                  id(${fallbackId}).update();`);
      lines.push(`                else`);
      lines.push(`                  id(${imgId}).update();`);
      lines.push(`              }`);
    }
    lines.push(`            }`);
  }

  // Pass 2: prefetch off-screen
  lines.push(``);
  lines.push(`            // Pass 2: prefetch off-screen`);
  lines.push(`            if (!started) {`);
  for (const [sid, comps] of byScreen) {
    lines.push(`              if (cur != UiScreenId::${sid}) {`);
    for (const c of comps) {
      const imgId = imageIdFromComponentId(c.id);
      const fallbackId = imageFallbackIdFromComponentId(c.id);
      lines.push(`                if (!started && id(${imgId}_pending_fetch)) {`);
      lines.push(`                  id(${imgId}_pending_fetch) = false;`);
      lines.push(`                  st.image_fetches_in_flight++;`);
      lines.push(`                  started = true;`);
      lines.push(`                  if (id(${imgId}_prefer_fallback))`);
      lines.push(`                    id(${fallbackId}).update();`);
      lines.push(`                  else`);
      lines.push(`                    id(${imgId}).update();`);
      lines.push(`                }`);
    }
    lines.push(`              }`);
  }
  lines.push(`            }`);

  lines.push(`          }`);
  return lines.join('\n') + '\n';
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
    lines.push(`          bind_ha_bool("${escapeCString(entityId)}", &g_ui_app.state().${stateVar});`);
  }

  for (const c of allComponents) {
    if (c.type !== 'hvac') continue;
    const hc = c as HvacComponent;
    const entityId = hc.stateBinding?.entityId;
    if (!entityId) continue;
    const base = stateVarFromEntity(entityId);

    // hvac_mode: the entity's state (off, heat, cool, etc.)
    const modeVar = `${base}_hvac_mode`;
    if (!claimed.has(modeVar)) {
      claimed.add(modeVar);
      lines.push(`          bind_ha_string("${escapeCString(entityId)}", &g_ui_app.state().${modeVar});`);
    }

    // current_temperature attribute
    const curTempVar = `${base}_current_temp`;
    if (!claimed.has(curTempVar)) {
      claimed.add(curTempVar);
      lines.push(`          bind_ha_float_attr("${escapeCString(entityId)}", "current_temperature", &g_ui_app.state().${curTempVar});`);
    }

    // temperature attribute (target)
    const tgtTempVar = `${base}_target_temp`;
    if (!claimed.has(tgtTempVar)) {
      claimed.add(tgtTempVar);
      lines.push(`          bind_ha_float_attr("${escapeCString(entityId)}", "temperature", &g_ui_app.state().${tgtTempVar});`);
    }

    // hvac_action attribute (heating, cooling, idle)
    const actionVar = `${base}_hvac_action`;
    if (!claimed.has(actionVar)) {
      claimed.add(actionVar);
      lines.push(`          bind_ha_string_attr("${escapeCString(entityId)}", "hvac_action", &g_ui_app.state().${actionVar});`);
    }
  }

  for (const c of allComponents) {
    if (c.type !== "range_slider") continue;
    const rc = c as RangeSliderComponent;
    const binding = rc.valueBinding;
    if (!binding?.entityId) continue;
    const stateVar = stateVarFromEntity(binding.entityId, binding.attribute);
    if (claimed.has(stateVar)) continue;
    claimed.add(stateVar);
    if (binding.attribute) {
      lines.push(`          bind_ha_float_attr("${escapeCString(binding.entityId)}", "${escapeCString(binding.attribute)}", &g_ui_app.state().${stateVar});`);
    } else {
      lines.push(`          bind_ha_float("${escapeCString(binding.entityId)}", &g_ui_app.state().${stateVar});`);
    }
  }

  for (const c of allComponents) {
    if (c.type !== "todo_list") continue;
    const tc = c as TodoListComponent;
    const todoEntityId = todoEntityIdFromComponent(tc);
    // Direct todo.get_items service calls take over when todoEntityId is set;
    // only generate bind_ha_string_attr for legacy bridge-sensor components.
    if (todoEntityId) continue;
    const entityId = tc.itemsBinding?.entityId;
    if (!entityId) continue;
    const stateVar = todoItemsVarFromBinding(tc.itemsBinding, tc.id);
    if (claimed.has(stateVar)) continue;
    claimed.add(stateVar);
    const attribute = tc.itemsBinding?.attribute ?? "all_items";
    lines.push(`          bind_ha_string_attr("${escapeCString(entityId)}", "${escapeCString(attribute)}", &g_ui_app.state().${stateVar});`);
  }

  // For todo entities using the service-call path, subscribe to state
  // changes so we can trigger an immediate refetch via a flag instead
  // of waiting for the 2-minute polling interval.
  for (const c of allComponents) {
    if (c.type !== "todo_list") continue;
    const tc = c as TodoListComponent;
    const todoEntityId = todoEntityIdFromComponent(tc);
    if (!todoEntityId) continue;
    const itemsVar = todoItemsVarFromTodoEntity(todoEntityId);
    const refetchFlag = `g_todo_refetch_${itemsVar}`;
    if (claimed.has(refetchFlag)) continue;
    claimed.add(refetchFlag);
    lines.push(`          bind_todo_refetch("${escapeCString(todoEntityId)}", &id(${refetchFlag}));`);
  }

  for (const c of allComponents) {
    if (c.type !== "text") continue;
    const tc = c as TextComponent;
    for (const b of collectTextBindings(tc)) {
      const stateVar = textBindingVar(b);
      if (claimed.has(stateVar)) continue;
      claimed.add(stateVar);
      if (b.attribute) {
        lines.push(`          bind_ha_string_attr("${escapeCString(b.entityId)}", "${escapeCString(b.attribute)}", &g_ui_app.state().${stateVar});`);
      } else {
        lines.push(`          bind_ha_string("${escapeCString(b.entityId)}", &g_ui_app.state().${stateVar});`);
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
    const imageId = imageIdFromComponentId(ic.id);
    lines.push(`          bind_ha_image_url("${escapeCString(entityId)}", "${escapeCString(attribute)}", id(${imageId}), id(${imageFallbackIdFromComponentId(ic.id)}), &id(${imageId}_prefer_fallback), &id(${imageId}_pending_fetch));`);
  }

  for (const f of (project.state?.fields ?? []) as StateField[]) {
    if (!f.haEntity) continue;
    if (claimed.has(f.name)) continue;
    const binder = BINDER_BY_TYPE[f.cppType];
    if (!binder) continue;
    claimed.add(f.name);
    lines.push(`          ${binder}("${escapeCString(f.haEntity)}", &g_ui_app.state().${f.name});`);
  }

  for (const e of collectConditionEntities(project)) {
    if (claimed.has(e.varName)) continue;
    const cppType: ConditionEntityType = e.cppType;
    const binder = BINDER_BY_TYPE[cppType];
    if (!binder) continue;
    claimed.add(e.varName);
    lines.push(`          ${binder}("${escapeCString(e.entityId)}", &g_ui_app.state().${e.varName});`);
  }

  return lines.join('\n');
}

function generateNotificationSubscriptions(project: Project): string {
  const overlay = project.notificationOverlay;
  if (!overlay || overlay.enabled === false) return '';
  const lines: string[] = [];
  if (overlay.titleEntityId) {
    lines.push(`          bind_ha_string("${escapeCString(overlay.titleEntityId)}", &g_ui_app.state().notification_title);`);
  }
  if (overlay.bodyEntityId) {
    lines.push(`          {`);
    lines.push(`            auto *api = esphome::api::global_api_server;`);
    lines.push(`            if (api != nullptr) {`);
    lines.push(`              api->subscribe_home_assistant_state(`);
    lines.push(`                  "${escapeCString(overlay.bodyEntityId)}", esphome::optional<std::string>(),`);
    lines.push(`                  [trim_numeric](esphome::StringRef state) {`);
    lines.push(`                    std::string next = trim_numeric(state);`);
    lines.push(`                    const bool changed = (*g_ui_app.state().notification_body.ptr() != next);`);
    lines.push(`                    g_ui_app.state().notification_body.set(next);`);
    lines.push(`                    if (changed) {`);
    lines.push(`                      g_ui_app.state().notification_dismissed.set("");`);
    lines.push(`                    }`);
    lines.push(`                    UiRedraw::trigger_display_update();`);
    lines.push(`                  });`);
    lines.push(`            }`);
    lines.push(`          }`);
  }
  if (overlay.severityEntityId) {
    lines.push(`          bind_ha_string("${escapeCString(overlay.severityEntityId)}", &g_ui_app.state().notification_severity);`);
  }
  // Dismiss action: clears HA title/body entities via input_text.set_value
  if (overlay.titleEntityId || overlay.bodyEntityId) {
    const clearLines: string[] = [];
    if (overlay.titleEntityId) {
      clearLines.push(`          clear_text_entity("${escapeCString(overlay.titleEntityId)}");`);
    }
    if (overlay.bodyEntityId) {
      clearLines.push(`          clear_text_entity("${escapeCString(overlay.bodyEntityId)}");`);
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
    lines.push('          g_ui_app.dismiss_notification = [clear_text_entity]() {');
    for (const l of clearLines) {
      lines.push(l);
    }
    lines.push('          };');
  }
  return lines.join('\n');
}

function generateWeatherForecastIntervals(project: Project): string {
  const allComponents = collectProjectComponents(project);
  const weatherComponents = allComponents.filter(c => c.type === 'weather') as WeatherComponent[];
  if (weatherComponents.length === 0) return '';

  const seen = new Set<string>();
  const entries: string[] = [];

  for (const wc of weatherComponents) {
    const entityId = wc.stateBinding?.entityId;
    if (!entityId) continue;
    const mode = wc.mode ?? 'today';
    // Dedup by entity_id + mode
    const key = `${entityId}|${mode}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const escapedId = escapeCString(entityId);
    const base = stateVarFromEntity(entityId);

    if (mode === 'forecast') {
      entries.push(`  - interval: 10min
    startup_delay: 5s
    then:
      - logger.log:
          level: WARN
          tag: weather
          format: "calling weather.get_forecasts for ${escapedId}"
      - homeassistant.service:
          service: weather.get_forecasts
          data:
            type: daily
            entity_id: "${escapedId}"
          capture_response: true
          on_success:
            then:
              - lambda: |-
                  ESP_LOGW("weather", "on_response fired for %s (response keys=%u)", "${escapedId}", response.size());
                  auto resp_wrapper = response["response"];
                  if (!resp_wrapper.is<JsonObjectConst>()) {
                    ESP_LOGW("weather", "response.response is not object (is_null=%d)", resp_wrapper.isNull());
                    char buf[512]; serializeJson(response, buf, sizeof(buf));
                    ESP_LOGW("weather", "raw response=%s", buf);
                    return;
                  }
                  ESP_LOGW("weather", "response.response keys=%u", resp_wrapper.size());
                  auto entity_obj = resp_wrapper["${escapedId}"];
                  if (!entity_obj.is<JsonObjectConst>()) {
                    ESP_LOGW("weather", "entity key not found in response.response (is_null=%d)", entity_obj.isNull());
                    char buf[1024]; serializeJson(resp_wrapper, buf, sizeof(buf));
                    ESP_LOGW("weather", "response.response content=%s", buf);
                    return;
                  }
                  ESP_LOGW("weather", "entity_obj keys=%u", entity_obj.size());
                  auto fc = entity_obj["forecast"];
                  if (!fc.is<JsonArrayConst>()) {
                    ESP_LOGW("weather", "forecast is not array (is_null=%d)", fc.isNull());
                    return;
                  }
                  ESP_LOGW("weather", "forecast array size=%u", fc.size());
                  auto d1 = fc[0];
                  if (d1["condition"].is<std::string>())     { auto v = d1["condition"].as<std::string>(); ESP_LOGW("weather", "day1 condition=%s", v.c_str()); g_ui_app.state().${base}_day1_condition.set(v); }
                  if (d1["temperature"].is<float>())   { auto v = d1["temperature"].as<float>(); ESP_LOGW("weather", "day1 temperature=%.1f", v); g_ui_app.state().${base}_day1_temperature.set(v); }
                  if (d1["humidity"].is<float>())      { auto v = d1["humidity"].as<float>(); ESP_LOGW("weather", "day1 humidity=%.1f", v); g_ui_app.state().${base}_day1_humidity.set(v); }
                  if (d1["wind_speed"].is<float>())    { auto v = d1["wind_speed"].as<float>(); ESP_LOGW("weather", "day1 wind_speed=%.1f", v); g_ui_app.state().${base}_day1_wind_speed.set(v); }
                  if (d1["precipitation"].is<float>()) { auto v = d1["precipitation"].as<float>(); ESP_LOGW("weather", "day1 precipitation=%.1f", v); g_ui_app.state().${base}_day1_precipitation.set(v); }
                  if (fc.size() >= 2) { auto d2 = fc[1];
                    if (d2["condition"].is<std::string>())     { auto v = d2["condition"].as<std::string>(); ESP_LOGW("weather", "day2 condition=%s", v.c_str()); g_ui_app.state().${base}_day2_condition.set(v); }
                    if (d2["temperature"].is<float>())   { auto v = d2["temperature"].as<float>(); ESP_LOGW("weather", "day2 temperature=%.1f", v); g_ui_app.state().${base}_day2_temperature.set(v); }
                    if (d2["humidity"].is<float>())      { auto v = d2["humidity"].as<float>(); ESP_LOGW("weather", "day2 humidity=%.1f", v); g_ui_app.state().${base}_day2_humidity.set(v); }
                    if (d2["wind_speed"].is<float>())    { auto v = d2["wind_speed"].as<float>(); ESP_LOGW("weather", "day2 wind_speed=%.1f", v); g_ui_app.state().${base}_day2_wind_speed.set(v); }
                    if (d2["precipitation"].is<float>()) { auto v = d2["precipitation"].as<float>(); ESP_LOGW("weather", "day2 precipitation=%.1f", v); g_ui_app.state().${base}_day2_precipitation.set(v); } }
                  if (fc.size() >= 3) { auto d3 = fc[2];
                    if (d3["condition"].is<std::string>())     { auto v = d3["condition"].as<std::string>(); ESP_LOGW("weather", "day3 condition=%s", v.c_str()); g_ui_app.state().${base}_day3_condition.set(v); }
                    if (d3["temperature"].is<float>())   { auto v = d3["temperature"].as<float>(); ESP_LOGW("weather", "day3 temperature=%.1f", v); g_ui_app.state().${base}_day3_temperature.set(v); }
                    if (d3["humidity"].is<float>())      { auto v = d3["humidity"].as<float>(); ESP_LOGW("weather", "day3 humidity=%.1f", v); g_ui_app.state().${base}_day3_humidity.set(v); }
                    if (d3["wind_speed"].is<float>())    { auto v = d3["wind_speed"].as<float>(); ESP_LOGW("weather", "day3 wind_speed=%.1f", v); g_ui_app.state().${base}_day3_wind_speed.set(v); }
                    if (d3["precipitation"].is<float>()) { auto v = d3["precipitation"].as<float>(); ESP_LOGW("weather", "day3 precipitation=%.1f", v); g_ui_app.state().${base}_day3_precipitation.set(v); } }
                  ESP_LOGW("weather", "parse complete");
                  UiRedraw::trigger_display_update();`);
    } else {
      entries.push(`  - interval: 10min
    startup_delay: 5s
    then:
      - logger.log:
          level: WARN
          tag: weather
          format: "calling weather.get_forecasts for ${escapedId}"
      - homeassistant.service:
          service: weather.get_forecasts
          data:
            type: hourly
            entity_id: "${escapedId}"
          capture_response: true
          on_success:
            then:
              - lambda: |-
                  ESP_LOGW("weather", "on_response fired for %s (response keys=%u)", "${escapedId}", response.size());
                  auto resp_wrapper = response["response"];
                  if (!resp_wrapper.is<JsonObjectConst>()) {
                    ESP_LOGW("weather", "response.response is not object (is_null=%d)", resp_wrapper.isNull());
                    char buf[512]; serializeJson(response, buf, sizeof(buf));
                    ESP_LOGW("weather", "raw response=%s", buf);
                    return;
                  }
                  ESP_LOGW("weather", "response.response keys=%u", resp_wrapper.size());
                  auto entity_obj = resp_wrapper["${escapedId}"];
                  if (!entity_obj.is<JsonObjectConst>()) {
                    ESP_LOGW("weather", "entity key not found in response.response (is_null=%d)", entity_obj.isNull());
                    char buf[1024]; serializeJson(resp_wrapper, buf, sizeof(buf));
                    ESP_LOGW("weather", "response.response content=%s", buf);
                    return;
                  }
                  ESP_LOGW("weather", "entity_obj keys=%u", entity_obj.size());
                  auto fc = entity_obj["forecast"];
                  if (!fc.is<JsonArrayConst>()) {
                    ESP_LOGW("weather", "forecast is not array (is_null=%d)", fc.isNull());
                    return;
                  }
                  ESP_LOGW("weather", "forecast array size=%u", fc.size());
                  auto today = fc[0];
                  if (today["condition"].is<std::string>())     { auto v = today["condition"].as<std::string>(); ESP_LOGW("weather", "condition=%s", v.c_str()); g_ui_app.state().${base}_condition.set(v); }
                  if (today["temperature"].is<float>())   { auto v = today["temperature"].as<float>(); ESP_LOGW("weather", "temperature=%.1f", v); g_ui_app.state().${base}_temperature.set(v); }
                  if (today["humidity"].is<float>())      { auto v = today["humidity"].as<float>(); ESP_LOGW("weather", "humidity=%.1f", v); g_ui_app.state().${base}_humidity.set(v); }
                  if (today["wind_speed"].is<float>())    { auto v = today["wind_speed"].as<float>(); ESP_LOGW("weather", "wind_speed=%.1f", v); g_ui_app.state().${base}_wind_speed.set(v); }
                  if (today["precipitation"].is<float>()) { auto v = today["precipitation"].as<float>(); ESP_LOGW("weather", "precipitation=%.1f", v); g_ui_app.state().${base}_precipitation.set(v); }
                  ESP_LOGW("weather", "today parse complete — hourly");
                  UiRedraw::trigger_display_update();`);
    }
  }

  return entries.join('\n\n');
}

function generateTodoRefetchGlobals(project: Project): string {
  const allComponents = collectProjectComponents(project);
  const todoComponents = allComponents.filter(c => c.type === 'todo_list') as TodoListComponent[];
  if (todoComponents.length === 0) return '';

  const seen = new Set<string>();
  const entries: string[] = [];

  for (const tc of todoComponents) {
    const entityId = todoEntityIdFromComponent(tc);
    if (!entityId) continue;
    if (seen.has(entityId)) continue;
    seen.add(entityId);
    const itemsVar = todoItemsVarFromTodoEntity(entityId);
    entries.push(`  - id: g_todo_refetch_${itemsVar}
    type: bool
    restore_value: no
    initial_value: "false"`);
  }

  return entries.join('\n');
}

function generateTodoItemsIntervals(project: Project): string {
  const allComponents = collectProjectComponents(project);
  const todoComponents = allComponents.filter(c => c.type === 'todo_list') as TodoListComponent[];
  if (todoComponents.length === 0) return '';

  const seen = new Set<string>();
  interface TodoEntry { entityId: string; escapedId: string; itemsVar: string; escapedStatusFilter: string; refetchFlag: string; }
  const todos: TodoEntry[] = [];

  for (const tc of todoComponents) {
    const entityId = todoEntityIdFromComponent(tc);
    if (!entityId) continue;
    if (seen.has(entityId)) continue;
    seen.add(entityId);
    const escapedId = escapeCString(entityId);
    const itemsVar = todoItemsVarFromTodoEntity(entityId);
    const statusFilter = tc.itemsBinding?.attribute ?? 'needs_action';
    const escapedStatusFilter = escapeYAMLDoubleQuoted(statusFilter);
    const refetchFlag = `g_todo_refetch_${itemsVar}`;
    todos.push({ entityId, escapedId, itemsVar, escapedStatusFilter, refetchFlag });
  }

  if (todos.length === 0) return '';

  // Shared response-parsing lambda body for todo.get_items on_success.
  function onSuccessLambda(t: TodoEntry): string {
    return [
      `                  - lambda: |-`,
      `                      JsonVariantConst root = response;`,
      `                      auto resp_wrapper = response["response"];`,
      `                      if (resp_wrapper.is<JsonObjectConst>()) root = resp_wrapper;`,
      `                      auto entity_obj = root["${t.escapedId}"];`,
      `                      JsonVariantConst items = entity_obj["items"];`,
      `                      if (!items.is<JsonArrayConst>()) {`,
      `                        // Some integrations return {"items": [...]} directly`,
      `                        // without entity-id nesting.`,
      `                        items = root["items"];`,
      `                      }`,
      `                      if (!items.is<JsonArrayConst>()) {`,
      `                        ESP_LOGW("todo", "todo.get_items response missing items for %s", "${t.escapedId}");`,
      `                        return;`,
      `                      }`,
      `                      JsonArrayConst items_arr = items.as<JsonArrayConst>();`,
      `                      auto sanitize = [](std::string s) {`,
      `                        for (char &ch : s) {`,
      `                          if (ch == '|' || ch == '\\n' || ch == '\\r' || ch == '\\t') ch = ' ';`,
      `                        }`,
      `                        return s;`,
      `                      };`,
      `                      std::string formatted;`,
      `                      for (JsonVariantConst item : items_arr) {`,
      `                        std::string summary;`,
      `                        std::string due;`,
      `                        std::string status;`,
      `                        std::string uid;`,
      `                        if (item["summary"].is<std::string>()) summary = sanitize(item["summary"].as<std::string>());`,
      `                        if (item["due"].is<std::string>()) due = sanitize(item["due"].as<std::string>());`,
      `                        if (item["status"].is<std::string>()) status = sanitize(item["status"].as<std::string>());`,
      `                        if (item["uid"].is<std::string>()) uid = sanitize(item["uid"].as<std::string>());`,
      `                        else if (item["id"].is<std::string>()) uid = sanitize(item["id"].as<std::string>());`,
      `                        if (!formatted.empty()) formatted += "\\n";`,
      `                        formatted += summary + "|" + due + "|" + status + "|" + uid;`,
      `                      }`,
      `                      if (formatted.empty()) formatted = "LIST EMPTY";`,
      `                      g_ui_app.state().${t.itemsVar}.set(formatted);`,
      `                      UiRedraw::trigger_display_update();`,
    ].join('\n');
  }

  // Build the if-blocks for the fast interval. Each block checks a
  // refetch flag, clears it, and fires todo.get_items with capture_response.
  const ifBlocks = todos.map(t => `      - if:
          condition:
            lambda: 'return id(${t.refetchFlag});'
          then:
            - lambda: 'id(${t.refetchFlag}) = false;'
            - logger.log:
                level: WARN
                tag: todo
                format: "refetch triggered for ${t.escapedId}"
            - homeassistant.service:
                service: todo.get_items
                data:
                  entity_id: "${t.escapedId}"
                  status: "${t.escapedStatusFilter}"
                capture_response: true
                on_success:
                  then:
${onSuccessLambda(t)}`);

  const entries: string[] = [];

  // Fast interval: checks refetch flags (set by HA state subscriptions)
  // every 250ms and fires todo.get_items when a change is detected.
  entries.push(`  - interval: 250ms
    then:
${ifBlocks.join('\n')}`);

  // Fallback: set all refetch flags every 2 minutes (and once 7s after
  // boot) so the fast interval picks them up even if no push notification
  // was received.
  const flagSetters = todos.map(t => `          id(${t.refetchFlag}) = true;`).join('\n');
  entries.push(`  - interval: 2min
    startup_delay: 7s
    then:
      - lambda: |-
${flagSetters}`);

  return entries.join('\n\n');
}

function generateCalendarIntervals(project: Project): string {
  const allComponents = collectProjectComponents(project);
  const calendarComponents = allComponents.filter(c => c.type === 'calendar') as CalendarComponent[];
  if (calendarComponents.length === 0) return '';

  const selectedByEntityWindow = new Map<string, CalendarComponent>();
  for (const cc of calendarComponents) {
    const entityId = cc.entityBinding?.entityId;
    if (!entityId) continue;
    const durationDays = Math.max(0, Math.floor(cc.durationDays ?? 125));
    const key = `${entityId}::${durationDays}`;
    const current = selectedByEntityWindow.get(key);
    if (!current) {
      selectedByEntityWindow.set(key, cc);
      continue;
    }
    const currentMaxItems = Math.max(1, Math.min(10, current.maxItems ?? 4));
    const nextMaxItems = Math.max(1, Math.min(10, cc.maxItems ?? 4));
    if (nextMaxItems > currentMaxItems) selectedByEntityWindow.set(key, cc);
  }

  const entries: string[] = [];
  for (const cc of selectedByEntityWindow.values()) {
    const entityId = cc.entityBinding?.entityId;
    if (!entityId) continue;
    const escapedId = escapeCString(entityId);
    const durationDays = Math.max(0, Math.floor(cc.durationDays ?? 125));
    const durationHours = durationDays * 24;
    const durationString = `${durationHours}:00:00`;
    const eventsVar = calendarEventsVarFromEntity(entityId, durationDays);

    entries.push(`  - interval: 2min
    startup_delay: 6s
    then:
      - logger.log:
          level: WARN
          tag: calendar
          format: "calling calendar.get_events for ${escapedId}"
      - homeassistant.service:
          service: calendar.get_events
          data:
            entity_id: "${escapedId}"
            duration: "${durationString}"
          capture_response: true
          on_success:
            then:
              - lambda: |-
                  auto resp_wrapper = response["response"];
                  if (!resp_wrapper.is<JsonObjectConst>()) {
                    ESP_LOGW("calendar", "response.response is not object");
                    return;
                  }
                  auto entity_obj = resp_wrapper["${escapedId}"];
                  if (!entity_obj.is<JsonObjectConst>()) {
                    ESP_LOGW("calendar", "entity key not found: %s", "${escapedId}");
                    return;
                  }
                  auto events_var = entity_obj["events"];
                  if (!events_var.is<JsonArrayConst>()) {
                    ESP_LOGW("calendar", "events is not array");
                    g_ui_app.state().${eventsVar}.set("NO EVENTS");
                    UiRedraw::trigger_display_update();
                    return;
                  }
                  JsonArrayConst events = events_var.as<JsonArrayConst>();

                  auto sanitize = [](std::string s) {
                    for (char &ch : s) {
                      if (ch == '|' || ch == '\\n' || ch == '\\r' || ch == '\\t') ch = ' ';
                    }
                    return s;
                  };

                  std::string formatted;
                  int count = 0;
                  for (JsonVariantConst item : events) {
                    if (count >= 32) break;
                    std::string start;
                    std::string end_time;
                    std::string summary;
                    std::string location;
                    if (item["start"].is<std::string>()) start = sanitize(item["start"].as<std::string>());
                    if (item["end"].is<std::string>()) end_time = sanitize(item["end"].as<std::string>());
                    if (item["summary"].is<std::string>()) summary = sanitize(item["summary"].as<std::string>());
                    if (item["location"].is<std::string>()) location = sanitize(item["location"].as<std::string>());
                    if (summary.empty()) continue;
                    if (!formatted.empty()) formatted += "\\n";
                    formatted += start + "|" + end_time + "|" + summary + "|" + location;
                    count++;
                  }
                  if (formatted.empty()) formatted = "NO EVENTS";
                  g_ui_app.state().${eventsVar}.set(formatted);
                  UiRedraw::trigger_display_update();`);
  }

  return entries.join('\n\n');
}

export function generateESPHomeYAML(project: Project, firmwareVersion?: string): string {
  const deviceName = sanitizeDeviceName(project.name);
  const friendlyName = escapeYAMLDoubleQuoted(project.name);
  const timezone = escapeYAMLDoubleQuoted(project.timezone || "UTC");
  const projectVersionYaml = firmwareVersion
    ? `\n  project:\n    name: "esphome_designer.${deviceName}"\n    version: "${firmwareVersion}"`
    : '';
  const onlineImagesEnabled = hasOnlineImages(project);
  const onlineImageCount = countOnlineImages(project);
  const imageScreenMap = buildImageScreenMap(project);
  const homeAssistantBaseUrlEnabled = onlineImagesEnabled && !!project.secrets?.homeAssistantBaseUrl;
  const httpOtaEnabled = !!(project.secrets?.firmwareUpdateUrl);
  const httpRequestEnabled = onlineImagesEnabled || httpOtaEnabled;
  const bindings = generateBindings(project);
  const weatherIntervals = generateWeatherForecastIntervals(project);
  const todoIntervals = generateTodoItemsIntervals(project);
  const todoRefetchGlobals = generateTodoRefetchGlobals(project);
  const hasTodoEntityRefetch = !!todoRefetchGlobals;
  const calendarIntervals = generateCalendarIntervals(project);
  const notificationSubs = generateNotificationSubscriptions(project);
  const notificationBindings = notificationSubs ? `\n${notificationSubs}` : '';
  const iconGlyphs = getIconGlyphs(collectProjectIconNames(project));
  const iconFontAssignment = iconGlyphs.size > 0
    ? `\n          g_theme.icon.font = id(${ICON_FONT_ID});`
    : '';
  const weatherIconFontAssignment = projectHasWeather(project)
    ? `\n          g_theme.weather_icon.font = id(${WEATHER_ICON_FONT_ID});`
    : '';
  const imageYaml = generateStaticImagesYAML(project);
  const onlineImageYaml = generateOnlineImagesYAML(project, imageScreenMap);
  const onlineImageFormatGlobals = generateOnlineImageFormatGlobals(project);
  const fetchPump = generateFetchPump(project, imageScreenMap);
  const httpRequestYaml = httpRequestEnabled
    ? `\nhttp_request:\n  verify_ssl: false\n  timeout: 10s\n`
    : '';
  const httpOtaYaml = httpOtaEnabled
    ? `
ota:
  - platform: http_request
    on_begin:
      then:
        - lambda: |-
            // Show a static "UPDATING" splash and keep the backlight on
            // (dimmed). Painting through render_basic_ui() during the OTA
            // would queue real UI redraws on top of the splash as the
            // cache-bus contention from flash erase/write starves the RGB
            // DMA bounce buffer -- the user sees that as wild flicker.
            // The g_ota_in_progress flag short-circuits every subsequent
            // display update to render_ota_splash() until the new
            // firmware reboots the device.
            g_ota_font = id(font_medium);
            g_ota_in_progress = true;
            UiRedraw::request_full();
            id(main_display).update();
        - light.turn_on:
            id: display_backlight
            brightness: 30%
    on_error:
      then:
        - lambda: |-
            g_ota_in_progress = false;
            UiRedraw::request_full();
            id(main_display).update();
        - light.turn_on:
            id: display_backlight
            brightness: 100%
`
    : '';
  const httpUpdateYaml = httpOtaEnabled
    ? `\nupdate:\n  - platform: http_request\n    name: Firmware Update\n    source: !secret firmware_manifest_url\n`
    : '';
  const homeAssistantBaseUrlSubstitution = homeAssistantBaseUrlEnabled
    ? `\n  home_assistant_base_url: !secret home_assistant_base_url`
    : '';
  const haBaseUrlLocal = homeAssistantBaseUrlEnabled
    ? `\n          const std::string ha_base_url = "\${home_assistant_base_url}";\n`
    : '';
  const imageHelperCapture = homeAssistantBaseUrlEnabled ? '[ha_base_url]' : '[]';
  const imageCallbackCapture = homeAssistantBaseUrlEnabled
    ? '[primary, fallback, prefer_fallback, pending_fetch, ha_base_url]'
    : '[primary, fallback, prefer_fallback, pending_fetch]';
  const relativeImageHandling = homeAssistantBaseUrlEnabled
    ? `
                  if (url.rfind("/", 0) == 0) {
                    url = ha_base_url + url;
                  }`
    : `
                  if (url.rfind("/", 0) == 0) return;`;
  const imageBindingHelper = onlineImagesEnabled
    ? `
          auto bind_ha_image_url = ${imageHelperCapture}(const std::string& entity_id, const std::string& attribute, auto *primary, auto *fallback, bool *prefer_fallback, bool *pending_fetch) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(attribute),
                ${imageCallbackCapture}(esphome::StringRef state) {
                  std::string url(state.c_str(), state.size());
                  if (url.empty() || url == "unknown" || url == "unavailable") return;
${relativeImageHandling}
                  if (url.rfind("http://", 0) != 0 && url.rfind("https://", 0) != 0) return;
                  primary->set_url(url);
                  fallback->set_url(url);
                  if (prefer_fallback != nullptr)
                    *prefer_fallback = false;
                  if (pending_fetch != nullptr)
                    *pending_fetch = true;
                });
          };
`
    : '';
  const defaultVacuumEntity = resolveDefaultEntityForDomain(project, "vacuum");
  const vacuumFallbackEntityLine = defaultVacuumEntity
    ? `\n          const std::string default_vacuum_entity = "${escapeCString(defaultVacuumEntity)}";`
    : '';
  const vacuumFallbackResolution = defaultVacuumEntity
    ? `
            if (effective_entity_id.empty() && service.rfind("vacuum.", 0) == 0) {
              effective_entity_id = default_vacuum_entity;
            }`
    : '';

  return `substitutions:
  device_name: ${deviceName}
  friendly_name: "${friendlyName}"
  timezone: "${timezone}"${homeAssistantBaseUrlSubstitution}

packages:
  base: !include base.yaml
  fonts: !include fonts.yaml
  hardware: !include hardware.yaml
${imageYaml}${onlineImageYaml}${httpRequestYaml}${httpOtaYaml}${httpUpdateYaml}

esphome:
${projectVersionYaml}
  on_boot:
    priority: -100
    then:
      - lambda: |-
          g_theme.header.font = id(font_medium);
          g_theme.header_large.font = id(font_giant);
          g_theme.label.font = id(font_small);
          g_theme.weather_tiny.font = id(font_weather_tiny);
          g_theme.primary.font = id(font_small);
          g_theme.accent.font = id(font_small);
          g_theme.neutral.font = id(font_small);
          g_theme.success.font = id(font_small);${iconFontAssignment}${weatherIconFontAssignment}
          g_ui_app.on_action = [](const std::string& entity_id, const std::string& service) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr || !api->is_connected()) return;
${vacuumFallbackEntityLine}
            std::string effective_entity_id = entity_id;${vacuumFallbackResolution}

            esphome::api::HomeAssistantServiceCallAction<> call(api, false);
            call.set_service(service);
            if (!effective_entity_id.empty()) {
              call.init_data(1);
              call.add_data("entity_id", effective_entity_id);
            } else {
              call.init_data(0);
            }
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
                [target, entity_id](esphome::StringRef state) {
                  bool on = (state.size() == 2 && state.c_str()[0] == 'o'
                             && state.c_str()[1] == 'n');
                  target->set(on);
                  ESP_LOGW("bind", "[t=%u] %s = %s", millis(), entity_id.c_str(), on ? "on" : "off");
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
            if (dot == std::string::npos) return s;
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
                [target, entity_id](esphome::StringRef state) {
                  std::string s(state.c_str(), state.size());
                  if (s.empty()) return;
                  char *end = nullptr;
                  float v = strtof(s.c_str(), &end);
                  if (end == s.c_str()) return;
                  target->set(v);
                  ESP_LOGW("bind", "[t=%u] %s = %.2f", millis(), entity_id.c_str(), v);
                  UiRedraw::trigger_display_update();
                });
          };

          auto bind_ha_float_attr = [](const std::string& entity_id, const std::string& attribute,
                                      Observable<float>* target) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(attribute),
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
${hasTodoEntityRefetch ? `
          // Subscribe to a todo entity's state changes and set a flag so
          // the fast 250ms interval can trigger an immediate todo.get_items
          // refetch. This bridges HA push notifications to the YAML service
          // action (which needs capture_response, only available in YAML).
          auto bind_todo_refetch = [](const std::string& entity_id, bool* flag) {
            auto *api = esphome::api::global_api_server;
            if (api == nullptr) return;
            api->subscribe_home_assistant_state(
                entity_id, esphome::optional<std::string>(),
                [flag](esphome::StringRef) { *flag = true; });
          };
` : ''}
${bindings ? bindings + '\n' : ''}${notificationBindings ? notificationBindings + '\n' : ''}  includes:
    - includes/ui_theme.h
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
${onlineImageFormatGlobals}
${todoRefetchGlobals ? '\n' + todoRefetchGlobals : ''}

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
              g_ui_app.state().image_fetches_in_flight = 0;
              g_ui_app.state().online_images_completed = 0;
              g_ui_app.state().online_images_failed = 0;
              g_ui_app.screens().navigate_to(UiScreenId::Home);
            } else {
              if (g_ui_app.state().online_images_expected > 0 && !g_ui_app.state().loading_done) {
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
${fetchPump}          if (!connected) {
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
${weatherIntervals ? '\n' + weatherIntervals + '\n' : ''}${todoIntervals ? '\n' + todoIntervals + '\n' : ''}${calendarIntervals ? '\n' + calendarIntervals + '\n' : ''}
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

button:
  - platform: restart
    name: "Reboot Device"
`;
}
