import { getDb } from '@vesp-cloud/db';
import { feedbackEntries } from '@vesp-cloud/db/schema';
import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { ensureS3 } from '$lib/server/s3';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params }) => {
  if (!locals.user) error(401, 'Unauthorized');

  const [entry] = await getDb()
    .select({ key: feedbackEntries.attachmentKey, type: feedbackEntries.attachmentType })
    .from(feedbackEntries)
    .where(and(eq(feedbackEntries.id, params.id), eq(feedbackEntries.userId, locals.user.id)))
    .limit(1);

  if (!entry?.key || !entry.type) error(404, 'Attachment not found');
  const file = ensureS3().file(entry.key);
  if (!(await file.exists())) error(404, 'Attachment not found');

  return new Response(file.stream(), {
    headers: {
      'Content-Type': entry.type,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
