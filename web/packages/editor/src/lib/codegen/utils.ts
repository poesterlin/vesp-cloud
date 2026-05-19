import type {
  Component,
  TabContainerComponent,
  ConditionalAreaComponent,
  Project,
  IconComponent,
  ButtonComponent,
  AutoLayoutListComponent,
  AutoLayoutListItem,
} from "@esphome-designer/schema";

export function toCppIdentifier(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
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

export function stateVarFromEntity(entityId: string): string {
  return entityId.replace(/\./g, '_').replace(/[^a-zA-Z0-9_]/g, '');
}

export function escapeCString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
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
 * Currently inspects: `icon`, `button.icon`, and `auto_layout_list` item icons.
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
      } else if (c.type === "auto_layout_list") {
        const list = c as AutoLayoutListComponent;
        for (const item of list.items as AutoLayoutListItem[]) {
          addIcon(item.icon);
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

  return icons;
}
