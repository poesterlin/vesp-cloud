import { describe, expect, test } from "bun:test";
import type { Project } from "@vesp-cloud/schema";
import { generateESPHomeYAML } from "../esphome-yaml";

function project(): Project {
  return {
    name: "Test Display",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
  };
}

describe("framebuffer camera", () => {
  test("exposes an on-demand local camera through the native API", () => {
    const yaml = generateESPHomeYAML(project());

    expect(yaml).toContain("path: components");
    expect(yaml).toContain("camera_encoder:");
    expect(yaml).toContain("quality: 90");
    expect(yaml).toContain("framebuffer_camera:");
    expect(yaml).toContain('name: "Display Screenshot"');
    expect(yaml).toContain("display_id: main_display");
    expect(yaml).toContain("disabled_by_default: true");
    expect(yaml).not.toContain("screenshot_upload_url");
  });
});
