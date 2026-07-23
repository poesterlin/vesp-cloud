import { getDb } from "@vesp-cloud/db";
import { usersTable, projects, compilationJobs } from "@vesp-cloud/db/schema";
import { eq, desc } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import { getBinarySize } from "$lib/server/s3";
import type { PageServerLoad } from "./$types";

function formatBytes(bytes: number): string {
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

export const load: PageServerLoad = async ({ params }) => {
  const db = getDb(env.DATABASE_URL);

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.id));

  if (!project) return { project: null };

  const [user] = await db
    .select({ username: usersTable.username })
    .from(usersTable)
    .where(eq(usersTable.id, project.userId));

  const jobs = await db
    .select()
    .from(compilationJobs)
    .where(eq(compilationJobs.projectId, params.id))
    .orderBy(desc(compilationJobs.createdAt))
    .limit(50);

  const enrichedJobs = await Promise.all(
    jobs.map(async (j) => {
      if (j.status !== 'completed') return { ...j, binarySizeFormatted: null };
      const size = await getBinarySize(j.id);
      return { ...j, binarySizeFormatted: size ? formatBytes(size) : null };
    }),
  );

  return {
    project: {
      ...project,
      data: project.data as Record<string, unknown>,
      lastSavedData: project.lastSavedData as Record<string, unknown> | null,
    },
    username: user?.username ?? null,
    jobs: enrichedJobs,
  };
};
