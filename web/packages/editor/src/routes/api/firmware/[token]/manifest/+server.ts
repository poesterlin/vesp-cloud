import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db';
import { projects, compilationJobs } from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { getStaticBuildsDir } from '$lib/server/static-paths';

export const GET: RequestHandler = async ({ params, url }) => {
  const db = getDb();

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.firmwareToken, params.token));

  if (!project) error(404, 'Not found');

  const [job] = await db
    .select({ id: compilationJobs.id, completedAt: compilationJobs.completedAt })
    .from(compilationJobs)
    .where(
      and(
        eq(compilationJobs.projectId, project.id),
        eq(compilationJobs.status, 'completed'),
        eq(compilationJobs.published, true),
      ),
    )
    .orderBy(desc(compilationJobs.completedAt));

  if (!job) error(404, 'No published firmware');

  const binPath = join(getStaticBuildsDir(), `${job.id}.bin`);
  if (!existsSync(binPath)) error(404, 'Binary not found');

  const firmwareBytes = readFileSync(binPath);
  const md5 = createHash('md5').update(firmwareBytes).digest('hex');
  const firmwarePath = `${url.origin}/api/firmware/${params.token}`;

  return json({
    name: 'ESPHome Designer Firmware',
    version: job.id,
    builds: [
      {
        chipFamily: 'ESP32-S3',
        ota: {
          md5,
          path: firmwarePath,
          release_url: firmwarePath,
        },
      },
    ],
  });
};
