import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '@vesp-cloud/db';
import { projects } from '@vesp-cloud/db/schema';
import { eq, desc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.user) error(401);

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

  return json(rows);
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.user) error(401);

  const body = await request.json();
  const { id, name, data } = body;

  if (!name || !data) {
    return json({ error: 'Missing name or data' }, { status: 400 });
  }

  const db = getDb();
  const [row] = await db
    .insert(projects)
    .values({
      id,
      userId: locals.user.id,
      name,
      data,
    })
    .returning();

  return json(row, { status: 201 });
};
