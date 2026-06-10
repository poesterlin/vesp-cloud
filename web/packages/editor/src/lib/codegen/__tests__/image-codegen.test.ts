/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type { Project } from "@esphome-designer/schema";
import { generateESPHomeYAML } from "../esphome-yaml";
import { generateSecretsYAML } from "../secrets";
import { generateUIScreensHeader } from "../ui-screens";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: "Test",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
    ...overrides,
  };
}

describe("image component codegen", () => {
  test("emits ImageWidget for image components", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "album-art",
              type: "image",
              position: { x: 12, y: 34 },
              size: { width: 96, height: 96 },
              file: "images/album.png",
              image_type: "RGB565",
            },
          ],
        },
      ],
    });

    const out = generateUIScreensHeader(project);
    expect(out).toContain("emplace_widget<ImageWidget>");
    expect(out).toContain("UiRect{12, 34, 96, 96}, id(img_albumart)");
    expect(out).not.toContain("// TODO: component type 'image'");
  });

  test("emits static image YAML when no HA binding is set", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "logo",
              type: "image",
              position: { x: 0, y: 0 },
              size: { width: 80, height: 40 },
              file: "images/logo.png",
              image_type: "RGB565",
            },
          ],
        },
      ],
    });

    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain("image:");
    expect(yaml).toContain('file: "images/logo.png"');
    expect(yaml).toContain("id: img_logo");
    expect(yaml).not.toContain("online_image:");
  });

  test("emits online image YAML and HA binding for imageBinding", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "album-art",
              type: "image",
              position: { x: 0, y: 0 },
              size: { width: 120, height: 120 },
              file: "images/fallback.png",
              image_type: "RGB565",
              onlineFormat: "jpeg",
              imageBinding: { entityId: "image.album_art" },
            },
          ],
        },
      ],
    });

    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain("online_image:");
    expect(yaml).toContain("format: jpeg");
    expect(yaml).not.toContain("home_assistant_bearer_token");
    expect(yaml).not.toContain("Authorization:");
    expect(yaml).toContain('bind_ha_image_url("image.album_art", "entity_picture", id(img_albumart), id(img_albumart_alt));');
    expect(yaml).not.toContain("home_assistant_base_url");
    expect(yaml).toContain("http_request:");
  });

  test("emits HTTP firmware update entity when firmware URL is configured", () => {
    const project = makeProject({
      secrets: { firmwareUpdateUrl: "https://example.com/api/firmware/token" },
    });

    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain("http_request:");
    expect(yaml).toContain("ota:\n  - platform: http_request");
    expect(yaml).toContain("update:\n  - platform: http_request");
    expect(yaml).toContain("name: Firmware Update");
    expect(yaml).toContain("source: !secret firmware_manifest_url");
  });

  test("emits ESPHome project version when firmware version is provided", () => {
    const yaml = generateESPHomeYAML(makeProject(), "job-version-123");

    expect(yaml).toContain("project:");
    expect(yaml).toContain('name: "esphome_designer.test"');
    expect(yaml).toContain('version: "job-version-123"');
  });

  test("emits firmware manifest URL secret", () => {
    const project = makeProject({
      secrets: { firmwareUpdateUrl: "https://example.com/api/firmware/token/" },
    });

    const yaml = generateSecretsYAML(project);
    expect(yaml).toContain('firmware_update_url: "https://example.com/api/firmware/token/"');
    expect(yaml).toContain('firmware_manifest_url: "https://example.com/api/firmware/token/manifest"');
  });
});
