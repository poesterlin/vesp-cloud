/**
 * Tests for ESPHome YAML generator
 */
import { describe, test, expect } from "bun:test";
import { generateESPHomeYAML } from "./esphome";
import type { Project, ConditionalAreaComponent, SliderComponent, GaugeComponent } from "@esphome-designer/schema";

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

describe("ESPHome YAML Generator - Detail Views", () => {
  test("generates detail view as hidden overlay", () => {
    const project = createMinimalProject();
    project.dashboardPages = [{
      id: "page-1",
      name: "Home",
      components: [{
        id: "btn-open",
        type: "button",
        position: { x: 100, y: 100 },
        size: { width: 80, height: 40 },
        label: "Open",
        pressAction: {
          type: "OPEN_DETAIL",
          targetId: "SETTINGS",
        },
      }],
    }];
    project.detailViews = [{
      id: "SETTINGS",
      title: "Settings",
      height: 600,
      components: [],
    }];

    const yaml = generateESPHomeYAML(project);

    // Button should use lvgl.page.show (not lvgl.widget.show)
    expect(yaml).toContain("lvgl.page.show: detail_settings");
    expect(yaml).not.toContain("lvgl.widget.show");

    // Detail view should be a skipped page
    expect(yaml).toContain("id: detail_settings");
    expect(yaml).toContain("skip: true");
    expect(yaml).not.toContain("top_layer:");

    // Should have back button that returns to the stored page
    expect(yaml).toContain("detail_view_active");
    expect(yaml).toContain("return_page");
    expect(yaml).toContain("id(my_lvgl)->show_page(id(return_page)");

    // OPEN_DETAIL button should store page index and set detail_view_active
    expect(yaml).toContain('value: "true"');
    expect(yaml).toContain('value: "0"'); // return to page_0

    // Swipe should be blocked when detail view is active
    expect(yaml).toContain("if (id(detail_view_active)) return;");
  });

  test("detail view has header with title and back button", () => {
    const project = createMinimalProject();
    project.dashboardPages = [{ id: "page-1", name: "Home", components: [] }];
    project.detailViews = [{
      id: "TEMPS",
      title: "Temperature Details",
      height: 600,
      headerHeight: 50,
      components: [],
    }];

    const yaml = generateESPHomeYAML(project);

    // Should have title label
    expect(yaml).toContain('text: "Temperature Details"');
    
    // Should have back button with correct ID
    expect(yaml).toContain("id: detail_temps_back");
  });
});

describe("ESPHome YAML Generator - Slider", () => {
  test("generates slider with onChange service call using on_change trigger", () => {
    const slider: SliderComponent = {
      id: "brightness-slider",
      type: "slider",
      position: { x: 20, y: 100 },
      size: { width: 200, height: 30 },
      min: 0,
      max: 255,
      onChange: {
        type: "SERVICE_CALL",
        service: "light.turn_on",
        target: { entityId: "light.living_room" },
      },
    };

    const project = createMinimalProject();
    project.dashboardPages = [{
      id: "page-1",
      name: "Home",
      components: [slider],
    }];

    const yaml = generateESPHomeYAML(project);

    // Should use on_change (user-only), NOT on_value (which fires on programmatic updates too)
    expect(yaml).toContain("on_change:");
    expect(yaml).not.toContain("on_value:");

    // Should have inline service call
    expect(yaml).toContain("homeassistant.service:");
    expect(yaml).toContain("service: light.turn_on");
    expect(yaml).toContain("entity_id: light.living_room");

    // Should pass slider value with rounding
    expect(yaml).toContain("value: !lambda return (int)(x + 0.5);");

    // Should have slider properties
    expect(yaml).toContain("min_value: 0");
    expect(yaml).toContain("max_value: 255");
  });

  test("bidirectional slider uses on_change without feedback guard globals", () => {
    const slider: SliderComponent = {
      id: "volume-slider",
      type: "slider",
      position: { x: 10, y: 50 },
      size: { width: 180, height: 25 },
      min: 0,
      max: 100,
      valueBinding: {
        type: "entity_state",
        entityId: "input_number.volume",
      },
      onChange: {
        type: "SERVICE_CALL",
        service: "input_number.set_value",
        target: { entityId: "input_number.volume" },
      },
    };

    const project = createMinimalProject();
    project.dashboardPages = [{
      id: "page-1",
      name: "Home",
      components: [slider],
    }];

    const yaml = generateESPHomeYAML(project);

    // The slider widget itself should use on_change (not on_value) for its service call
    // Note: the HA sensor section uses on_value: for sensor updates — that's correct and expected
    expect(yaml).toContain("on_change:");

    // Should NOT have _updating globals (on_change eliminates the need)
    expect(yaml).not.toContain("_updating");

    // Should have sensor binding for programmatic updates
    expect(yaml).toContain("entity_id: input_number.volume");
    expect(yaml).toContain("lvgl.slider.update:");

    // Sensor update should use rounding
    expect(yaml).toContain("value: !lambda return (int)(x + 0.5);");
  });

  test("slider with only valueBinding (no onChange) has no on_change", () => {
    const slider: SliderComponent = {
      id: "temp-display",
      type: "slider",
      position: { x: 10, y: 50 },
      size: { width: 200, height: 20 },
      min: 0,
      max: 50,
      valueBinding: {
        type: "entity_state",
        entityId: "sensor.temperature",
      },
    };

    const project = createMinimalProject();
    project.dashboardPages = [{
      id: "page-1",
      name: "Home",
      components: [slider],
    }];

    const yaml = generateESPHomeYAML(project);

    // Should have sensor binding
    expect(yaml).toContain("lvgl.slider.update:");
    expect(yaml).toContain("entity_id: sensor.temperature");

    // Should NOT have on_change (read-only slider)
    expect(yaml).not.toContain("on_change:");
    expect(yaml).not.toContain("homeassistant.service:");
  });

  test("slider with styling properties", () => {
    const slider: SliderComponent = {
      id: "styled-slider",
      type: "slider",
      position: { x: 10, y: 10 },
      size: { width: 200, height: 30 },
      trackColor: { r: 50, g: 50, b: 50 },
      fillColor: { r: 0, g: 150, b: 255 },
      handleColor: { r: 255, g: 255, b: 255 },
    };

    const project = createMinimalProject();
    project.dashboardPages = [{
      id: "page-1",
      name: "Home",
      components: [slider],
    }];

    const yaml = generateESPHomeYAML(project);

    expect(yaml).toContain("bg_color: 0x323232");
    expect(yaml).toContain("indicator:");
    expect(yaml).toContain("knob:");
  });
});

describe("ESPHome YAML Generator - Gauge (Arc)", () => {
  test("generates arc widget from gauge component", () => {
    const gauge: GaugeComponent = {
      id: "temp-gauge",
      type: "gauge",
      position: { x: 50, y: 50 },
      size: { width: 120, height: 120 },
      min: 0,
      max: 50,
      valueBinding: {
        type: "entity_state",
        entityId: "sensor.temperature",
      },
      unit: "°C",
    };

    const project = createMinimalProject();
    project.dashboardPages = [{
      id: "page-1",
      name: "Home",
      components: [gauge],
    }];

    const yaml = generateESPHomeYAML(project);

    // Should generate arc widget
    expect(yaml).toContain("- arc:");
    expect(yaml).toContain("id: w_temp_gauge");
    expect(yaml).toContain("min_value: 0");
    expect(yaml).toContain("max_value: 50");
    expect(yaml).toContain("adjustable: false");

    // Size should use min dimension (square)
    expect(yaml).toContain("width: 120");
    expect(yaml).toContain("height: 120");

    // Should have sensor binding with rounding
    expect(yaml).toContain("lvgl.arc.update:");
    expect(yaml).toContain("value: !lambda return (int)(x + 0.5);");
    expect(yaml).toContain("entity_id: sensor.temperature");
  });

  test("gauge uses min dimension for non-square sizes", () => {
    const gauge: GaugeComponent = {
      id: "rect-gauge",
      type: "gauge",
      position: { x: 10, y: 10 },
      size: { width: 200, height: 150 },
      min: 0,
      max: 100,
    };

    const project = createMinimalProject();
    project.dashboardPages = [{
      id: "page-1",
      name: "Home",
      components: [gauge],
    }];

    const yaml = generateESPHomeYAML(project);

    // Arc should use min(200, 150) = 150
    expect(yaml).toContain("width: 150");
    expect(yaml).toContain("height: 150");
  });

  test("gauge with colors", () => {
    const gauge: GaugeComponent = {
      id: "colored-gauge",
      type: "gauge",
      position: { x: 10, y: 10 },
      size: { width: 100, height: 100 },
      min: 0,
      max: 100,
      backgroundColor: { r: 30, g: 30, b: 30 },
      needleColor: { r: 255, g: 100, b: 0 },
    };

    const project = createMinimalProject();
    project.dashboardPages = [{
      id: "page-1",
      name: "Home",
      components: [gauge],
    }];

    const yaml = generateESPHomeYAML(project);

    expect(yaml).toContain("arc_color: 0x1E1E1E");
    expect(yaml).toContain("indicator:");
    expect(yaml).toContain("arc_color: 0xFF6400");
  });
});

describe("ESPHome YAML Generator - To-Do List", () => {
  test("generates todo list rows and scrolling summary labels", () => {
    const project = createMinimalProject();
    project.dashboardPages = [
      {
        id: "page-1",
        name: "Home",
        components: [
          {
            id: "shopping-list",
            type: "todo_list",
            position: { x: 20, y: 30 },
            size: { width: 280, height: 150 },
            maxItems: 3,
            rowHeight: 36,
            itemsBinding: {
              entityId: "sensor.flur_display_to_do_items",
              attribute: "all_items",
            },
          },
        ],
      },
    ];

    const yaml = generateESPHomeYAML(project);

    expect(yaml).toContain("id: w_shopping_list");
    expect(yaml).toContain("id: w_shopping_list_r0_summary");
    expect(yaml).toContain("id: w_shopping_list_r1_summary");
    expect(yaml).toContain("id: w_shopping_list_r2_summary");
    expect(yaml).toContain("long_mode: SCROLL");
    expect(yaml).toContain("anim_time: 7000ms");
    expect(yaml).toContain("id: w_shopping_list_r0_cb");
    expect(yaml).toContain("id: w_shopping_list_r0_due");
    expect(yaml).toContain("bg_opa: 100%");
  });

  test("generates PSV parsing lambda and human-readable due handling", () => {
    const project = createMinimalProject();
    project.dashboardPages = [
      {
        id: "page-1",
        name: "Home",
        components: [
          {
            id: "todo",
            type: "todo_list",
            position: { x: 0, y: 0 },
            size: { width: 220, height: 120 },
            maxItems: 2,
            itemsBinding: {
              entityId: "sensor.flur_display_to_do_items",
              attribute: "all_items",
            },
          },
        ],
      },
    ];

    const yaml = generateESPHomeYAML(project);

    expect(yaml).toContain("auto humanize_due = [](const std::string &raw_due)");
    expect(yaml).toContain("size_t p1 = line.find('|')");
    expect(yaml).toContain("size_t p2 = rest.find('|')");
    expect(yaml).toContain("if (due == \"no-date\" || due == \"none\")");
    expect(yaml).toContain("lv_label_set_text(id(w_todo_r0_cb), \"[ ]\")");
    expect(yaml).toContain("lv_obj_set_width(id(w_todo_r0_summary), 186);");
    expect(yaml).toContain("lv_obj_set_width(id(w_todo_r0_summary), 104);");
    expect(yaml).toContain("statuses[0] == \"overdue\" ? 0xFF5555 : 0xFFC857");
    expect(yaml).toContain("if (item_count == 0 && !input.empty()) {");
    expect(yaml).toContain("entity_id: sensor.flur_display_to_do_items");
    expect(yaml).toContain("attribute: all_items");
  });
});
