import { generateESPHomeYAML, generateUITypesHeader, generateUIStateHeader, generateUIScreensHeader } from './packages/editor/src/lib/codegen/esphome';
import { generateSecretsYAML } from './packages/editor/src/lib/codegen/secrets';
import { copyStaticTemplates } from './packages/editor/src/lib/server/esphome-templates';
import { join } from 'path';
import { promises as fs } from 'fs';
import type { Project } from './packages/schema/dist';

const project = {
  version: "1.0.1",
  id: "test-display",
  name: "Test Display",
  display: {
    width: 480,
    height: 480,
  },
  dashboardPages: [
    {
      id: "page-1",
      name: "Home",
      components: [
        {
          type: "light_state",
          id: "light-1",
          label: "Kitchen Light",
          position: { x: 20, y: 80 },
          size: { width: 200, height: 60 },
          stateBinding: { entityId: "light.kitchen" },
          onTap: { type: "SERVICE_CALL", service: "light.toggle", target: { entityId: "light.kitchen" } },
        },
        {
          type: "tab_container",
          id: "tabs-main",
          position: { x: 0, y: 0 },
          size: { width: 480, height: 480 },
          tabs: [
            {
              id: "tab-one",
              name: "Lights",
              components: [
                {
                  type: "light_state",
                  id: "light-tab-1",
                  label: "Kitchen",
                  position: { x: 20, y: 50 },
                  size: { width: 200, height: 60 },
                  stateBinding: { entityId: "light.kitchen" },
                  onTap: { type: "SERVICE_CALL", service: "light.toggle", target: { entityId: "light.kitchen" } },
                },
              ],
            },
            {
              id: "tab-two",
              name: "Info",
              components: [
                {
                  type: "text",
                  id: "info-text",
                  text: "System Status",
                  position: { x: 20, y: 50 },
                  size: { width: 200, height: 20 },
                  fontSize: "medium",
                },
              ],
            },
          ],
        },
      ]
    },
    {
      id: "page-2",
      name: "Actions",
      components: []
    }
  ],
  detailViews: [],
  secrets: {
    firmwareUpdateUrl: "http://localhost:5173/api/firmware/TOKEN/manifest"
  }
} satisfies Project;

try {
  const tempDir = join('./temp', project.id);
  const configFile = join(tempDir, 'config.yaml');

  await fs.mkdir(tempDir, { recursive: true });

  // Copy static template files (YAML + C++ headers), excluded as import.meta.glob doesn't work in this test file
  // await copyStaticTemplates(tempDir);

  // Write generated dynamic headers
  await fs.writeFile(join(tempDir, 'includes', 'ui_types.h'), generateUITypesHeader(project));
  await fs.writeFile(join(tempDir, 'includes', 'ui_state.h'), generateUIStateHeader(project));
  await fs.writeFile(join(tempDir, 'includes', 'ui_screens.h'), generateUIScreensHeader(project));

  const esphomeYaml = generateESPHomeYAML(project, "test-job-id");
  const secretsYaml = generateSecretsYAML(project);

  await fs.writeFile(configFile, esphomeYaml);
  await fs.writeFile(join(tempDir, 'secrets.yaml'), secretsYaml);

  // Print summary
  const files = await fs.readdir(tempDir, { recursive: true });
  console.log("Generated files in", tempDir);
  for (const f of files.sort()) {
    const stat = await fs.stat(join(tempDir, f.toString()));
    if (stat.isFile()) {
      console.log(`  ${f} (${stat.size} bytes)`);
    }
  }

  // Print config.yaml first 30 lines
  console.log("\n=== config.yaml (first 30 lines) ===");
  const config = await fs.readFile(configFile, 'utf-8');
  console.log(config.split('\n').slice(0, 30).join('\n'));

  // Print ui_types.h
  console.log("\n=== ui_types.h ===");
  console.log(await fs.readFile(join(tempDir, 'includes', 'ui_types.h'), 'utf-8'));

  // Print ui_state.h
  console.log("\n=== ui_state.h ===");
  console.log(await fs.readFile(join(tempDir, 'includes', 'ui_state.h'), 'utf-8'));

  // Print ui_screens.h setup_ui_screens section
  console.log("\n=== ui_screens.h (setup_ui_screens only) ===");
  const screens = await fs.readFile(join(tempDir, 'includes', 'ui_screens.h'), 'utf-8');
  const setupStart = screens.indexOf('inline void setup_ui_screens');
  console.log(screens.slice(setupStart));
} catch (e: any) {
  console.error("Error:", e.message);
  console.error(e.stack);
}
