import { getDb } from '@vesp-cloud/db';
import * as table from '@vesp-cloud/db/schema';
import { createPasswordResetToken, getPasswordResetBaseUrl } from '$lib/server/password-reset';
import { sendEmail } from '$lib/server/email';
import { AccountRecoveryEmail, Renderer, toPlainText } from '@vesp-cloud/email';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { validateForm } from '$lib/server/form';
import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { consumeRateLimit } from '$lib/server/rate-limit';

const renderer = new Renderer();

export const load: PageServerLoad = async () => {
  return {};
};

export const actions: Actions = {
  requestReset: validateForm(
    z.object({
      email: z.email().trim().transform((value) => value.toLowerCase()),
    }),
    async (event, form) => {
      const rateLimit = consumeRateLimit(`password-reset:${event.getClientAddress()}`, {
        limit: 5,
        windowMs: 15 * 60_000,
      });
      if (!rateLimit.allowed) {
        event.setHeaders({ 'Retry-After': String(rateLimit.retryAfterSeconds) });
        return fail(429, { message: 'Too many password reset attempts. Please try again later.' });
      }

      const db = getDb();
      const user = await db
        .select({
          id: table.usersTable.id,
          username: table.usersTable.username,
          email: table.usersTable.email,
        })
        .from(table.usersTable)
        .where(eq(table.usersTable.email, form.email))
        .then((rows) => rows.at(0));

      if (user) {
        const { token } = await createPasswordResetToken(user.id);
        const resetUrl = new URL('/reset-password', getPasswordResetBaseUrl(event.url.origin));
        resetUrl.searchParams.set('token', token);

        try {
          const html = await renderer.render(AccountRecoveryEmail, {
            props: {
              appName: 'vESP.cloud',
              recipient: user.username,
              recoveryUrl: resetUrl.toString(),
              expiresIn: '1 hour',
            },
          });

          await sendEmail({
            to: user.email,
            subject: 'Reset your vESP.cloud password',
            html,
            text: toPlainText(html),
          });
        } catch (error) {
          console.error('Password reset email failed:', error);
        }
      }

      return { message: 'If an account exists for that email, a reset link has been sent.' };
    },
  ),
};
