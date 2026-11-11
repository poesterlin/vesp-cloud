#pragma once

#include "ui_widget_base.h"

class RectWidget : public Widget {
 public:
  const char *widget_label() const override { return "Rect"; }
  RectWidget(UiRect rect, Color color) : rect_(rect), color_(color) {}
  bool is_background_widget() const override { return true; }

  UiRect bounds() const override { return screen_rect(rect_); }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    const UiRect r = screen_rect(rect_);
    if (r.w <= 0 || r.h <= 0) return;
    draw_clipped_box(it, r.x, r.y, r.w, r.h, 6, color_, color_, false);
  }

 private:
  UiRect rect_;
  Color color_;
};
