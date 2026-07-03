import { getDb } from '@esphome-designer/db';
import { feedbackEntries } from '@esphome-designer/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { validateForm } from '$lib/server/form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.user) {
    redirect(302, '/login');
  }

  const db = getDb();
  const rows = await db
    .select({
      id: feedbackEntries.id,
      message: feedbackEntries.message,
      adminReply: feedbackEntries.adminReply,
      createdAt: feedbackEntries.createdAt,
      repliedAt: feedbackEntries.repliedAt,
    })
    .from(feedbackEntries)
    .where(eq(feedbackEntries.userId, locals.user.id))
    .orderBy(desc(feedbackEntries.createdAt));

  return {
    entries: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      repliedAt: row.repliedAt?.toISOString() ?? null,
    })),
  };
};

export const actions: Actions = {
  submit: validateForm(
    z.object({
      message: z.string().trim().min(3).max(2000),
    }),
    async (event, form) => {
      if (!event.locals.user) {
        return fail(401, { message: 'Unauthorized' });
      }

      const db = getDb();
      await db.insert(feedbackEntries).values({
        userId: event.locals.user.id,
        message: form.message,
      });

      return { success: true };
    },
  ),
};
