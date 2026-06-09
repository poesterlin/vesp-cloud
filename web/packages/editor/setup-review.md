# Editor Setup Review (Queue, Build, Auth, Payments, Errors, Logs)

## Queue and Build

- [x] `getStats()` is incorrect: `total`, `completed`, and `failed` always return `0`.
- [x] `this.jobs` in-memory map is never pruned and can grow indefinitely.
- [x] `PYTHONPATH` is hardcoded to Python `3.11`, which can break on version changes.
- [x] Credits are deducted before compile and not refunded when compilation fails.
<!-- - [ ] Worker/db init in `hooks.server.ts` is unawaited; requests can arrive before readiness. -->
- [x] No per-user rate limiting on compile job submission. make it only 1 job.
- [x] Job insertion and queue processing can leave orphaned pending jobs after crashes. TODO: check again: web/packages/editor/src/lib/queue/index.ts:51 in failInProgressJobs()
- [x] Shutdown uses `process.kill()` with basic handling; child cleanup can be incomplete.
- [x] Build retention keeps last 10 only; no way to pin/retain important builds.

## Authentication

- [x] Session cookie is missing `httpOnly`, `secure`, and `sameSite` flags.
- [x] No CSRF protection on mutating POST endpoints. TODO: this is checked by sveltekit right?
- [x] No login rate limiting or account lockout for brute-force protection. 
- [x] Argon2 settings are acceptable but below stronger modern recommendations.
- [x] Registration catch block hides root cause (`username taken` vs real server error).
- [x] Password policy is weak (length-only, min 6 chars).
<!-- - [ ] Login flow timing/validation behavior may allow weak username enumeration signals. -->
<!-- - [ ] Email can be provided but there is no verification flow. -->

## Payments and Credits

<!-- - [ ] Stripe price IDs are hardcoded in source instead of environment/config. -->
- [x] Webhook idempotency relies on DB uniqueness only; no processed-event ledger.
- [x] Webhook route returns `400` for all failures, including server-side/transient errors.
<!-- - [ ] No customer billing portal integration. -->

## Error Handling

- [x] API error responses return raw `error.message`, potentially leaking internals.
- [x] Multiple endpoints use broad catch-and-return patterns without sanitization.
<!-- - [ ] Project validation runs twice (API and worker), producing inconsistent UX paths. -->
- [x] No circuit breaker/backoff when compile environment is consistently broken.
- [x] Compile timeout and compile failure are not clearly distinguished in user-facing errors.

## Logging and Observability

- [x] Logging uses plain `console.*` only; no structured logs or level controls. Add correlation IDs across API, queue, and subprocess logs.
- [x] Stripe success paths are minimally logged compared to error paths.

## Infrastructure and Ops

- [x] Production image includes broader dependency set than necessary (dev prune not explicit).
