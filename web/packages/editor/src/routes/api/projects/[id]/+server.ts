import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db';
import { projects } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) error(401);

  const db = getDb();
  const [row] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.userId, locals.user.id)));

  if (!row) error(404, 'Project not found');
  return json(row);
};

export const PUT: RequestHandler = async ({ locals, params, request }) => {
  if (!locals.user) error(401);

  const body = await request.json();
  const { name, data } = body;

  const db = getDb();
  const [row] = await db
    .update(projects)
    .set({
      ...(name !== undefined && { name }),
      ...(data !== undefined && { data }),
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, params.id), eq(projects.userId, locals.user.id)))
    .returning();

  if (!row) error(404, 'Project not found');
  return json(row);
};

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) error(401);

  const db = getDb();
  const [row] = await db
    .delete(projects)
    .where(and(eq(projects.id, params.id), eq(projects.userId, locals.user.id)))
    .returning({ id: projects.id });

  if (!row) error(404, 'Project not found');
  return json({ ok: true });
};
