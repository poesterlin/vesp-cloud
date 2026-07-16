import { env } from "$env/dynamic/private";

const TEST_PRICE_IDS = {
  starter: "price_1TeAvHAhO1kA3vuNbGO8y87n",
  builder: "price_1TeAwuAhO1kA3vuNUUXVhx4e",
  pro: "price_1TeAy1AhO1kA3vuNfqw8gfpJ",
} as const;

const LIVE_PRICE_IDS = {
  starter: "prod_UdRobG0ylzovgG",
  builder: "prod_UdRqbAJtKbP0di",
  pro: "prod_UdRrpDxVvYhDZ2",
} as const;

const priceIds = env.STRIPE_SECRET_KEY?.startsWith("rk_live_")
  ? LIVE_PRICE_IDS
  : TEST_PRICE_IDS;

export const CREDIT_PACKS = [
  {
    priceId: priceIds.starter,
    priceKey: "10_builds",
    name: "Starter",
    credits: 10,
    price: 5,
  },
  {
    priceId: priceIds.builder,
    priceKey: "50_builds",
    name: "Builder",
    credits: 50,
    price: 20,
  },
  {
    priceId: priceIds.pro,
    priceKey: "200_builds",
    name: "Pro",
    credits: 200,
    price: 60,
  },
] as const;

export function getPackByPriceId(priceId: string) {
  return CREDIT_PACKS.find((p) => p.priceId === priceId);
}
