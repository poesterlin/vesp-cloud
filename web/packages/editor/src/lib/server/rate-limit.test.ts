import { beforeEach, describe, expect, test } from 'bun:test';
import { clearRateLimitsForTests, consumeRateLimit } from './rate-limit';

describe('consumeRateLimit', () => {
  beforeEach(clearRateLimitsForTests);

  test('blocks requests after the configured limit', () => {
    const options = { limit: 2, windowMs: 60_000 };

    expect(consumeRateLimit('register:127.0.0.1', options, 1_000).allowed).toBe(true);
    expect(consumeRateLimit('register:127.0.0.1', options, 2_000).allowed).toBe(true);
    const blocked = consumeRateLimit('register:127.0.0.1', options, 3_000);

    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBe(58);
  });

  test('resets the counter after the window expires', () => {
    const options = { limit: 1, windowMs: 1_000 };

    expect(consumeRateLimit('password-reset:127.0.0.1', options, 1_000).allowed).toBe(true);
    expect(consumeRateLimit('password-reset:127.0.0.1', options, 1_500).allowed).toBe(false);
    expect(consumeRateLimit('password-reset:127.0.0.1', options, 2_000).allowed).toBe(true);
  });

  test('tracks keys independently', () => {
    const options = { limit: 1, windowMs: 60_000 };

    expect(consumeRateLimit('register:one', options, 1_000).allowed).toBe(true);
    expect(consumeRateLimit('register:two', options, 1_000).allowed).toBe(true);
  });
});
