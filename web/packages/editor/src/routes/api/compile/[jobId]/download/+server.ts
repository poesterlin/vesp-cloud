import { error } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import { getDb } from '@vesp-cloud/db';
import { compilationJobs, projects, uiFirmwareBuilds } from '@vesp-cloud/db/schema';
import type { Project } from '@vesp-cloud/schema';
import { exportProjectZip } from '$lib/server/project-export';
import { manifestArtifact, uiManifestUrls } from '$lib/server/ui-manifests';
import { uiFirmwareCapabilities, uiManifestRequirements } from '$lib/codegen/ui-capabilities';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, url }) => {
  if (!locals.user) error(401);
  const db = getDb();
  const [job] = await db.select().from(compilationJobs)
    .where(and(eq(compilationJobs.id, params.jobId), eq(compilationJobs.userId, locals.user.id)));
  if (!job) error(404, 'Job not found');
  const config = JSON.parse(job.config) as Project;
  const buildId = randomUUID();
  const [project] = job.projectId ? await db.select().from(projects)
    .where(and(eq(projects.id, job.projectId), eq(projects.userId, locals.user.id))) : [];
  const sanitized = { ...config, secrets: { ...config.secrets, firmwareUpdateUrl: undefined,
    ...(project ? uiManifestUrls(env.PUBLIC_BASE_URL || url.origin, project.firmwareToken, buildId) : {}) } };
  const exported = await exportProjectZip(sanitized, buildId);
  if (project && exported.manifest.ok) {
    const artifact = manifestArtifact(exported.manifest.bytes, uiManifestRequirements(sanitized));
    await db.insert(uiFirmwareBuilds).values({ id: buildId, projectId: project.id, sourceExport: true, available: true,
      capabilities: uiFirmwareCapabilities(sanitized), manifestBase64: artifact.manifestBase64,
      sha256: artifact.sha256, fingerprint: artifact.fingerprint });
  }
  return new Response(exported.bytes, { headers: { 'Content-Type': 'application/zip',
    'Content-Length': String(exported.bytes.byteLength), 'Content-Disposition': `attachment; filename="${exported.fileName}.zip"`,
    'Cache-Control': 'no-store' } });
};
