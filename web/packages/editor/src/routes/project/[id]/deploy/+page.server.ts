import { error } from '@sveltejs/kit';
import { loadProjectPage } from '$lib/server/project-loader';
import type { PageServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { getDb } from '@vesp-cloud/db';
import { feedbackEntries } from '@vesp-cloud/db/schema';
import { eq } from 'drizzle-orm';

const IS_CLOUD = env.APP_EDITION === 'cloud';

export const load: PageServerLoad = async ({ locals, params }) => {
	if (!locals.user) error(401);

	const { row, activeJob } = await loadProjectPage(locals.user.id, params.id);
	const feedback = await getDb()
		.select({ id: feedbackEntries.id })
		.from(feedbackEntries)
		.where(eq(feedbackEntries.userId, locals.user.id))
		.limit(1);

	return {
		isCloud: IS_CLOUD,
		project: {
			id: row.id,
			name: row.name,
			data: row.data,
		},
		lastSavedData: row.lastSavedData ?? null,
		activeJob,
		hasSubmittedFeedback: feedback.length > 0,
	};
};
