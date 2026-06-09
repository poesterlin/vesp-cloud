import { json, error } from '@sveltejs/kit';
import { existsSync } from 'fs';
import { join } from 'path';
import { getStaticBuildsDir } from '$lib/server/static-paths';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const { jobId } = params;

	const binPath = join(getStaticBuildsDir(), `${jobId}.bin`);
	if (!existsSync(binPath)) {
		throw error(404, 'Firmware binary not found');
	}

	const manifest = {
		name: 'ESP32 Firmware',
		version: new Date().toISOString().split('T')[0],
		new_install_prompt_erase: true,
		builds: [
			{
				chipFamily: 'ESP32-S3',
				parts: [{ path: `/api/builds/${jobId}`, offset: 0 }]
			}
		]
	};

	return json(manifest);
};
