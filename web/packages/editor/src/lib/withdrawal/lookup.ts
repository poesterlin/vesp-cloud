import { getDb } from '@vesp-cloud/db';
import {
  creditBalances,
  creditTransactions,
  usersTable,
  withdrawalRequests,
} from '@vesp-cloud/db/schema';
import { CREDIT_PACKS } from '$lib/credits/packs';
import { and, desc, eq, gt, isNotNull, lt, ne, sql } from 'drizzle-orm';

export interface PurchaseLookupResult {
  stripeSessionId: string;
  userId: string;
  email: string;
  creditsPurchased: number;
  amountPaid: number;
  amountPaidCents: number | null;
  packName: string;
  purchasedAt: Date;
  creditsConsumed: number;
  creditsRemainingEstimate: number;
  hasUsedCredits: boolean;
}

export interface PurchaseListItem {
  stripeSessionId: string;
  creditsPurchased: number;
  amountPaid: number;
  packName: string;
  purchasedAt: Date;
  withdrawalActive: boolean;
}

const GENERIC_ERROR = 'No matching order found. Check your email and order ID and try again.';
const GENERIC_LIST_ERROR = 'No withdrawable orders found for this email.';

export function getLookupErrorMessage(): string {
  return GENERIC_ERROR;
}

export function getListErrorMessage(): string {
  return GENERIC_LIST_ERROR;
}

function getPackInfo(credits: number, packKey?: string | null, amountPaidCents?: number | null) {
  if (packKey) {
    const pack = CREDIT_PACKS.find((p) => p.priceKey === packKey);
    if (pack) {
      return {
        amountPaid: amountPaidCents != null ? amountPaidCents / 100 : pack.price,
        packName: pack.name,
      };
    }
  }

  const pack = CREDIT_PACKS.find((p) => p.credits === credits);
  if (pack) {
    return {
      amountPaid: amountPaidCents != null ? amountPaidCents / 100 : pack.price,
      packName: pack.name,
    };
  }

  return {
    amountPaid: amountPaidCents != null ? amountPaidCents / 100 : 0,
    packName: `${credits} credits`,
  };
}

export async function listPurchasesForEmail(email: string): Promise<PurchaseListItem[] | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const db = getDb();

  const [user] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(sql`lower(${usersTable.email}) = ${normalizedEmail}`)
    .limit(1);

  if (!user) return null;

  const purchases = await db
    .select({
      stripeSessionId: creditTransactions.stripeSessionId,
      amount: creditTransactions.amount,
      packKey: creditTransactions.packKey,
      amountPaidCents: creditTransactions.amountPaidCents,
      createdAt: creditTransactions.createdAt,
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, user.id),
        gt(creditTransactions.amount, 0),
        isNotNull(creditTransactions.stripeSessionId),
      ),
    )
    .orderBy(desc(creditTransactions.createdAt));

  if (purchases.length === 0) return null;

  const activeWithdrawals = await db
    .select({ stripeSessionId: withdrawalRequests.stripeSessionId })
    .from(withdrawalRequests)
    .where(
      and(
        eq(withdrawalRequests.userId, user.id),
        ne(withdrawalRequests.status, 'rejected'),
      ),
    );

  const activeIds = new Set(
    activeWithdrawals.map((row) => row.stripeSessionId).filter(Boolean) as string[],
  );

  return purchases
    .filter((row): row is typeof row & { stripeSessionId: string } => Boolean(row.stripeSessionId))
    .map((row) => {
      const { amountPaid, packName } = getPackInfo(row.amount, row.packKey, row.amountPaidCents);
      return {
        stripeSessionId: row.stripeSessionId,
        creditsPurchased: row.amount,
        amountPaid,
        packName,
        purchasedAt: row.createdAt,
        withdrawalActive: activeIds.has(row.stripeSessionId),
      };
    });
}

export async function lookupPurchase(
  email: string,
  stripeSessionId: string,
): Promise<PurchaseLookupResult | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedSessionId = stripeSessionId.trim();

  if (!normalizedEmail || !normalizedSessionId.startsWith('cs_')) {
    return null;
  }

  const db = getDb();

  const [row] = await db
    .select({
      transaction: creditTransactions,
      user: {
        id: usersTable.id,
        email: usersTable.email,
      },
    })
    .from(creditTransactions)
    .innerJoin(usersTable, eq(creditTransactions.userId, usersTable.id))
    .where(
      and(
        eq(creditTransactions.stripeSessionId, normalizedSessionId),
        sql`lower(${usersTable.email}) = ${normalizedEmail}`,
      ),
    )
    .limit(1);

  if (!row || row.transaction.amount <= 0) {
    return null;
  }

  const creditsPurchased = row.transaction.amount;
  const { amountPaid, packName } = getPackInfo(
    creditsPurchased,
    row.transaction.packKey,
    row.transaction.amountPaidCents,
  );

  const [usage] = await db
    .select({
      consumed: sql<number>`coalesce(sum(abs(${creditTransactions.amount})), 0)`.mapWith(Number),
    })
    .from(creditTransactions)
    .where(
      and(
        eq(creditTransactions.userId, row.user.id),
        lt(creditTransactions.amount, 0),
        gt(creditTransactions.createdAt, row.transaction.createdAt),
      ),
    );

  const creditsConsumed = Math.min(usage?.consumed ?? 0, creditsPurchased);
  const [balanceRow] = await db
    .select({ balance: creditBalances.balance })
    .from(creditBalances)
    .where(eq(creditBalances.userId, row.user.id));

  const currentBalance = balanceRow?.balance ?? 0;
  const creditsRemainingEstimate = Math.min(currentBalance, creditsPurchased - creditsConsumed);

  return {
    stripeSessionId: normalizedSessionId,
    userId: row.user.id,
    email: row.user.email,
    creditsPurchased,
    amountPaid,
    amountPaidCents: row.transaction.amountPaidCents,
    packName,
    purchasedAt: row.transaction.createdAt,
    creditsConsumed,
    creditsRemainingEstimate,
    hasUsedCredits: creditsConsumed > 0,
  };
}
