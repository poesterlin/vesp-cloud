import * as auth from '$lib/server/auth';
import { getDb } from '$lib/db';
import * as table from '$lib/db/schema';
import { validatePassword, validateUsername } from '$lib/server/util';
import { verify } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { checkLoginRate } from '$lib/server/login-limiter';
import type { Actions, PageServerLoad } from './$types';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export const load: PageServerLoad = async (event) => {
  if (event.locals.user) {
    return redirect(302, '/');
  }
  return {};
};

export const actions: Actions = {
  login: async (event) => {
    const form = await event.request.formData();
    const username = form.get('username') as string;
    const password = form.get('password') as string;
    const redirectTo = form.get('redirect') as string | null;

    if (!validateUsername(username)) {
      return fail(400, { message: 'Invalid username' });
    }
    if (!validatePassword(password)) {
      return fail(400, { message: 'Invalid password' });
    }

    const ip = event.getClientAddress();
    if (!checkLoginRate(ip)) {
      return fail(429, { message: 'Too many login attempts. Please try again later.' });
    }

    const db = getDb();
    const results = await db
      .select()
      .from(table.usersTable)
      .where(eq(table.usersTable.username, username));

    const existingUser = results.at(0);
    if (!existingUser) {
      return fail(400, { message: 'Invalid username or password' });
    }

    if (existingUser.lockedUntil && existingUser.lockedUntil.getTime() > Date.now()) {
      const remainingMinutes = Math.ceil(
        (existingUser.lockedUntil.getTime() - Date.now()) / 60_000,
      );
      return fail(423, {
        message: `Account locked. Try again in ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}.`,
      });
    }

    const validPassword = await verify(existingUser.passwordHash, password, {
      memoryCost: 65536,
      timeCost: 3,
      outputLen: 32,
      parallelism: 1,
    });
    if (!validPassword) {
      const newFailures = (existingUser.failedLoginAttempts ?? 0) + 1;
      const lockedUntil =
        newFailures >= MAX_FAILED_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
          : null;

      await db
        .update(table.usersTable)
        .set({ failedLoginAttempts: newFailures, lockedUntil })
        .where(eq(table.usersTable.id, existingUser.id));

      const message =
        newFailures >= MAX_FAILED_ATTEMPTS
          ? `Account locked for ${LOCKOUT_MINUTES} minutes due to too many failed attempts.`
          : 'Invalid username or password';

      return fail(400, { message });
    }

    await db
      .update(table.usersTable)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(table.usersTable.id, existingUser.id));

    const sessionToken = auth.generateSessionToken();
    const session = await auth.createSession(sessionToken, existingUser.id);
    auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

    await db
      .update(table.usersTable)
      .set({ lastLogin: new Date() })
      .where(eq(table.usersTable.id, existingUser.id));

    return redirect(302, redirectTo || '/');
  },
};
