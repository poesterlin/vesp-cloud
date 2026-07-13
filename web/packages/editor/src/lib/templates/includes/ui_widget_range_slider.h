#pragma once

#include "ui_widget_base.h"

class RangeSliderWidget : public Widget {
 public:
  const char *widget_label() const override { return "RangeSlider"; }

  using ValueCallback = std::function<void(float value)>;

  RangeSliderWidget(UiRect rect, const char *label,
                    float min_value, float max_value, float step,
                    float value,
                    const char *unit = "",
                    int value_decimals = 1)
      : rect_(rect),
        label_(label),
        min_value_(min_value),
        max_value_(max_value),
        step_(step > 0.0f ? step : 0.1f),
        value_(clamp_to_step(value)),
        unit_(unit),
        value_decimals_(value_decimals < 0 ? 0 : value_decimals) {
    if (max_value_ < min_value_) std::swap(min_value_, max_value_);
    last_value_ = value_;
    baseline_set_ = true;
  }

  UiRect bounds() const override { return screen_rect(rect_); }

  void set_accent(Color c) {
    accent_override_ = c;
    has_accent_override_ = true;
    mark_full_dirty();
  }

  void set_unit(const char *unit) {
    unit_ = unit ? unit : "";
    mark_full_dirty();
  }

  void bind(const float *value_ptr) {
    value_ptr_ = value_ptr;
    baseline_set_ = false;
    mark_dirty();
  }

  void on_change(ValueCallback cb) { on_change_ = std::move(cb); }
  void on_release(ValueCallback cb) { on_release_ = std::move(cb); }

  float value() const { return value_; }
  float min_value() const { return min_value_; }
  float max_value() const { return max_value_; }

  void mark_full_dirty() {
    needs_full_draw_ = true;
    mark_dirty();
  }

  void set_value(float v, bool notify = false) {
    v = clamp_to_step(v);
    if (value_ == v) return;
    value_ = v;
    mark_full_dirty();
    if (notify && on_change_) on_change_(value_);
  }

  void update(uint32_t now) override {
    (void)now;
    if (!dragging_ && value_ptr_) {
      const float v = clamp_to_step(*value_ptr_);
      if (!baseline_set_ ||
          ui_value_changed_quantized(v, last_value_, step_)) {
        value_ = v;
        mark_full_dirty();
      }
    }
    Widget::update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    const UiRect r = screen_rect(rect_);
    const SliderLayout l = compute_layout_(r);

    if (event.type == TouchType::Down) {
      if (!hit_test_(l, event.x, event.y)) return false;
      dragging_ = true;
      apply_drag_(l, event.x, /*commit=*/false);
      return true;
    }

    if (event.type == TouchType::Move) {
      if (!dragging_) return false;
      apply_drag_(l, event.x, /*commit=*/false);
      return true;
    }

    if (event.type == TouchType::Up || event.type == TouchType::Tap) {
      if (!dragging_) return false;
      apply_drag_(l, event.x, /*commit=*/true);
      dragging_ = false;
      mark_full_dirty();
      return true;
    }

    return false;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    const UiRect r = screen_rect(rect_);
#if UI_THEME_RETRO
    draw_retro_(it, r);
#else
    draw_modern_(it, r);
#endif
    last_value_ = value_;
    baseline_set_ = true;
  }

 private:
  struct SliderLayout {
    int pad;
    int header_h;
    int track_x;
    int track_y;
    int track_w;
    int track_h;
    int thumb_r;
    int hit_r;
    int value_y;
    int label_y;
  };

  SliderLayout compute_layout_(const UiRect &r) const {
    SliderLayout l;
    l.pad = ui_spacing::lg;
    l.header_h = 22;
    l.thumb_r = 12;
    l.hit_r = std::max(UI_MIN_TOUCH_TARGET / 2, l.thumb_r + 6);
    l.label_y = r.y + l.pad;
#if UI_THEME_RETRO
    l.track_h = 10;
#else
    l.track_h = 8;
#endif
    l.track_x = r.x + l.pad + l.thumb_r;
    l.track_w = r.w - 2 * l.pad - 2 * l.thumb_r;
    if (l.track_w < 8) l.track_w = 8;
    const int body_top = r.y + l.pad + l.header_h + 2;
    const int body_bot = r.y + r.h - l.pad - 18;
    l.track_y = body_top + (body_bot - body_top) / 2 - l.track_h / 2;
    l.value_y = r.y + r.h - l.pad - 14;
    return l;
  }

  int value_to_x_(const SliderLayout &l, float v) const {
    const float span = max_value_ - min_value_;
    if (span <= 0.0f) return l.track_x;
    float t = (v - min_value_) / span;
    if (t < 0.0f) t = 0.0f;
    if (t > 1.0f) t = 1.0f;
    return l.track_x + static_cast<int>(std::lround(t * l.track_w));
  }

  float x_to_value_(const SliderLayout &l, int x) const {
    if (l.track_w <= 0) return min_value_;
    float t = static_cast<float>(x - l.track_x) / static_cast<float>(l.track_w);
    if (t < 0.0f) t = 0.0f;
    if (t > 1.0f) t = 1.0f;
    return clamp_to_step(min_value_ + t * (max_value_ - min_value_));
  }

  float clamp_to_step(float v) const {
    if (v < min_value_) v = min_value_;
    if (v > max_value_) v = max_value_;
    if (step_ <= 0.0f) return v;
    const float q = std::lround((v - min_value_) / step_) * step_ + min_value_;
    if (q < min_value_) return min_value_;
    if (q > max_value_) return max_value_;
    return q;
  }

  bool hit_test_(const SliderLayout &l, int tx, int ty) const {
    const int cx = value_to_x_(l, value_);
    const int cy = l.track_y + l.track_h / 2;
    const int dx = tx - cx;
    const int dy = ty - cy;
    const int hit2 = l.hit_r * l.hit_r;
    if (dx * dx + dy * dy <= hit2) return true;
    return ty >= l.track_y - l.hit_r && ty <= l.track_y + l.track_h + l.hit_r;
  }

  void apply_drag_(const SliderLayout &l, int tx, bool commit) {
    float next = x_to_value_(l, tx);
    if (next < min_value_) next = min_value_;
    if (next > max_value_) next = max_value_;
    const bool changed = ui_value_changed_quantized(next, value_, step_);
    if (changed) {
      const int old_cx = value_to_x_(l, value_);
      value_ = next;
      const int new_cx = value_to_x_(l, value_);
      mark_track_dirty_(l, old_cx, new_cx);
      if (on_change_) on_change_(value_);
    } else {
      value_ = next;
    }
    if (commit && on_release_) {
      on_release_(value_);
    }
  }

  void mark_track_dirty_(const SliderLayout &l, int old_cx, int new_cx) {
    const int rad = l.thumb_r + 3;
    const int left_cx = std::min(old_cx, new_cx);
    const int right_cx = std::max(old_cx, new_cx);
    int left = std::min(l.track_x - rad, left_cx - rad);
    int right = std::max(l.track_x + l.track_w + rad, right_cx + rad);
    int top = l.track_y - rad;
    int bottom = l.track_y + l.track_h + rad;
    UiInvalidation::request_rect(
        UiDirtyRect{left, top, right - left, bottom - top}, "slider:drag");
  }

  Color accent_() const {
    if (has_accent_override_) return accent_override_;
#if UI_THEME_RETRO
    return RetroColors::CYAN;
#else
    return Color(80, 180, 255);
#endif
  }

  void draw_modern_(display::Display &it, const UiRect &r) {
    const SliderLayout l = compute_layout_(r);
    const Color accent = accent_();
    const Color bg(12, 16, 24);
    const Color track_bg(28, 34, 46);
    const Color track_border(42, 50, 66);
    const Color fill = accent;
    const Color dim(140, 150, 168);
    const Color thumb_fill(250, 252, 255);
    const Color thumb_ring = accent;

    // Only redraw the box background and label on a non-drag full redraw.
    // During dragging, dirty rects are constrained to the thumb + track
    // region so the expensive background fill is skipped → no flicker.
    if (needs_full_draw_) {
      draw_clipped_box(it, r.x, r.y, r.w, r.h,
                       ui_corner_radius_for_height(r.h), track_border, bg, false);

      if (label_ && label_[0] && g_theme.label.font != nullptr) {
        const int max_label_w = r.w - 2 * l.pad - 110;
        ui_print_truncated(it, r.x + l.pad, l.label_y,
                           g_theme.label.font, dim,
                           TextAlign::TOP_LEFT, label_, max_label_w);
      }
      needs_full_draw_ = false;
    }

    const int track_mid = l.track_y + l.track_h / 2;
    ui_fast_filled_rectangle(it, l.track_x, l.track_y, l.track_w, l.track_h,
                             track_bg);
    it.rectangle(l.track_x, l.track_y, l.track_w, l.track_h, track_border);

    const int cx = value_to_x_(l, value_);
    if (cx > l.track_x) {
      ui_fast_filled_rectangle(it, l.track_x, l.track_y + 1, cx - l.track_x,
                               l.track_h - 2, fill);
    }

    const int rad = dragging_ ? l.thumb_r + 2 : l.thumb_r;
    it.filled_circle(cx, track_mid, rad, thumb_fill);
    it.circle(cx, track_mid, rad, thumb_ring);
    it.circle(cx, track_mid, rad - 1, thumb_ring);
    it.filled_circle(cx, track_mid, 3, accent);
  }

#if UI_THEME_RETRO
  void draw_retro_(display::Display &it, const UiRect &r) {
    const SliderLayout l = compute_layout_(r);
    const Color accent = accent_();
    const Color accent_hi = RetroColors::AMBER;
    const Color bg = RetroColors::VOID;
    const Color track_bg = RetroColors::DIMMER;
    const Color dim = RetroColors::STEEL;
    const Color fill = accent;

    // Skip expensive static decorations during drag (box, border, corners,
    // divider, label). Only the track + thumb region is dirty → no flicker.
    if (needs_full_draw_) {
      draw_clipped_box(it, r.x, r.y, r.w, r.h,
                       ui_corner_radius_for_height(r.h), accent, bg, true);
      draw_clipped_border(it, r.x + 2, r.y + 2, r.w - 4, r.h - 4,
                          7, 7, 7, 7, RetroColors::DIMMER);
      draw_corner_accent_tl(it, r.x + 4, r.y + 4, 5, RetroColors::CYAN_DIM);
      draw_corner_accent_tr(it, r.x + r.w - 5, r.y + 4, 5, RetroColors::CYAN_DIM);
      draw_corner_accent_bl(it, r.x + 4, r.y + r.h - 5, 5, RetroColors::CYAN_DIM);
      draw_corner_accent_br(it, r.x + r.w - 5, r.y + r.h - 5, 5,
                            RetroColors::CYAN_DIM);

      if (label_ && label_[0] && g_theme.header.font != nullptr) {
        const int max_label_w = r.w - 2 * l.pad - 120;
        ui_print_truncated(it, r.x + l.pad, l.label_y,
                           g_theme.header.font, dim,
                           TextAlign::TOP_LEFT, label_, max_label_w);
      }

      {
        const int div_y = l.label_y + l.header_h;
        draw_dashed_hline(it, r.x + l.pad, r.x + r.w - l.pad, div_y,
                          RetroColors::DIMMER, 3, 3);
      }
      needs_full_draw_ = false;
    }

    const int track_mid = l.track_y + l.track_h / 2;
    ui_fast_filled_rectangle(it, l.track_x, l.track_y, l.track_w, l.track_h,
                             track_bg);
    it.rectangle(l.track_x - 1, l.track_y - 1, l.track_w + 2, l.track_h + 2,
                 RetroColors::DIM);

    const int cx = value_to_x_(l, value_);
    if (cx > l.track_x) {
      ui_fast_filled_rectangle(it, l.track_x, l.track_y, cx - l.track_x, l.track_h, fill);
      if (l.track_h >= 4) {
        it.horizontal_line(l.track_x, l.track_y + 1, cx - l.track_x, RetroColors::CYAN);
      }
    }

    const Color bc = dragging_ ? accent_hi : accent;
    const int half = dragging_ ? l.thumb_r + 1 : l.thumb_r;
    const int side = half * 2;
    const int tx = cx - half;
    const int ty = track_mid - half;
    ui_fast_filled_rectangle(it, tx, ty, side, side, RetroColors::VOID);
    it.rectangle(tx, ty, side, side, bc);
    it.rectangle(tx + 1, ty + 1, side - 2, side - 2, bc);
    ui_fast_filled_rectangle(it, tx + 3, ty + 3, side - 6, side - 6, bc);
    const int arm = 3;
    draw_corner_accent_tl(it, tx - 1, ty - 1, arm, bc);
    draw_corner_accent_tr(it, tx + side, ty - 1, arm, bc);
    draw_corner_accent_bl(it, tx - 1, ty + side, arm, bc);
    draw_corner_accent_br(it, tx + side, ty + side, arm, bc);
  }
#endif

  UiRect rect_;
  const char *label_ = nullptr;
  float min_value_ = 0.0f;
  float max_value_ = 100.0f;
  float step_ = 1.0f;
  float value_ = 50.0f;
  const char *unit_ = "";
  int value_decimals_ = 1;

  const float *value_ptr_ = nullptr;

  ValueCallback on_change_;
  ValueCallback on_release_;

  Color accent_override_{0, 0, 0};
  bool has_accent_override_ = false;

  bool dragging_ = false;
  float last_value_ = 50.0f;
  bool baseline_set_ = false;
  bool needs_full_draw_ = true;
};
