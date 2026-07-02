/// <reference types="bun" />
import { afterEach, describe, expect, test } from "bun:test";
import type { Project } from "@esphome-designer/schema";
import { generateESPHomeYAML } from "../esphome-yaml";
import { generateSecretsYAML } from "../secrets";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: "Test Display",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
    ...overrides,
  };
}

describe("screenshot debug feature", () => {
  const previousEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...previousEnv };
  });

  test("omits all screenshot wiring when SCREENSHOT_DEBUG_ENABLED is unset", () => {
    delete process.env.SCREENSHOT_DEBUG_ENABLED;
    delete process.env.SCREENSHOT_UPLOAD_BASE_URL;
    const yaml = generateESPHomeYAML(makeProject());
    expect(yaml).not.toContain("ui_screenshot.h");
    expect(yaml).not.toContain("SCREENSHOT_DEBUG_ENABLED");
    expect(yaml).not.toContain("request_screenshot");
    expect(yaml).not.toContain("screenshot_task_notify");
    expect(yaml).not.toContain("button.test_display_screenshot");
    expect(yaml).not.toContain("external_components:");
    const secrets = generateSecretsYAML(makeProject());
    expect(secrets).not.toContain("screenshot_upload_url");
  });

  test("emits full screenshot wiring when SCREENSHOT_DEBUG_ENABLED is on", () => {
    process.env.SCREENSHOT_DEBUG_ENABLED = "1";
    process.env.SCREENSHOT_UPLOAD_BASE_URL = "https://designer.example.com";
    const yaml = generateESPHomeYAML(makeProject());
    expect(yaml).toContain("includes/ui_screenshot.h");
    expect(yaml).toContain("-DSCREENSHOT_DEBUG_ENABLED");
    expect(yaml).toContain("request_screenshot");
    expect(yaml).toContain("screenshot_task_notify");
    expect(yaml).toContain("name: \"Take Screenshot\"");
    expect(yaml).toContain("request_screenshot();");
    expect(yaml).toContain("external_components:");
    expect(yaml).toContain("screenshot_upload_url: \"https://designer.example.com/api/screenshot/test-display\"");
    const secrets = generateSecretsYAML(makeProject());
    expect(secrets).toContain("screenshot_upload_url:");
    expect(secrets).toContain("https://designer.example.com");
  });
});
