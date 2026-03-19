import * as auth from '$lib/server/auth';
import { getDb } from '$lib/db';
import * as table from '$lib/db/schema';
import { validatePassword, validateUsername } from '$lib/server/util';
import { verify } from '@node-rs/argon2';
import { fail, redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

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

    const db = getDb();
    const results = await db
      .select()
      .from(table.usersTable)
      .where(eq(table.usersTable.username, username));

    const existingUser = results.at(0);
    if (!existingUser) {
      return fail(400, { message: 'Invalid username or password' });
    }

    const validPassword = await verify(existingUser.passwordHash, password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });
    if (!validPassword) {
      return fail(400, { message: 'Invalid username or password' });
    }

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
