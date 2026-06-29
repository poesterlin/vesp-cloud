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
  TextComponent,
  HvacComponent,
  EntityBinding,
  Condition,
  EntityCondition,
  StateCondition,
  CompoundCondition,
  NotCondition,
} from "@esphome-designer/schema";
import { extractBindings, parseTemplate } from "../utils/template-utils";

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
    hvac: "HVAC Control",
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
  validateCodegenSafeStrings,
  validateActionTargets,
  validateLightStateBinding,
  validateTodoListBinding,
  validateImageHaBinding,
  validateHvacBinding,
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

const CPP_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const HA_ENTITY_RE = /^[a-z_]+\.[a-z0-9_]+$/;
const HA_SERVICE_RE = /^[a-z_]+\.[a-z0-9_]+$/;
const HA_ATTRIBUTE_RE = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const HA_DEVICE_ID_RE = /^[A-Za-z0-9_-]+$/;
const TIMEZONE_RE = /^[A-Za-z_][A-Za-z0-9_+\/-]*$/;
const IMAGE_RESIZE_RE = /^\d+x\d+$/;
const URL_RE = /^https?:\/\/[^\s"'<>]+$/;

function validatePattern(
  value: string | undefined | null,
  pattern: RegExp,
  message: string,
  component?: Component,
  field?: string,
): ValidationError[] {
  if (value == null || value === '') return [];
  if (pattern.test(value)) return [];
  return [{
    type: 'error' as const,
    message,
    componentId: component?.id,
    componentLabel: component ? componentLabel(component) : undefined,
    field,
  }];
}

function validateBinding(binding: EntityBinding | undefined, component: Component, field: string): ValidationError[] {
  if (!binding) return [];
  return [
    ...validatePattern(binding.entityId, HA_ENTITY_RE, `${field} entity ID must be a Home Assistant entity ID`, component, field),
    ...validatePattern(binding.attribute, HA_ATTRIBUTE_RE, `${field} attribute must be a safe Home Assistant attribute path`, component, field),
  ];
}

function visitCondition(condition: Condition | undefined, visit: (condition: Condition) => void): void {
  if (!condition) return;
  visit(condition);
  if (condition.type === 'compound') {
    for (const inner of (condition as CompoundCondition).conditions) visitCondition(inner, visit);
  } else if (condition.type === 'not') {
    visitCondition((condition as NotCondition).condition, visit);
  }
}

function validateCondition(condition: Condition | undefined, component: Component, field: string): ValidationError[] {
  const errors: ValidationError[] = [];
  visitCondition(condition, (c) => {
    if (c.type === 'entity') {
      const entity = c as EntityCondition;
      errors.push(...validatePattern(entity.entityId, HA_ENTITY_RE, `${field} entity ID must be a Home Assistant entity ID`, component, field));
      errors.push(...validatePattern(entity.attribute, HA_ATTRIBUTE_RE, `${field} attribute must be a safe Home Assistant attribute path`, component, field));
    } else if (c.type === 'state') {
      const state = c as StateCondition;
      errors.push(...validatePattern(state.variable, CPP_IDENTIFIER_RE, `${field} state variable must be a safe C++ identifier`, component, field));
    }
  });
  return errors;
}

function validateCodegenSafeStrings(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];

  errors.push(...validatePattern(project.timezone, TIMEZONE_RE, 'Timezone must be an IANA-like identifier'));
  errors.push(...validatePattern(project.secrets?.firmwareUpdateUrl, URL_RE, 'Firmware update URL must be an HTTP(S) URL'));
  errors.push(...validatePattern(project.secrets?.homeAssistantBaseUrl, URL_RE, 'Home Assistant base URL must be an HTTP(S) URL'));

  const stateFieldNames = new Set<string>();
  for (const field of project.state?.fields ?? []) {
    errors.push(...validatePattern(field.name, CPP_IDENTIFIER_RE, `State field "${field.name}" must be a safe C++ identifier`, undefined, 'state.fields.name'));
    errors.push(...validatePattern(field.haEntity, HA_ENTITY_RE, `State field "${field.name}" must reference a Home Assistant entity ID`, undefined, 'state.fields.haEntity'));
    stateFieldNames.add(field.name);
  }

  const components = collectAllComponents(project);
  for (const c of components) {
    errors.push(...validateBinding(c.visibleWhen, c, 'visibleWhen'));
    errors.push(...validateBinding(c.loadingBinding, c, 'loadingBinding'));

    for (const actionField of ['onTap', 'onHold', 'onDragStart', 'onDragEnd'] as const) {
      const action = c[actionField];
      if (action?.type === 'SERVICE_CALL') {
        errors.push(...validatePattern(action.service, HA_SERVICE_RE, `${actionField} service must be a Home Assistant service`, c, actionField));
        errors.push(...validatePattern(action.target?.entityId, HA_ENTITY_RE, `${actionField} target must be a Home Assistant entity ID`, c, actionField));
        errors.push(...validatePattern(action.target?.deviceId, HA_DEVICE_ID_RE, `${actionField} device target must be a safe device ID`, c, actionField));
      }
    }

    if (c.type === 'button') {
      const button = c as ButtonComponent;
      for (const actionField of ['pressAction', 'holdAction'] as const) {
        const action = button[actionField];
        if (action?.type === 'SERVICE_CALL') {
          errors.push(...validatePattern(action.service, HA_SERVICE_RE, `${actionField} service must be a Home Assistant service`, c, actionField));
          errors.push(...validatePattern(action.target?.entityId, HA_ENTITY_RE, `${actionField} target must be a Home Assistant entity ID`, c, actionField));
          errors.push(...validatePattern(action.target?.deviceId, HA_DEVICE_ID_RE, `${actionField} device target must be a safe device ID`, c, actionField));
        }
      }
    } else if (c.type === 'light_state') {
      errors.push(...validateBinding((c as LightStateComponent).stateBinding, c, 'stateBinding'));
    } else if (c.type === 'hvac') {
      errors.push(...validateBinding((c as HvacComponent).stateBinding, c, 'stateBinding'));
    } else if (c.type === 'todo_list') {
      const todo = c as TodoListComponent;
      errors.push(...validateBinding(todo.itemsBinding, c, 'itemsBinding'));
      errors.push(...validatePattern(todo.todoEntityId, HA_ENTITY_RE, 'todoEntityId must be a Home Assistant entity ID', c, 'todoEntityId'));
    } else if (c.type === 'text') {
      const text = c as TextComponent;
      errors.push(...validateBinding(text.textBinding, c, 'textBinding'));
      for (const binding of extractBindings(parseTemplate(text.text ?? ''))) {
        errors.push(...validateBinding(binding, c, 'text'));
      }
    } else if (c.type === 'image') {
      const image = c as ImageComponent;
      errors.push(...validateBinding(image.imageBinding, c, 'imageBinding'));
      errors.push(...validatePattern(image.resize, IMAGE_RESIZE_RE, 'Image resize must use WIDTHxHEIGHT format', c, 'resize'));
    } else if (c.type === 'conditional_area') {
      const area = c as ConditionalAreaComponent;
      for (const variant of area.variants) {
        errors.push(...validateCondition(variant.condition, c, 'condition'));
      }
    }
  }

  for (const c of components) {
    if (c.type !== 'conditional_area') continue;
    const area = c as ConditionalAreaComponent;
    for (const variant of area.variants) {
      visitCondition(variant.condition, (condition) => {
        if (condition.type !== 'state') return;
        const state = condition as StateCondition;
        if (!stateFieldNames.has(state.variable)) {
          errors.push({
            type: 'error' as const,
            message: `Condition references unknown state variable "${state.variable}"`,
            componentId: c.id,
            componentLabel: componentLabel(c),
            field: 'condition',
          });
        }
      });
    }
  }

  return errors;
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

  if (action.type === "SERVICE_CALL") {
    if (!action.service) {
      return [
        {
          type: "error" as const,
          message: `"${fieldLabel}" needs a service`,
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
    if (tl.checkable && !tl.todoEntityId) {
      errors.push({
        type: "error" as const,
        message: `Checkable to-do lists need a todoEntityId to mark items complete`,
        componentId: c.id,
        componentLabel: componentLabel(c),
        field: 'todoEntityId',
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

function validateHvacBinding(project: Project): ValidationError[] {
  const errors: ValidationError[] = [];
  const components = collectAllComponents(project);

  for (const c of components) {
    if (c.type !== "hvac") continue;
    const hvac = c as HvacComponent;
    if (!hvac.stateBinding?.entityId) {
      errors.push({
        type: "error" as const,
        message: `Needs a climate entity binding to control`,
        componentId: c.id,
        componentLabel: componentLabel(c),
      });
    }
  }

  return errors;
}
