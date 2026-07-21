export const CREDIT_COSTS = {
  // 0 = free trial period (first 30 days). Change back to 1 when trial ends.
  compile: 0,
} as const;

export type PaidAction = keyof typeof CREDIT_COSTS;
