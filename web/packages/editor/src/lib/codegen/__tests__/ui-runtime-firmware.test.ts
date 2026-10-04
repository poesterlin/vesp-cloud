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
import { generateSecretsYAML } from '../secrets';

const fixture: Project = {
  name: "Runtime Firmware POC",
  secrets: { firmwareUpdateUrl: 'https://example.com/api/firmware/token', uiManifestUrl: 'https://example.com/panel/ui_manifest.vespui', uiManifestReportUrl: 'https://example.com/panel/ui-status' },
  display: { width: 480, height: 480 },
  dashboardPages: [{
    id: "home", name: "Home", backgroundColor: { r: 7, g: 8, b: 9 },
    components: [
      { id: "state", type: "text", position: { x: 20, y: 20 }, size: { width: 180, height: 30 }, text: "State: {{light.desk}}", fontSize: "medium", align: "center", visibleWhen: { entityId: "binary_sensor.ready" } },
      { id: "details", type: "button", position: { x: 20, y: 70 }, size: { width: 120, height: 42 }, label: "Details", backgroundColor: { r: 20, g: 30, b: 40 }, foregroundColor: { r: 220, g: 230, b: 240 }, onTap: { type: "OPEN_DETAIL", targetId: "detail" } },
      { id: "power", type: "icon", position: { x: 160, y: 70 }, size: { width: 42, height: 42 }, icon: "power" },
      { id: "large", type: "text", position: { x: 20, y: 150 }, size: { width: 240, height: 50 }, text: "Runtime text", fontSize: "large", align: "right" },
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
  expect(yaml).toContain("g_ui_app.update(millis());");
  expect(yaml).toContain("g_theme.header.font = id(font_medium);");
  expect(yaml).toContain("g_theme.header_large.font = id(font_large);");
  expect(yaml).not.toContain("includes/ui_screens.h");
  expect(yaml).toContain('g_ui_app.prepare_boot_manifest(');
  expect(yaml).toContain('url: !secret ui_manifest_url');
  expect(yaml).toContain('max_response_buffer_size: 32768');
  expect(yaml).toContain('g_ui_app.accept_boot_manifest(body);');
  expect(yaml.indexOf('g_ui_app.accept_boot_manifest(body);')).toBeLessThan(yaml.indexOf('g_ui_app.init();'));
  expect(generateSecretsYAML(fixture)).toContain('ui_manifest_url: "https://example.com/panel/ui_manifest.vespui"');
  expect(yaml).toContain('url: !secret ui_manifest_report_url');
  expect(yaml).toContain('root["fingerprint"] = g_ui_app.manifest_fingerprint();');
  expect(yaml).toContain('source: !secret firmware_manifest_url');
});

test('runtime without a manifest URL uses persistent cache without waiting for networking', () => {
  const yaml = generateRuntimeESPHomeYAML({ ...fixture, secrets: undefined });
  expect(yaml).toContain('g_ui_app.prepare_boot_manifest(');
  expect(yaml).not.toContain('http_request.get:');
  expect(yaml).not.toContain('wait_until:');
  expect(yaml).not.toContain('!secret ui_manifest_url');
});

const editorRoot = resolve(import.meta.dir, "../../../..");
const repositoryRoot = resolve(editorRoot, "../../..");
const esphome = join(repositoryRoot, ".venv/bin/esphome");
const dockerImage = process.env.VESPUI_ESPHOME_DOCKER_IMAGE;
const compileEnabled = process.env.VESPUI_ESPHOME_COMPILE === "1" && (existsSync(esphome) || !!dockerImage);

test.skipIf(!compileEnabled)("compiles a real ESPHome RuntimeUi fixture", async () => {
  const manifest = compileUiManifest(fixture);
  if (!manifest.ok) throw new Error(JSON.stringify(manifest.errors));
  const directory = await mkdtemp(join(process.env.TMPDIR ?? tmpdir(), "vespui-esphome-"));
  try {
    await cp(join(editorRoot, "src/lib/templates"), directory, { recursive: true });
    await writeFile(join(directory, "includes/ui_manifest.h"), generateEmbeddedUiManifestHeader(manifest.bytes));
    await writeFile(join(directory, "includes/ui_types.h"), generateRuntimeUITypesHeader());
    await writeFile(join(directory, "includes/ui_theme.h"), generateUIThemeHeader(fixture));
    const fonts = await Bun.file(join(directory, "fonts.yaml")).text();
    await writeFile(join(directory, "fonts.yaml"), generateFontsYAML(fixture, fonts));
    await writeFile(join(directory, "runtime-poc.yaml"), generateRuntimeESPHomeYAML(fixture, "poc-test"));
    await writeFile(join(directory, 'secrets.yaml'), generateSecretsYAML(fixture));
    const command = dockerImage
      ? ["docker", "run", "--rm", "--user", `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
          "-e", "HOME=/tmp", "-e", "PLATFORMIO_CORE_DIR=/tmp/platformio", "-e", "PLATFORMIO_BUILD_CACHE_DIR=/tmp/pio-build-cache",
          "-e", "ESPHOME_ESP_IDF_PREFIX=/tmp/esphome-idf", "-e", "CCACHE_DIR=/tmp/ccache",
          "-v", `${directory}:/config`, "--entrypoint", process.env.VESPUI_ESPHOME_DOCKER_ENTRYPOINT ?? "esphome", dockerImage, "compile", "/config/runtime-poc.yaml"]
      : [esphome, "compile", join(directory, "runtime-poc.yaml")];
    const compile = Bun.spawnSync(command, {
      env: { ...process.env, PLATFORMIO_CORE_DIR: join(repositoryRoot, ".platformio") },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(compile.exitCode, `${compile.stdout.toString()}\n${compile.stderr.toString()}`).toBe(0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 900_000);
