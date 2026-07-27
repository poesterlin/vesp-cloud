import { expect, test } from "bun:test";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { Project } from "@vesp-cloud/schema";
import {
  compileUiManifest,
  generateEmbeddedUiManifestHeader,
  generateFontsYAML,
  generateRuntimeESPHomeYAML,
  generateRuntimeUITypesHeader,
  generateUIThemeHeader,
} from "../esphome";

const fixture: Project = {
  name: "Runtime Firmware POC",
  display: { width: 480, height: 480 },
  dashboardPages: [{
    id: "home", name: "Home", backgroundColor: { r: 7, g: 8, b: 9 },
    components: [
      { id: "state", type: "text", position: { x: 20, y: 20 }, size: { width: 180, height: 30 }, text: "State", textBinding: { entityId: "light.desk" }, visibleWhen: { entityId: "binary_sensor.ready" } },
      { id: "details", type: "button", position: { x: 20, y: 70 }, size: { width: 120, height: 42 }, label: "Details", backgroundColor: { r: 20, g: 30, b: 40 }, foregroundColor: { r: 220, g: 230, b: 240 }, onTap: { type: "OPEN_DETAIL", targetId: "detail" } },
      { id: "power", type: "icon", position: { x: 160, y: 70 }, size: { width: 42, height: 42 }, icon: "power" },
    ],
  }],
  detailViews: [{
    id: "detail", title: "Detail", height: 480,
    components: [{ id: "toggle", type: "button", position: { x: 20, y: 20 }, size: { width: 120, height: 42 }, label: "Toggle", onTap: { type: "SERVICE_CALL", service: "light.toggle", target: { entityId: "light.desk" } } }],
  }],
};

test("runtime firmware artifacts embed the manifest and select generic C++", () => {
  const manifest = compileUiManifest(fixture);
  expect(manifest.ok).toBe(true);
  if (!manifest.ok) return;
  const header = generateEmbeddedUiManifestHeader(manifest.bytes);
  const yaml = generateRuntimeESPHomeYAML(fixture, "poc-test");
  expect(header).toContain("vespui_embedded_manifest");
  expect(yaml).toContain("-DVESPUI_RUNTIME=1");
  expect(yaml).toContain("includes/ui_runtime_app.h");
  expect(yaml).toContain("g_ui_app.init()");
  expect(yaml).not.toContain("includes/ui_screens.h");
});

const editorRoot = resolve(import.meta.dir, "../../../..");
const repositoryRoot = resolve(editorRoot, "../../..");
const esphome = join(repositoryRoot, ".venv/bin/esphome");
const compileEnabled = process.env.VESPUI_ESPHOME_COMPILE === "1" && existsSync(esphome);

test.skipIf(!compileEnabled)("compiles a real ESPHome RuntimeUi fixture", async () => {
  const manifest = compileUiManifest(fixture);
  if (!manifest.ok) throw new Error(JSON.stringify(manifest.errors));
  const directory = await mkdtemp(join(tmpdir(), "vespui-esphome-"));
  try {
    await cp(join(editorRoot, "src/lib/templates"), directory, { recursive: true });
    await writeFile(join(directory, "includes/ui_manifest.h"), generateEmbeddedUiManifestHeader(manifest.bytes));
    await writeFile(join(directory, "includes/ui_types.h"), generateRuntimeUITypesHeader());
    await writeFile(join(directory, "includes/ui_theme.h"), generateUIThemeHeader(fixture));
    const fonts = await Bun.file(join(directory, "fonts.yaml")).text();
    await writeFile(join(directory, "fonts.yaml"), generateFontsYAML(fixture, fonts));
    await writeFile(join(directory, "runtime-poc.yaml"), generateRuntimeESPHomeYAML(fixture, "poc-test"));
    const compile = Bun.spawnSync([esphome, "compile", join(directory, "runtime-poc.yaml")], {
      env: { ...process.env, PLATFORMIO_CORE_DIR: join(repositoryRoot, ".platformio") },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(compile.exitCode, `${compile.stdout.toString()}\n${compile.stderr.toString()}`).toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 900_000);
