import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { getDb } from "@vesp-cloud/db";
import * as table from "@vesp-cloud/db/schema";
import * as auth from "$lib/server/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validateForm } from "$lib/server/form";
import { deleteBinaries } from "$lib/server/s3";

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    return {
      user: null,
    };
  }

  const db = getDb();
  const result = await db
    .select({
      id: table.usersTable.id,
      username: table.usersTable.username,
      email: table.usersTable.email,
      createdAt: table.usersTable.createdAt,
      lastLogin: table.usersTable.lastLogin,
    })
    .from(table.usersTable)
    .where(eq(table.usersTable.id, locals.user.id));

  return {
    user: result.at(0) ?? null,
  };
};

export const actions: Actions = {
  deleteAccount: validateForm(
    z.object({
      confirmUsername: z.string().trim().min(1),
      confirmPhrase: z.literal("DELETE"),
    }),
    async (event, form) => {
      if (!event.locals.user) {
        return fail(401, { deleteError: "Unauthorized" });
      }

      const { confirmUsername, confirmPhrase } = form;

      if (confirmUsername !== event.locals.user.username) {
        return fail(400, {
          deleteError: "Username does not match your account.",
        });
      }

      if (confirmPhrase !== "DELETE") {
        return fail(400, {
          deleteError: "Confirmation phrase must be exactly DELETE.",
        });
      }

      const db = getDb();
      const userId = event.locals.user.id;

      const jobs = await db
        .select({ id: table.compilationJobs.id })
        .from(table.compilationJobs)
        .where(eq(table.compilationJobs.userId, userId));

      if (jobs.length > 0) {
        await deleteBinaries(jobs.map((j) => j.id));
      }

      await db.transaction(async (tx) => {
        await tx.delete(table.compilationJobs).where(eq(table.compilationJobs.userId, userId));
        await tx.delete(table.creditTransactions).where(eq(table.creditTransactions.userId, userId));
        await tx.delete(table.creditBalances).where(eq(table.creditBalances.userId, userId));
        await tx.delete(table.stripeCustomers).where(eq(table.stripeCustomers.userId, userId));

        const deleted = await tx
          .delete(table.usersTable)
          .where(eq(table.usersTable.id, userId))
          .returning({ id: table.usersTable.id });

        if (deleted.length === 0) {
          throw new Error("Account deletion failed");
        }
      });

      auth.deleteSessionTokenCookie(event);
      redirect(302, "/register?deleted=1");
    },
  ),
};
