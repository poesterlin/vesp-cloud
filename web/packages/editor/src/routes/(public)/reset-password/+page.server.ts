import * as auth from '$lib/server/auth';
import { consumePasswordResetToken } from '$lib/server/password-reset';
import { getDb } from '@vesp-cloud/db';
import * as table from '@vesp-cloud/db/schema';
import { hash } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { validateForm } from '$lib/server/form';
import type { Actions, PageServerLoad } from './$types';

const RESET_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}=?$/;
const tokenSchema = z.object({ token: z.string().regex(RESET_TOKEN_PATTERN) });

export const load: PageServerLoad = async (event) => {
  const parsed = tokenSchema.safeParse(Object.fromEntries(event.url.searchParams));
  if (!parsed.success) {
    return { valid: false, token: null };
  }

  return { valid: true, token: parsed.data.token };
};

export const actions: Actions = {
  resetPassword: validateForm(
    z.object({
      token: z.string().regex(RESET_TOKEN_PATTERN),
      password: z.string().min(8).max(255).regex(/[a-zA-Z]/).regex(/[0-9]/),
    }),
    async (event, form) => {
      const user = await consumePasswordResetToken(form.token);
      if (!user) {
        return fail(400, { message: 'This reset link is invalid or expired.' });
      }

      const passwordHash = await hash(form.password, {
        memoryCost: 65536,
        timeCost: 3,
        outputLen: 32,
        parallelism: 1,
      });

      const db = getDb();
      await db.transaction(async (tx) => {
        await tx
          .update(table.usersTable)
          .set({ passwordHash, failedLoginAttempts: 0, lockedUntil: null })
          .where(eq(table.usersTable.id, user.id));

        await tx.delete(table.passwordResetTokens).where(eq(table.passwordResetTokens.userId, user.id));
      });

      await auth.invalidateUserSessions(user.id);

      return redirect(302, '/login?reset=1');
    },
  ),
};
