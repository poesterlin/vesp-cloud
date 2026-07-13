import { getDb } from '@vesp-cloud/db';
import { compilationJobs, projects } from '@vesp-cloud/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) return { projects: [] };

  const db = getDb();
  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, locals.user.id))
    .orderBy(desc(projects.updatedAt));

  const jobs = await db
    .select({
      projectId: compilationJobs.projectId,
      status: compilationJobs.status,
      published: compilationJobs.published,
      createdAt: compilationJobs.createdAt,
    })
    .from(compilationJobs)
    .where(eq(compilationJobs.userId, locals.user.id))
    .orderBy(desc(compilationJobs.createdAt));

  const latestJobByProject = new Map<string, (typeof jobs)[number]>();
  for (const job of jobs) {
    if (job.projectId && !latestJobByProject.has(job.projectId)) {
      latestJobByProject.set(job.projectId, job);
    }
  }

  return {
    projects: rows.map((r) => {
      const latestJob = latestJobByProject.get(r.id);
      return {
        id: r.id,
        name: r.name,
        updatedAt: r.updatedAt.toISOString(),
        deployment: latestJob
          ? {
              status: latestJob.status,
              published: latestJob.published,
              createdAt: latestJob.createdAt.toISOString(),
            }
          : null,
      };
    }),
  };
};
