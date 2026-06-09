import { getStripe } from "./client";
import { getDb } from "$lib/db";
import { stripeCustomers } from "$lib/db/schema";
import { eq } from "drizzle-orm";
import { getPackByPriceId } from "../packs";
import { createLogger } from "$lib/server/logger";

export interface CreateCheckoutParams {
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createCheckoutSession(params: CreateCheckoutParams) {
  const logger = createLogger(`checkout:${params.userId}`);
  const pack = getPackByPriceId(params.priceId);
  if (!pack) {
    throw new Error(`Unknown priceId: ${params.priceId}`);
  }

  const stripe = getStripe();
  const db = getDb();

  let stripeCustomerId: string | undefined;

  const [existing] = await db
    .select()
    .from(stripeCustomers)
    .where(eq(stripeCustomers.userId, params.userId));

  if (existing) {
    stripeCustomerId = existing.id;
  } else {
    const customer = await stripe.customers.create({
      metadata: { userId: params.userId },
    });
    await db.insert(stripeCustomers).values({
      id: customer.id,
      userId: params.userId,
    });
    stripeCustomerId = customer.id;
    logger.info(`Created Stripe customer: ${customer.id}`);
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    line_items: [{ price: params.priceId, quantity: 1 }],
    mode: "payment",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
    },
    allow_promotion_codes: true,
  });

  logger.info(`Checkout session created: ${session.id} for pack ${pack.priceKey}`);
  return { url: session.url };
}
