import type {
  Project,
  Component,
  ButtonComponent,
  OnTapAction,
  ActionBinding,
  TabContainerComponent,
  ConditionalAreaComponent,
  ContainerComponent,
  LightStateComponent,
  TodoListComponent,
  ImageComponent,
} from "@esphome-designer/schema";

export interface ValidationError {
  type: "error" | "warning";
  message: string;
  componentId?: string;
  componentLabel?: string;
  field?: string;
}

const FIELD_LABELS: Record<string, string> = {
  onTap: "On Tap",
  onHold: "On Hold",
  onDragStart: "On Drag Start",
  onDragEnd: "On Drag End",
  pressAction: "Press Action",
  holdAction: "Hold Action",
};

function componentLabel(c: Component): string {
  if (c.type === "button" && (c as ButtonComponent).label) {
    return `"${(c as ButtonComponent).label}" button`;
  }
  if (c.type === "text" && c.text) {
    return `"${c.text}" text`;
  }
  const typeLabels: Record<string, string> = {
    button: "Button",
    text: "Text",
    icon: "Icon",
    image: "Image",
    light_state: "Light State",
    todo_list: "To-Do List",
    slider: "Slider",
    gauge: "Gauge",
    conditional_area: "Conditional Area",
    tab_container: "Tab Container",
    container: "Container",
    procedural_icon: "Procedural Icon",
    auto_layout_list: "Auto Layout List",
  };
  return typeLabels[c.type] ?? c.type;
}

export type ValidationRule = (project: Project) => ValidationError[];

const RULES: ValidationRule[] = [
  validateActionTargets,
  validateLightStateBinding,
  validateTodoListBinding,
  validateImageHaBinding,
];

export function validateProject(project: Project): ValidationError[] {
  return RULES.flatMap((rule) => rule(project));
}

function collectAllComponents(project: Project): Component[] {
  const result: Component[] = [];

  const walk = (components: Component[]) => {
    for (const c of components) {
      result.push(c);
      if (c.type === "container") {
        const container = c as ContainerComponent;
        if (container.children) walk(container.children);
      } else if (c.type === "tab_container") {
        const tc = c as TabContainerComponent;
        for (const tab of tc.tabs) {
          walk(tab.components);
        }
      } else if (c.type === "conditional_area") {
        const ca = c as ConditionalAreaComponent;
        for (const variant of ca.variants) {
          walk(variant.components);
        }
      }
    }
  };

  for (const page of project.dashboardPages ?? []) {
    walk(page.components ?? []);
  }
  for (const view of project.detailViews ?? []) {
    walk(view.components ?? []);
  }
  if (project.pageHeader?.components) {
    walk(project.pageHeader.components);
  }

  return result;
}

function validateAction(action: OnTapAction | ActionBinding | undefined, fieldName: string, componentId: string, compLabel: string): ValidationError[] {
  if (!action) return [];

  const fieldLabel = FIELD_LABELS[fieldName] ?? fieldName;

  if (action.type === "OPEN_DETAIL") {
    if (!action.targetId) {
      return [
        {
          type: "error" as const,
          message: `"${fieldLabel}" needs a target detail view`,
          componentId,
          componentLabel: compLabel,
          field: fieldName,
        },
      ];
    }
  }

  return [];
}

function validateActionTargets(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const components = collectAllComponents(project);

  for (const c of components) {
    const label = componentLabel(c);

    const baseActions: { action: OnTapAction | undefined; field: string }[] = [
      { action: c.onTap, field: "onTap" },
      { action: c.onHold, field: "onHold" },
      { action: c.onDragStart, field: "onDragStart" },
      { action: c.onDragEnd, field: "onDragEnd" },
    ];

    for (const { action, field } of baseActions) {
      errors.push(...validateAction(action, field, c.id, label));
    }

    if (c.type === "button") {
      const btn = c as ButtonComponent;
      errors.push(...validateAction(btn.pressAction, "pressAction", c.id, label));
      errors.push(...validateAction(btn.holdAction, "holdAction", c.id, label));
    }
  }

  return errors;
}

function validateLightStateBinding(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const components = collectAllComponents(project);

  for (const c of components) {
    if (c.type !== "light_state") continue;
    const ls = c as LightStateComponent;
    if (!ls.stateBinding?.entityId) {
      errors.push({
        type: "error" as const,
        message: `Needs an entity binding to display state`,
        componentId: c.id,
        componentLabel: componentLabel(c),
      });
    }
  }

  return errors;
}

function validateTodoListBinding(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const components = collectAllComponents(project);

  for (const c of components) {
    if (c.type !== "todo_list") continue;
    const tl = c as TodoListComponent;
    if (!tl.itemsBinding?.entityId) {
      errors.push({
        type: "error" as const,
        message: `Needs an entity binding to display items`,
        componentId: c.id,
        componentLabel: componentLabel(c),
      });
    }
  }

  return errors;
}

function validateImageHaBinding(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const components = collectAllComponents(project);

  for (const c of components) {
    if (c.type !== "image") continue;
    const img = c as ImageComponent;
    if (img.imageSource === "ha" && !img.imageBinding?.entityId) {
      errors.push({
        type: "error" as const,
        message: `Needs an entity binding for Home Assistant image`,
        componentId: c.id,
        componentLabel: componentLabel(c),
      });
    }
  }

  return errors;
}
