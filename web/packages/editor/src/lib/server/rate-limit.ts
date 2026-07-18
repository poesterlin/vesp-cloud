interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

const entries = new Map<string, RateLimitEntry>();
let checksSinceCleanup = 0;

function cleanupExpiredEntries(now: number): void {
  checksSinceCleanup++;
  if (checksSinceCleanup < 100) return;
  checksSinceCleanup = 0;

  for (const [key, entry] of entries) {
    if (entry.resetAt <= now) entries.delete(key);
  }
}

export function consumeRateLimit(
  key: string,
  options: RateLimitOptions,
  now = Date.now(),
): RateLimitResult {
  cleanupExpiredEntries(now);

  const current = entries.get(key);
  const entry = !current || current.resetAt <= now
    ? { count: 0, resetAt: now + options.windowMs }
    : current;

  entry.count++;
  entries.set(key, entry);

  return {
    allowed: entry.count <= options.limit,
    remaining: Math.max(0, options.limit - entry.count),
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function clearRateLimitsForTests(): void {
  entries.clear();
  checksSinceCleanup = 0;
}
