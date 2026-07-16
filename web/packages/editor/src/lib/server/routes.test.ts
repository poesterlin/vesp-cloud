import { describe, expect, test } from "bun:test";
import { isPublicRoute } from "./routes";

describe("isPublicRoute", () => {
  test("recognizes routes nested in the public route group", () => {
    expect(isPublicRoute("/(public)/login")).toBe(true);
    expect(isPublicRoute("/(public)/api/firmware/[token]")).toBe(true);
  });

  test("does not expose ungrouped, similarly named, or unmatched routes", () => {
    expect(isPublicRoute("/account")).toBe(false);
    expect(isPublicRoute("/(publicity)/login")).toBe(false);
    expect(isPublicRoute(null)).toBe(false);
  });
});
