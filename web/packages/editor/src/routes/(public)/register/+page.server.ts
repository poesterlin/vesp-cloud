import * as auth from '$lib/server/auth';
import { getDb } from '@vesp-cloud/db';
import * as table from '@vesp-cloud/db/schema';
import { generateId, getSafeRedirectPath } from '$lib/server/util';
import { hash } from '@node-rs/argon2';
import { error, fail, redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { validateForm } from '$lib/server/form';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { TERMS_VERSION } from '$lib/terms';
import { consumeRateLimit } from '$lib/server/rate-limit';
import type { Actions, PageServerLoad } from './$types';

const requireTermsAcceptance = dev || env.APP_EDITION === 'cloud';

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
      email: z.string().email('Enter a valid email address').trim().transform((value) => value.toLowerCase()).optional().nullable(),
      password: z.string()
        .min(8, 'Password must be at least 8 characters')
        .max(255, 'Password must be 255 characters or fewer')
        .regex(/[a-zA-Z]/, 'Password must contain at least one letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
      acceptTerms: z.string().optional(),
      termsVersion: z.string().optional(),
      redirectTo: z.string().optional().nullable(),
    }),
    async (event, form) => {
      const { username, password, email, acceptTerms, termsVersion, redirectTo } = form;

      const rateLimit = consumeRateLimit(`register:${event.getClientAddress()}`, {
        limit: 5,
        windowMs: 60 * 60_000,
      });
      if (!rateLimit.allowed) {
        event.setHeaders({ 'Retry-After': String(rateLimit.retryAfterSeconds) });
        error(429, 'Too many registration attempts. Please try again later.');
      }

      if (
        requireTermsAcceptance &&
        (acceptTerms !== 'accepted' || termsVersion !== TERMS_VERSION)
      ) {
        return fail(400, {
          errors: [{ path: ['acceptTerms'], message: 'You must accept the General Terms and Conditions' }],
          message: 'Please correct the highlighted field',
        });
      }

      const userId = generateId();
      const passwordHash = await hash(password, {
        memoryCost: 65536,
        timeCost: 3,
        outputLen: 32,
        parallelism: 1,
      });

      const db = getDb();
      const sessionToken = auth.generateSessionToken();
      const session = auth.createSessionRecord(sessionToken, userId);
      try {
        await db.transaction(async (tx) => {
          await tx.insert(table.usersTable).values({
            id: userId,
            email: email ?? null,
            createdAt: new Date(),
            lastLogin: new Date(),
            username,
            passwordHash,
          });
          await tx.insert(table.sessionTable).values(session);
          await tx.insert(table.creditBalances).values({ userId, balance: 0 });
        });
        auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);
      } catch (e) {
        if (isUniqueConstraintError(e, 'user_username_unique')) {
          return fail(409, {
            errors: [{ path: ['username'], message: 'Username is already taken' }],
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
