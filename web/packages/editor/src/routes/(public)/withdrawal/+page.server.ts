import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { validateForm } from '$lib/server/form';
import { checkWithdrawalRate } from '$lib/server/withdrawal-limiter';
import {
  getListErrorMessage,
  getLookupErrorMessage,
  listPurchasesForEmail,
  lookupPurchase,
} from '$lib/withdrawal/lookup';
import { confirmWithdrawal, hasActiveWithdrawal } from '$lib/withdrawal/process';
import {
  createListToken,
  createWithdrawalToken,
  verifyListToken,
  verifyWithdrawalToken,
} from '$lib/withdrawal/token';
import type { Actions, PageServerLoad } from './$types';

function serializeOrders(
  orders: NonNullable<Awaited<ReturnType<typeof listPurchasesForEmail>>>,
) {
  return orders.map((order) => ({
    stripeSessionId: order.stripeSessionId,
    creditsPurchased: order.creditsPurchased,
    amountPaid: order.amountPaid,
    packName: order.packName,
    purchasedAt: order.purchasedAt.toISOString(),
    withdrawalActive: order.withdrawalActive,
  }));
}

function serializePurchase(purchase: NonNullable<Awaited<ReturnType<typeof lookupPurchase>>>) {
  return {
    stripeSessionId: purchase.stripeSessionId,
    creditsPurchased: purchase.creditsPurchased,
    amountPaid: purchase.amountPaid,
    packName: purchase.packName,
    purchasedAt: purchase.purchasedAt.toISOString(),
    hasUsedCredits: purchase.hasUsedCredits,
    creditsConsumed: purchase.creditsConsumed,
    creditsRemainingEstimate: purchase.creditsRemainingEstimate,
  };
}

export const load: PageServerLoad = async ({ url }) => {
  const step = url.searchParams.get('step');
  const token = url.searchParams.get('token');
  const listToken = url.searchParams.get('listToken');

  if (step === 'confirm' && token) {
    const payload = await verifyWithdrawalToken(token);
    if (!payload) {
      return { step: 'identify' as const, purchase: null, orders: null, listToken: null, error: 'Your session expired. Please start again.' };
    }

    const purchase = await lookupPurchase(payload.email, payload.stripeSessionId);
    if (!purchase) {
      return { step: 'identify' as const, purchase: null, orders: null, listToken: null, error: getLookupErrorMessage() };
    }

    const duplicate = await hasActiveWithdrawal(purchase.stripeSessionId);
    if (duplicate) {
      return { step: 'success' as const, purchase: null, orders: null, listToken: null, error: null, alreadySubmitted: true };
    }

    return {
      step: 'confirm' as const,
      purchase: serializePurchase(purchase),
      orders: null,
      listToken: null,
      token,
      error: null,
      alreadySubmitted: false,
    };
  }

  if (step === 'select' && listToken) {
    const payload = await verifyListToken(listToken);
    if (!payload) {
      return { step: 'identify' as const, purchase: null, orders: null, listToken: null, error: 'Your session expired. Please start again.' };
    }

    const orders = await listPurchasesForEmail(payload.email);
    if (!orders) {
      return { step: 'identify' as const, purchase: null, orders: null, listToken: null, error: getListErrorMessage() };
    }

    return {
      step: 'select' as const,
      purchase: null,
      orders: serializeOrders(orders),
      listToken,
      token: null,
      error: null,
      alreadySubmitted: false,
    };
  }

  if (step === 'success') {
    return { step: 'success' as const, purchase: null, orders: null, listToken: null, error: null, alreadySubmitted: false };
  }

  return { step: 'identify' as const, purchase: null, orders: null, listToken: null, error: null, alreadySubmitted: false };
};

export const actions: Actions = {
  listOrders: validateForm(
    z.object({
      email: z.email().trim().transform((value) => value.toLowerCase()),
    }),
    async (event, form) => {
      const ip = event.getClientAddress();
      if (!checkWithdrawalRate(ip)) {
        return fail(429, { message: 'Too many attempts. Please try again later.' });
      }

      const orders = await listPurchasesForEmail(form.email);
      if (!orders) {
        return fail(400, { message: getListErrorMessage() });
      }

      const token = await createListToken(form.email);
      return { step: 'select', listToken: token };
    },
  ),

  identify: validateForm(
    z
      .object({
        listToken: z.string().optional(),
        email: z
          .string()
          .trim()
          .transform((value) => value.toLowerCase())
          .optional(),
        orderId: z.string().trim().min(1, 'Order ID is required'),
      })
      .refine((data) => data.listToken || (data.email && z.email().safeParse(data.email).success), {
        message: 'Email or session token is required',
      }),
    async (event, form) => {
      const ip = event.getClientAddress();
      if (!checkWithdrawalRate(ip)) {
        return fail(429, { message: 'Too many attempts. Please try again later.' });
      }

      let email: string | undefined;
      if (form.listToken) {
        const payload = await verifyListToken(form.listToken);
        if (!payload) {
          return fail(400, { message: 'Your session expired. Please start again.' });
        }
        email = payload.email;
      } else {
        email = form.email;
      }

      if (!email) {
        return fail(400, { message: getLookupErrorMessage() });
      }

      const purchase = await lookupPurchase(email, form.orderId);
      if (!purchase) {
        return fail(400, { message: getLookupErrorMessage() });
      }

      const duplicate = await hasActiveWithdrawal(purchase.stripeSessionId);
      if (duplicate) {
        return { step: 'success', alreadySubmitted: true };
      }

      const token = await createWithdrawalToken(purchase.stripeSessionId, email);
      return { step: 'confirm', token };
    },
  ),

  confirm: validateForm(
    z.object({
      token: z.string().min(1),
    }),
    async (event, form) => {
      const ip = event.getClientAddress();
      if (!checkWithdrawalRate(ip)) {
        return fail(429, { message: 'Too many attempts. Please try again later.' });
      }

      const payload = await verifyWithdrawalToken(form.token);
      if (!payload) {
        return fail(400, { message: 'Your session expired. Please start again.' });
      }

      const purchase = await lookupPurchase(payload.email, payload.stripeSessionId);
      if (!purchase) {
        return fail(400, { message: getLookupErrorMessage() });
      }

      const result = await confirmWithdrawal(purchase, payload.email);
      if (!result.success) {
        if (result.reason === 'duplicate') {
          return { step: 'success', alreadySubmitted: true };
        }
        return fail(500, { message: 'Something went wrong. Please try again later.' });
      }

      return { step: 'success', alreadySubmitted: false };
    },
  ),
};
