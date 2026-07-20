import { getDb } from '@vesp-cloud/db';
import { feedbackEntries } from '@vesp-cloud/db/schema';
import { env } from '$env/dynamic/private';
import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { ensureS3 } from '$lib/server/s3';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const [entry] = await getDb(env.DATABASE_URL)
    .select({ key: feedbackEntries.attachmentKey, type: feedbackEntries.attachmentType })
    .from(feedbackEntries)
    .where(eq(feedbackEntries.id, params.id))
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
