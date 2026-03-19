import { error } from '@sveltejs/kit';
import { getDb } from '$lib/db';
import { projects } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
  if (!locals.user) error(401);

  const db = getDb();
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.userId, locals.user.id)));

  if (!row) error(404, 'Project not found');

  return {
    project: {
      id: row.id,
      name: row.name,
      data: row.data,
      firmwareToken: row.firmwareToken,
    },
  };
};
