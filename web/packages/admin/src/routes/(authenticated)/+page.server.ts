import { getDb } from "@esphome-designer/db";
import { usersTable, compilationJobs, creditBalances } from "@esphome-designer/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import { env } from "$env/dynamic/private";

export async function load() {
  const db = getDb(env.DATABASE_URL);

  const [userCount] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [creditTotal] = await db.select({ total: sql<number>`coalesce(sum(balance), 0)::int` }).from(creditBalances);

  const statusCounts = await db
    .select({ status: compilationJobs.status, count: sql<number>`count(*)::int` })
    .from(compilationJobs)
    .groupBy(compilationJobs.status);

  const counts: Record<string, number> = {};
  for (const row of statusCounts) {
    if (row.status) counts[row.status] = row.count;
  }

  const recentJobs = await db
    .select()
    .from(compilationJobs)
    .orderBy(desc(compilationJobs.createdAt))
    .limit(5);

  return {
    userCount: userCount?.count ?? 0,
    creditTotal: creditTotal?.total ?? 0,
    jobCounts: {
      pending: counts.pending ?? 0,
      running: counts.running ?? 0,
      completed: counts.completed ?? 0,
      failed: counts.failed ?? 0,
    },
    recentJobs,
  };
}
