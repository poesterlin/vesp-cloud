import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '@esphome-designer/db';
import { compilationJobs } from '@esphome-designer/db/schema';
import { eq, and } from 'drizzle-orm';

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

  // Un-publish all other builds for this project
  if (job.projectId) {
    await db
      .update(compilationJobs)
      .set({ published: false })
      .where(and(eq(compilationJobs.projectId, job.projectId), eq(compilationJobs.published, true)));
  }

  // Publish this build
  const [updated] = await db
    .update(compilationJobs)
    .set({ published: true })
    .where(eq(compilationJobs.id, params.jobId))
    .returning();

  return json(updated);
};
