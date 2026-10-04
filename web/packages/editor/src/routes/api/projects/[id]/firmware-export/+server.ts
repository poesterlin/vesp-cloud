import { randomUUID } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { getDb } from '@vesp-cloud/db';
import { projects, uiFirmwareBuilds } from '@vesp-cloud/db/schema';
import type { Project } from '@vesp-cloud/schema';
import { uiFirmwareCapabilities, uiManifestRequirements } from '$lib/codegen/ui-capabilities';
import { manifestArtifact, uiManifestUrls, UUID_PATTERN } from '$lib/server/ui-manifests';
import { exportProjectZip } from '$lib/server/project-export';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) error(401);
  if (!UUID_PATTERN.test(params.id)) error(404);
  const db = getDb();
  const [row] = await db.select().from(projects).where(and(eq(projects.id, params.id), eq(projects.userId, locals.user.id)));
  if (!row) error(404, 'Project not found');
  const buildId = randomUUID();
  const config = row.data as Project;
  const project = { ...config, secrets: { ...config.secrets, firmwareUpdateUrl: undefined,
    ...uiManifestUrls(env.PUBLIC_BASE_URL || url.origin, row.firmwareToken, buildId) } };
  const exported = await exportProjectZip(project, buildId);
  if (exported.manifest.ok) {
    const artifact = manifestArtifact(exported.manifest.bytes, uiManifestRequirements(project));
    await db.insert(uiFirmwareBuilds).values({ id: buildId, projectId: row.id, sourceExport: true, available: true,
      capabilities: uiFirmwareCapabilities(project), manifestBase64: artifact.manifestBase64, sha256: artifact.sha256, fingerprint: artifact.fingerprint });
  }
  return new Response(exported.bytes, { headers: { 'Content-Type': 'application/zip',
    'Content-Length': String(exported.bytes.byteLength), 'Content-Disposition': `attachment; filename="${exported.fileName}.zip"`,
    'Cache-Control': 'no-store' } });
};
