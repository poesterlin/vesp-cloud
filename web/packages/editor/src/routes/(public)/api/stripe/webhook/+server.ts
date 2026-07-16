import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { processStripeEvent } from "$lib/credits";
import { env } from "$env/dynamic/private";

export const POST: RequestHandler = async ({ request }) => {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await request.text();

  try {
    await processStripeEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook]", err);
    const isSignatureError =
      err && typeof err === 'object' && 'type' in err &&
      (err as { type?: string }).type?.startsWith('StripeSignatureVerification');
    const status = isSignatureError ? 400 : 500;
    return json({ error: "Webhook processing failed" }, { status });
  }

  return json({ received: true });
};
