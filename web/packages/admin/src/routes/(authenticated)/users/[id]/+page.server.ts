import { getDb } from "@vesp-cloud/db";
import { usersTable, projects, compilationJobs, creditBalances, creditTransactions } from "@vesp-cloud/db/schema";
import { eq, desc } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const db = getDb(env.DATABASE_URL);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, params.id));
  if (!user) return { user: null };

  const [balance] = await db.select().from(creditBalances).where(eq(creditBalances.userId, params.id));

  const userProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.userId, params.id))
    .orderBy(desc(projects.updatedAt));

  const transactions = await db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, params.id))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(20);

  const jobs = await db
    .select()
    .from(compilationJobs)
    .where(eq(compilationJobs.userId, params.id))
    .orderBy(desc(compilationJobs.createdAt))
    .limit(20);

  return {
    user,
    balance: balance?.balance ?? 0,
    projects: userProjects,
    transactions,
    jobs,
  };
};
