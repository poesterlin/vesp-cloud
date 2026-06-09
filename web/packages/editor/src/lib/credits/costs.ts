export const CREDIT_COSTS = {
  compile: 1,
} as const;

export type PaidAction = keyof typeof CREDIT_COSTS;
