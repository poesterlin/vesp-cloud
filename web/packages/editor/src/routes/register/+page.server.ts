import * as auth from '$lib/server/auth';
import { ensureBalanceExists } from '$lib/credits';
import { getDb } from '@vesp-cloud/db';
import * as table from '@vesp-cloud/db/schema';
import { generateId, getSafeRedirectPath, normalizeEmail } from '$lib/server/util';
import { hash } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { validateForm } from '$lib/server/form';
import { sendEmail } from '$lib/server/email';
import { Renderer, toPlainText } from '@vesp-cloud/email';
import AddressValidationEmail from '@vesp-cloud/email/address-validation.svelte';
import type { Actions, PageServerLoad } from './$types';

const renderer = new Renderer();

function isUniqueConstraintError(err: unknown, constraintName: string): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? (err as { code?: unknown }).code : undefined;
  const constraint = 'constraint' in err
    ? (err as { constraint?: unknown }).constraint
    : undefined;
  return code === '23505' && typeof constraint === 'string' && constraint.includes(constraintName);
}

export const load: PageServerLoad = async (event) => {
  if (event.locals.user) {
    return redirect(302, '/');
  }
  return {};
};

export const actions: Actions = {
  register: validateForm(
    z.object({
      username: z.string().trim()
        .min(3, 'Username must be at least 3 characters')
        .max(31, 'Username must be 31 characters or fewer'),
      email: z.email('Enter a valid email address').trim().transform((value) => value.toLowerCase()),
      password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(255, 'Password must be 255 characters or fewer')
        .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
      redirectTo: z.string().optional().nullable(),
    }),
    async (event, form) => {
      const { username, password, email, redirectTo } = form;

      const userId = generateId();
      const passwordHash = await hash(password, {
        memoryCost: 65536,
        timeCost: 3,
        outputLen: 32,
        parallelism: 1,
      });

      const db = getDb();
      try {
        await db.insert(table.usersTable).values({
          id: userId,
          email: normalizeEmail(email),
          createdAt: new Date(),
          lastLogin: new Date(),
          username,
          passwordHash,
        });

        const sessionToken = auth.generateSessionToken();
        const session = await auth.createSession(sessionToken, userId);
        auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

        await ensureBalanceExists(userId);

        try {
          const recipient = normalizeEmail(email);
          const html = await renderer.render(AddressValidationEmail, {
            props: {
              appName: 'vESP.cloud',
              recipient: username,
              verificationUrl: event.url.origin,
            },
          });

          const welcomeResult = await sendEmail({
            to: recipient,
            subject: 'Confirm your vESP.cloud email address',
            html,
            text: toPlainText(html),
          });

          if (welcomeResult.skipped) {
            console.log('Registration email skipped because Resend is not configured');
          }
        } catch (error) {
          console.error('Registration email failed:', error);
        }
      } catch (e) {
        if (isUniqueConstraintError(e, 'user_username_unique')) {
          return fail(409, {
            errors: [{ path: ['username'], message: 'Username is already taken' }],
            message: 'Please correct the highlighted field',
          });
        }
        if (isUniqueConstraintError(e, 'user_email_unique')) {
          return fail(409, {
            errors: [{ path: ['email'], message: 'An account already uses this email address' }],
            message: 'Please correct the highlighted field',
          });
        }
        console.error('Registration error:', e);
        return fail(500, { message: 'An error occurred during registration' });
      }

      return redirect(302, getSafeRedirectPath(redirectTo, event.url));
    },
  ),
};
