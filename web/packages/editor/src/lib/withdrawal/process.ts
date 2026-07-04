import { env } from '$env/dynamic/private';
import { getDb } from '@vesp-cloud/db';
import { withdrawalRequests } from '@vesp-cloud/db/schema';
import { sendEmail } from '$lib/server/email';
import { createLogger } from '$lib/server/logger';
import { WithdrawalConfirmationEmail, Renderer, toPlainText } from '@vesp-cloud/email';
import { and, eq, ne } from 'drizzle-orm';
import type { PurchaseLookupResult } from './lookup';

const renderer = new Renderer();
const logger = createLogger('withdrawal');

export const SUPPORT_EMAIL = 'support@vesp-cloud.com';

function isActiveWithdrawalConflict(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? (err as { code?: unknown }).code : undefined;
  const constraint = 'constraint' in err ? (err as { constraint?: unknown }).constraint : undefined;
  return (
    code === '23505' &&
    typeof constraint === 'string' &&
    constraint.includes('withdrawal_request_stripe_session_active')
  );
}

export async function confirmWithdrawal(
  purchase: PurchaseLookupResult,
  submittedEmail: string,
): Promise<{ success: true } | { success: false; reason: 'duplicate' | 'error' }> {
  const db = getDb();
  const confirmedAt = new Date();
  const email = submittedEmail.trim().toLowerCase();

  try {
    await db.insert(withdrawalRequests).values({
      stripeSessionId: purchase.stripeSessionId,
      userId: purchase.userId,
      email,
      status: 'confirmed',
      creditsPurchased: purchase.creditsPurchased,
      amountPaidCents:
        purchase.amountPaidCents ?? Math.round(purchase.amountPaid * 100),
      creditsConsumed: purchase.creditsConsumed,
      confirmedAt,
    });
  } catch (err) {
    if (isActiveWithdrawalConflict(err)) {
      return { success: false, reason: 'duplicate' };
    }
    logger.error(`Failed to insert withdrawal request: ${err}`);
    return { success: false, reason: 'error' };
  }

  try {
    const html = await renderer.render(WithdrawalConfirmationEmail, {
      props: {
        orderId: purchase.stripeSessionId,
        confirmedAt: confirmedAt.toISOString(),
        creditsPurchased: purchase.creditsPurchased,
        amountPaid: purchase.amountPaid,
        supportEmail: SUPPORT_EMAIL,
      },
    });

    await sendEmail({
      to: email,
      subject: 'Withdrawal confirmation – vESP.cloud',
      html,
      text: toPlainText(html),
    });
  } catch (err) {
    logger.error(`Withdrawal confirmation email failed: ${err}`);
  }

  const notifyEmail = env.WITHDRAWAL_NOTIFY_EMAIL;
  if (notifyEmail) {
    try {
      await sendEmail({
        to: notifyEmail,
        subject: `Withdrawal request: ${purchase.stripeSessionId}`,
        html: `<p>A withdrawal was confirmed for order <code>${purchase.stripeSessionId}</code> (${email}).</p>`,
        text: `A withdrawal was confirmed for order ${purchase.stripeSessionId} (${email}).`,
      });
    } catch (err) {
      logger.error(`Withdrawal admin notification failed: ${err}`);
    }
  }

  return { success: true };
}

export async function hasActiveWithdrawal(stripeSessionId: string): Promise<boolean> {
  const db = getDb();
  const [existing] = await db
    .select({ id: withdrawalRequests.id })
    .from(withdrawalRequests)
    .where(
      and(
        eq(withdrawalRequests.stripeSessionId, stripeSessionId),
        ne(withdrawalRequests.status, 'rejected'),
      ),
    )
    .limit(1);

  return Boolean(existing);
}
