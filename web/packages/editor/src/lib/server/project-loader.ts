import { error } from '@sveltejs/kit';
import { getDb } from '@esphome-designer/db';
import { projects, compilationJobs } from '@esphome-designer/db/schema';
import { eq, and, notInArray, desc } from 'drizzle-orm';

const TERMINAL_STATUSES = ['completed', 'failed'];

export async function loadProjectPage(
	userId: string,
	projectId: string,
) {
	const db = getDb();
	const [row] = await db
		.select()
		.from(projects)
		.where(and(eq(projects.id, projectId), eq(projects.userId, userId)));

	if (!row) error(404, 'Project not found');

	const activeJobs = await db
		.select()
		.from(compilationJobs)
		.where(
			and(
				eq(compilationJobs.projectId, projectId),
				eq(compilationJobs.userId, userId),
				notInArray(compilationJobs.status, TERMINAL_STATUSES),
			),
		)
		.orderBy(desc(compilationJobs.createdAt));

	const activeJob = activeJobs[0] ?? null;

	return {
		row,
		activeJob: activeJob
			? {
					id: activeJob.id,
					status: activeJob.status,
					projectName: activeJob.projectName,
					createdAt: activeJob.createdAt,
				}
			: null,
	};
}
