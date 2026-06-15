import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '@esphome-designer/db';
import { projects, compilationJobs } from '@esphome-designer/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { ensureS3, factoryBinKey } from '$lib/server/s3';
import { createLogger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ params }) => {
  const db = getDb();
  const logger = createLogger(params.token);

  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.firmwareToken, params.token));

  if (!project) {
    logger.warn('factory firmware request rejected: token not found');
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
    logger.warn(`factory firmware request rejected: no published firmware for project="${project.name}"`);
    error(404, 'No published firmware');
  }

  const s3 = ensureS3();
  const s3File = s3.file(factoryBinKey(job.id));
  if (!(await s3File.exists())) {
    logger.warn(`factory firmware request rejected: S3 factory binary missing for job=${job.id}`);
    error(404, 'Factory binary not found');
  }

  const { size } = await s3File.stat();
  logger.info(`serving factory firmware: project="${project.name}" size=${size}`);

  const deviceName = project.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  return new Response(s3File.stream(), {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${deviceName}-factory.bin"`,
      'Content-Length': String(size),
      'Cache-Control': 'no-store',
    },
  });
};
