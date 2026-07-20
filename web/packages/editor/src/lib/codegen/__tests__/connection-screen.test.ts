/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type { Project } from "@vesp-cloud/schema";
import { generateESPHomeYAML } from "../esphome-yaml";
import { generateUIStateHeader } from "../ui-state";

const project: Project = {
  name: "Connection screen test",
  display: { width: 480, height: 480 },
  dashboardPages: [],
  detailViews: [],
};

describe("connection screen lifecycle", () => {
  test("latches first-boot loading complete when its timeout expires", () => {
    const header = generateUIStateHeader(project);

    expect(header).toContain(
      "if (millis() - image_bootstrap_started_at >= ONLINE_IMAGE_BOOTSTRAP_TIMEOUT_MS) {\n" +
      "      loading_done = true;\n" +
      "      return false;",
    );
    expect(header).toContain("if (loading_done) return false;");
  });

  test("does not navigate away from the current screen on HA disconnect", () => {
    const yaml = generateESPHomeYAML(project);
    const disconnectBranch = yaml.slice(
      yaml.indexOf("if (!connected) {"),
      yaml.indexOf("} else {", yaml.indexOf("if (!connected) {")),
    );

    expect(disconnectBranch).not.toContain("navigate_to");
    expect(disconnectBranch).toContain("image_bootstrap_active = false;");
  });
});
