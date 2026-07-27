import { describe, expect, test } from "bun:test";
import type { Project } from "@vesp-cloud/schema";
import { canFallbackToGeneratedUi, compileUiManifest } from "../ui-manifest";

function fixture(): Project {
  return {
    name: "Runtime fixture",
    display: { width: 480, height: 480 },
    dashboardPages: [{
      id: "home",
      name: "Home",
      backgroundColor: { r: 1, g: 2, b: 3 },
      components: [
        {
          id: "status", type: "text", position: { x: 20, y: 30 },
          size: { width: 180, height: 30 }, text: "Lamp",
          textBinding: { entityId: "light.desk" },
          visibleWhen: { entityId: "binary_sensor.room_active" },
          color: { r: 240, g: 241, b: 242 },
        },
        {
          id: "background", type: "rectangle", position: { x: 10, y: 20 },
          size: { width: 210, height: 100 }, backgroundColor: { r: 4, g: 5, b: 6 },
        },
        {
          id: "open", type: "button", position: { x: 20, y: 70 },
          size: { width: 100, height: 40 }, label: "Details",
          onTap: { type: "OPEN_DETAIL", targetId: "details" },
        },
      ],
    }],
    detailViews: [{
      id: "details", title: "Details", height: 480,
      components: [{
        id: "back", type: "button", position: { x: 20, y: 20 },
        size: { width: 100, height: 40 }, label: "Back",
        onTap: { type: "GO_BACK" },
      }, {
        id: "service", type: "button", position: { x: 150, y: 20 },
        size: { width: 80, height: 40 }, label: "Power",
        onTap: { type: "SERVICE_CALL", service: "light.toggle", target: { entityId: "light.desk" } },
      }],
    }],
  };
}

describe("compileUiManifest", () => {
  test("is deterministic and reports the runtime resource budget", () => {
    const first = compileUiManifest(fixture());
    const second = compileUiManifest(fixture());
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.bytes).toEqual(second.bytes);
    expect(new TextDecoder().decode(first.bytes.slice(0, 6))).toBe("VESPUI");
    expect(first.metadata).toMatchObject({
      formatVersion: 1, screenCount: 2, widgetCount: 5,
      stateBindingCount: 2, actionCount: 3, conditionCount: 1,
    });
    expect(first.metadata.byteLength).toBeLessThan(32 * 1024);
  });

  test("rejects unsupported widgets without producing a partial manifest", () => {
    const project = fixture();
    project.dashboardPages[0].components.push({
      id: "clock", type: "digital_clock", position: { x: 0, y: 0 },
    });
    const result = compileUiManifest(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "UNSUPPORTED_WIDGET" }));
    expect(canFallbackToGeneratedUi(result)).toBe(true);
  });

  test("rejects dangling navigation and invalid geometry", () => {
    const project = fixture();
    const button = project.dashboardPages[0].components[2];
    if (button.type !== "button") throw new Error("bad fixture");
    button.onTap = { type: "OPEN_DETAIL", targetId: "missing" };
    button.size = { width: 0, height: 40 };
    const result = compileUiManifest(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.code)).toContain("BAD_SCREEN_TARGET");
    expect(result.errors.map((error) => error.code)).toContain("BAD_GEOMETRY");
    expect(canFallbackToGeneratedUi(result)).toBe(false);
  });

  test("enforces the fixed widget budget", () => {
    const project = fixture();
    project.dashboardPages[0].components = Array.from({ length: 33 }, (_, index) => ({
      id: `rect-${index}`,
      type: "rectangle" as const,
      position: { x: index, y: index },
      size: { width: 10, height: 10 },
    }));
    const result = compileUiManifest(project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual(expect.objectContaining({ code: "LIMIT_WIDGETS" }));
  });
});
