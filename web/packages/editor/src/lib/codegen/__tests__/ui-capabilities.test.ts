import { expect, test } from 'bun:test';
import type { Project } from '@vesp-cloud/schema';
import { manifestFingerprint, uiCompatibilityReasons, uiFirmwareCapabilities, uiManifestRequirements } from '../ui-capabilities';
import { generateFontsYAML } from '../mdi-icons';
import { RETRO_THEME } from '../../themes/retro';

function project(text = 'Ready: {{sensor.room.temperature}}', icon = 'mdi:power'): Project {
  return { name: 'Capabilities', display: { width: 480, height: 480 }, theme: RETRO_THEME,
    dashboardPages: [{ id: 'home', name: 'Home', components: [
      { id: 'label', type: 'text', text, position: { x: 20, y: 20 } },
      { id: 'icon', type: 'icon', icon, position: { x: 20, y: 80 } },
    ] }], detailViews: [] };
}

test('layout text/binding edits and existing icon aliases fit installed firmware', () => {
  const installed = uiFirmwareCapabilities(project());
  const required = uiManifestRequirements(project('Updated: {{sensor.other_entity}}', 'power'));
  expect(uiCompatibilityReasons(required, installed)).toEqual([]);
  expect(required.textGlyphs).not.toContain('{');
});

test('new icons, theme changes and text glyphs require a firmware resource update', () => {
  const installed = uiFirmwareCapabilities(project());
  expect(uiCompatibilityReasons(uiManifestRequirements(project('Ready', 'lightbulb')), installed).join(' ')).toContain('icon glyph');
  const modern = project(); modern.theme = undefined;
  expect(uiCompatibilityReasons(uiManifestRequirements(modern), installed)).toContain('The theme or chrome accent changed.');
  expect(uiCompatibilityReasons(uiManifestRequirements(project('Ω')), installed).join(' ')).toContain('Ω');
  expect(uiCompatibilityReasons(uiManifestRequirements(project('Ω')), uiFirmwareCapabilities(project('Ω')))).toEqual([]);
});

test('firmware generation actually includes newly required literal glyphs at every runtime size', async () => {
  const base = await Bun.file(new URL('../../templates/fonts.yaml', import.meta.url)).text();
  const fonts = generateFontsYAML(project('Ω\n{{sensor.name}}'), base);
  for (const id of ['font_small', 'font_medium', 'font_large']) {
    const quoted = fonts.match(new RegExp(`id: ${id}\\b[\\s\\S]*?glyphs: ("(?:\\\\.|[^"\\\\])*")`))?.[1];
    expect(quoted).toBeDefined();
    expect(JSON.parse(quoted!)).toContain('Ω');
  }
  expect(fonts).toContain('glyphs: "-:0123456789"');
});

test('fingerprint matches the standard FNV-1a 64-bit vector', () => {
  expect(manifestFingerprint(new TextEncoder().encode('hello'))).toBe('a430d84680aabd0b');
});
