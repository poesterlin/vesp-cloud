import { describe, expect, test } from "bun:test";
import type { Project } from "@vesp-cloud/schema";
import {
  LATEST_PROJECT_VERSION,
  migrateProjectSchema,
} from "$lib/utils/project-migration";

function legacyProject(): Project {
  return {
    version: "1.0.1",
    name: "Legacy",
    display: { width: 480, height: 480 },
    dashboardPages: [{ id: "page-1", name: "Home", components: [] }],
    detailViews: [],
  };
}

describe("project schema migration", () => {
  test("fills the device field with the default profile and bumps version", () => {
    const p = legacyProject();
    const result = migrateProjectSchema(p);
    expect(result.changed).toBe(true);
    expect(result.fromFuture).toBe(false);
    expect(p.device).toBe("guition-esp32-s3-4848s040");
    expect(p.version).toBe(LATEST_PROJECT_VERSION);
  });

  test("is idempotent", () => {
    const p = legacyProject();
    migrateProjectSchema(p);
    const second = migrateProjectSchema(p);
    expect(second.changed).toBe(false);
    expect(second.fromFuture).toBe(false);
  });

  test("preserves an explicit device choice", () => {
    const p = legacyProject();
    p.device = "lilygo-t-encoder-pro";
    migrateProjectSchema(p);
    expect(p.device).toBe("lilygo-t-encoder-pro");
    expect(p.version).toBe(LATEST_PROJECT_VERSION);
  });

  test("flags newer/unknown schema versions without touching them", () => {
    const p = legacyProject();
    p.version = "9.0.0";
    const result = migrateProjectSchema(p);
    expect(result.fromFuture).toBe(true);
    expect(result.changed).toBe(false);
    expect(p.version).toBe("9.0.0");
  });
});
