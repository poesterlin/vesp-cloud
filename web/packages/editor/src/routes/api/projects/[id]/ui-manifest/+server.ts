import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@vesp-cloud/db';
import { projects } from '@vesp-cloud/db/schema';
import { loadUiDeployment, publishUiLayout, UUID_PATTERN } from '$lib/server/ui-manifests';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) error(401);
  if (!UUID_PATTERN.test(params.id)) error(404);
  const [project] = await getDb().select({ id: projects.id }).from(projects)
    .where(and(eq(projects.id, params.id), eq(projects.userId, locals.user.id)));
  if (!project) error(404);
  return json(await loadUiDeployment(project.id), { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) error(401);
  if (!UUID_PATTERN.test(params.id)) error(404);
  return json(await publishUiLayout(params.id, locals.user.id));
};
