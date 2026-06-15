import { getDb } from "@esphome-designer/db";
import { compilationJobs } from "@esphome-designer/db/schema";
import { eq } from "drizzle-orm";
import { env } from "$env/dynamic/private";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const db = getDb(env.DATABASE_URL);

  const [job] = await db
    .select()
    .from(compilationJobs)
    .where(eq(compilationJobs.id, params.id));

  return { job };
};
