/**
 * URLs that are safe both as HTTP(S) values and when ESPHome substitutes them
 * into generated source. Backslashes are deliberately excluded because a
 * trailing backslash can escape the closing quote of a C++ string literal.
 */
export const CODEGEN_SAFE_HTTP_URL_RE = /^https?:\/\/[^\s"'<>\\]+$/;

export function assertCodegenSafeHttpUrl(value: string, label: string): void {
  if (!CODEGEN_SAFE_HTTP_URL_RE.test(value)) {
    throw new Error(`${label} must be a codegen-safe HTTP(S) URL`);
  }
}
