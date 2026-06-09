import { error } from '@sveltejs/kit';
import { getDb } from '$lib/db';
import { projects, compilationJobs } from '$lib/db/schema';
import { eq, and, notInArray, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';

const IS_CLOUD = env.APP_EDITION === 'cloud';
const TERMINAL_STATUSES = ['completed', 'failed'];

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) error(401);

  const db = getDb();
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.userId, locals.user.id)));

  if (!row) error(404, 'Project not found');

  const activeJobs = await db
    .select()
    .from(compilationJobs)
    .where(
      and(
        eq(compilationJobs.projectId, params.id),
        eq(compilationJobs.userId, locals.user.id),
        notInArray(compilationJobs.status, TERMINAL_STATUSES),
      ),
    )
    .orderBy(desc(compilationJobs.createdAt));

  const activeJob = activeJobs[0] ?? null;

  return {
    isCloud: IS_CLOUD,
    project: {
      id: row.id,
      name: row.name,
      data: row.data,
    },
    lastSavedData: row.lastSavedData ?? null,
    activeJob: activeJob
      ? {
          id: activeJob.id,
          status: activeJob.status,
          projectName: activeJob.projectName,
          createdAt: activeJob.createdAt,
        }
      : null,
  };
};
