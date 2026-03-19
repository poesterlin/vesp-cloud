/**
 * Tests for ESPHome YAML generator - Conditional Areas
 */
import { describe, test, expect } from "bun:test";
import { generateESPHomeYAML } from "./esphome";
import type { Project, ConditionalAreaComponent } from "@esphome-designer/schema";

function createMinimalProject(): Project {
  return {
    id: "test-project",
    name: "Test Project",
    display: {
      width: 480,
      height: 480,
    },
    dashboardPages: [],
    detailViews: [],
  };
}

describe("ESPHome YAML Generator - Conditional Areas", () => {
  test("generates conditional area with entity condition", () => {
    const conditionalArea: ConditionalAreaComponent = {
      id: "cond-area-1",
      type: "conditional_area",
      position: { x: 10, y: 10 },
      size: { width: 100, height: 50 },
      defaultVariantId: "off",
      variants: [
        {
          id: "on",
          name: "Light On",
          condition: {
            type: "entity",
            entityId: "light.living_room",
            operator: "eq",
            value: "on",
          },
          components: [
            {
              id: "text-on",
              type: "text",
              position: { x: 0, y: 0 },
              text: "ON",
            },
          ],
        },
        {
          id: "off",
          name: "Light Off",
          components: [
            {
              id: "text-off",
              type: "text",
              position: { x: 0, y: 0 },
              text: "OFF",
            },
          ],
        },
      ],
    };

    const project = createMinimalProject();
    project.dashboardPages = [
      {
        id: "page-1",
        name: "Home",
        components: [conditionalArea],
      },
    ];

    const yaml = generateESPHomeYAML(project);

    // Should have binary_sensor section for light.living_room
    expect(yaml).toContain("binary_sensor:");
    expect(yaml).toContain("entity_id: light.living_room");
    expect(yaml).toContain("script.execute: update_conditional_areas");

    // Should have script section with update_conditional_areas
    expect(yaml).toContain("script:");
    expect(yaml).toContain("id: update_conditional_areas");
    expect(yaml).toContain("lambda:");

    // Should have conditional area obj containers
    expect(yaml).toContain("w_cond_area_1");
    expect(yaml).toContain("w_cond_area_1_v0");
    expect(yaml).toContain("w_cond_area_1_v1");

    // Default variant should not be hidden, others should
    expect(yaml).toContain("hidden: true");
  });

  test("generates sensor for condition-only entity", () => {
    // Entity used only in condition, not bound to any widget
    const conditionalArea: ConditionalAreaComponent = {
      id: "temp-area",
      type: "conditional_area",
      position: { x: 0, y: 0 },
      size: { width: 100, height: 50 },
      defaultVariantId: "normal",
      variants: [
        {
          id: "hot",
          name: "Hot",
          condition: {
            type: "entity",
            entityId: "sensor.temperature",
            operator: "gt",
            value: 25,
          },
          components: [
            { id: "text-hot", type: "text", position: { x: 0, y: 0 }, text: "HOT" },
          ],
        },
        {
          id: "normal",
          name: "Normal",
          components: [
            { id: "text-normal", type: "text", position: { x: 0, y: 0 }, text: "OK" },
          ],
        },
      ],
    };

    const project = createMinimalProject();
    project.dashboardPages = [
      {
        id: "page-1",
        name: "Home",
        components: [conditionalArea],
      },
    ];

    const yaml = generateESPHomeYAML(project);

    // Should have sensor section for sensor.temperature
    expect(yaml).toContain("sensor:");
    expect(yaml).toContain("entity_id: sensor.temperature");
    expect(yaml).toContain("script.execute: update_conditional_areas");
  });

  test("generates compound condition", () => {
    const conditionalArea: ConditionalAreaComponent = {
      id: "compound-area",
      type: "conditional_area",
      position: { x: 0, y: 0 },
      size: { width: 100, height: 50 },
      variants: [
        {
          id: "both-on",
          name: "Both On",
          condition: {
            type: "compound",
            operator: "and",
            conditions: [
              { type: "entity", entityId: "light.a", operator: "eq", value: "on" },
              { type: "entity", entityId: "light.b", operator: "eq", value: "on" },
            ],
          },
          components: [],
        },
        {
          id: "default",
          name: "Default",
          components: [],
        },
      ],
      defaultVariantId: "default",
    };

    const project = createMinimalProject();
    project.dashboardPages = [
      {
        id: "page-1",
        name: "Home",
        components: [conditionalArea],
      },
    ];

    const yaml = generateESPHomeYAML(project);

    // Should generate both sensors
    expect(yaml).toContain("entity_id: light.a");
    expect(yaml).toContain("entity_id: light.b");

    // Should have compound condition with &&
    expect(yaml).toContain("&&");
  });

  test("no duplicate sensor sections", () => {
    // Create a project with both widget bindings and condition entities
    const project = createMinimalProject();
    project.dashboardPages = [
      {
        id: "page-1",
        name: "Home",
        components: [
          // Regular text with binding
          {
            id: "temp-text",
            type: "text",
            position: { x: 0, y: 0 },
            text: "Temp",
            textBinding: {
              type: "entity_state",
              entityId: "sensor.temperature",
              format: "%.1f°C",
            },
          },
          // Conditional area using same entity in condition
          {
            id: "temp-area",
            type: "conditional_area",
            position: { x: 0, y: 50 },
            size: { width: 100, height: 50 },
            variants: [
              {
                id: "hot",
                name: "Hot",
                condition: {
                  type: "entity",
                  entityId: "sensor.temperature",
                  operator: "gt",
                  value: 25,
                },
                components: [],
              },
              {
                id: "normal",
                name: "Normal",
                components: [],
              },
            ],
            defaultVariantId: "normal",
          },
        ],
      },
    ];

    const yaml = generateESPHomeYAML(project);

    // Count occurrences of "sensor:" - should only be 1
    const sensorSections = yaml.match(/^sensor:/gm);
    expect(sensorSections?.length).toBe(1);

    // sensor.temperature should only appear once as a sensor definition
    const tempSensorDefs = yaml.match(/entity_id: sensor\.temperature/g);
    expect(tempSensorDefs?.length).toBe(1);
  });
});
