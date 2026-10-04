import { expect, test } from 'bun:test';
import type { Project } from '@vesp-cloud/schema';
import { generateUIScreensHeader } from '../ui-screens';
import { generateESPHomeYAML, generateRuntimeESPHomeYAML } from '../esphome-yaml';
import { compileUiManifest } from '../ui-manifest';
import { RETRO_THEME } from '../../themes/retro';
import { MODERN_THEME } from '../../themes/modern';

const project: Project = {
  name: 'Renderer parity', display: { width: 480, height: 480 },
  dashboardPages: [{ id: 'home', name: 'Home', components: [
    ...(['small', 'medium', 'large'] as const).map((fontSize, index) => ({
      id: `label_${fontSize}`, type: 'text' as const, text: fontSize, fontSize,
      position: { x: 20, y: 20 + index * 60 }, size: { width: 200, height: 50 },
    })),
    { id: 'button_home', type: 'button', label: 'Home', position: { x: 20, y: 250 },
      backgroundColor: { r: 12, g: 34, b: 56 }, foregroundColor: { r: 210, g: 220, b: 230 } },
  ] }],
  detailViews: [{ id: 'detail', title: 'Detail', height: 480, components: [
    { id: 'button_detail', type: 'button', label: 'Detail', position: { x: 20, y: 80 },
      backgroundColor: { r: 12, g: 34, b: 56 }, foregroundColor: { r: 210, g: 220, b: 230 } },
  ] }],
};

test('small, medium and large labels select distinct firmware font styles', () => {
  const header = generateUIScreensHeader(project);
  for (const [size, style] of [['small', 'label'], ['medium', 'header'], ['large', 'label_large']])
    expect(header).toMatch(new RegExp(`LabelWidget>\\([^\\n]*"${size}"[^\\n]*g_theme\\.${style}\\)`));
  // Clock's giant font stays independent from the 32px large label font.
  const generated = generateESPHomeYAML(project);
  expect(generated).toContain('g_theme.header_large.font = id(font_giant);');
  expect(generated).toContain('g_theme.label_large.font = id(font_large);');
  expect(generateRuntimeESPHomeYAML(project)).toContain('g_theme.label_large.font = id(font_large);');
});

test('button foreground/background colors survive both dashboard and detail generation', () => {
  const header = generateUIScreensHeader(project);
  for (const id of ['button_home', 'button_detail']) {
    expect(header).toContain(`${id}->set_background_color(Color(12, 34, 56));`);
    expect(header).toContain(`${id}->set_foreground_color(Color(210, 220, 230));`);
  }
});

test('manifest button defaults match each theme and explicit colors override them', () => {
  for (const theme of [RETRO_THEME, MODERN_THEME]) {
    for (const custom of [false, true]) {
      const fixture: Project = {
        name: 'Colors', display: { width: 480, height: 480 }, theme,
        dashboardPages: [{ id: 'home', name: 'Home', components: [{
          id: 'button', type: 'button', label: 'Color', position: { x: 20, y: 20 },
          ...(custom ? { backgroundColor: { r: 12, g: 34, b: 56 }, foregroundColor: { r: 210, g: 220, b: 230 } } : {}),
        }] }], detailViews: [],
      };
      const result = compileUiManifest(fixture);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(JSON.stringify(result.errors));
      const view = new DataView(result.bytes.buffer);
      let record: Uint8Array | undefined;
      for (let offset = 16; offset < result.bytes.length;) {
        const length = view.getUint16(offset + 1, true);
        if (result.bytes[offset] === 6) record = result.bytes.slice(offset + 3, offset + 3 + length);
        offset += 3 + length;
      }
      const background = custom ? [12, 34, 56] : theme.id === 'retro' ? [25, 30, 40] : [30, 36, 45];
      const foreground = custom ? [210, 220, 230] : theme.id === 'retro' ? [230, 240, 250] : [240, 246, 252];
      expect(record?.slice(16, 19)).toEqual(Uint8Array.from(background));
      expect(record?.slice(19, 22)).toEqual(Uint8Array.from(foreground));
    }
  }
});
