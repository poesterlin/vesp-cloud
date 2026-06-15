import { getDb } from "@esphome-designer/db";
import { usersTable, creditBalances } from "@esphome-designer/db/schema";
import { eq, desc } from "drizzle-orm";
import { env } from "$env/dynamic/private";

export async function load() {
  const db = getDb(env.DATABASE_URL);

  const users = await db
    .select()
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  const balances = await db.select().from(creditBalances);
  const balanceMap = new Map(balances.map((b) => [b.userId, b.balance]));

  return {
    users: users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      credits: balanceMap.get(u.id) ?? 0,
      createdAt: u.createdAt,
      lastLogin: u.lastLogin,
    })),
  };
}
