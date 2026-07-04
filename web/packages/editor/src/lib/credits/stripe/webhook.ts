import { getStripe } from "./client";
import { addCredits } from "../credits";
import { getPackByPriceId } from "../packs";
import { getDb } from "@vesp-cloud/db";
import { stripeCheckoutSessions, stripeEvents } from "@vesp-cloud/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "$lib/server/logger";
import type Stripe from "stripe";

const trackedEvents = new Set<string>([
  "checkout.session.completed",
]);

export function isTrackedEvent(type: string): boolean {
  return trackedEvents.has(type);
}

export async function handleCompletedCheckout(
  sessionId: string
): Promise<void> {
  const logger = createLogger(sessionId);
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price"],
  });

  const userId = session.metadata?.userId;
  if (!userId) { logger.warn('No userId in session metadata'); return; }
  if (session.mode !== "payment") { logger.info(`Skipping non-payment session: ${session.mode}`); return; }
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    logger.info(`Skipping session with status: ${session.payment_status}`);
    return;
  }

  const lineItems = session.line_items?.data;
  if (!lineItems || lineItems.length === 0) { logger.warn('No line items in session'); return; }

  const priceId = lineItems[0].price?.id;
  if (!priceId) { logger.warn('No price ID in line item'); return; }

  const pack = getPackByPriceId(priceId);
  if (!pack) { logger.warn(`Unknown price: ${priceId}`); return; }

  const completedAt = new Date();
  await getDb()
    .update(stripeCheckoutSessions)
    .set({ status: 'complete', completedAt })
    .where(eq(stripeCheckoutSessions.id, session.id));

  await addCredits({
    userId,
    amount: pack.credits,
    reason: `purchase:${pack.priceKey}`,
    stripeSessionId: session.id,
    packKey: pack.priceKey,
    amountPaidCents: session.amount_total ?? pack.price * 100,
    currency: session.currency ?? 'eur',
  });

  logger.info(`Credited ${pack.credits} credits to user ${userId} for pack ${pack.priceKey}`);
}

export async function processStripeEvent(
  body: string,
  signature: string,
  webhookSecret: string
): Promise<{ alreadyProcessed: boolean }> {
  const stripe = getStripe();
  const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

  const db = getDb();
  const [existing] = await db
    .select({ id: stripeEvents.id })
    .from(stripeEvents)
    .where(eq(stripeEvents.id, event.id))
    .limit(1);

  if (existing) {
    return { alreadyProcessed: true };
  }

  if (!isTrackedEvent(event.type)) {
    return { alreadyProcessed: false };
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCompletedCheckout(session.id);
  }

  await db.insert(stripeEvents).values({
    id: event.id,
    type: event.type,
  });

  return { alreadyProcessed: false };
}
