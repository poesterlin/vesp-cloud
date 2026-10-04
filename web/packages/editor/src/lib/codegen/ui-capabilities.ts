import type { Project } from '@vesp-cloud/schema';
import { collectProjectIconNames } from './utils';
import { getIconGlyphs } from './mdi-icons';
import { UI_TEXT_GLYPHS, requiredUiTextGlyphs } from './ui-font-resources';
export { UI_TEXT_GLYPHS } from './ui-font-resources';

export interface UiFirmwareCapabilities {
  protocol: 1;
  formatVersion: 2;
  theme: string;
  textGlyphs: string;
  iconGlyphs: string[];
}

export function uiFirmwareCapabilities(project: Project): UiFirmwareCapabilities {
  return {
    protocol: 1, formatVersion: 2,
    theme: JSON.stringify({ retro: project.theme?.id === 'retro', accent: project.theme?.chromeAccent
      ? [project.theme.chromeAccent.r, project.theme.chromeAccent.g, project.theme.chromeAccent.b] : null }),
    textGlyphs: [...new Set(UI_TEXT_GLYPHS + requiredUiTextGlyphs(project))].sort().join(''),
    iconGlyphs: [...getIconGlyphs(collectProjectIconNames(project)).values()].sort(),
  };
}

export function uiManifestRequirements(project: Project): UiFirmwareCapabilities {
  const requirements = uiFirmwareCapabilities(project);
  requirements.textGlyphs = requiredUiTextGlyphs(project);
  return requirements;
}

export function uiCompatibilityReasons(required: UiFirmwareCapabilities, installed: UiFirmwareCapabilities): string[] {
  const reasons: string[] = [];
  if (installed.protocol !== 1 || installed.formatVersion !== required.formatVersion)
    reasons.push('The installed firmware does not support this manifest format.');
  if (installed.theme !== required.theme) reasons.push('The theme or chrome accent changed.');
  const missingIcons = required.iconGlyphs.filter(glyph => !installed.iconGlyphs.includes(glyph));
  if (missingIcons.length) reasons.push(`${missingIcons.length} icon glyph(s) are not included in the installed firmware.`);
  const missingText = [...required.textGlyphs].filter(char => !installed.textGlyphs.includes(char));
  if (missingText.length) reasons.push(`Text glyphs ${missingText.join(' ')} are not included in the installed firmware.`);
  return reasons;
}

export function manifestFingerprint(bytes: Uint8Array): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of bytes) hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  return hash.toString(16).padStart(16, '0');
}
