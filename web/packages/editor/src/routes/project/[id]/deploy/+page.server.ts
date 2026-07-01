import { error } from '@sveltejs/kit';
import { loadProjectPage } from '$lib/server/project-loader';
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';

const IS_CLOUD = env.APP_EDITION === 'cloud';
const SCREENSHOT_DEBUG_ENABLED = env.SCREENSHOT_DEBUG_ENABLED === '1' || env.SCREENSHOT_DEBUG_ENABLED === 'true';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) error(401);

	const { row, activeJob } = await loadProjectPage(locals.user.id, params.id);

	return {
		isCloud: IS_CLOUD,
		screenshotDebugEnabled: SCREENSHOT_DEBUG_ENABLED,
		project: {
			id: row.id,
			name: row.name,
			data: row.data,
		},
		lastSavedData: row.lastSavedData ?? null,
		activeJob,
	};
};
