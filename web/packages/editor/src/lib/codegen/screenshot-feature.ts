/**
 * Server-side env gate for the device-screenshot debug feature.
 *
 * Set SCREENSHOT_DEBUG_ENABLED=1 to enable the feature in builds. When
 * disabled, all of the codegen paths that emit screenshot wiring become
 * no-ops: no `ui_screenshot.h` include, no extra `http_request:`, no HA
 * trigger subscription, no 50ms poll hook. The on-device include itself
 * also short-circuits via the SCREENSHOT_DEBUG_ENABLED C++ define so the
 * helper symbols compile to nothing in production firmware.
 *
 * SCREENSHOT_UPLOAD_BASE_URL is the editor's public base URL (e.g.
 * `https://designer.example.com`). The device POSTs raw RGB565 to
 * `${SCREENSHOT_UPLOAD_BASE_URL}/api/screenshot/<device_id>`.
 */

function envTrue(value: string | undefined): boolean {
  if (!value) return false;
  return value === "1" || value.toLowerCase() === "true";
}

export function isScreenshotDebugEnabled(): boolean {
  return envTrue(process.env.SCREENSHOT_DEBUG_ENABLED);
}

export function screenshotUploadUrl(): string | undefined {
  const raw = process.env.SCREENSHOT_UPLOAD_BASE_URL;
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "");
}
