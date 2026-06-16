/// <reference types="bun" />
import { describe, test, expect } from "bun:test";
import type { Project } from "@esphome-designer/schema";
import { generateUIScreensHeader } from "../ui-screens";
import { generateUIStateHeader } from "../ui-state";
import { generateESPHomeYAML } from "../esphome-yaml";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: "Test",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
    ...overrides,
  };
}

describe("todo_list codegen", () => {
  test("emits TodoPreviewWidget with configured rows and height", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "todos",
              type: "todo_list",
              position: { x: 20, y: 100 },
              size: { width: 220, height: 140 },
              maxItems: 3,
              rowHeight: 26,
              itemsBinding: {
                entityId: "sensor.esphome_todo_bridge",
                attribute: "all_items",
              },
            },
          ],
        },
      ],
    });

    const out = generateUIScreensHeader(project);
    expect(out).toContain("emplace_widget<TodoPreviewWidget>");
    expect(out).toContain("state.sensor_esphome_todo_bridge_all_items.ptr()");
    expect(out).toContain(", 3, 26, false, false");
  });

  test("emits checkable/scrollable options and todo entity", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "todos",
              type: "todo_list",
              position: { x: 0, y: 0 },
              size: { width: 220, height: 140 },
              maxItems: 5,
              rowHeight: 28,
              scrollable: true,
              checkable: true,
              todoEntityId: "todo.todo",
              itemsBinding: {
                entityId: "sensor.esphome_todo_bridge",
                attribute: "all_items",
              },
            },
          ],
        },
      ],
    });

    const out = generateUIScreensHeader(project);
    expect(out).toContain(", 5, 28, true, true");
    expect(out).toContain('"todo.todo"');
  });

  test("emits onTap callback for non-checkable todo list", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "todos",
              type: "todo_list",
              position: { x: 19, y: 59 },
              size: { width: 363, height: 140 },
              maxItems: 4,
              rowHeight: 30,
              scrollable: false,
              checkable: false,
              onTap: {
                type: "OPEN_DETAIL",
                targetId: "DETAIL_1",
              },
              itemsBinding: {
                entityId: "sensor.esphome_todo_bridge",
              },
            },
          ],
        },
      ],
    });

    const out = generateUIScreensHeader(project);
    expect(out).toContain("[&screens]() { screens.navigate_to(UiScreenId::DetailDetail1); }");
  });

  test("makes tall detail views vertically scrollable below fixed header", () => {
    const project = makeProject({
      detailViews: [
        {
          id: "detail_1",
          title: "Detail",
          height: 580,
          components: [
            {
              id: "bottom",
              type: "button",
              position: { x: 20, y: 520 },
              size: { width: 120, height: 40 },
              label: "Bottom",
            },
          ],
        },
      ],
    });

    const out = generateUIScreensHeader(project);
    expect(out).toContain("detaildetail1->set_scroll_area(50, 430, 580);");
    expect(out).toContain("detaildetail1_header->set_scroll_exempt(true);");
  });

  test("adds generated todo string state field", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "todos",
              type: "todo_list",
              position: { x: 0, y: 0 },
              size: { width: 220, height: 140 },
              itemsBinding: {
                entityId: "sensor.esphome_todo_bridge",
                attribute: "all_items",
              },
            },
          ],
        },
      ],
    });

    const out = generateUIStateHeader(project);
    expect(out).toContain("Observable<std::string> sensor_esphome_todo_bridge_all_items");
    expect(out).toContain('{"LIST EMPTY"}');
  });

  test("binds todo attribute subscription in generated yaml", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "todos",
              type: "todo_list",
              position: { x: 0, y: 0 },
              size: { width: 220, height: 140 },
              itemsBinding: {
                entityId: "sensor.esphome_todo_bridge",
                attribute: "all_items",
              },
            },
          ],
        },
      ],
    });

    const out = generateESPHomeYAML(project);
    expect(out).toContain("auto bind_ha_string_attr");
    expect(out).toContain('bind_ha_string_attr("sensor.esphome_todo_bridge", "all_items", &g_ui_app.state().sensor_esphome_todo_bridge_all_items);');
  });
});
