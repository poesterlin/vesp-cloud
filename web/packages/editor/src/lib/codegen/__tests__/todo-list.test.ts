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
    // With todoEntityId set, the items var is derived from the todo entity,
    // and bridgeEntity is empty (no longer using bind_ha_string_attr bridge).
    expect(out).toContain("state.todo_todo_items.ptr()");
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
    expect(out).toContain("detaildetail1->set_scroll_area(50, 430, 530);");
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

  test("generates todo.get_items interval when todoEntityId is set", () => {
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
              todoEntityId: "todo.shopping_list",
            },
          ],
        },
      ],
    });

    const out = generateESPHomeYAML(project);
    expect(out).toContain("todo.get_items");
    expect(out).toContain('entity_id: "todo.shopping_list"');
    expect(out).toContain('status: "needs_action"');
    expect(out).toContain("todo_shopping_list_items");
    expect(out).toContain('if (item["uid"].is<std::string>()) uid = sanitize(item["uid"].as<std::string>());');
    expect(out).toContain('formatted += summary + "|" + due + "|" + status + "|" + uid;');
    // Should NOT contain the old bind_ha_string_attr pattern
    expect(out).not.toContain("bind_ha_string_attr(");
  });

  test("parses todo.get_items response with both wrapped and direct items payloads", () => {
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
              todoEntityId: "todo.shopping_list",
            },
          ],
        },
      ],
    });

    const out = generateESPHomeYAML(project);
    expect(out).toContain("JsonVariantConst root = response;");
    expect(out).toContain('if (resp_wrapper.is<JsonObjectConst>()) root = resp_wrapper;');
    expect(out).toContain('JsonVariantConst items = entity_obj["items"];');
    expect(out).toContain('items = root["items"];');
    expect(out).toContain('ESP_LOGW("todo", "todo.get_items response missing items for %s", "todo.shopping_list");');
  });

  test("adds todo items state var derived from todoEntityId", () => {
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
              todoEntityId: "todo.shopping_list",
            },
          ],
        },
      ],
    });

    const state = generateUIStateHeader(project);
    expect(state).toContain("Observable<std::string> todo_shopping_list_items");
    expect(state).toContain('{"LIST EMPTY"}');
    // Should NOT contain the old bridge-sensor var name
    expect(state).not.toContain("sensor_esphome_todo_bridge");
  });

  test("supports custom status filter via itemsBinding.attribute", () => {
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
              todoEntityId: "todo.chores",
              itemsBinding: {
                entityId: "todo.chores",
                attribute: "completed",
              },
            },
          ],
        },
      ],
    });

    const out = generateESPHomeYAML(project);
    expect(out).toContain('entity_id: "todo.chores"');
    expect(out).toContain('status: "completed"');
  });
});
