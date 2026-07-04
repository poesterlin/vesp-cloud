/// <reference types="bun" />
import { describe, test, expect } from "bun:test";
import { validateProject } from "../validations";
import { generateUIStateHeader } from "../ui-state";
import { generateUIScreensHeader } from "../ui-screens";
import { generateESPHomeYAML } from "../esphome-yaml";
import type { Project } from "@vesp-cloud/schema";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: "HVAC Test",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
    ...overrides,
  };
}

describe("HVAC validation", () => {
  test("passes when hvac has climate entity binding", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "hvac1",
              type: "hvac",
              position: { x: 10, y: 10 },
              size: { width: 140, height: 130 },
              stateBinding: { entityId: "climate.living_room" },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("fails when hvac has no entity binding", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "hvac1",
              type: "hvac",
              position: { x: 10, y: 10 },
              size: { width: 140, height: 130 },
            },
          ],
        },
      ],
    });
    const errors = validateProject(project);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.type).toBe("error");
  });
});

describe("HVAC codegen - ui-state", () => {
  test("generates Observable fields for climate entity", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "hvac1",
              type: "hvac",
              position: { x: 10, y: 10 },
              size: { width: 140, height: 130 },
              stateBinding: { entityId: "climate.living_room" },
            },
          ],
        },
      ],
    });
    const header = generateUIStateHeader(project);
    expect(header).toContain("climate_living_room_hvac_mode");
    expect(header).toContain("climate_living_room_current_temp");
    expect(header).toContain("climate_living_room_target_temp");
    expect(header).toContain("climate_living_room_hvac_action");
    expect(header).toContain('Observable<std::string> climate_living_room_hvac_mode{"off"};');
    expect(header).toContain('Observable<float> climate_living_room_current_temp{0.0f};');
    expect(header).toContain('Observable<float> climate_living_room_target_temp{20.0f};');
  });
});

describe("HVAC codegen - ui-screens", () => {
  test("generates HvacWidget on dashboard page", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "hvac1",
              type: "hvac",
              label: "Living Room",
              position: { x: 10, y: 10 },
              size: { width: 140, height: 130 },
              stateBinding: { entityId: "climate.living_room" },
              tempStep: 0.5,
              minTemp: 10,
              maxTemp: 30,
              onMode: "heat",
            },
          ],
        },
      ],
    });
    const header = generateUIScreensHeader(project);
    expect(header).toContain("HvacWidget");
    expect(header).toContain("Living Room");
    expect(header).toContain("climate_living_room_hvac_mode.ptr()");
    expect(header).toContain("climate_living_room_current_temp.ptr()");
    expect(header).toContain("climate_living_room_target_temp.ptr()");
    expect(header).toContain("climate_living_room_hvac_action.ptr()");
    expect(header).toContain('"climate.living_room"');
  });

  test("generates HvacWidget with default values", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "hvac1",
              type: "hvac",
              label: "AC",
              position: { x: 0, y: 0 },
              size: { width: 140, height: 130 },
              stateBinding: { entityId: "climate.bedroom" },
            },
          ],
        },
      ],
    });
    const header = generateUIScreensHeader(project);
    expect(header).toContain("0.5f, 10.0f, 30.0f");
    expect(header).toContain('"heat"');
  });
});

describe("HVAC codegen - esphome-yaml", () => {
  test("generates climate entity bindings", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "hvac1",
              type: "hvac",
              label: "Living Room",
              position: { x: 10, y: 10 },
              size: { width: 140, height: 130 },
              stateBinding: { entityId: "climate.living_room" },
            },
          ],
        },
      ],
    });
    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain('bind_ha_string("climate.living_room"');
    expect(yaml).toContain("climate_living_room_hvac_mode");
    expect(yaml).toContain('bind_ha_float_attr("climate.living_room", "current_temperature"');
    expect(yaml).toContain("climate_living_room_current_temp");
    expect(yaml).toContain('bind_ha_float_attr("climate.living_room", "temperature"');
    expect(yaml).toContain("climate_living_room_target_temp");
    expect(yaml).toContain('bind_ha_string_attr("climate.living_room", "hvac_action"');
    expect(yaml).toContain("climate_living_room_hvac_action");
  });
});
