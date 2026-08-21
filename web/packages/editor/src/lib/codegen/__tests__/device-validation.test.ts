/// <reference types="bun" />
import { describe, test, expect } from "bun:test";
import { validateProject } from "../validations";
import type { Project } from "@vesp-cloud/schema";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: "Device validation",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
    ...overrides,
  };
}

describe("validateDeviceProfile", () => {
  test("accepts absent device (legacy default)", () => {
    expect(validateProject(makeProject())).toEqual([]);
  });

  test("accepts a known device with matching dimensions", () => {
    const project = makeProject({
      device: "guition-esp32-s3-4848s040",
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("hard-errors on an unknown device id", () => {
    const project = makeProject({ device: "definitely-not-a-board" });
    const errors = validateProject(project);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("error");
    expect(errors[0].message).toContain("Unknown device");
    expect(errors[0].message).toContain("guition-esp32-s3-4848s040");
    expect(errors[0].message).toContain("lilygo-t-encoder-pro");
  });

  test("errors when display dimensions disagree with the profile", () => {
    const project = makeProject({
      device: "lilygo-t-encoder-pro",
      display: { width: 480, height: 480 },
    });
    const errors = validateProject(project);
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe("error");
    expect(errors[0].message).toContain("390x390");
  });
});
