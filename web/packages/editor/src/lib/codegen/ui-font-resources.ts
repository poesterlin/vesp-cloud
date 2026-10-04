import type { Project } from '@vesp-cloud/schema';
import { collectAllComponents } from './utils';
import { parseTemplate } from '../utils/template-utils';

export const UI_TEXT_GLYPHS = `'°!"%()+*-.,/:;<=>?@[\\]^€—_\`{|}~ 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿß`;

export function requiredUiTextGlyphs(project: Project): string {
  const glyphs = new Set<string>();
  const roots = [...project.dashboardPages, ...project.detailViews].flatMap(screen => screen.components);
  for (const component of collectAllComponents(roots)) {
    const text = component.type === 'text' ? parseTemplate(component.text ?? '').filter(part => part.type === 'text').map(part => part.value).join('')
      : component.type === 'button' ? component.label ?? '' : '';
    for (const char of text) if (!['\n', '\r', '\t'].includes(char)) glyphs.add(char);
  }
  return [...glyphs].sort().join('');
}
