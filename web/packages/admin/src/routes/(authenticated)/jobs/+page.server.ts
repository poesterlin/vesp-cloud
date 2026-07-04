import { getDb } from "@vesp-cloud/db";
import { compilationJobs } from "@vesp-cloud/db/schema";
import { eq, desc } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ url }) => {
  const db = getDb(env.DATABASE_URL);
  const filter = url.searchParams.get("status") || "";

  let jobs;
  if (filter) {
    jobs = await db
      .select()
      .from(compilationJobs)
      .where(eq(compilationJobs.status, filter))
      .orderBy(desc(compilationJobs.createdAt))
      .limit(100);
  } else {
    jobs = await db
      .select()
      .from(compilationJobs)
      .orderBy(desc(compilationJobs.createdAt))
      .limit(100);
  }

  return { jobs, filter };
}
