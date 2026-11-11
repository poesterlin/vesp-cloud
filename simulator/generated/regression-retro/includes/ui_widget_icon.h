#pragma once

#include "ui_widget_base.h"

class IconWidget : public Widget {
 public:
  const char *widget_label() const override { return "Icon"; }
  IconWidget(UiRect rect, const char *glyph, const Theme::TextStyle &style)
      : rect_(rect), glyph_(glyph), style_(&style) {}

  UiRect bounds() const override { return screen_rect(rect_); }

  void set_color(Color c) {
    color_override_ = c;
    has_color_override_ = true;
    mark_dirty();
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    if (style_ == nullptr || style_->font == nullptr) return;
    if (glyph_ == nullptr || glyph_[0] == '\0') return;

    auto *f = style_->font;
    auto color = has_color_override_ ? color_override_ : style_->color;
    const UiRect r = screen_rect(rect_);
    const int cx = r.x + r.w / 2;
    const int cy = r.y + r.h / 2;
    it.printf(cx, cy, f, color, TextAlign::CENTER, "%s", glyph_);
  }

 private:
  UiRect rect_;
  const char *glyph_;
  const Theme::TextStyle *style_ = nullptr;
  Color color_override_{0, 0, 0};
  bool has_color_override_ = false;
};
