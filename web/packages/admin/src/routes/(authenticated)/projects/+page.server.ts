import { getDb } from "@vesp-cloud/db";
import { usersTable, projects, compilationJobs } from "@vesp-cloud/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const db = getDb(env.DATABASE_URL);

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      userId: projects.userId,
      username: usersTable.username,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      firmwareToken: projects.firmwareToken,
    })
    .from(projects)
    .leftJoin(usersTable, eq(projects.userId, usersTable.id))
    .orderBy(desc(projects.updatedAt));

  const jobRows = await db
    .select({
      projectId: compilationJobs.projectId,
      status: compilationJobs.status,
      createdAt: compilationJobs.createdAt,
    })
    .from(compilationJobs)
    .where(sql`${compilationJobs.projectId} IS NOT NULL`)
    .orderBy(desc(compilationJobs.createdAt));

  const jobMap = new Map<string, { count: number; lastStatus: string | null; lastCreatedAt: Date | null }>();
  for (const j of jobRows) {
    if (!j.projectId) continue;
    const existing = jobMap.get(j.projectId);
    if (!existing) {
      jobMap.set(j.projectId, { count: 1, lastStatus: j.status, lastCreatedAt: j.createdAt });
    } else {
      existing.count++;
    }
  }

  return {
    projects: projectRows.map((p) => {
      const jobInfo = jobMap.get(p.id);
      return {
        ...p,
        jobCount: jobInfo?.count ?? 0,
        lastJobStatus: jobInfo?.lastStatus ?? null,
        lastJobAt: jobInfo?.lastCreatedAt ?? null,
      };
    }),
  };
};
