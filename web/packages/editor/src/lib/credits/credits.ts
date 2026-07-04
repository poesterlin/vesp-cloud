import { getDb } from "@vesp-cloud/db";
import { creditBalances, creditTransactions } from "@vesp-cloud/db/schema";
import { eq } from "drizzle-orm";
import type { CreditBalance } from "@vesp-cloud/db/schema";

interface AddCreditsParams {
  userId: string;
  amount: number;
  reason: string;
  stripeSessionId?: string;
  packKey?: string;
  amountPaidCents?: number;
  currency?: string;
}

function isUniqueStripeSessionViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = "code" in err ? (err as { code?: unknown }).code : undefined;
  const constraint = "constraint" in err ? (err as { constraint?: unknown }).constraint : undefined;
  return (
    code === "23505" &&
    typeof constraint === "string" &&
    constraint.includes("stripe_session_id")
  );
}

export async function addCredits(params: AddCreditsParams): Promise<CreditBalance> {
  const db = getDb();

  try {
    return await db.transaction(async (tx) => {
      if (params.stripeSessionId) {
        const [existingTx] = await tx
          .select({ id: creditTransactions.id })
          .from(creditTransactions)
          .where(eq(creditTransactions.stripeSessionId, params.stripeSessionId))
          .limit(1);

        if (existingTx) {
          const [row] = await tx
            .select()
            .from(creditBalances)
            .where(eq(creditBalances.userId, params.userId));

          return {
            userId: params.userId,
            balance: row?.balance ?? params.amount,
            updatedAt: row?.updatedAt ?? new Date(),
          };
        }
      }

      const [existing] = await tx
        .select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, params.userId))
        .for("update");

      if (!existing) {
        await tx.insert(creditBalances).values({
          userId: params.userId,
          balance: params.amount,
        });

        await tx.insert(creditTransactions).values({
          userId: params.userId,
          amount: params.amount,
          balanceAfter: params.amount,
          reason: params.reason,
          stripeSessionId: params.stripeSessionId ?? null,
          packKey: params.packKey ?? null,
          amountPaidCents: params.amountPaidCents ?? null,
          currency: params.currency ?? null,
        });

        return { userId: params.userId, balance: params.amount, updatedAt: new Date() };
      }

      const newBalance = existing.balance + params.amount;

      await tx
        .update(creditBalances)
        .set({ balance: newBalance, updatedAt: new Date() })
        .where(eq(creditBalances.userId, params.userId));

      await tx.insert(creditTransactions).values({
        userId: params.userId,
        amount: params.amount,
        balanceAfter: newBalance,
        reason: params.reason,
        stripeSessionId: params.stripeSessionId ?? null,
        packKey: params.packKey ?? null,
        amountPaidCents: params.amountPaidCents ?? null,
        currency: params.currency ?? null,
      });

      return { userId: params.userId, balance: newBalance, updatedAt: new Date() };
    });
  } catch (err) {
    if (!params.stripeSessionId || !isUniqueStripeSessionViolation(err)) {
      throw err;
    }

    const [row] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, params.userId));

    return {
      userId: params.userId,
      balance: row?.balance ?? params.amount,
      updatedAt: row?.updatedAt ?? new Date(),
    };
  }
}

interface DeductCreditsParams {
  userId: string;
  amount: number;
  reason: string;
}

export async function deductCredits(
  params: DeductCreditsParams
): Promise<{ success: true; balance: number } | { success: false; reason: "insufficient_credits" }> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ balance: creditBalances.balance })
      .from(creditBalances)
      .where(eq(creditBalances.userId, params.userId))
      .for("update");

    if (!row || row.balance < params.amount) {
      return { success: false as const, reason: "insufficient_credits" as const };
    }

    const newBalance = row.balance - params.amount;

    await tx
      .update(creditBalances)
      .set({ balance: newBalance, updatedAt: new Date() })
      .where(eq(creditBalances.userId, params.userId));

    await tx.insert(creditTransactions).values({
      userId: params.userId,
      amount: -params.amount,
      balanceAfter: newBalance,
      reason: params.reason,
    });

    return { success: true as const, balance: newBalance };
  });
}

export async function getBalance(userId: string): Promise<number> {
  const db = getDb();

  const [row] = await db
    .select({ balance: creditBalances.balance })
    .from(creditBalances)
    .where(eq(creditBalances.userId, userId));

  return row?.balance ?? 0;
}

export async function ensureBalanceExists(userId: string): Promise<void> {
  const db = getDb();

  await db
    .insert(creditBalances)
    .values({ userId, balance: 0 })
    .onConflictDoNothing();
}
