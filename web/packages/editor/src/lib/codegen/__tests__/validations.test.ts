/// <reference types="bun" />
import { describe, test, expect } from "bun:test";
import { validateProject } from "../validations";
import type { Project } from "@vesp-cloud/schema";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: "Test",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
    ...overrides,
  };
}

describe("validateActionTargets", () => {
  test("passes when SERVICE_CALL has entityId target", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn1",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              onTap: {
                type: "SERVICE_CALL",
                service: "light.toggle",
                target: { entityId: "light.kitchen" },
              },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("passes when SERVICE_CALL has deviceId target", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn1",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              onTap: {
                type: "SERVICE_CALL",
                service: "script.my_script",
                target: { deviceId: "device_abc" },
              },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("passes when SERVICE_CALL has no target", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn1",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              onTap: {
                type: "SERVICE_CALL",
                service: "light.toggle",
              },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("fails when SERVICE_CALL has no service", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn1",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              onTap: {
                type: "SERVICE_CALL",
                service: "",
              },
            },
          ],
        },
      ],
    });
    const errors = validateProject(project);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.type).toBe("error");
    expect(errors[0]!.componentId).toBe("btn1");
    expect(errors[0]!.field).toBe("onTap");
  });

  test("passes when OPEN_DETAIL has targetId", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn1",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              onTap: {
                type: "OPEN_DETAIL",
                targetId: "Temps",
              },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("fails when OPEN_DETAIL has no targetId", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn1",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              onTap: {
                type: "OPEN_DETAIL",
              },
            },
          ],
        },
      ],
    });
    const errors = validateProject(project);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.componentId).toBe("btn1");
    expect(errors[0]!.field).toBe("onTap");
  });

  test("passes for GO_BACK (no target needed)", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn1",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              onTap: {
                type: "GO_BACK",
              },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("validates pressAction on buttons", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn1",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              pressAction: {
                type: "SERVICE_CALL",
                service: "light.toggle",
              },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("validates holdAction on buttons", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn1",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              holdAction: {
                type: "OPEN_DETAIL",
              },
            },
          ],
        },
      ],
    });
    const errors = validateProject(project);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.field).toBe("holdAction");
  });

  test("validates onHold on non-button components", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "txt1",
              type: "text",
              text: "Hello",
              position: { x: 10, y: 10 },
              onHold: {
                type: "SERVICE_CALL",
                service: "light.toggle",
              },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("validates nested components in tab_container", () => {
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
              size: { width: 480, height: 480 },
              tabs: [
                {
                  id: "tab1",
                  name: "Tab 1",
                  components: [
                    {
                      id: "btn_nested",
                      type: "button",
                      position: { x: 10, y: 10 },
                      size: { width: 80, height: 36 },
                      onTap: {
                        type: "SERVICE_CALL",
                        service: "light.toggle",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("validates nested components in conditional_area", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "ca",
              type: "conditional_area",
              position: { x: 0, y: 0 },
              variants: [
                {
                  id: "v1",
                  name: "Variant 1",
                  components: [
                    {
                      id: "btn_var",
                      type: "button",
                      position: { x: 10, y: 10 },
                      size: { width: 80, height: 36 },
                      onTap: {
                        type: "OPEN_DETAIL",
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const errors = validateProject(project);
    expect(errors).toHaveLength(1);
    expect(errors[0]!.componentId).toBe("btn_var");
  });

  test("validates components in detail views", () => {
    const project = makeProject({
      detailViews: [
        {
          id: "DETAIL1",
          title: "Detail View",
          height: 300,
          components: [
            {
              id: "btn_detail",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              onTap: {
                type: "SERVICE_CALL",
                service: "light.toggle",
              },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("validates components in page header", () => {
    const project = makeProject({
      pageHeader: {
        height: 40,
        components: [
          {
            id: "btn_header",
            type: "button",
            position: { x: 10, y: 5 },
            size: { width: 80, height: 30 },
            onTap: {
              type: "SERVICE_CALL",
              service: "light.toggle",
            },
          },
        ],
      },
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("reports multiple errors from different components", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn1",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              onTap: { type: "SERVICE_CALL", service: "light.toggle" },
            },
            {
              id: "btn2",
              type: "button",
              position: { x: 100, y: 10 },
              size: { width: 80, height: 36 },
              pressAction: { type: "OPEN_DETAIL" },
            },
          ],
        },
      ],
    });
    const errors = validateProject(project);
    expect(errors).toHaveLength(1);
  });

  test("returns empty array for project with no issues", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "txt1",
              type: "text",
              text: "Hello",
              position: { x: 10, y: 10 },
            },
            {
              id: "btn_ok",
              type: "button",
              position: { x: 100, y: 10 },
              size: { width: 80, height: 36 },
              onTap: {
                type: "SERVICE_CALL",
                service: "light.toggle",
                target: { entityId: "light.kitchen" },
              },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("warns when service and target entity domains differ", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn_mismatch",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              onTap: {
                type: "SERVICE_CALL",
                service: "scene.turn_on",
                target: { entityId: "switch.alles_aus_stateful_scene" },
              },
            },
          ],
        },
      ],
    });

    const errors = validateProject(project);
    const warning = errors.find((e) => e.componentId === "btn_mismatch" && e.type === "warning");
    expect(warning).toBeDefined();
    expect(warning?.message).toContain('service domain "scene"');
    expect(warning?.message).toContain('entity domain "switch"');
  });

  test("warns for button without any action", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "btn_noop",
              type: "button",
              position: { x: 10, y: 10 },
              size: { width: 80, height: 36 },
              label: "",
            },
          ],
        },
      ],
    });

    const errors = validateProject(project);
    const warning = errors.find((e) => e.componentId === "btn_noop" && e.type === "warning");
    expect(warning).toBeDefined();
    expect(warning?.message).toContain("no action configured");
  });
});

describe("time range conditions", () => {
  function projectWithTime(after?: string, before?: string): Project {
    return makeProject({
      dashboardPages: [{
        id: "p1",
        name: "Home",
        components: [{
          id: "ca_time",
          type: "conditional_area",
          position: { x: 0, y: 0 },
          size: { width: 100, height: 100 },
          variants: [{
            id: "timed",
            name: "Timed",
            condition: { type: "time", after, before },
            components: [],
          }],
        }],
      }],
    });
  }

  test("accepts normal, overnight, and open-ended ranges", () => {
    expect(validateProject(projectWithTime("08:00", "20:00"))).toEqual([]);
    expect(validateProject(projectWithTime("22:00", "06:00"))).toEqual([]);
    expect(validateProject(projectWithTime("08:00"))).toEqual([]);
  });

  test("rejects empty and malformed ranges", () => {
    expect(validateProject(projectWithTime())).toEqual([
      expect.objectContaining({ message: "condition time range needs a start or end time", componentId: "ca_time" }),
    ]);
    const malformed = validateProject(projectWithTime("24:00", "9:75"));
    expect(malformed.map((error) => error.message)).toEqual([
      "condition start time must use HH:MM (00:00-23:59)",
      "condition end time must use HH:MM (00:00-23:59)",
    ]);
  });
});
