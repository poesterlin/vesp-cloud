import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '@esphome-designer/db';
import { projects, compilationJobs } from '@esphome-designer/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ensureS3, otaBinKey } from '$lib/server/s3';
import { createLogger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ params, request, url }) => {
  const db = getDb();
  const logger = createLogger(params.token);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  const ifNoneMatch = request.headers.get('if-none-match');

  logger.info(`firmware request: path=${url.pathname} device="${userAgent}" etag=${ifNoneMatch ?? 'none'}`);

  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.firmwareToken, params.token));

  if (!project) {
    logger.warn('firmware request rejected: token not found');
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
    logger.warn(`firmware request rejected: no published firmware for project="${project.name}"`);
    error(404, 'No published firmware');
  }

  const s3 = ensureS3();
  const s3File = s3.file(otaBinKey(job.id));
  if (!(await s3File.exists())) {
    logger.warn(`firmware request rejected: S3 OTA binary missing for job=${job.id}`);
    error(404, 'OTA binary not found');
  }

  const etag = `"${job.id}"`;
  const version = job.completedAt?.toISOString() ?? job.id;

  logger.info(`update check: project="${project.name}" device="${userAgent}" etag=${ifNoneMatch ?? 'none'} current=${job.id}`);

  if (ifNoneMatch === etag) {
    logger.info(`up to date: project="${project.name}"`);
    return new Response(null, { status: 304 });
  }

  const { size } = await s3File.stat();
  logger.info(`serving update: project="${project.name}" size=${size}`);

  return new Response(s3File.stream(), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="firmware.bin"`,
      'Content-Length': String(size),
      'ETag': etag,
      'X-Esphome-Current-Version': version,
      'Cache-Control': 'no-store',
    },
  });
};
