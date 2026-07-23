import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getBinaryBuffer } from '$lib/server/s3';
import { getJobStatus } from '$lib/utils/worker';

export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.user) throw error(401);

  const job = await getJobStatus(params.jobId);
  if (!job || job.userId !== locals.user.id || job.status !== 'completed') {
    throw error(404, 'Firmware binary not found');
  }

  try {
    return await getBinaryBuffer(params.jobId);
  } catch {
    return new Response('Firmware binary not found', { status: 404 });
  }
};
