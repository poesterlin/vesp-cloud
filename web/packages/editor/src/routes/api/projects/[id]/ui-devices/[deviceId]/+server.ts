import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@vesp-cloud/db';
import { projects, uiDeviceBoots } from '@vesp-cloud/db/schema';
import { UUID_PATTERN } from '$lib/server/ui-manifests';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) error(401);
  if (!UUID_PATTERN.test(params.id)) error(404);
  await getDb().transaction(async tx => {
    const [project] = await tx.select({ id: projects.id }).from(projects)
      .where(and(eq(projects.id, params.id), eq(projects.userId, locals.user!.id))).for('update');
    if (!project) error(404, 'Project not found');
    await tx.delete(uiDeviceBoots).where(and(eq(uiDeviceBoots.projectId, project.id),
      eq(uiDeviceBoots.deviceId, params.deviceId)));
  });
  return json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
};
