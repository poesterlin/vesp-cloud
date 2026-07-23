/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import type { Project } from "@vesp-cloud/schema";
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

  test("rounds fractional UiRect values for generated C++", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "conditional-area",
              type: "conditional_area",
              position: { x: 222.5, y: 341 },
              size: { width: 83.5, height: 80 },
              variants: [
                {
                  id: "default",
                  name: "Default",
                  components: [
                    {
                      id: "icon",
                      type: "icon",
                      position: { x: 8, y: 12 },
                      size: { width: 50, height: 56 },
                      icon: "home",
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
    expect(out).toContain("UiRect{223, 341, 84, 80}");
    expect(out).toContain("UiRect{231, 353, 50, 56}");
    expect(out).not.toContain("222.5");
    expect(out).not.toContain("83.5");
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
    expect(yaml).toContain("platform: online_image");
    expect(yaml).not.toContain("\nonline_image:");
    expect(yaml).toContain("format: jpeg");
    expect(yaml.match(/    buffer_size: 2048/g)).toHaveLength(2);
    expect(yaml).not.toContain("home_assistant_bearer_token");
    expect(yaml).not.toContain("Authorization:");
    expect(yaml).toContain('bind_ha_image_url("image.album_art", "entity_picture", id(img_albumart), id(img_albumart_alt), &id(img_albumart_prefer_fallback), &id(img_albumart_pending_fetch));');
    expect(yaml).toContain("id: img_albumart_prefer_fallback");
    expect(yaml).not.toContain("home_assistant_base_url");
    expect(yaml).toContain("http_request:");
  });

  test("uses current image frame for legacy default resize", () => {
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
              size: { width: 72, height: 64 },
              file: "images/fallback.png",
              image_type: "RGB565",
              imageBinding: { entityId: "image.album_art" },
              resize: "100x100",
            },
          ],
        },
      ],
    });

    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain("resize: 72x64");
    expect(yaml).not.toContain("resize: 100x100");
  });

  test("rounds fractional online-image geometry for generated YAML and C++", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "fractional-image",
              type: "image",
              position: { x: 50.25, y: 29.75 },
              size: { width: 311, height: 161.5 },
              file: "images/fallback.png",
              image_type: "RGB565",
              imageBinding: { entityId: "image.album_art" },
            },
          ],
        },
      ],
    });

    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain("resize: 311x162");
    expect(yaml).toContain("UiDirtyRect{50, 30, 311, 162}");
    expect(yaml).not.toContain("161.5");
  });

  test("resolves relative HA image URLs when HA base URL is configured", () => {
    const project = makeProject({
      secrets: { homeAssistantBaseUrl: "http://homeassistant.local:8123" },
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
              imageBinding: { entityId: "image.album_art" },
            },
          ],
        },
      ],
    });

    const yaml = generateESPHomeYAML(project);
    const secrets = generateSecretsYAML(project);
    expect(yaml).toContain("home_assistant_base_url: !secret home_assistant_base_url");
    expect(yaml).toContain('const std::string ha_base_url = "${home_assistant_base_url}";');
    expect(yaml).toContain('url = ha_base_url + url;');
    expect(yaml.indexOf('const std::string ha_base_url')).toBeLessThan(yaml.indexOf('auto bind_ha_image_url'));
    expect(secrets).toContain('home_assistant_base_url: "http://homeassistant.local:8123"');
  });

  test("emits HTTP firmware update entity when firmware URL is configured", () => {
    const project = makeProject({
      secrets: { firmwareUpdateUrl: "https://example.com/api/firmware/token" },
    });

    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain("http_request:");
    expect(yaml).toContain("ota:\n  - platform: http_request");
    expect(yaml).toContain("on_begin:");
    expect(yaml).toContain("g_ota_in_progress = true;");
    expect(yaml).toContain("on_error:");
    expect(yaml).toContain("light.turn_on:");
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

  test("can omit OTA secrets for downloadable exports", () => {
    const project = makeProject({
      secrets: {
        firmwareUpdateUrl: "https://example.com/api/firmware/token/",
        homeAssistantBaseUrl: "http://homeassistant.local:8123",
      },
    });

    const yaml = generateSecretsYAML(project, { includeOtaSecrets: false });
    expect(yaml).not.toContain("firmware_update_url:");
    expect(yaml).not.toContain("firmware_manifest_url:");
    expect(yaml).toContain('home_assistant_base_url: "http://homeassistant.local:8123"');
  });
});
