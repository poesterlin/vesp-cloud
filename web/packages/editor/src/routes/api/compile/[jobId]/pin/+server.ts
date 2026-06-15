import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '@esphome-designer/db';
import { compilationJobs } from '@esphome-designer/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async ({ locals, request, params }) => {
  if (!locals.user) error(401);

  const db = getDb();

  const [job] = await db
    .select()
    .from(compilationJobs)
    .where(
      and(
        eq(compilationJobs.id, params.jobId),
        eq(compilationJobs.userId, locals.user.id),
      ),
    );

  if (!job) error(404, 'Job not found');

  const body = await request.json();
  const pinned = Boolean(body.pinned);

  const [updated] = await db
    .update(compilationJobs)
    .set({ pinned })
    .where(eq(compilationJobs.id, params.jobId))
    .returning();

  return json(updated);
};
