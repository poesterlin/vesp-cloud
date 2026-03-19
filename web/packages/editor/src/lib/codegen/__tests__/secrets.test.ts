import { describe, test, expect } from "vitest";
import { generateSecretsYAML, hasSecrets } from "../secrets";
import type { Project } from "@esphome-designer/schema";

describe("generateSecretsYAML", () => {
  test("generates placeholder firmware URL when no secrets configured", () => {
    const project: Project = {
      name: "Test Display",
      display: { width: 240, height: 320, platform: "ili9xxx" },
      dashboardPages: [],
      detailViews: [],
    };

    const yaml = generateSecretsYAML(project);

    expect(yaml).toContain('firmware_update_url: "http://YOUR_SERVER/api/firmware/YOUR_TOKEN"');
  });

  test("uses configured firmware URL", () => {
    const project: Project = {
      name: "Test Display",
      display: { width: 240, height: 320, platform: "ili9xxx" },
      dashboardPages: [],
      detailViews: [],
      secrets: {
        firmwareUpdateUrl: "http://myserver.com/api/firmware/abc123",
      },
    };

    const yaml = generateSecretsYAML(project);

    expect(yaml).toContain('firmware_update_url: "http://myserver.com/api/firmware/abc123"');
  });

  test("includes header comments", () => {
    const project: Project = {
      name: "Test",
      display: { width: 240, height: 320, platform: "ili9xxx" },
      dashboardPages: [],
      detailViews: [],
    };

    const yaml = generateSecretsYAML(project);

    expect(yaml).toContain("ESPHome Secrets");
  });
});

describe("hasSecrets", () => {
  test("returns false when no secrets configured", () => {
    const project: Project = {
      name: "Test",
      display: { width: 240, height: 320, platform: "ili9xxx" },
      dashboardPages: [],
      detailViews: [],
    };

    expect(hasSecrets(project)).toBe(false);
  });

  test("returns true when firmware URL is configured", () => {
    const project: Project = {
      name: "Test",
      display: { width: 240, height: 320, platform: "ili9xxx" },
      dashboardPages: [],
      detailViews: [],
      secrets: {
        firmwareUpdateUrl: "http://example.com/firmware",
      },
    };

    expect(hasSecrets(project)).toBe(true);
  });
});
