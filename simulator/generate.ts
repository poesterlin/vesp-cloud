import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { RETRO_THEME } from '../web/packages/editor/src/lib/themes/retro';
import { MODERN_THEME } from '../web/packages/editor/src/lib/themes/modern';
import { generateUIScreensHeader } from '../web/packages/editor/src/lib/codegen/ui-screens';
import { generateUIStateHeader } from '../web/packages/editor/src/lib/codegen/ui-state';
import { generateUITypesHeader } from '../web/packages/editor/src/lib/codegen/ui-types';
import type { Project } from '../web/packages/schema/dist/types';
import { compileUiManifest, generateEmbeddedUiManifestHeader } from '../web/packages/editor/src/lib/codegen/ui-manifest';
import { generateRuntimeESPHomeYAML } from '../web/packages/editor/src/lib/codegen/esphome-yaml';
import { generateRuntimeUITypesHeader } from '../web/packages/editor/src/lib/codegen/ui-types';
import { generateUIThemeHeader } from '../web/packages/editor/src/lib/codegen/ui-theme';
import { generateFontsYAML, getMdiUtf8CEscape } from '../web/packages/editor/src/lib/codegen/mdi-icons';

const root = resolve(import.meta.dir, '..');
const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: {
  gallery: { type: 'boolean' }, theme: { type: 'string' }, output: { type: 'string' },
  deterministic: { type: 'boolean' }, parity: { type: 'string' },
} });
if (values.theme && !['retro', 'modern'].includes(values.theme)) throw new Error('theme must be retro or modern');
if (values.parity && !['generated', 'manifest'].includes(values.parity)) throw new Error('parity must be generated or manifest');
const output = resolve(values.output ?? resolve(import.meta.dir, 'generated'));
const project: Project = JSON.parse(await readFile(positionals[0] ?? resolve(import.meta.dir, values.parity ? 'parity.json' : 'demo.json'), 'utf8'));
if (values.theme) project.theme = structuredClone(values.theme === 'retro' ? RETRO_THEME : MODERN_THEME);
const result = compileUiManifest(project);
if (!result.ok) throw new Error(JSON.stringify(result.errors, null, 2));
await mkdir(output, { recursive: true });
await cp(resolve(root, 'web/packages/editor/src/lib/templates'), output, { recursive: true });
await cp(resolve(import.meta.dir, 'simulator-app.h'), resolve(output, 'includes/ui_runtime_app.h'));
await writeFile(resolve(output, 'includes/ui_manifest.h'), generateEmbeddedUiManifestHeader(result.bytes));
await writeFile(resolve(output, 'ui_manifest.vespui'), result.bytes);
await writeFile(resolve(output, 'includes/ui_types.h'), generateRuntimeUITypesHeader());
await writeFile(resolve(output, 'includes/ui_theme.h'), generateUIThemeHeader(project));
await writeFile(resolve(output, 'fonts.yaml'), generateFontsYAML(project, await readFile(resolve(output, 'fonts.yaml'), 'utf8')));

// Desktop boot delivery uses a mounted file, not the physical WiFi/NVS adapter.
let yaml = generateRuntimeESPHomeYAML({ ...project, secrets: { ...project.secrets, firmwareUpdateUrl: undefined, uiManifestUrl: undefined, uiManifestReportUrl: undefined } })
  .replace('    - includes/ui_manifest_storage.h\n', '')
  .replace(/          g_ui_app\.prepare_boot_manifest\([^\n]*\);/, '')
  .replace('  base: !include base.yaml\n', '')
  .replace('  hardware: !include hardware.yaml\n', '')
  .replace('esphome:', 'esphome:\n  name: vesp-simulator')
  .replace('      - -DVESPUI_RUNTIME=1', '      - -DVESPUI_RUNTIME=1\n      - -DVESPUI_SIMULATOR=1\n      - -DUI_PROFILE=0')
  .replace('  platform: gt911', '  platform: sdl')
  .replace('  id: touch_gt911', '  id: simulator_touch')
  .replace('  i2c_id: touch_i2c\n', '');
yaml += `
host:
time:
  - platform: host
    id: sntp_time
logger:
  level: INFO
api:
  reboot_timeout: 0s
display:
  - platform: sdl
    id: main_display
    dimensions:
      width: 480
      height: 480
    auto_clear_enabled: false
    update_interval: never
    window_options:
      borderless: true
      position:
        x: 0
        y: 0
    lambda: |-
      render_basic_ui(it);
`;
await writeFile(resolve(output, 'simulator.yaml'), yaml);
await writeFile(resolve(output, 'layout.json'), JSON.stringify({
  width: project.display.width, height: project.display.height,
  screens: [...project.dashboardPages.map((screen) => ({ id: screen.id, name: screen.name, components: screen.components })),
    ...project.detailViews.map((screen) => ({ id: screen.id, name: screen.title, components: screen.components }))]
    .map((screen) => ({ id: screen.id, name: screen.name, widgets: screen.components.map((component) => ({
      id: component.id, type: component.type,
      label: component.type === 'button' ? component.label : component.type === 'text' ? component.text : component.id,
      x: component.position.x, y: component.position.y,
      width: component.size?.width ?? 100, height: component.size?.height ?? 40,
    })) })),
}, null, 2));
console.log(`Generated ${result.metadata.widgetCount} widgets across ${result.metadata.screenCount} screens in ${output}`);
if (values.gallery) {
  const fontProject: Project = structuredClone(project);
  fontProject.dashboardPages[0].components.push(
    { id: 'gallery-weather', type: 'weather', position: { x: 0, y: 0 }, stateBinding: { entityId: 'weather.demo' } },
    { id: 'gallery-hvac', type: 'hvac', position: { x: 0, y: 0 }, stateBinding: { entityId: 'climate.demo' } },
    { id: 'gallery-icon', type: 'icon', position: { x: 0, y: 0 }, icon: 'mdi:lightbulb' },
  );
  await writeFile(resolve(output, 'fonts.yaml'), generateFontsYAML(fontProject, await readFile(resolve(root, 'web/packages/editor/src/lib/templates/fonts.yaml'), 'utf8')));
  yaml = yaml.replace('g_theme.primary.font = id(font_small);', 'g_theme.primary.font = id(font_small);\n          g_theme.icon.font = id(mdi_icons_24);\n          g_theme.weather_icon.font = id(mdi_weather_icons_48);');
  const extras = (await readdir(resolve(output, 'includes'))).filter(name => name.startsWith('ui_widget_') || ['ui_widgets.h', 'ui_chrome.h', 'ui_tab_container.h', 'ui_confirmation_popup.h'].includes(name));
  extras.push('ui_state.h');
  await writeFile(resolve(output, 'includes/ui_state.h'), '#pragma once\n#include "ui_runtime_state.h"\n');
  const baseHeader = resolve(output, 'includes/ui_widget_base.h');
  await writeFile(baseHeader, '#include "ui_runtime_state.h"\n#include "ui_redraw.h"\n' + await readFile(baseHeader, 'utf8'));
  await writeFile(resolve(output, 'gallery.svg'), '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="80"><rect width="160" height="80" fill="#174960"/><circle cx="80" cy="40" r="28" fill="#ffb400"/></svg>');
  yaml += '\nimage:\n  - file: gallery.svg\n    id: gallery_image\n    type: RGB565\n    byte_order: BIG_ENDIAN\n';
  yaml = yaml.replace('  includes:\n', `  includes:\n${extras.filter(name => !yaml.includes(`includes/${name}`)).map(name => `    - includes/${name}\n`).join('')}`);
  await writeFile(resolve(output, 'simulator.yaml'), yaml);
  await cp(resolve(import.meta.dir, 'gallery-app.h'), resolve(output, 'includes/ui_runtime_app.h'));
  const galleryHeader = resolve(output, 'includes/ui_runtime_app.h');
  let gallerySource = await readFile(galleryHeader, 'utf8');
  for (const icon of ['minus', 'plus', 'power']) gallerySource = gallerySource.replace(`@${icon}@`, getMdiUtf8CEscape(icon)!);
  await writeFile(galleryHeader, gallerySource);
  await writeFile(resolve(output, 'layout.json'), JSON.stringify({ width: 480, height: 480,
    theme: project.theme?.id ?? 'modern', deterministic: !!values.deterministic,
    screens: ['Basics', 'Lists', 'Climate', 'Containers', 'Notification', 'Loading', 'Image and detail header', 'Weather today', 'Page header'].map((name, index) => ({
      id: `gallery-${index}`, name, widgets: [{ id: 'next', type: 'button', label: 'Next test page', x: 330, y: 432, width: 130, height: 36 }],
      scenarios: index === 0 ? [
        { id: 'light-off', operation: 'tap', data: { x: 100, y: 270 } },
        { id: 'light-on-restored', operation: 'tap', data: { x: 100, y: 270 } },
        { id: 'confirmation', operation: 'tap', data: { x: 100, y: 175 } },
        { id: 'confirmation-cancelled', operation: 'tap', data: { x: 165, y: 318 } },
      ] : index === 1 ? [
        { id: 'todo-scrolled', operation: 'drag', data: { x: 200, y: 185, toX: 200, toY: 85, durationMs: 300 } },
      ] : index === 3 ? [
        { id: 'second-tab', operation: 'tap', data: { x: 350, y: 80 } },
        { id: 'first-tab-restored', operation: 'tap', data: { x: 100, y: 80 } },
        { id: 'conditional-off', operation: 'tap', data: { x: 100, y: 405 } },
        { id: 'conditional-on-restored', operation: 'tap', data: { x: 100, y: 405 } },
      ] : index === 4 ? [
        { id: 'dismissed', operation: 'tap', data: { x: 240, y: 355 } },
      ] : [],
    })) }));
}
if (values.deterministic) {
  const yamlPath = resolve(output, 'simulator.yaml');
  await writeFile(yamlPath, (await readFile(yamlPath, 'utf8')).replace('      - -DVESPUI_SIMULATOR=1', '      - -DVESPUI_SIMULATOR=1\n      - -DVESPUI_REGRESSION=1'));
  // Change only desktop build copies: no production firmware clock changes.
  for (const name of ['ui_widget_digital_clock.h', 'ui_chrome.h']) {
    const path = resolve(output, 'includes', name);
    await writeFile(path, (await readFile(path, 'utf8')).replaceAll('sntp_time->now()', 'esphome::ESPTime::from_epoch_utc(1767268800)'));
  }
  const path = resolve(output, 'includes/ui_widget_loading.h');
  await writeFile(path, (await readFile(path, 'utf8')).replaceAll('millis()', 'uint32_t(1200)'));
}
if (values.parity) {
  if (values.gallery) throw new Error('parity and gallery are separate fixture modes');
  const extras = (await readdir(resolve(output, 'includes'))).filter(name => name.startsWith('ui_widget_') || ['ui_widgets.h', 'ui_chrome.h', 'ui_tab_container.h', 'ui_confirmation_popup.h', 'ui_scrollable_detail.h'].includes(name));
  extras.push('ui_state.h', 'ui_screens.h');
  await writeFile(resolve(output, 'includes/ui_types.h'), generateUITypesHeader(project));
  await writeFile(resolve(output, 'includes/ui_state.h'), generateUIStateHeader(project));
  await writeFile(resolve(output, 'includes/ui_runtime_state.h'), '#pragma once\n#include "ui_state.h"\n');
  await writeFile(resolve(output, 'includes/ui_screens.h'), generateUIScreensHeader(project));
  const baseHeader = resolve(output, 'includes/ui_widget_base.h');
  await writeFile(baseHeader, '#include "ui_state.h"\n#include "ui_redraw.h"\n' + await readFile(baseHeader, 'utf8'));
  await cp(resolve(import.meta.dir, 'parity-app.h'), resolve(output, 'includes/ui_runtime_app.h'));
  const yamlPath = resolve(output, 'simulator.yaml');
  let parityYaml = await readFile(yamlPath, 'utf8');
  parityYaml = parityYaml.replace('  includes:\n', `  includes:\n${extras.filter(name => !parityYaml.includes(`includes/${name}`)).map(name => `    - includes/${name}\n`).join('')}`);
  if (values.parity === 'generated') parityYaml = parityYaml.replace('      - -DVESPUI_SIMULATOR=1', '      - -DVESPUI_SIMULATOR=1\n      - -DVESPUI_PARITY_GENERATED=1');
  await writeFile(yamlPath, parityYaml);
  const layout = JSON.parse(await readFile(resolve(output, 'layout.json'), 'utf8'));
  layout.theme = project.theme?.id ?? 'modern'; layout.deterministic = !!values.deterministic; layout.renderer = values.parity;
  layout.screens[0].scenarios = [
    { id: 'state-on', operation: 'tap', data: { x: 100, y: 160 } },
    { id: 'state-off-restored', operation: 'tap', data: { x: 100, y: 160 } },
    { id: 'disjoint-repaint', operation: 'tap', data: { x: 100, y: 370 } },
  ];
  await writeFile(resolve(output, 'layout.json'), JSON.stringify(layout));
}
if (values.deterministic && (values.gallery || values.parity)) {
  const path = resolve(output, 'layout.json');
  const layout = JSON.parse(await readFile(path, 'utf8'));
  for (const page of layout.screens) for (const scenario of page.scenarios ?? [])
    scenario.expect = scenario.id.endsWith('restored') || ['confirmation-cancelled', 'disjoint-repaint'].includes(scenario.id) ? 'initial' : 'changed';
  await writeFile(path, JSON.stringify(layout));
}
