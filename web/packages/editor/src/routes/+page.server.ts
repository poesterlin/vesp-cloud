import { getDb } from '@vesp-cloud/db';
import { projects } from '@vesp-cloud/db/schema';
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

  return {
    projects: rows.map((r) => ({
      id: r.id,
      name: r.name,
      updatedAt: r.updatedAt.toISOString(),
    })),
  };
};
