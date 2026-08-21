import { describe, expect, test } from "bun:test";
import type { Project } from "@vesp-cloud/schema";
import {
  DEFAULT_DEVICE_ID,
  DEVICE_PROFILES,
  generateHardwareYAML,
  generateUIConfigHeader,
  getDeviceProfile,
  resolveProjectDeviceProfile,
} from "../device-profiles";
import { generateESPHomeYAML } from "../esphome-yaml";

function project(device?: string, display?: { width: number; height: number }): Project {
  return {
    name: "Device test",
    ...(device ? { device } : {}),
    display: display ?? { width: 480, height: 480 },
    dashboardPages: [{ id: "home", name: "Home", components: [] }],
    detailViews: [],
  };
}

describe("device profile registry", () => {
  test("profile ids are unique and the default resolves", () => {
    const ids = DEVICE_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getDeviceProfile(undefined).id).toBe(DEFAULT_DEVICE_ID);
    expect(getDeviceProfile("nonexistent-board").id).toBe(DEFAULT_DEVICE_ID);
  });

  test("every profile defines main_display and its own ota block", () => {
    for (const p of DEVICE_PROFILES) {
      expect(p.hardwareYaml).toContain("id: main_display");
      expect(p.hardwareYaml).toContain("platform: esphome");
      expect(p.width).toBeGreaterThan(0);
      expect(p.height).toBeGreaterThan(0);
    }
  });

  test("encoder profiles declare pins; rect profiles do not", () => {
    const guition = getDeviceProfile(DEFAULT_DEVICE_ID);
    const tencoder = getDeviceProfile("lilygo-t-encoder-pro");
    expect(guition.hasEncoder).toBe(false);
    expect(guition.encoder).toBeUndefined();
    expect(tencoder.hasEncoder).toBe(true);
    expect(tencoder.encoder).toEqual({ pinA: 1, pinB: 2, push: 0 });
    expect(tencoder.shape).toBe("circle");
  });

  test("generateHardwareYAML emits the resolved profile body", () => {
    const yaml = generateHardwareYAML(project("lilygo-t-encoder-pro"));
    expect(yaml).toContain("platform: mipi_spi");
    expect(yaml).not.toContain("st7701s");
    expect(yaml).toContain("board_build.flash_mode: dio");

    const guition = generateHardwareYAML(project());
    expect(guition).toContain("platform: st7701s");
  });

  test("generateUIConfigHeader follows the profile dimensions", () => {
    expect(generateUIConfigHeader(project())).toContain("#define UI_SCREEN_WIDTH 480");
    expect(generateUIConfigHeader(project("lilygo-t-encoder-pro"))).toContain(
      "#define UI_SCREEN_WIDTH 390",
    );
    expect(generateUIConfigHeader(project("lilygo-t-encoder-pro"))).toContain(
      "#define UI_SCREEN_HEIGHT 390",
    );
  });
});

describe("device-driven firmware sections", () => {
  test("default (Guition) projects keep screenshot support and gt911 touch", () => {
    const yaml = generateESPHomeYAML(project());
    expect(yaml).toContain("camera_encoder:");
    expect(yaml).toContain("framebuffer_camera:");
    expect(yaml).toContain("touchscreen:");
    expect(yaml).toContain("platform: gt911");
    expect(yaml).not.toContain("rotary_encoder");
    expect(yaml).not.toContain("encoder_push");
    expect(yaml).toContain("- includes/ui_input.h");
    expect(yaml).toContain("- includes/ui_config.h");
  });

  test("T-Encoder-Pro projects swap in mipi_spi, chsc5816 and encoder input", () => {
    const p = project("lilygo-t-encoder-pro", { width: 390, height: 390 });
    const yaml = generateESPHomeYAML(p);

    // Display + touch wiring comes from the profile's hardware.yaml.
    expect(yaml).toContain("hardware: !include hardware.yaml");

    // Touchscreen stanza is profile-driven.
    expect(yaml).toContain("platform: chsc5816");
    expect(yaml).toContain("reset_pin: GPIO8");
    expect(yaml).toContain("interrupt_pin: GPIO9");
    expect(yaml).toContain("address: 0x2E");

    // Screenshot pipeline omitted on unsupported drivers.
    expect(yaml).not.toContain("camera_encoder:");
    expect(yaml).not.toContain("framebuffer_camera:");

    // Encoder rotation + push wired into the C++ dispatcher.
    expect(yaml).toContain("platform: rotary_encoder");
    expect(yaml).toContain("UiInput::encoder_step(1);");
    expect(yaml).toContain("UiInput::encoder_step(-1);");
    expect(yaml).toContain("id: encoder_push");
    expect(yaml).toContain("UiInput::encoder_push();");
    expect(yaml).toContain("number: GPIO0");
  });

  test("resolveProjectDeviceProfile falls back for legacy projects", () => {
    expect(resolveProjectDeviceProfile(project()).id).toBe(DEFAULT_DEVICE_ID);
    expect(resolveProjectDeviceProfile(project("lilygo-t-encoder-pro")).width).toBe(390);
  });
});
