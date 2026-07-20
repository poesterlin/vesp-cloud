import { getDb } from '@vesp-cloud/db';
import { feedbackEntries, usersTable } from '@vesp-cloud/db/schema';
import { env } from '$env/dynamic/private';
import { fail } from '@sveltejs/kit';
import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const db = getDb(env.DATABASE_URL);

  const entries = await db
    .select({
      id: feedbackEntries.id,
      userId: feedbackEntries.userId,
      username: usersTable.username,
      email: usersTable.email,
      message: feedbackEntries.message,
      attachmentName: feedbackEntries.attachmentName,
      attachmentType: feedbackEntries.attachmentType,
      attachmentSize: feedbackEntries.attachmentSize,
      adminReply: feedbackEntries.adminReply,
      createdAt: feedbackEntries.createdAt,
      repliedAt: feedbackEntries.repliedAt,
    })
    .from(feedbackEntries)
    .leftJoin(usersTable, eq(feedbackEntries.userId, usersTable.id))
    .orderBy(desc(feedbackEntries.createdAt));

  return {
    entries: entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      repliedAt: entry.repliedAt?.toISOString() ?? null,
    })),
  };
};

export const actions: Actions = {
  reply: async ({ request }) => {
    const form = await request.formData();
    const id = form.get('id');
    const reply = form.get('reply');

    if (typeof id !== 'string' || !id) {
      return fail(400, { message: 'Missing feedback id' });
    }
    if (typeof reply !== 'string' || reply.trim().length < 2) {
      return fail(400, { message: 'Reply must be at least 2 characters.' });
    }
    if (reply.trim().length > 2000) {
      return fail(400, { message: 'Reply is too long.' });
    }

    const db = getDb(env.DATABASE_URL);
    const [updated] = await db
      .update(feedbackEntries)
      .set({
        adminReply: reply.trim(),
        repliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(feedbackEntries.id, id), isNull(feedbackEntries.adminReply)))
      .returning({ id: feedbackEntries.id });

    if (!updated) {
      return fail(400, { message: 'Feedback already replied to or not found.' });
    }

    return { success: true };
  },
};
