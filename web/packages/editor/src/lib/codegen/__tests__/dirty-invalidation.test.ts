/// <reference types="bun" />
import { describe, expect, test } from "bun:test";

async function includeSource(name: string): Promise<string> {
  return Bun.file(new URL(`../../templates/includes/${name}`, import.meta.url)).text();
}

describe("dirty-region architecture", () => {
  test("preserves concrete damage raised for the next frame", async () => {
    const source = await includeSource("ui_invalidation.h");

    expect(source).toContain("DamageSet current_");
    expect(source).toContain("DamageSet next_");
    expect(source).toContain("request_continue(const UiDirtyRect &rect");
    expect(source).toContain("current_ = next_");
    expect(source).not.toContain("request_partial()");
  });

  test("normalizes, coalesces, and bounds dirty rectangles", async () => {
    const source = await includeSource("ui_invalidation.h");

    expect(source).toContain("normalize_(input, rect)");
    expect(source).toContain("should_merge_(damage.rects[i], rect)");
    expect(source).toContain("MAX_DIRTY_RECTS");
    expect(source).toContain("SCREEN_WIDTH");
    expect(source).toContain("SCREEN_HEIGHT");
  });

  test("multi-frame images and scrolling retain explicit regions", async () => {
    const widgets = await includeSource("ui_widget_image.h");
    const screens = await includeSource("ui_screen_base.h");
    const detail = await includeSource("ui_scrollable_detail.h");

    expect(widgets).toContain('"image:tile"');
    expect(widgets).toContain('"image:deferred"');
    expect(screens).toContain('"screen:scroll"');
    expect(detail).toContain('"detail:scroll"');
    expect(`${widgets}${screens}${detail}`).not.toContain("request_partial()");
  });

  test("widgets draw through the paint-bounds clipping contract", async () => {
    const widgets = await includeSource("ui_widget_base.h");
    const screens = await includeSource("ui_screen_base.h");
    const tabs = await includeSource("ui_tab_container.h");

    expect(widgets).toContain("virtual UiRect paint_bounds() const");
    expect(widgets).toContain("virtual UiRect touch_bounds() const");
    expect(widgets).toContain("UiRect dirty_bounds() const");
    expect(widgets).toContain("void draw_clipped(");
    expect(screens).not.toContain("w->draw(it, state)");
    expect(tabs).not.toContain("w->draw(it, state)");
  });
});
