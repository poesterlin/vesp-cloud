import { error } from '@sveltejs/kit';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getStaticBuildsDir } from '$lib/server/static-paths';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const { jobId } = params;
  const binPath = join(getStaticBuildsDir(), `${jobId}.bin`);

  if (!existsSync(binPath)) {
    throw error(404, 'Firmware binary not found');
  }

  const firmware = await readFile(binPath);

  return new Response(firmware, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(firmware.byteLength),
      'Cache-Control': 'no-store',
      'Content-Disposition': `attachment; filename="${jobId}.bin"`
    }
  });
};
