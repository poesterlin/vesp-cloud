import { getDb } from '@vesp-cloud/db';
import { feedbackEntries } from '@vesp-cloud/db/schema';
import { fail, redirect } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import {
  deleteFeedbackAttachment,
  feedbackAttachmentKey,
  uploadFeedbackAttachment,
} from '$lib/server/s3';
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
      attachmentName: feedbackEntries.attachmentName,
      attachmentType: feedbackEntries.attachmentType,
      attachmentSize: feedbackEntries.attachmentSize,
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
  submit: async (event) => {
      const user = event.locals.user;
      if (!user) {
        return fail(401, { message: 'Unauthorized' });
      }

      const form = await event.request.formData();
      const rawMessage = form.get('message');
      const attachment = form.get('attachment');
      const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';

      if (message.length < 3 || message.length > 2000) {
        return fail(400, { message: 'Feedback must be between 3 and 2000 characters.' });
      }

      const allowedTypes: Record<string, string> = {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
      };
      const image = attachment instanceof File && attachment.size > 0 ? attachment : null;
      if (image && !allowedTypes[image.type]) {
        return fail(400, { message: 'Attach a JPEG, PNG, or WebP image.' });
      }
      if (image && image.size > 8 * 1024 * 1024) {
        return fail(400, { message: 'The attached image must be 8 MB or smaller.' });
      }

      const imageData = image ? await image.arrayBuffer() : null;
      if (image && imageData) {
        const bytes = new Uint8Array(imageData, 0, Math.min(imageData.byteLength, 12));
        const hasExpectedSignature =
          (image.type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
          (image.type === 'image/png' && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
          (image.type === 'image/webp' &&
            String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
            String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP');
        if (!hasExpectedSignature) {
          return fail(400, { message: 'The attachment does not appear to be a valid image.' });
        }
      }

      const db = getDb();
      const id = crypto.randomUUID();
      const attachmentKey = image
        ? feedbackAttachmentKey(user.id, id, allowedTypes[image.type])
        : null;

      if (image && imageData && attachmentKey) {
        await uploadFeedbackAttachment(attachmentKey, imageData, image.type);
      }

      try {
        await db.insert(feedbackEntries).values({
          id,
          userId: user.id,
          message,
          attachmentKey,
          attachmentName: image?.name ?? null,
          attachmentType: image?.type ?? null,
          attachmentSize: image?.size ?? null,
        });
      } catch (error) {
        if (attachmentKey) await deleteFeedbackAttachment(attachmentKey);
        throw error;
      }

      return { success: true };
  },
};
