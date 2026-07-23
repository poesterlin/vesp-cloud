/**
 * The ESPHome version the generated firmware is configured and tested for.
 *
 * This must stay in sync with the compiler images:
 * - `Dockerfile` / `Dockerfile.worker` (`ARG ESPHOME_VERSION`)
 * - `esphome-patches/apply-fast-jpeg.py` (`EXPECTED_ESPHOME_VERSION`)
 *
 * The integration tests in `__tests__/fast-jpeg-integration.test.ts`
 * assert that all of these pin the same version.
 */
export const ESPHOME_VERSION = "2026.7.1";
