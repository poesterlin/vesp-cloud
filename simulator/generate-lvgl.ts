import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import type { Project } from '../web/packages/schema/dist/types';
import { RETRO_THEME } from '../web/packages/editor/src/lib/themes/retro';
import { MODERN_THEME } from '../web/packages/editor/src/lib/themes/modern';
import { compileUiManifest, generateEmbeddedUiManifestHeader } from '../web/packages/editor/src/lib/codegen/ui-manifest';
import { generateFontsYAML, getIconGlyphs, ICON_FONT_ID } from '../web/packages/editor/src/lib/codegen/mdi-icons';
import { collectProjectIconNames } from '../web/packages/editor/src/lib/codegen/utils';

const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  theme: { type: 'string', default: 'retro' }, output: { type: 'string', default: 'simulator/generated-lvgl' },
} });
if (!['retro', 'modern'].includes(values.theme!)) throw new Error('theme must be retro or modern');
const root = resolve(import.meta.dir, '..');
const output = resolve(values.output!);
const project: Project = JSON.parse(await readFile(positionals[0] ?? resolve(import.meta.dir, 'lvgl-fixture.json'), 'utf8'));
project.theme = structuredClone(values.theme === 'retro' ? RETRO_THEME : MODERN_THEME);
const result = compileUiManifest(project);
if (!result.ok) throw new Error(JSON.stringify(result.errors));
await mkdir(output, { recursive: true });
await cp(resolve(root, 'web/packages/editor/src/lib/templates/includes'), resolve(output, 'includes'), { recursive: true });
await cp(resolve(import.meta.dir, 'lvgl-app.h'), resolve(output, 'lvgl-app.h'));
await writeFile(resolve(output, 'includes/ui_manifest.h'), generateEmbeddedUiManifestHeader(result.bytes));
await writeFile(resolve(output, 'ui_manifest.vespui'), result.bytes);
const fontsYaml = generateFontsYAML(project,
  await readFile(resolve(root, 'web/packages/editor/src/lib/templates/fonts.yaml'), 'utf8'));
await writeFile(resolve(output, 'fonts.yaml'), fontsYaml);
// The icon font is only generated when the project references known icons.
// Keep the runtime's icon references conditional so icon-free projects compile.
const hasIconFont = getIconGlyphs(collectProjectIconNames(project)).size > 0;
const iconFontArgument = hasIconFont ? `id(${ICON_FONT_ID})->get_lv_font()` : 'nullptr';
const iconBootstrapLabel = hasIconFont ? `
          - label:
              text: ""
              text_font: ${ICON_FONT_ID}` : '';
await writeFile(resolve(output, 'simulator.yaml'), `esphome:
  name: vesp-lvgl-runtime
  includes:
    - includes/ui_runtime_manifest.h
    - includes/ui_boot_manifest.h
    - includes/ui_runtime_session.h
    - includes/ui_lvgl_runtime.h
    - includes/ui_manifest.h
    - lvgl-app.h
  platformio_options:
    build_flags:
      - -DLV_USE_LABEL=1
      - -DLV_USE_BUTTON=1
  on_boot:
    priority: -100
    then:
      - lambda: |-
          g_lvgl_app.init(id(runtime_lvgl),
            {id(font_small)->get_lv_font(), id(font_medium)->get_lv_font(), id(font_large)->get_lv_font()},
            ${iconFontArgument}, ${values.theme === 'retro'});
host:
logger:
  level: INFO
packages:
  fonts: !include fonts.yaml
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
touchscreen:
  - platform: sdl
    id: simulator_touch
lvgl:
  id: runtime_lvgl
  displays: main_display
  touchscreens: simulator_touch
  paused: true
  resume_on_input: false
  buffer_size: 12%
  default_font: font_small
  widgets:
    - obj:
        hidden: true
        width: 1
        height: 1
        widgets:
          - label:
              text: ""
              text_font: font_medium
          - label:
              text: ""
              text_font: font_large${iconBootstrapLabel}
interval:
  - interval: 50ms
    then:
      - lambda: g_lvgl_app.update(millis());
`);
await writeFile(resolve(output, 'layout.json'), JSON.stringify({ width: 480, height: 480,
  screens: [...project.dashboardPages.map(s => ({ id: s.id, name: s.name, components: s.components })),
    ...project.detailViews.map(s => ({ id: s.id, name: s.title, components: s.components }))]
    .map(s => ({ id: s.id, name: s.name, widgets: s.components.map(c => ({ id: c.id, type: c.type,
      x: c.position.x, y: c.position.y, width: c.size?.width ?? 100, height: c.size?.height ?? 40 })) })),
}, null, 2));
console.log(`Generated ${values.theme} LVGL manifest runtime: ${result.metadata.widgetCount} widgets`);
