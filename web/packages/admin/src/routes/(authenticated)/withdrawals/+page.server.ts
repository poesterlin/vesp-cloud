import { fail } from '@sveltejs/kit';
import { getDb } from '@vesp-cloud/db';
import {
  creditBalances,
  creditTransactions,
  usersTable,
  withdrawalRequests,
} from '@vesp-cloud/db/schema';
import { desc, eq } from 'drizzle-orm';
import { env } from '$env/dynamic/private';
import type { Actions, PageServerLoad } from './$types';

const STATUSES = ['confirmed', 'pending', 'processed', 'rejected'] as const;
type WithdrawalStatus = (typeof STATUSES)[number];
type WithdrawalFilter = WithdrawalStatus | 'all';

function isWithdrawalFilter(value: string): value is WithdrawalFilter {
  return value === 'all' || (STATUSES as readonly string[]).includes(value);
}

export const load: PageServerLoad = async ({ url }) => {
  const statusParam = url.searchParams.get('status') ?? 'confirmed';
  const statusFilter = isWithdrawalFilter(statusParam) ? statusParam : 'confirmed';

  const db = getDb(env.DATABASE_URL);

  const baseQuery = db
    .select({
      id: withdrawalRequests.id,
      stripeSessionId: withdrawalRequests.stripeSessionId,
      userId: withdrawalRequests.userId,
      email: withdrawalRequests.email,
      status: withdrawalRequests.status,
      confirmedAt: withdrawalRequests.confirmedAt,
      processedAt: withdrawalRequests.processedAt,
      notes: withdrawalRequests.notes,
      createdAt: withdrawalRequests.createdAt,
      snapshotCreditsPurchased: withdrawalRequests.creditsPurchased,
      snapshotAmountPaidCents: withdrawalRequests.amountPaidCents,
      snapshotCreditsConsumed: withdrawalRequests.creditsConsumed,
      username: usersTable.username,
      accountEmail: usersTable.email,
      creditsPurchased: creditTransactions.amount,
      amountPaidCents: creditTransactions.amountPaidCents,
      purchasedAt: creditTransactions.createdAt,
      currentBalance: creditBalances.balance,
    })
    .from(withdrawalRequests)
    .leftJoin(usersTable, eq(withdrawalRequests.userId, usersTable.id))
    .leftJoin(
      creditTransactions,
      eq(withdrawalRequests.stripeSessionId, creditTransactions.stripeSessionId),
    )
    .leftJoin(creditBalances, eq(withdrawalRequests.userId, creditBalances.userId));

  const rows = await (statusFilter === 'all'
    ? baseQuery
    : baseQuery.where(eq(withdrawalRequests.status, statusFilter))
  ).orderBy(desc(withdrawalRequests.confirmedAt), desc(withdrawalRequests.createdAt));

  return {
    statusFilter,
    withdrawals: rows.map((row) => ({
      id: row.id,
      stripeSessionId: row.stripeSessionId,
      userId: row.userId,
      email: row.email,
      status: row.status,
      confirmedAt: row.confirmedAt?.toISOString() ?? null,
      processedAt: row.processedAt?.toISOString() ?? null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      username: row.username,
      accountEmail: row.accountEmail,
      creditsPurchased: row.snapshotCreditsPurchased ?? row.creditsPurchased,
      amountPaid:
        (row.snapshotAmountPaidCents ?? row.amountPaidCents) != null
          ? (row.snapshotAmountPaidCents ?? row.amountPaidCents)! / 100
          : null,
      creditsConsumed: row.snapshotCreditsConsumed,
      purchasedAt: row.purchasedAt?.toISOString() ?? null,
      currentBalance: row.currentBalance ?? 0,
    })),
  };
};

export const actions: Actions = {
  markProcessed: async ({ request }) => {
    const form = await request.formData();
    const id = form.get('id');
    const notes = form.get('notes');

    if (typeof id !== 'string' || !id) {
      return fail(400, { message: 'Missing withdrawal id' });
    }

    const db = getDb(env.DATABASE_URL);
    const [updated] = await db
      .update(withdrawalRequests)
      .set({
        status: 'processed',
        processedAt: new Date(),
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      })
      .where(eq(withdrawalRequests.id, id))
      .returning({ id: withdrawalRequests.id });

    if (!updated) {
      return fail(404, { message: 'Withdrawal not found' });
    }

    return { success: true };
  },
};
