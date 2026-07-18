/**
 * Tests for ConditionalVariant and ConditionalAreaComponent schemas
 */
import { describe, test, expect } from "bun:test";
import type {
  ConditionalVariant,
  ConditionalAreaComponent,
  EntityCondition,
  StateCondition,
  TimeCondition,
  CompoundCondition,
  NotCondition,
  Component,
} from "../dist/types";

describe("ConditionalVariant", () => {
  test("minimal valid variant has id, name, and components", () => {
    const variant: ConditionalVariant = {
      id: "default",
      name: "Default State",
      components: [],
    };

    expect(variant.id).toBe("default");
    expect(variant.name).toBe("Default State");
    expect(variant.components).toEqual([]);
  });

  test("variant with entity condition", () => {
    const condition: EntityCondition = {
      type: "entity",
      entityId: "light.living_room",
      operator: "eq",
      value: "on",
    };

    const variant: ConditionalVariant = {
      id: "lights-on",
      name: "Lights On",
      condition,
      components: [
        {
          id: "light-icon",
          type: "icon",
          position: { x: 0, y: 0 },
          size: { width: 32, height: 32 },
          icon: "mdi:lightbulb",
        },
      ],
    };

    expect(variant.condition?.type).toBe("entity");
    expect((variant.condition as EntityCondition).entityId).toBe("light.living_room");
  });

  test("variant with state condition", () => {
    const condition: StateCondition = {
      type: "state",
      variable: "currentPage",
      operator: "eq",
      value: 1,
    };

    const variant: ConditionalVariant = {
      id: "page-1-active",
      name: "Page 1 Active",
      condition,
      components: [],
    };

    expect(variant.condition?.type).toBe("state");
    expect((variant.condition as StateCondition).variable).toBe("currentPage");
  });

  test("variant with time condition", () => {
    const condition: TimeCondition = {
      type: "time",
      after: "08:00",
      before: "20:00",
    };

    const variant: ConditionalVariant = {
      id: "daytime",
      name: "Daytime",
      condition,
      components: [],
    };

    expect(variant.condition?.type).toBe("time");
    expect((variant.condition as TimeCondition).after).toBe("08:00");
    expect((variant.condition as TimeCondition).before).toBe("20:00");
  });

  test("variant with priority", () => {
    const variant: ConditionalVariant = {
      id: "high-priority",
      name: "High Priority Alert",
      priority: 100,
      condition: {
        type: "entity",
        entityId: "binary_sensor.alarm",
        operator: "eq",
        value: "on",
      },
      components: [],
    };

    expect(variant.priority).toBe(100);
  });

  test("variant with transition", () => {
    const variant: ConditionalVariant = {
      id: "animated",
      name: "Animated Variant",
      transition: {
        type: "fade",
        duration: 300,
      },
      components: [],
    };

    expect(variant.transition?.type).toBe("fade");
    expect(variant.transition?.duration).toBe(300);
  });
});

describe("Condition types", () => {
  test("entity condition with attribute", () => {
    const condition: EntityCondition = {
      type: "entity",
      entityId: "climate.thermostat",
      attribute: "temperature",
      operator: "gt",
      value: 20,
    };

    expect(condition.attribute).toBe("temperature");
    expect(condition.operator).toBe("gt");
  });

  test("all comparison operators are valid", () => {
    const operators = ["eq", "neq", "gt", "gte", "lt", "lte", "contains", "not_contains", "matches"] as const;

    operators.forEach((op) => {
      const condition: EntityCondition = {
        type: "entity",
        entityId: "sensor.test",
        operator: op,
        value: "test",
      };
      expect(condition.operator).toBe(op);
    });
  });

  test("compound condition with AND", () => {
    const condition: CompoundCondition = {
      type: "compound",
      operator: "and",
      conditions: [
        { type: "entity", entityId: "light.a", operator: "eq", value: "on" },
        { type: "entity", entityId: "light.b", operator: "eq", value: "on" },
      ],
    };

    expect(condition.operator).toBe("and");
    expect(condition.conditions.length).toBe(2);
  });

  test("compound condition with OR", () => {
    const condition: CompoundCondition = {
      type: "compound",
      operator: "or",
      conditions: [
        { type: "time", after: "22:00" },
        { type: "time", before: "06:00" },
      ],
    };

    expect(condition.operator).toBe("or");
  });

  test("not condition", () => {
    const condition: NotCondition = {
      type: "not",
      condition: {
        type: "entity",
        entityId: "binary_sensor.motion",
        operator: "eq",
        value: "on",
      },
    };

    expect(condition.type).toBe("not");
    expect(condition.condition.type).toBe("entity");
  });

  test("nested compound conditions", () => {
    const condition: CompoundCondition = {
      type: "compound",
      operator: "and",
      conditions: [
        {
          type: "compound",
          operator: "or",
          conditions: [
            { type: "entity", entityId: "light.a", operator: "eq", value: "on" },
            { type: "entity", entityId: "light.b", operator: "eq", value: "on" },
          ],
        },
        { type: "time", after: "18:00" },
      ],
    };

    expect(condition.conditions[0]?.type).toBe("compound");
  });
});

describe("ConditionalAreaComponent", () => {
  test("minimal conditional area with one variant", () => {
    const area: ConditionalAreaComponent = {
      id: "cond-area-1",
      type: "conditional_area",
      position: { x: 10, y: 10 },
      size: { width: 200, height: 100 },
      variants: [
        {
          id: "default",
          name: "Default",
          components: [],
        },
      ],
    };

    expect(area.type).toBe("conditional_area");
    expect(area.variants.length).toBe(1);
  });

  test("conditional area with multiple variants", () => {
    const area: ConditionalAreaComponent = {
      id: "light-status",
      type: "conditional_area",
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      variants: [
        {
          id: "on",
          name: "Light On",
          condition: { type: "entity", entityId: "light.main", operator: "eq", value: "on" },
          components: [
            { id: "icon-on", type: "icon", position: { x: 0, y: 0 }, size: { width: 32, height: 32 }, icon: "mdi:lightbulb" },
          ],
        },
        {
          id: "off",
          name: "Light Off",
          components: [
            { id: "icon-off", type: "icon", position: { x: 0, y: 0 }, size: { width: 32, height: 32 }, icon: "mdi:lightbulb-outline" },
          ],
        },
      ],
      defaultVariantId: "off",
    };

    expect(area.variants.length).toBe(2);
    expect(area.defaultVariantId).toBe("off");
  });

  test("conditional area with evaluation mode", () => {
    const area: ConditionalAreaComponent = {
      id: "priority-area",
      type: "conditional_area",
      position: { x: 0, y: 0 },
      evaluationMode: "priority",
      variants: [
        { id: "high", name: "High Priority", priority: 10, components: [] },
        { id: "low", name: "Low Priority", priority: 1, components: [] },
      ],
    };

    expect(area.evaluationMode).toBe("priority");
  });

  test("conditional area with clip content disabled", () => {
    const area: ConditionalAreaComponent = {
      id: "no-clip",
      type: "conditional_area",
      position: { x: 0, y: 0 },
      clipContent: false,
      variants: [{ id: "default", name: "Default", components: [] }],
    };

    expect(area.clipContent).toBe(false);
  });

  test("conditional area inherits BaseComponent properties", () => {
    const area: ConditionalAreaComponent = {
      id: "base-test",
      type: "conditional_area",
      position: { x: 50, y: 100 },
      size: { width: 200, height: 150 },
      visible: false,
      variant: "retro",
      variants: [{ id: "default", name: "Default", components: [] }],
    };

    expect(area.position).toEqual({ x: 50, y: 100 });
    expect(area.size).toEqual({ width: 200, height: 150 });
    expect(area.visible).toBe(false);
    expect(area.variant).toBe("retro");
  });

  test("conditional area variants can contain nested components", () => {
    const area: ConditionalAreaComponent = {
      id: "nested",
      type: "conditional_area",
      position: { x: 0, y: 0 },
      variants: [
        {
          id: "complex",
          name: "Complex Layout",
          components: [
            { id: "text-1", type: "text", position: { x: 0, y: 0 }, text: "Hello" },
            { id: "btn-1", type: "button", position: { x: 0, y: 20 }, size: { width: 80, height: 30 }, label: "Click" },
            { id: "icon-1", type: "icon", position: { x: 100, y: 0 }, size: { width: 60, height: 60 }, icon: "home" },
          ],
        },
      ],
    };

    expect(area.variants[0]?.components.length).toBe(3);
    expect(area.variants[0]?.components[0]?.type).toBe("text");
    expect(area.variants[0]?.components[1]?.type).toBe("button");
    expect(area.variants[0]?.components[2]?.type).toBe("icon");
  });
});

describe("Component union includes ConditionalAreaComponent", () => {
  test("conditional area can be used as Component type", () => {
    const components: Component[] = [
      { id: "text-1", type: "text", position: { x: 0, y: 0 }, text: "Hello" },
      {
        id: "cond-1",
        type: "conditional_area",
        position: { x: 0, y: 50 },
        variants: [{ id: "default", name: "Default", components: [] }],
      },
    ];

    expect(components.length).toBe(2);
    expect(components[1]?.type).toBe("conditional_area");
  });
});
