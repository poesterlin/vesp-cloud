import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db';
import { projects, compilationJobs } from '$lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { existsSync, createReadStream, statSync } from 'fs';
import { join } from 'path';
import { getStaticBuildsDir } from '$lib/server/static-paths';
import { createLogger } from '$lib/server/logger';

export const GET: RequestHandler = async ({ params, request }) => {
  const db = getDb();

  // Look up project by firmware token
  const [project] = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .where(eq(projects.firmwareToken, params.token));

  if (!project) error(404, 'Not found');

  // Find the published build for this project
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

  // Use job ID as the ETag / version identifier
  const etag = `"${job.id}"`;
  const version = job.completedAt?.toISOString() ?? job.id;

  const logger = createLogger(params.token);
  const ifNoneMatch = request.headers.get('if-none-match');
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  logger.info(`update check: project="${project.name}" device="${userAgent}" etag=${ifNoneMatch ?? 'none'} current=${job.id}`);

  if (ifNoneMatch === etag) {
    logger.info(`up to date: project="${project.name}"`);
    return new Response(null, { status: 304 });
  }

  const { size } = statSync(binPath);
  logger.info(`serving update: project="${project.name}" size=${size}`);
  const stream = createReadStream(binPath);
  const webStream = new ReadableStream({
    start(controller) {
      stream.on('data', (chunk) => controller.enqueue(chunk));
      stream.on('end', () => controller.close());
      stream.on('error', (err) => controller.error(err));
    },
  });

  return new Response(webStream, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="firmware.bin"`,
      'Content-Length': String(size),
      'ETag': etag,
      'X-Esphome-Current-Version': version,
    },
  });
};
