import type { RequestHandler } from './$types';
import { getBinaryBuffer } from '$lib/server/s3';

export const GET: RequestHandler = async ({ params }) => {
  try {
    return await getBinaryBuffer(params.jobId);
  } catch {
    return new Response('Firmware binary not found', { status: 404 });
  }
};
