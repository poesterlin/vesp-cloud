import { env } from '$env/dynamic/private';
import { getDb } from '@vesp-cloud/db';
import * as table from '@vesp-cloud/db/schema';
import { sha256 } from '@oslojs/crypto/sha2';
import { encodeBase64url, encodeHexLowerCase } from '@oslojs/encoding';
import { and, eq, isNull } from 'drizzle-orm';

const RESET_TOKEN_TTL_MS = 1000 * 60 * 60;

export function generatePasswordResetToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return encodeBase64url(bytes);
}

export function hashPasswordResetToken(token: string) {
  return encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
}

export function getPasswordResetBaseUrl(origin: string) {
  return env.PUBLIC_BASE_URL || origin;
}

export async function createPasswordResetToken(userId: string) {
  const db = getDb();
  const token = generatePasswordResetToken();
  const tokenId = hashPasswordResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await db.transaction(async (tx) => {
    await tx.delete(table.passwordResetTokens).where(eq(table.passwordResetTokens.userId, userId));
    await tx.insert(table.passwordResetTokens).values({
      id: tokenId,
      userId,
      expiresAt,
      createdAt: new Date(),
    });
  });

  return { token, expiresAt };
}

export async function consumePasswordResetToken(token: string) {
  const db = getDb();
  const tokenId = hashPasswordResetToken(token);

  const [result] = await db
    .select({
      token: table.passwordResetTokens,
      user: {
        id: table.usersTable.id,
        username: table.usersTable.username,
        email: table.usersTable.email,
      },
    })
    .from(table.passwordResetTokens)
    .innerJoin(table.usersTable, eq(table.passwordResetTokens.userId, table.usersTable.id))
    .where(and(eq(table.passwordResetTokens.id, tokenId), isNull(table.passwordResetTokens.usedAt)));

  if (!result) {
    return null;
  }

  if (Date.now() >= result.token.expiresAt.getTime()) {
    await db.delete(table.passwordResetTokens).where(eq(table.passwordResetTokens.id, tokenId));
    return null;
  }

  await db
    .update(table.passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(table.passwordResetTokens.id, tokenId));

  return result.user;
}
