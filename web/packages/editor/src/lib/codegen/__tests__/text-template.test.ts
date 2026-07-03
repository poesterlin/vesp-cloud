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

describe("text component template codegen", () => {
  test("static text emits a plain LabelWidget without bind_text_fn", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "lbl",
              type: "text",
              position: { x: 10, y: 10 },
              text: "Hello world",
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).toContain('"Hello world"');
    expect(out).not.toContain("bind_text_fn");
  });

  test("text alignment is emitted for centered and right-aligned labels", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "center_lbl",
              type: "text",
              position: { x: 10, y: 10 },
              text: "Center",
              align: "center",
            },
            {
              id: "right_lbl",
              type: "text",
              position: { x: 10, y: 40 },
              text: "Right",
              align: "right",
            },
            {
              id: "left_lbl",
              type: "text",
              position: { x: 10, y: 70 },
              text: "Left",
              align: "left",
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).toContain("center_lbl->set_align(TextAlign::TOP_CENTER);");
    expect(out).toContain("right_lbl->set_align(TextAlign::TOP_RIGHT);");
    expect(out).not.toContain("left_lbl->set_align");
  });

  test("text color emits set_color for dashboard labels", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "colored_lbl",
              type: "text",
              position: { x: 10, y: 10 },
              text: "Color",
              color: { r: 155, g: 34, b: 38 },
            },
          ],
        },
      ],
    });

    const out = generateUIScreensHeader(project);
    expect(out).toContain("colored_lbl->set_color(Color(155, 34, 38));");
  });

  test("text color emits set_color for nested tab labels", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "tabs",
              type: "tab_container",
              position: { x: 0, y: 0 },
              size: { width: 200, height: 160 },
              tabs: [
                {
                  id: "t1",
                  name: "Tab 1",
                  components: [
                    {
                      id: "nested_lbl",
                      type: "text",
                      position: { x: 8, y: 8 },
                      text: "Nested",
                      color: { r: 148, g: 210, b: 189 },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    const out = generateUIScreensHeader(project);
    expect(out).toContain("nested_lbl->set_color(Color(148, 210, 189));");
  });

  test("template with single binding emits empty static text + bind_text_fn lambda", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "lbl",
              type: "text",
              position: { x: 10, y: 10 },
              text: "Temp: {{sensor.living_room_temp}}",
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).toContain('""');
    expect(out).toContain("bind_text_fn");
    expect(out).toContain('"Temp: "');
    expect(out).toContain("state.txt_sensor_living_room_temp.ptr()");
    expect(out).not.toContain("{{");
  });

  test("template with multiple bindings concatenates all parts", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "lbl",
              type: "text",
              position: { x: 10, y: 10 },
              text: "{{sensor.a}}: {{sensor.b}} now",
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).toContain("bind_text_fn");
    expect(out).toContain("state.txt_sensor_a.ptr()");
    expect(out).toContain("state.txt_sensor_b.ptr()");
    expect(out).toContain('": "');
    expect(out).toContain('" now"');
  });

  test("HA subscriptions cover every binding referenced in the template", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "lbl",
              type: "text",
              position: { x: 10, y: 10 },
              text: "{{sensor.foo}} / {{sensor.bar.attributes.unit}}",
            },
          ],
        },
      ],
    });
    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain('bind_ha_string("sensor.foo"');
    expect(yaml).toContain('bind_ha_string_attr("sensor.bar", "attributes.unit"');
  });

  test("HA string bindings strip trailing .0 from numeric strings", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "lbl",
              type: "text",
              position: { x: 10, y: 10 },
              text: "{{sensor.count}}",
            },
          ],
        },
      ],
    });
    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain("if (dot == std::string::npos) return s;");
    expect(yaml).toContain('out.compare(out.size() - 2, 2, ".0") == 0');
    expect(yaml).not.toContain("s.size() - dot <= 2");
  });

  test("declared Observables match the bindings parsed from the template", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "lbl",
              type: "text",
              position: { x: 10, y: 10 },
              text: "Hello {{sensor.foo}}",
            },
          ],
        },
      ],
    });
    const state = generateUIStateHeader(project);
    expect(state).toContain("Observable<std::string> txt_sensor_foo");
  });

  test("legacy textBinding still works alongside the modern template", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "lbl",
              type: "text",
              position: { x: 10, y: 10 },
              text: "Prefix",
              textBinding: { entityId: "sensor.legacy" },
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).toContain("bind_text_fn");
    expect(out).toContain("state.txt_sensor_legacy.ptr()");
    expect(out).toContain('"Prefix"');
  });

  test("escapes quotes and backslashes in static text segments", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "lbl",
              type: "text",
              position: { x: 10, y: 10 },
              text: 'A "quoted" \\ thing {{sensor.x}}',
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).toContain('"A \\"quoted\\" \\\\ thing "');
  });
});
