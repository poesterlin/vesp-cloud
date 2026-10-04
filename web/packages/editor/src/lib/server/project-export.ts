import JSZip from 'jszip';
import type { Project } from '@vesp-cloud/schema';
import { error } from '@sveltejs/kit';
import { compileUiManifest, canFallbackToGeneratedUi, generateEmbeddedUiManifestHeader } from '../codegen/ui-manifest';
import { generateESPHomeYAML, generateRuntimeESPHomeYAML } from '../codegen/esphome-yaml';
import { generateUIScreensHeader } from '../codegen/ui-screens';
import { generateUIStateHeader } from '../codegen/ui-state';
import { generateUITypesHeader, generateRuntimeUITypesHeader } from '../codegen/ui-types';
import { generateUIThemeHeader } from '../codegen/ui-theme';
import { generateFontsYAML } from '../codegen/mdi-icons';
import { generateSecretsYAML } from '../codegen/secrets';
import { validateProject } from '../codegen/validations';
import { validateProjectSchema } from './project-schema';

const templates = import.meta.glob('../templates/**/*', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

export async function exportProjectZip(project: Project, buildId: string) {
  const schema = validateProjectSchema(project);
  if (!schema.valid) error(400, schema.errors.join('; '));
  const errors = validateProject(project);
  if (errors.length) error(400, errors.map(issue => issue.message).join('; '));
  const zip = new JSZip();
  let fonts = '';
  for (const [path, content] of Object.entries(templates)) {
    const relative = path.slice('../templates/'.length);
    if (relative === 'fonts.yaml') fonts = content;
    else zip.file(relative, content);
  }
  const fileName = project.name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  zip.file('fonts.yaml', generateFontsYAML(project, fonts));
  zip.file('secrets.yaml', generateSecretsYAML(project, { includeOtaSecrets: false }));
  zip.file('includes/ui_theme.h', generateUIThemeHeader(project));
  const manifest = compileUiManifest(project);
  if (manifest.ok) {
    zip.file('ui_manifest.vespui', manifest.bytes);
    zip.file('includes/ui_manifest.h', generateEmbeddedUiManifestHeader(manifest.bytes));
    zip.file('includes/ui_types.h', generateRuntimeUITypesHeader());
    zip.file(`${fileName}.yaml`, generateRuntimeESPHomeYAML(project, buildId));
  } else if (canFallbackToGeneratedUi(manifest)) {
    zip.file('includes/ui_types.h', generateUITypesHeader(project));
    zip.file('includes/ui_state.h', generateUIStateHeader(project));
    zip.file('includes/ui_screens.h', generateUIScreensHeader(project));
    zip.file(`${fileName}.yaml`, generateESPHomeYAML(project));
  } else error(400, manifest.errors.map(issue => issue.message).join('; '));
  return { bytes: await zip.generateAsync({ type: 'arraybuffer' }), fileName, manifest };
}
