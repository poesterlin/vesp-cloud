#pragma once

#include "ui_widget_base.h"

class LabelWidget : public Widget {
 public:
  const char *widget_label() const override { return "Label"; }
  LabelWidget(UiRect rect, const char *text, const Theme::TextStyle &style)
      : rect_(rect), text_(text), style_(&style) {}

  template<typename T>
  LabelWidget(UiRect rect, const char *fmt, const T *value)
      : rect_(rect), text_(fmt), style_(&g_theme.label) {
    printer_ = [value, fmt](display::Display &it, int x, int y,
                             esphome::font::Font *f, Color c, TextAlign a) {
      it.printf(x, y, f, c, a, fmt, *value);
    };
  }

  void set_bg_color(Color c) { bg_color_ = c; mark_dirty(); }
  void set_color(Color c) {
    color_override_ = c;
    has_color_override_ = true;
    mark_dirty();
  }
  void set_align(TextAlign a) {
    align_ = a;
    has_align_override_ = true;
    mark_dirty();
  }

  UiRect bounds() const override { return screen_rect(rect_); }

  void bind(const bool *value, const char *on_text = "ON", const char *off_text = "OFF") {
    bound_bool_ = value;
    on_text_ = on_text;
    off_text_ = off_text;
    last_bool_ = value != nullptr ? *value : false;
    bool_baseline_set_ = (value != nullptr);
    mark_dirty();
  }

  template<typename T>
  void bind(const T *value, const char *fmt) {
    printer_ = [value, fmt](display::Display &it, int x, int y,
                             esphome::font::Font *f, Color c, TextAlign a) {
      it.printf(x, y, f, c, a, fmt, *value);
    };
    mark_dirty();
  }

  // Bind the label to a runtime-computed string. Used by the codegen to
  // render templates with multiple bindings (e.g. "Temp: {{sensor.x}}").
  // The function is polled on every update() so the widget can self-mark
  // dirty when any contributing input changes, and is invoked again at
  // draw() time to produce the final string.
  void bind_text_fn(std::function<std::string()> fn) {
    text_fn_ = std::move(fn);
    // Pre-render once so the very first draw has something sensible to
    // show. If the lambda happens to throw (e.g. accessing a not-yet-
    // initialised observable), we'd rather catch it here at setup time
    // than at a random later moment when we'd lose the call site.
    if (text_fn_) {
      last_text_ = text_fn_();
      text_baseline_set_ = true;
    }
    mark_dirty();
  }

  // Poll bound state and mark dirty if it changed since the last draw. This is
  // what makes the "only the label that actually changed redraws" optimisation
  // work for the common bound-bool case (LED on/off, button A/B, etc.).
  void update(uint32_t now) override {
    if (bound_bool_ != nullptr) {
      const bool current = *bound_bool_;
      if (!bool_baseline_set_ || current != last_bool_) {
        mark_dirty();
      }
    }
    // Skip the text recompute when we're known to be hidden -- the
    // visibility check is the only thing that could make this widget
    // redraw, and `mark_dirty()` while hidden would only invalidate
    // pixels nobody is going to repaint anyway. This also avoids the
    // per-frame heap allocation for templated labels stacked inside
    // conditional areas (only one variant is on-screen at a time).
    const bool currently_visible = !visibility_check_ || visibility_check_();
    if (text_fn_ && currently_visible) {
      std::string current = text_fn_();
      if (!text_baseline_set_) {
        last_text_ = std::move(current);
        text_baseline_set_ = true;
      } else if (current != last_text_) {
        last_text_ = std::move(current);
        mark_dirty();
      }
    }
    Widget::update(now);
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    if (style_ == nullptr || style_->font == nullptr) return;

    auto *f = style_->font;
    auto cl = has_color_override_ ? color_override_ : style_->color;
    auto a = text_align();
    const UiRect r = screen_rect(rect_);
    const int x = text_anchor_x(r, a);
    const int y = text_anchor_y(r);

    // All string render paths truncate to rect_.w with an ellipsis so the
    // label never bleeds outside its bounds, no matter what HA streams in.
    const int max_text_w = rect_.w > 4 ? rect_.w - 4 : rect_.w;

    if (bound_bool_ != nullptr) {
      bool on_trunc = false, off_trunc = false;
      std::string on_disp = ui_truncate_to_width(it, f, on_text_ ? on_text_ : "", max_text_w, &on_trunc);
      std::string off_disp = ui_truncate_to_width(it, f, off_text_ ? off_text_ : "", max_text_w, &off_trunc);
      const bool truncated = *bound_bool_ ? on_trunc : off_trunc;
      const std::string &display = *bound_bool_ ? on_disp : off_disp;
      const std::string &alt = *bound_bool_ ? off_disp : on_disp;
      const bool alt_truncated = *bound_bool_ ? off_trunc : on_trunc;
      const int draw_x = ui_anchor_x_for_truncation(x, a, truncated);
      const int alt_x = ui_anchor_x_for_truncation(x, a, alt_truncated);
      int tx, ty, tw, th, ax, ay, aw, ah;
      it.get_text_bounds(draw_x, y, display.c_str(), f, a, &tx, &ty, &tw, &th);
      it.get_text_bounds(alt_x, y, alt.c_str(), f, a, &ax, &ay, &aw, &ah);
      // Pad the bg rect by the indicator width on whichever side might
      // gain dots, so flipping on->off doesn't leave stale pixels.
      const int dot_pad = UI_TRUNC_DOTS_W + 2;
      const int left = (tx < ax ? tx : ax) - 2;
      const int right = std::max(tx + tw + (truncated ? dot_pad : 0),
                                 ax + aw + (alt_truncated ? dot_pad : 0)) + 2;
      ui_fast_filled_rectangle(it, left, ty, right - left, th, bg_color_);
      it.printf(draw_x, y, f, cl, a, "%s", display.c_str());
      if (truncated && !display.empty()) {
        int baseline_y = ui_get_baseline(it, draw_x, y, f, a);
        ui_draw_truncation_dots(it, tx + tw, baseline_y, cl);
      }
      last_bool_ = *bound_bool_;
      bool_baseline_set_ = true;
    } else if (text_fn_) {
      const UiRect current_bounds = text_draw_bounds(it, f, a, x, y, last_text_, max_text_w);
      UiRect clear_bounds = current_bounds;
      if (draw_bounds_set_) {
        clear_bounds = union_rects(clear_bounds, last_draw_bounds_);
      }
      ui_fast_filled_rectangle(it, clear_bounds.x, clear_bounds.y,
                               clear_bounds.w, clear_bounds.h, bg_color_);
      ui_print_truncated(it, x, y, f, cl, a, last_text_, max_text_w);
      last_draw_bounds_ = current_bounds;
      draw_bounds_set_ = true;
    } else if (printer_) {
      ui_fast_filled_rectangle(it, r.x, r.y, r.w, r.h, bg_color_);
      // printer_ wraps a templated bound value; we can't easily intercept
      // the formatted result, but in practice these are short numeric
      // labels (gauges, percentages) that fit by construction.
      printer_(it, x, y, f, cl, a);
    } else {
      bool truncated = false;
      std::string disp = ui_truncate_to_width(it, f, text_ ? text_ : "", max_text_w, &truncated);
      const int draw_x = ui_anchor_x_for_truncation(x, a, truncated);
      int tx, ty, tw, th;
      it.get_text_bounds(draw_x, y, disp.c_str(), f, a, &tx, &ty, &tw, &th);
      const int dot_pad = truncated ? (UI_TRUNC_DOTS_W + 2) : 0;
      ui_fast_filled_rectangle(it, tx - 2, ty, tw + 4 + dot_pad, th, bg_color_);
      it.printf(draw_x, y, f, cl, a, "%s", disp.c_str());
      if (truncated && !disp.empty()) {
        int baseline_y = ui_get_baseline(it, draw_x, y, f, a);
        ui_draw_truncation_dots(it, tx + tw, baseline_y, cl);
      }
      last_draw_bounds_ = UiRect{tx - 2, ty, tw + 4 + dot_pad, th};
      draw_bounds_set_ = true;
    }
  }

 private:
  UiRect union_rects(const UiRect &a, const UiRect &b) const {
    const int left = std::min(a.x, b.x);
    const int top = std::min(a.y, b.y);
    const int right = std::max(a.x + a.w, b.x + b.w);
    const int bottom = std::max(a.y + a.h, b.y + b.h);
    return UiRect{left, top, right - left, bottom - top};
  }

  UiRect text_draw_bounds(display::Display &it, esphome::font::Font *f,
                          TextAlign a, int x, int y,
                          const std::string &text, int max_text_w) const {
    bool truncated = false;
    std::string disp = ui_truncate_to_width(it, f, text, max_text_w, &truncated);
    const int draw_x = ui_anchor_x_for_truncation(x, a, truncated);
    int tx, ty, tw, th;
    it.get_text_bounds(draw_x, y, disp.c_str(), f, a, &tx, &ty, &tw, &th);
    const int dots_pad = truncated ? (UI_TRUNC_DOTS_W + 2) : 0;
    return UiRect{tx - 2, ty, tw + 4 + dots_pad, th};
  }

  TextAlign text_align() const {
    return ui_text_align_vertical_center(has_align_override_ ? align_ : style_->align);
  }

  int text_anchor_x(UiRect r, TextAlign align) const {
    if (ui_text_align_is_right(align)) return r.x + r.w;
    if (ui_text_align_is_center(align)) return r.x + (r.w / 2);
    return r.x;
  }

  int text_anchor_y(UiRect r) const { return r.y + (r.h / 2); }

  UiRect rect_;
  const char *text_;
  const Theme::TextStyle *style_ = nullptr;
  const bool *bound_bool_ = nullptr;
  const char *on_text_ = "ON";
  const char *off_text_ = "OFF";
  std::function<void(display::Display&, int, int, esphome::font::Font*, Color, TextAlign)> printer_;
  std::function<std::string()> text_fn_;
  std::string last_text_;
  bool text_baseline_set_ = false;
  Color bg_color_{RetroColors::VOID};
  TextAlign align_ = TextAlign::TOP_LEFT;
  bool has_align_override_ = false;
  UiRect last_draw_bounds_{0, 0, 0, 0};
  bool draw_bounds_set_ = false;
  Color color_override_{0, 0, 0};
  bool has_color_override_ = false;
  bool last_bool_ = false;
  bool bool_baseline_set_ = false;
};
