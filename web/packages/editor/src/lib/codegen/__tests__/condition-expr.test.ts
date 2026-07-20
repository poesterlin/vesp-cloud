/// <reference types="bun" />
import { describe, expect, test } from "bun:test";
import { emitConditionExpression } from "../condition-expr";

describe("time condition codegen", () => {
  test("emits a same-day range using local SNTP time", () => {
    const out = emitConditionExpression({ type: "time", after: "08:00", before: "20:00" });
    expect(out).toContain("sntp_time->now()");
    expect(out).toContain("ui_time_now.is_valid()");
    expect(out).toContain("ui_time_minutes >= 480 && ui_time_minutes < 1200");
  });

  test("emits an overnight range", () => {
    const out = emitConditionExpression({ type: "time", after: "22:00", before: "06:00" });
    expect(out).toContain("ui_time_minutes >= 1320 || ui_time_minutes < 360");
  });

  test("supports open-ended and equal-endpoint ranges", () => {
    expect(emitConditionExpression({ type: "time", after: "09:30" })).toContain("ui_time_minutes >= 570");
    expect(emitConditionExpression({ type: "time", before: "09:30" })).toContain("ui_time_minutes < 570");
    expect(emitConditionExpression({ type: "time", after: "00:00", before: "00:00" })).toContain("return true;");
  });

  test("fails closed for an invalid or empty range", () => {
    expect(emitConditionExpression({ type: "time" })).toBe("false");
    expect(emitConditionExpression({ type: "time", after: "25:00" })).toBe("false");
    expect(emitConditionExpression({ type: "time", after: "25:00", before: "06:00" })).toBe("false");
  });
});
