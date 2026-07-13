#pragma once

#include "ui_widget_base.h"

class LoadingWidget : public Widget {
 public:
  const char *widget_label() const override { return "Loading"; }
  UiRect bounds() const override { return UiRect{0, 0, 480, 480}; }

  bool is_visible(const UiState &state) const override {
    loading_visible_ = state.should_show_loading();
    return loading_visible_;
  }

  bool is_loading_widget() const override { return true; }

  void update(uint32_t now) override {
    if (!loading_visible_) return;
    if (now - last_dirty_ms_ >= loading_redraw_interval_ms) {
      mark_dirty();
      last_dirty_ms_ = now;
    }
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    const int fx = 120, fy = 178, fw = 240, fh = 196;
    ui_fast_filled_rectangle(it, fx, fy, fw, fh, RetroColors::VOID);

    const int cx = 240, cy = 227;
    const uint32_t t = millis();

    const int segments = 8;
    for (int i = 0; i < segments; i++) {
      float angle = (t * 0.004f) + (i * 2.0f * 3.14159265f / segments);
      int r1 = 14, r2 = 20;
      Color c = RetroColors::CYAN;
      float alpha = 0.3f + 0.7f * (float)i / (float)(segments - 1);
      c.r = (uint8_t)(c.r * alpha);
      c.g = (uint8_t)(c.g * alpha);
      c.b = (uint8_t)(c.b * alpha);
      it.line(cx + (int)(cosf(angle) * r1), cy + (int)(sinf(angle) * r1),
              cx + (int)(cosf(angle) * r2), cy + (int)(sinf(angle) * r2), c);
    }

    if (g_theme.header.font != nullptr) {
      it.printf(cx, cy + 44, g_theme.header.font, RetroColors::CYAN,
                TextAlign::CENTER, "CONNECTING");
    }

    draw_clipped_border(it, 150, cy + 62, 180, 4, 2, 2, 2, 2, RetroColors::DIMMER);
    const float progress = (float)(t % 2000) / 2000.0f;
    const int pw = (int)(180.0f * progress);
    if (pw > 0) {
      ui_fast_filled_rectangle(it, 150, cy + 62, pw, 4, RetroColors::CYAN);
    }

    if (g_theme.label.font != nullptr) {
      it.printf(cx, cy + 77, g_theme.label.font, RetroColors::STEEL,
                TextAlign::CENTER, "vESP.cloud v2.0");
    }
  }

 private:
  static constexpr uint32_t loading_redraw_interval_ms = 200;
  uint32_t last_dirty_ms_ = 0;
  mutable bool loading_visible_ = true;
};
