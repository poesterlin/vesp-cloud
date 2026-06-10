import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db';
import { projects, compilationJobs } from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getBinaryStats } from '$lib/server/s3';
import { createLogger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ params, url, request }) => {
  const db = getDb();
  const logger = createLogger(params.token);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  logger.info(`manifest request: path=${url.pathname} device="${userAgent}"`);

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.firmwareToken, params.token));

  if (!project) {
    logger.warn('manifest request rejected: token not found');
    error(404, 'Not found');
  }

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

  if (!job) {
    logger.warn(`manifest request rejected: no published firmware for project=${project.id}`);
    error(404, 'No published firmware');
  }

  const { size, md5 } = await getBinaryStats(job.id);
  logger.info(`manifest check: projectId=${project.id} device="${userAgent}" size=${size}`);

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
