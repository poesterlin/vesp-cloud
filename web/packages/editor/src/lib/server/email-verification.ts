import { env } from '$env/dynamic/private';
import { getDb } from '@vesp-cloud/db';
import * as table from '@vesp-cloud/db/schema';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import { and, eq } from 'drizzle-orm';

const VERIFICATION_TOKEN_TTL_MS = 1000 * 60 * 10;

export function generateEmailVerificationToken() {
  return encodeBase64url(crypto.getRandomValues(new Uint8Array(32)));
}

export function hashEmailVerificationToken(token: string) {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export function getEmailVerificationBaseUrl(origin: string) {
  return env.PUBLIC_BASE_URL || origin;
}

export async function createEmailVerificationToken(userId: string, email: string) {
  const db = getDb();
  const token = generateEmailVerificationToken();
  const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);

  await db.transaction(async (tx) => {
    await tx.delete(table.emailVerificationTokens).where(eq(table.emailVerificationTokens.userId, userId));
    await tx.insert(table.emailVerificationTokens).values({
      id: hashEmailVerificationToken(token),
      userId,
      email,
      expiresAt,
      createdAt: new Date(),
    });
  });

  return { token, expiresAt };
}

export async function consumeEmailVerificationToken(token: string) {
  const db = getDb();
  const tokenId = hashEmailVerificationToken(token);

  return db.transaction(async (tx) => {
    const [result] = await tx
      .select({ token: table.emailVerificationTokens, currentEmail: table.usersTable.email })
      .from(table.emailVerificationTokens)
      .innerJoin(table.usersTable, eq(table.emailVerificationTokens.userId, table.usersTable.id))
      .where(eq(table.emailVerificationTokens.id, tokenId));

    if (!result || Date.now() >= result.token.expiresAt.getTime()) {
      if (result) {
        await tx.delete(table.emailVerificationTokens).where(eq(table.emailVerificationTokens.id, tokenId));
      }
      return false;
    }

    if (result.currentEmail !== result.token.email) {
      await tx.delete(table.emailVerificationTokens).where(eq(table.emailVerificationTokens.id, tokenId));
      return false;
    }

    const verifiedAt = new Date();
    const updated = await tx
      .update(table.usersTable)
      .set({ emailVerifiedAt: verifiedAt })
      .where(and(eq(table.usersTable.id, result.token.userId), eq(table.usersTable.email, result.token.email)))
      .returning({ id: table.usersTable.id });

    await tx.delete(table.emailVerificationTokens).where(eq(table.emailVerificationTokens.userId, result.token.userId));
    return updated.length > 0;
  });
}
