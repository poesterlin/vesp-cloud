export const CREDIT_PACKS = [
  {
    priceId: "price_1TeAvHAhO1kA3vuNbGO8y87n",
    priceKey: "10_builds",
    name: "Starter",
    credits: 10,
    price: 5,
  },
  {
    priceId: "price_1TeAwuAhO1kA3vuNUUXVhx4e",
    priceKey: "50_builds",
    name: "Builder",
    credits: 50,
    price: 20,
  },
  {
    priceId: "price_1TeAy1AhO1kA3vuNfqw8gfpJ",
    priceKey: "200_builds",
    name: "Pro",
    credits: 200,
    price: 60,
  },
] as const;

export function getPackByPriceId(priceId: string) {
  return CREDIT_PACKS.find((p) => p.priceId === priceId);
}
