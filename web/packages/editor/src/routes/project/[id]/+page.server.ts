import { error } from '@sveltejs/kit';
import { loadProjectPage } from '$lib/server/project-loader';
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';

const IS_CLOUD = env.APP_EDITION === 'cloud';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) error(401);

	const { row, activeJob } = await loadProjectPage(locals.user.id, params.id);

	return {
		isCloud: IS_CLOUD,
		project: {
			id: row.id,
			name: row.name,
			data: row.data,
		},
		activeJob,
	};
};
