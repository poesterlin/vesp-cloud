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
    ui_fast_filled_rectangle(it, r.x, r.y, r.w, r.h, color_);
  }

 private:
  UiRect rect_;
  Color color_;
};
