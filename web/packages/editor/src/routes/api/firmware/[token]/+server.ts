import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/db';
import { projects, compilationJobs } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { existsSync, createReadStream, statSync } from 'fs';
import { join } from 'path';

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
    );

  if (!job) error(404, 'No published firmware');

  const binPath = join(process.cwd(), 'static', 'builds', `${job.id}.bin`);
  if (!existsSync(binPath)) error(404, 'Binary not found');

  // Use job ID as the ETag / version identifier
  const etag = `"${job.id}"`;
  const version = job.completedAt?.toISOString() ?? job.id;

  // Support conditional requests — device can skip download if already up to date
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304 });
  }

  const { size } = statSync(binPath);
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
