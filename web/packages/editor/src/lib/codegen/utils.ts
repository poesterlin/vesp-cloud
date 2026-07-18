import type {
  Component,
  TabContainerComponent,
  ConditionalAreaComponent,
  Project,
  IconComponent,
  ButtonComponent,
  LightStateComponent,
  TodoListComponent,
  EntityBinding,
} from "@vesp-cloud/schema";

export function toCppIdentifier(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function detailScreenId(id: string, title: string): string {
  return 'Detail' + (toCppIdentifier(id) || toCppIdentifier(title) || 'View');
}

export function firstScreenId(_project: { dashboardPages: { name: string }[] }): string {
  return 'Home';
}

export function cppDefaultValue(cppType: string): string {
  switch (cppType) {
    case 'bool': return 'false';
    case 'int': return '0';
    case 'float': return '0.0f';
    case 'std::string': return '""';
    default: return '{}';
  }
}

export function cppTypeFor(cppType: string): string {
  switch (cppType) {
    case 'std::string': return 'std::string';
    default: return cppType;
  }
}

export function sanitizeDeviceName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function stateVarFromEntity(entityId: string, attribute?: string | null): string {
  let name = entityId.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '');
  if (attribute) {
    const attr = attribute.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    if (attr) name += `_${attr}`;
  }
  return name;
}

export function safeCppIdentifier(value: string, prefix = 'id'): string {
  const safe = value.replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(safe)) return safe;
  return `${prefix}_${safe.replace(/^_+/, '') || 'value'}`;
}

export function escapeYAMLDoubleQuoted(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function imageIdFromComponentId(id: string): string {
  const safe = stateVarFromEntity(id).toLowerCase();
  return `img_${safe || "image"}`;
}

export function imageFallbackIdFromComponentId(id: string): string {
  return `${imageIdFromComponentId(id)}_alt`;
}

export function todoItemsVarFromBinding(binding: EntityBinding | undefined, fallbackId: string): string {
  if (!binding?.entityId) {
    return `todo_${stateVarFromEntity(fallbackId)}_all_items`;
  }
  const attr = (binding.attribute ?? "all_items")
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "");
  const safeAttr = attr || "all_items";
  return `${stateVarFromEntity(binding.entityId)}_${safeAttr}`;
}

export function todoItemsVarFromTodoEntity(entityId: string): string {
  return `${stateVarFromEntity(entityId)}_items`;
}

export function todoEntityIdFromComponent(todo: Pick<TodoListComponent, 'todoEntityId' | 'itemsBinding'>): string | undefined {
  if (todo.todoEntityId) return todo.todoEntityId;
  const bindingEntityId = todo.itemsBinding?.entityId;
  if (bindingEntityId?.startsWith('todo.')) return bindingEntityId;
  return undefined;
}

export function calendarEventsVarFromEntity(entityId: string, durationDays?: number): string {
  const normalizedDays = Math.max(0, Math.floor(durationDays ?? 125));
  return `${stateVarFromEntity(entityId)}_events_${normalizedDays}d_raw`;
}

export function textBindingVar(binding: EntityBinding): string {
  let name = stateVarFromEntity(binding.entityId);
  if (binding.attribute) {
    const attr = binding.attribute
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "");
    if (attr) name += `_${attr}`;
  }
  return `txt_${name}`;
}

export function escapeCString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Stable key for de-duplicating EntityBindings (used when collecting
 * subscriptions / state vars so the same binding referenced from
 * multiple places only emits a single subscription).
 */
export function bindingKey(b: EntityBinding): string {
  return `${b.entityId}::${b.attribute ?? ""}`;
}

export function collectAllComponents(components: Component[]): Component[] {
  const result: Component[] = [];
  for (const c of components) {
    result.push(c);
    if (c.type === 'tab_container') {
      const tc = c as TabContainerComponent;
      for (const tab of tc.tabs) {
        result.push(...collectAllComponents(tab.components));
      }
    } else if (c.type === 'conditional_area') {
      const ca = c as ConditionalAreaComponent;
      for (const variant of ca.variants) {
        result.push(...collectAllComponents(variant.components));
      }
    }
  }
  return result;
}

export interface ScreenDescriptor {
  cppName: string;
  name: string;
}

export type WidgetFactory = (typeName: string, args: string) => string;

// Default icon font size used when a component does not specify size.
// Kept in sync with `ICON_FONT_SIZE` in mdi-icons.ts so codegen and YAML
// reference the same font id.
export const DEFAULT_ICON_FONT_SIZE = 24;

export const NOTIFICATION_OVERLAY_ICON_NAMES = [
  "information",
  "alert",
  "alert-circle",
  "help-circle",
] as const;

/**
 * Normalize an MDI icon name by stripping a leading `mdi:` prefix and
 * trimming whitespace. Returns an empty string if the input is falsy.
 */
export function normalizeIconName(name: string | undefined | null): string {
  if (!name) return "";
  return name.replace(/^mdi:/, "").trim();
}

/**
 * Walk all components in a project (dashboards, detail views, page header)
 * and collect the set of normalized icon names referenced by them.
 *
 * Currently inspects: `icon`, `button.icon`, `light_state.icon`,
 * and checkable `todo_list` checkbox icons.
 */
export function collectProjectIconNames(project: Project): Set<string> {
  const icons = new Set<string>();

  const addIcon = (raw: string | undefined | null) => {
    const name = normalizeIconName(raw);
    if (name) icons.add(name);
  };

  const visit = (components: Component[]) => {
    for (const c of collectAllComponents(components)) {
      if (c.type === "icon") {
        addIcon((c as IconComponent).icon);
      } else if (c.type === "button") {
        addIcon((c as ButtonComponent).icon);
      } else if (c.type === "light_state") {
        const light = c as LightStateComponent;
        if (light.showIcon !== false) {
          addIcon(light.icon ?? "lightbulb");
        }
      } else if (c.type === "hvac") {
        addIcon("minus");
        addIcon("plus");
        addIcon("power");
      } else if (c.type === "weather") {
        addIcon("weather-sunny");
        addIcon("weather-night");
        addIcon("weather-cloudy");
        addIcon("weather-partly-cloudy");
        addIcon("weather-rainy");
        addIcon("weather-pouring");
        addIcon("weather-snowy");
        addIcon("weather-snowy-rainy");
        addIcon("weather-windy");
        addIcon("weather-windy-variant");
        addIcon("weather-fog");
        addIcon("weather-hail");
        addIcon("weather-lightning");
        addIcon("weather-lightning-rainy");
        addIcon("weather-tornado");
      } else if (c.type === "todo_list") {
        const todo = c as TodoListComponent;
        if (todo.checkable === true) {
          addIcon("checkbox-blank-outline");
          addIcon("checkbox-marked");
        }
      }
    }
  };

  for (const page of project.dashboardPages ?? []) {
    visit(page.components);
  }
  for (const view of project.detailViews ?? []) {
    visit(view.components);
  }
  if (project.pageHeader?.components) {
    visit(project.pageHeader.components);
  }
  if (project.notificationOverlay != null && project.notificationOverlay.enabled !== false) {
    for (const icon of NOTIFICATION_OVERLAY_ICON_NAMES) {
      addIcon(icon);
    }
  }

  return icons;
}
