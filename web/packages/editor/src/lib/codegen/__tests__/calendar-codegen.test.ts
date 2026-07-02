/// <reference types="bun" />
import { describe, test, expect } from "bun:test";
import { generateESPHomeYAML } from "../esphome-yaml";
import { generateUIStateHeader } from "../ui-state";
import { generateUIScreensHeader } from "../ui-screens";
import type { Project } from "@esphome-designer/schema";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: "Calendar Test",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
    ...overrides,
  };
}

describe("calendar codegen", () => {
  test("generates separate state vars and fetch calls for different duration windows", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "cal_short",
              type: "calendar",
              position: { x: 10, y: 10 },
              size: { width: 220, height: 180 },
              entityBinding: { entityId: "calendar.family" },
              durationDays: 1,
            },
            {
              id: "cal_long",
              type: "calendar",
              position: { x: 240, y: 10 },
              size: { width: 220, height: 180 },
              entityBinding: { entityId: "calendar.family" },
              durationDays: 30,
            },
          ],
        },
      ],
    });

    const state = generateUIStateHeader(project);
    expect(state).toContain("calendar_family_events_1d_raw");
    expect(state).toContain("calendar_family_events_30d_raw");

    const screens = generateUIScreensHeader(project);
    expect(screens).toContain("state.calendar_family_events_1d_raw.ptr()");
    expect(screens).toContain("state.calendar_family_events_30d_raw.ptr()");

    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain('entity_id: "calendar.family"');
    expect(yaml).toContain('duration: "24:00:00"');
    expect(yaml).toContain('duration: "720:00:00"');
    expect(yaml).toContain("g_ui_app.state().calendar_family_events_1d_raw.set(formatted);");
    expect(yaml).toContain("g_ui_app.state().calendar_family_events_30d_raw.set(formatted);");
  });

  test("deduplicates identical calendar entity + duration windows", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "cal_a",
              type: "calendar",
              position: { x: 10, y: 10 },
              size: { width: 220, height: 180 },
              entityBinding: { entityId: "calendar.family" },
              durationDays: 7,
            },
            {
              id: "cal_b",
              type: "calendar",
              position: { x: 240, y: 10 },
              size: { width: 220, height: 180 },
              entityBinding: { entityId: "calendar.family" },
              durationDays: 7,
            },
          ],
        },
      ],
    });

    const yaml = generateESPHomeYAML(project);
    const calls = yaml.match(/service: calendar.get_events/g)?.length ?? 0;
    expect(calls).toBe(1);
    expect(yaml).toContain("g_ui_app.state().calendar_family_events_7d_raw.set(formatted);");
  });
});
