import { getStripe } from "./client";
import { addCredits } from "../credits";
import { getPackByPriceId } from "../packs";
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
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items.data.price"],
  });

  const userId = session.metadata?.userId;
  if (!userId) return;
  if (session.mode !== "payment") return;
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;

  const lineItems = session.line_items?.data;
  if (!lineItems || lineItems.length === 0) return;

  const priceId = lineItems[0].price?.id;
  if (!priceId) return;

  const pack = getPackByPriceId(priceId);
  if (!pack) return;

  await addCredits({
    userId,
    amount: pack.credits,
    reason: `purchase:${pack.priceKey}`,
    stripeSessionId: session.id,
  });
}

export async function processStripeEvent(
  body: string,
  signature: string,
  webhookSecret: string
): Promise<void> {
  const stripe = getStripe();
  const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

  if (!isTrackedEvent(event.type)) return;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCompletedCheckout(session.id);
  }
}
