import { consumeEmailVerificationToken } from '$lib/server/email-verification';
import type { PageServerLoad } from './$types';

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}=?$/;

export const load: PageServerLoad = async ({ url }) => {
  const token = url.searchParams.get('token');
  if (!token || !TOKEN_PATTERN.test(token)) return { verified: false };

  return { verified: await consumeEmailVerificationToken(token) };
};
