import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '@vesp-cloud/db';
import { compilationJobs, projects, uiFirmwareBuilds } from '@vesp-cloud/db/schema';
import { eq, and } from 'drizzle-orm';
import { appendUiManifestRelease } from '$lib/server/ui-manifests';
import { uiManifestRequirements } from '$lib/codegen/ui-capabilities';
import type { Project } from '@vesp-cloud/schema';

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) error(401);

  const db = getDb();

  // Fetch the job and verify ownership
  const [job] = await db
    .select()
    .from(compilationJobs)
    .where(
      and(
        eq(compilationJobs.id, params.jobId),
        eq(compilationJobs.userId, locals.user.id),
        eq(compilationJobs.status, 'completed'),
      ),
    );

  if (!job) error(404, 'Job not found');

  const updated = await db.transaction(async tx => {
    if (job.projectId) {
      // Serialize firmware and manifest publishing through the same project lock.
      await tx.select({ id: projects.id }).from(projects).where(eq(projects.id, job.projectId)).for('update');
      await tx
      .update(compilationJobs)
      .set({ published: false })
      .where(and(eq(compilationJobs.projectId, job.projectId), eq(compilationJobs.published, true)));
      const [runtime] = await tx.select().from(uiFirmwareBuilds).where(eq(uiFirmwareBuilds.jobId, job.id));
      if (runtime) await appendUiManifestRelease(tx, job.projectId, {
        manifestBase64: runtime.manifestBase64, sha256: runtime.sha256, fingerprint: runtime.fingerprint,
        requirements: uiManifestRequirements(JSON.parse(job.config) as Project),
      });
    }

  // Publish this build
    const [published] = await tx
    .update(compilationJobs)
    .set({ published: true })
    .where(eq(compilationJobs.id, params.jobId))
      .returning();
    return published;
  });

  return json(updated);
};
