import * as auth from '$lib/server/auth';
import { getDb } from '$lib/db';
import * as table from '$lib/db/schema';
import { generateId, validatePassword, validateUsername } from '$lib/server/util';
import { hash } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { ensureBalanceExists } from '$lib/credits';

export const load: PageServerLoad = async (event) => {
  if (event.locals.user) {
    return redirect(302, '/');
  }
  return {};
};

export const actions: Actions = {
  register: async (event) => {
    const form = await event.request.formData();
    const username = form.get('username') as string;
    const password = form.get('password') as string;
    const email = form.get('email') as string | null;
    const redirectTo = form.get('redirect') as string | null;

    if (!validateUsername(username)) {
      return fail(400, { message: 'Username must be 3-31 characters' });
    }
    if (!validatePassword(password)) {
      return fail(400, { message: 'Password must be 6-255 characters' });
    }

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
        email: email || undefined,
        createdAt: new Date(),
        lastLogin: new Date(),
        username,
        passwordHash,
      });

      const sessionToken = auth.generateSessionToken();
      const session = await auth.createSession(sessionToken, userId);
      auth.setSessionTokenCookie(event, sessionToken, session.expiresAt);

      await ensureBalanceExists(userId);
    } catch {
      return fail(500, { message: 'Username already taken or server error' });
    }

    return redirect(302, redirectTo || '/');
  },
};
