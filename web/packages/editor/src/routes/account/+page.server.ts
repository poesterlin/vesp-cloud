import { fail, redirect } from "@sveltejs/kit";
import type { Actions, PageServerLoad } from "./$types";
import { getDb } from "@vesp-cloud/db";
import * as table from "@vesp-cloud/db/schema";
import * as auth from "$lib/server/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { validateForm } from "$lib/server/form";
import { deleteBinaries } from "$lib/server/s3";
import { normalizeEmail } from "$lib/server/util";
import { createEmailVerificationToken, getEmailVerificationBaseUrl } from "$lib/server/email-verification";
import { isEmailConfigured, sendEmail } from "$lib/server/email";
import { AddressValidationEmail, Renderer, toPlainText } from "@vesp-cloud/email";

const renderer = new Renderer();

function isEmailUniqueConstraintError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  const constraint = "constraint" in error ? (error as { constraint?: unknown }).constraint : undefined;
  return code === "23505" && typeof constraint === "string" && constraint.includes("user_email_unique");
}

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
      emailVerifiedAt: table.usersTable.emailVerifiedAt,
    })
    .from(table.usersTable)
    .where(eq(table.usersTable.id, locals.user.id));

  return {
    user: result.at(0) ?? null,
  };
};

export const actions: Actions = {
  updateEmail: validateForm(
    z.object({
      email: z.email("Enter a valid email address").trim().transform((value) => normalizeEmail(value)),
    }),
    async (event, form) => {
      if (!event.locals.user) return fail(401, { emailError: "Unauthorized" });

      const db = getDb();
      try {
        const currentEmail = await db
          .select({ email: table.usersTable.email })
          .from(table.usersTable)
          .where(eq(table.usersTable.id, event.locals.user.id))
          .then((rows) => rows.at(0)?.email);

        if (!currentEmail) return fail(404, { emailError: "Account not found." });
        if (currentEmail === form.email) {
          return { emailMessage: "Your email address is unchanged." };
        }

        await db.transaction(async (tx) => {
          await tx
            .update(table.usersTable)
            .set({ email: form.email, emailVerifiedAt: null })
            .where(eq(table.usersTable.id, event.locals.user!.id));
          await tx
            .delete(table.emailVerificationTokens)
            .where(eq(table.emailVerificationTokens.userId, event.locals.user!.id));
        });
      } catch (error) {
        if (isEmailUniqueConstraintError(error)) {
          return fail(409, { emailError: "An account already uses this email address." });
        }
        console.error("Email update failed:", error);
        return fail(500, { emailError: "Could not update your email address." });
      }

      return { emailMessage: "Email address updated. Verification is optional." };
    },
  ),

  requestEmailVerification: validateForm(z.object({}), async (event) => {
    if (!event.locals.user) return fail(401, { verificationError: "Unauthorized" });
    if (!isEmailConfigured()) {
      return fail(503, { verificationError: "Email delivery is not configured." });
    }

    const db = getDb();
    const user = await db
      .select({
        id: table.usersTable.id,
        username: table.usersTable.username,
        email: table.usersTable.email,
        emailVerifiedAt: table.usersTable.emailVerifiedAt,
      })
      .from(table.usersTable)
      .where(eq(table.usersTable.id, event.locals.user.id))
      .then((rows) => rows.at(0));

    if (!user) return fail(404, { verificationError: "Account not found." });
    if (user.emailVerifiedAt) return { verificationMessage: "Your email address is already verified." };

    try {
      const { token } = await createEmailVerificationToken(user.id, user.email);
      const verificationUrl = new URL("/verify-email", getEmailVerificationBaseUrl(event.url.origin));
      verificationUrl.searchParams.set("token", token);
      const html = await renderer.render(AddressValidationEmail, {
        props: {
          appName: "vESP.cloud",
          recipient: user.username,
          verificationUrl: verificationUrl.toString(),
          expiresIn: "10 minutes",
        },
      });

      await sendEmail({
        to: user.email,
        subject: "Confirm your vESP.cloud email address",
        html,
        text: toPlainText(html),
      });
    } catch (error) {
      console.error("Email verification request failed:", error);
      return fail(500, { verificationError: "Could not send the verification email." });
    }

    return { verificationMessage: `Verification email sent to ${user.email}.` };
  }),

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
