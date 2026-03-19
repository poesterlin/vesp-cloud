import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db';
import { projects } from '$lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) error(401);

  const db = getDb();
  const [row] = await db
    .update(projects)
    .set({ firmwareToken: sql`gen_random_uuid()` })
    .where(and(eq(projects.id, params.id), eq(projects.userId, locals.user.id)))
    .returning({ firmwareToken: projects.firmwareToken });

  if (!row) error(404, 'Project not found');
  return json(row);
};
