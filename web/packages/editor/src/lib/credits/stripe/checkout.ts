import { getStripe } from "./client";
import { getDb } from "@vesp-cloud/db";
import { stripeCheckoutSessions, stripeCustomers } from "@vesp-cloud/db/schema";
import { eq } from "drizzle-orm";
import { getPackByPriceId } from "../packs";
import { createLogger } from "$lib/server/logger";
import type Stripe from "stripe";

export interface CreateCheckoutParams {
  userId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  immediatePerformanceConsent?: boolean;
}

function isMissingCustomerError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const stripeError = error as { code?: string; param?: string };
  return stripeError.code === "resource_missing" && stripeError.param === "customer";
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

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    line_items: [{ price: params.priceId, quantity: 1 }],
    mode: "payment",
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: {
      userId: params.userId,
      ...(params.immediatePerformanceConsent
        ? {
            immediatePerformanceConsent: "true",
            consentAt: new Date().toISOString(),
          }
        : {}),
    },
    allow_promotion_codes: true,
  };

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      ...sessionParams,
      customer: stripeCustomerId,
    });
  } catch (error) {
    if (!existing || !isMissingCustomerError(error)) throw error;

    const customer = await stripe.customers.create({
      metadata: { userId: params.userId },
    });
    await db
      .update(stripeCustomers)
      .set({ id: customer.id })
      .where(eq(stripeCustomers.userId, params.userId));
    logger.info(`Replaced missing Stripe customer ${existing.id} with ${customer.id}`);

    session = await stripe.checkout.sessions.create({
      ...sessionParams,
      customer: customer.id,
    });
  }

  logger.info(`Checkout session created: ${session.id} for pack ${pack.priceKey}`);

  await db.insert(stripeCheckoutSessions).values({
    id: session.id,
    userId: params.userId,
    priceId: params.priceId,
    status: 'open',
    consentAt: params.immediatePerformanceConsent ? new Date() : null,
  });

  return { url: session.url, sessionId: session.id };
}
