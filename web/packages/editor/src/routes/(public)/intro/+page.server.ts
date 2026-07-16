import { CREDIT_PACKS } from '$lib/credits/packs';
import { CREDIT_COSTS } from '$lib/credits/costs';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  return {
    user: locals.user,
    creditPacks: CREDIT_PACKS.map((p) => ({
      name: p.name,
      credits: p.credits,
      price: p.price,
    })),
    creditCosts: CREDIT_COSTS,
  };
};
