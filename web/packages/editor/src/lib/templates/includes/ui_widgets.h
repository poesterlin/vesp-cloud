#pragma once

#include "esphome.h"
#include "ui_invalidation.h"
#include "ui_types.h"
#include "ui_retro.h"
#include "esphome/components/image/image.h"
#include <algorithm>
#include <cmath>
#include <memory>
#include <vector>
#include <functional>
#include <string>

namespace esphome {
namespace font {
class Font;
}
namespace image {
class Image;
}
}  // namespace esphome

void ui_fast_filled_rectangle(display::Display &it, int x, int y, int w, int h, Color color);

// Width budget reserved for the painted truncation indicator (three
// 2x2 squares with 1px gaps). Keep in sync with ui_draw_truncation_dots.
constexpr int UI_TRUNC_DOT_SIZE = 2;
constexpr int UI_TRUNC_DOTS_W = 8;

// Truncate `text` so that, together with the painted truncation indicator
// (UI_TRUNC_DOTS_W pixels), it fits within `max_w` pixels when rendered
// with `font`. Returns the largest prefix that fits, WITHOUT any "..."
// suffix -- the caller is expected to paint the indicator via
// ui_draw_truncation_dots() iff `*truncated` ends up true. This keeps
// the indicator pixel-tight (~8px) instead of letting the font's "..."
// glyph eat ~30% of a label's horizontal real estate.
inline std::string ui_truncate_to_width(display::Display &it,
                                        esphome::font::Font *font,
                                        const std::string &text,
                                        int max_w,
                                        bool *truncated = nullptr) {
  if (truncated) *truncated = false;
  if (font == nullptr || text.empty() || max_w <= 0) return text;
  int x, y, w, h;
  it.get_text_bounds(0, 0, text.c_str(), font, TextAlign::TOP_LEFT, &x, &y, &w, &h);
  if (w <= max_w) return text;

  if (truncated) *truncated = true;
  // Budget the indicator dots out of `max_w` so the dots + truncated
  // text together fit. A tiny gap before the dots keeps them legible.
  const int dots_budget = UI_TRUNC_DOTS_W + 2;
  const int text_budget = max_w > dots_budget ? max_w - dots_budget : 0;

  std::string trimmed = text;
  while (!trimmed.empty()) {
    trimmed.pop_back();
    it.get_text_bounds(0, 0, trimmed.c_str(), font, TextAlign::TOP_LEFT, &x, &y, &w, &h);
    if (w <= text_budget) return trimmed;
  }
  return std::string();
}

// Paint the truncation indicator: three 2x2 px squares aligned above the
// text baseline at (after_x, baseline_y). `after_x` is the
// right edge of the last rendered glyph; the dots start there with a
// 2px gap, then 2px square + 1px gap repeated. Total width: 8px.
inline void ui_draw_truncation_dots(display::Display &it, int after_x, int baseline_y, Color color) {
  // Move up by the dot height twice: once to sit on top of the baseline,
  // and once more so the filled square never dips into/below it.
  const int y = baseline_y - (UI_TRUNC_DOT_SIZE * 2);
  int x = after_x + 2;
  for (int i = 0; i < 3; i++) {
    ui_fast_filled_rectangle(it, x, y, UI_TRUNC_DOT_SIZE, UI_TRUNC_DOT_SIZE, color);
    x += UI_TRUNC_DOT_SIZE + 1;
  }
}

// Compute the right-edge x coordinate of the rendered text bounds for
// the given anchor (x, y) and align. Used so callers can position the
// truncation indicator immediately after the last drawn glyph,
// regardless of alignment.
inline int ui_text_right_edge(display::Display &it, int x, int y,
                              esphome::font::Font *font, TextAlign align,
                              const std::string &text) {
  int tx, ty, tw, th;
  it.get_text_bounds(x, y, text.c_str(), font, align, &tx, &ty, &tw, &th);
  return tx + tw;
}

inline bool ui_text_align_is_center(TextAlign align) {
  return align == TextAlign::TOP_CENTER || align == TextAlign::CENTER ||
         align == TextAlign::BASELINE_CENTER || align == TextAlign::BOTTOM_CENTER;
}

inline bool ui_text_align_is_right(TextAlign align) {
  return align == TextAlign::TOP_RIGHT || align == TextAlign::CENTER_RIGHT ||
         align == TextAlign::BASELINE_RIGHT || align == TextAlign::BOTTOM_RIGHT;
}

inline TextAlign ui_text_align_vertical_center(TextAlign align) {
  if (ui_text_align_is_right(align)) return TextAlign::CENTER_RIGHT;
  if (ui_text_align_is_center(align)) return TextAlign::CENTER;
  return TextAlign::CENTER_LEFT;
}

// When text is truncated, the painted dot indicator is part of the visual
// label. Shift non-left anchors so text + dots stay aligned as one unit.
inline int ui_anchor_x_for_truncation(int x, TextAlign align, bool truncated) {
  if (!truncated) return x;
  const int dot_pad = UI_TRUNC_DOTS_W + 2;
  if (ui_text_align_is_right(align)) return x - dot_pad;
  if (ui_text_align_is_center(align)) return x - (dot_pad / 2);
  return x;
}

// Get the stable baseline of the font for the given alignment and y coordinate.
// By measuring a character without descenders (like "A"), we get a baseline
// that doesn't bounce up and down depending on whether the text has descenders.
inline int ui_get_baseline(display::Display &it, int x, int y,
                           esphome::font::Font *font, TextAlign align) {
  if (font == nullptr) return y;
  int tx, ty, tw, th;
  it.get_text_bounds(x, y, "A", font, align, &tx, &ty, &tw, &th);
  return ty + th;
}

// One-call helper: truncate `text` to `max_w` and draw it at (x, y)
// with `align`, painting the indicator dots after it iff truncated.
inline void ui_print_truncated(display::Display &it, int x, int y,
                               esphome::font::Font *font, Color color,
                               TextAlign align, const std::string &text,
                               int max_w) {
  bool truncated = false;
  std::string disp = ui_truncate_to_width(it, font, text, max_w, &truncated);
  if (font == nullptr) return;
  const int draw_x = ui_anchor_x_for_truncation(x, align, truncated);
  it.printf(draw_x, y, font, color, align, "%s", disp.c_str());
  if (!truncated || disp.empty()) return;
  int tx, ty, tw, th;
  it.get_text_bounds(draw_x, y, disp.c_str(), font, align, &tx, &ty, &tw, &th);
  int baseline_y = ui_get_baseline(it, draw_x, y, font, align);
  ui_draw_truncation_dots(it, tx + tw, baseline_y, color);
}

struct UiState;

struct UiRect {
  int x;
  int y;
  int w;
  int h;

  bool contains(int tx, int ty, int slop_x = 0, int slop_y = 0) const {
    return tx >= x - slop_x && tx <= x + w + slop_x && ty >= y - slop_y && ty <= y + h + slop_y;
  }
};

struct Theme {
  struct TextStyle {
    esphome::font::Font *font = nullptr;
    Color color = Color(255, 255, 255);
    TextAlign align = TextAlign::TOP_LEFT;
  };

  struct ButtonStyle {
    Color border_color = RetroColors::CYAN;
    Color text_color = RetroColors::WHITE;
    esphome::font::Font *font = nullptr;
  };

  TextStyle header   = {nullptr, RetroColors::CYAN, TextAlign::TOP_LEFT};
  TextStyle label    = {nullptr, RetroColors::LIGHT, TextAlign::TOP_LEFT};
  TextStyle icon     = {nullptr, RetroColors::WHITE, TextAlign::CENTER};
  Color     info_bg  = RetroColors::VOID;

  ButtonStyle primary = {RetroColors::CYAN, RetroColors::WHITE, nullptr};
  ButtonStyle accent  = {RetroColors::AMBER, RetroColors::WHITE, nullptr};
  ButtonStyle neutral = {RetroColors::GRAY, RetroColors::WHITE, nullptr};
  ButtonStyle success = {RetroColors::GREEN, RetroColors::WHITE, nullptr};
};

inline Theme g_theme;

class Widget {
 public:
  virtual ~Widget() = default;
  virtual void enter() {}
  virtual void exit() {}
  virtual void layout() {}

  // Default update() polls the visibility_check_ lambda and self-marks dirty
  // when its result flips. This is what makes conditional-area variants (and
  // anything else using set_visibility_condition) repaint when the underlying
  // state changes -- the codegen sets a visibility lambda on each variant
  // child, and this poll detects the flip from active->inactive / vice versa.
  //
  // Subclasses that override update() MUST call Widget::update(now) at the
  // end (or beginning) or they'll lose visibility-driven dirty marking.
  virtual void update(uint32_t now) {
    (void)now;
    if (visibility_check_) {
      const bool current = visibility_check_();
      if (!visibility_baseline_set_ || current != last_visibility_) {
        mark_dirty();
        last_visibility_ = current;
        visibility_baseline_set_ = true;
      }
    }
  }

  virtual bool handle_touch(const TouchEvent &event, uint32_t now) { return false; }
  virtual void draw(display::Display &it, const UiState &state) = 0;

  // Bounding box used by the dirty-rect machinery. Widgets with a fixed
  // rectangle override this to return their rect_; widgets that paint
  // outside a single box can return a conservative superset. Default is
  // the full screen, which means "I might be anywhere -> always redraw me".
  virtual UiRect bounds() const { return UiRect{0, 0, 480, 480}; }

  // Override the rect that mark_dirty() invalidates. By default mark_dirty
  // invalidates bounds(); widgets inside a "container" like a conditional
  // area set this to the container rect so that when they (dis)appear, the
  // shared background + sibling variant widgets all repaint together. Without
  // this, a small per-widget dirty rect would cause the bg to fill the whole
  // container and erase siblings that don't intersect the dirty rect.
  void set_dirty_bounds(UiRect b) {
    dirty_bounds_ = b;
    has_custom_dirty_bounds_ = true;
  }

  // Mark this widget's bounds dirty so it (and only it) is redrawn on the
  // next render pass. Use this from state-change handlers / update() polls.
  void mark_dirty() {
    const UiRect b = has_custom_dirty_bounds_ ? dirty_bounds_ : bounds();
    UiInvalidation::request_rect(UiDirtyRect{b.x, b.y, b.w, b.h});
  }

  // Should this widget actually be drawn this frame? Combines visibility
  // and dirty-rect intersection.
  bool needs_draw(const UiState &state) const {
    if (!is_visible(state)) return false;
    const auto b = bounds();
    return UiInvalidation::needs_redraw_in(b.x, b.y, b.w, b.h);
  }

  virtual bool is_visible(const UiState &state) const {
    (void)state;
    if (visibility_check_) return visibility_check_();
    return true;
  }

  virtual bool is_loading_widget() const { return false; }

  void set_visibility_condition(std::function<bool()> check) {
    visibility_check_ = std::move(check);
  }

 protected:
  std::function<bool()> visibility_check_;
  UiRect dirty_bounds_{0, 0, 0, 0};
  bool has_custom_dirty_bounds_ = false;
  bool last_visibility_ = false;
  bool visibility_baseline_set_ = false;
};

class RectWidget : public Widget {
 public:
  RectWidget(UiRect rect, Color color) : rect_(rect), color_(color) {}

  UiRect bounds() const override { return rect_; }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, rect_.h, color_);
  }

 private:
  UiRect rect_;
  Color color_;
};

class ImageWidget : public Widget {
 public:
  using Callback = std::function<void()>;

  static constexpr int TILE_ROWS = 32;

  ImageWidget(UiRect rect, esphome::image::Image *image,
              Color color_on = display::COLOR_ON,
              Color color_off = display::COLOR_OFF)
      : rect_(rect), image_(image),
        color_on_(color_on), color_off_(color_off) {}

  ImageWidget(UiRect rect, esphome::image::Image &image,
              Color color_on = display::COLOR_ON,
              Color color_off = display::COLOR_OFF)
      : ImageWidget(rect, &image, color_on, color_off) {}

  void on_tap(Callback cb) { tap_callback_ = std::move(cb); }

  void set_tint(Color on, Color off) {
    color_on_ = on;
    color_off_ = off;
  }

  void set_bg_color(Color c) { bg_color_ = c; }

  UiRect bounds() const override { return rect_; }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (!tap_callback_ || !fully_rendered_) return false;
    if (event.type != TouchType::Tap) return false;
    if (rect_.contains(event.x, event.y)) {
      tap_callback_();
      return true;
    }
    return false;
  }

  void draw(display::Display &it, const UiState &state) override {
    if (image_ == nullptr) return;

    if (image_->get_data_start() == nullptr) {
      draw_placeholder(it, true);
      return;
    }

    if (!fully_rendered_) {
      if (state.images_rendered_this_frame >= UiState::MAX_IMAGES_PER_FRAME
          && tile_row_ == 0) {
        draw_placeholder(it, false);
        if (!deferred_) {
          deferred_ = true;
          UiInvalidation::request_continue();
        }
        return;
      }
      render_tile(it, state);
      return;
    }

    ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, rect_.h, bg_color_);
    it.image(rect_.x, rect_.y, image_, color_on_, color_off_);
  }

 private:
  void render_tile(display::Display &it, const UiState &state) {
    const int iw = image_->get_width();
    const int ih = image_->get_height();
    if (iw <= 0 || ih <= 0) { fully_rendered_ = true; return; }

    const int ox = rect_.x + (rect_.w - iw) / 2;
    const int oy = rect_.y + (rect_.h - ih) / 2;

    if (tile_row_ == 0) {
      ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, rect_.h, bg_color_);
    }

    int tile_h = TILE_ROWS;
    if (tile_row_ + tile_h > ih) tile_h = ih - tile_row_;

    const uint8_t *data = image_->get_data_start();
    const uint8_t *tile_data = data + (tile_row_ * iw * 2);

    it.draw_pixels_at(ox, oy + tile_row_, iw, tile_h, tile_data,
                      display::COLOR_ORDER_RGB, display::COLOR_BITNESS_565,
                      true, 0, 0, 0);

    tile_row_ += TILE_ROWS;
    if (tile_row_ >= ih) {
      fully_rendered_ = true;
      deferred_ = false;
      return;
    }

    UiInvalidation::request_continue();
    const_cast<UiState&>(state).images_rendered_this_frame++;
  }

  void draw_placeholder(display::Display &it, bool downloading) const {
    ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, rect_.h, bg_color_);
    draw_clipped_border(it, rect_.x + 2, rect_.y + 2, rect_.w - 4, rect_.h - 4,
                        4, 4, 4, 4, RetroColors::DIMMER);
    if (g_theme.label.font != nullptr) {
      it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2,
                g_theme.label.font, RetroColors::DIMMER,
                TextAlign::CENTER, downloading ? "LOADING..." : "...");
    }
  }

  UiRect rect_;
  esphome::image::Image *image_;
  Color color_on_;
  Color color_off_;
  Color bg_color_{RetroColors::VOID};
  Callback tap_callback_;
  bool fully_rendered_ = false;
  bool deferred_ = false;
  int tile_row_ = 0;
};

class LabelWidget : public Widget {
 public:
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

  void set_bg_color(Color c) { bg_color_ = c; }
  void set_align(TextAlign a) {
    align_ = a;
    has_align_override_ = true;
  }

  UiRect bounds() const override { return rect_; }

  void bind(const bool *value, const char *on_text = "ON", const char *off_text = "OFF") {
    bound_bool_ = value;
    on_text_ = on_text;
    off_text_ = off_text;
    last_bool_ = value != nullptr ? *value : false;
    bool_baseline_set_ = (value != nullptr);
  }

  template<typename T>
  void bind(const T *value, const char *fmt) {
    printer_ = [value, fmt](display::Display &it, int x, int y,
                             esphome::font::Font *f, Color c, TextAlign a) {
      it.printf(x, y, f, c, a, fmt, *value);
    };
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
    }
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
      if (current != last_text_) {
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
    auto cl = style_->color;
    auto a = text_align();
    const int x = text_anchor_x(a);
    const int y = text_anchor_y();

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
      ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, rect_.h, bg_color_);
      ui_print_truncated(it, x, y, f, cl, a, last_text_, max_text_w);
    } else if (printer_) {
      ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, rect_.h, bg_color_);
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
    }
  }

 private:
  TextAlign text_align() const {
    return ui_text_align_vertical_center(has_align_override_ ? align_ : style_->align);
  }

  int text_anchor_x(TextAlign align) const {
    if (ui_text_align_is_right(align)) return rect_.x + rect_.w;
    if (ui_text_align_is_center(align)) return rect_.x + (rect_.w / 2);
    return rect_.x;
  }

  int text_anchor_y() const { return rect_.y + (rect_.h / 2); }

  UiRect rect_;
  const char *text_;
  const Theme::TextStyle *style_ = nullptr;
  const bool *bound_bool_ = nullptr;
  const char *on_text_ = "ON";
  const char *off_text_ = "OFF";
  std::function<void(display::Display&, int, int, esphome::font::Font*, Color, TextAlign)> printer_;
  std::function<std::string()> text_fn_;
  std::string last_text_;
  Color bg_color_{RetroColors::VOID};
  TextAlign align_ = TextAlign::TOP_LEFT;
  bool has_align_override_ = false;
  bool last_bool_ = false;
  bool bool_baseline_set_ = false;
};

class IconWidget : public Widget {
 public:
  IconWidget(UiRect rect, const char *glyph, const Theme::TextStyle &style)
      : rect_(rect), glyph_(glyph), style_(&style) {}

  UiRect bounds() const override { return rect_; }

  void set_color(Color c) {
    color_override_ = c;
    has_color_override_ = true;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    if (style_ == nullptr || style_->font == nullptr) return;
    if (glyph_ == nullptr || glyph_[0] == '\0') return;

    auto *f = style_->font;
    auto color = has_color_override_ ? color_override_ : style_->color;
    const int cx = rect_.x + rect_.w / 2;
    const int cy = rect_.y + rect_.h / 2;
    it.printf(cx, cy, f, color, TextAlign::CENTER, "%s", glyph_);
  }

 private:
  UiRect rect_;
  const char *glyph_;
  const Theme::TextStyle *style_ = nullptr;
  Color color_override_{0, 0, 0};
  bool has_color_override_ = false;
};

class ButtonWidget : public Widget {
 public:
  using Callback = std::function<void()>;

  ButtonWidget(UiRect rect, const char *label, Callback callback, const Theme::ButtonStyle &style)
      : rect_(rect), label_(label), callback_(callback), style_(&style) {}

  UiRect bounds() const override { return rect_; }

  // Configure an optional icon glyph drawn above the label using the
  // provided text style (typically `g_theme.icon` so the MDI font is used).
  void set_icon(const char *glyph, const Theme::TextStyle *icon_style) {
    icon_glyph_ = glyph;
    icon_style_ = icon_style;
  }

  void update(uint32_t now) override {
    if (loading_timeout_ms_ > 0 && loading_ && (now - loading_start_ms_ > loading_timeout_ms_)) {
      loading_ = false;
      mark_dirty();
    }
    Widget::update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (event.type != TouchType::Tap) return false;
    if (loading_) return false;
    
    // Safety: Don't trigger if API is not connected to avoid crashes
    if (esphome::api::global_api_server == nullptr || !esphome::api::global_api_server->is_connected()) {
      return false;
    }

    if (!hit_test(event.x, event.y)) return false;
    loading_ = true;
    loading_start_ms_ = now;
    mark_dirty();
    if (callback_) callback_();

    // Schedule a delayed reset to end the loading state and trigger redraw
    char name_buf[24];
    snprintf(name_buf, sizeof(name_buf), "btn_%p", this);
    esphome::App.scheduler.set_timeout(nullptr, name_buf, loading_timeout_ms_,
        [this]() {
          loading_ = false;
          mark_dirty();
          UiRedraw::trigger_display_update();
        });
    return true;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    if (style_ == nullptr || style_->font == nullptr) return;

    auto *f = style_->font;
    auto bc = style_->border_color;
    auto tc = style_->text_color;

    int c = (rect_.h < 40) ? 4 : 6;
    draw_clipped_box(it, rect_.x, rect_.y, rect_.w, rect_.h,
                     c, bc, RetroColors::DIM, true);

    if (loading_) {
      it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, f, tc, TextAlign::CENTER, "...");
      return;
    }

    const bool has_icon = icon_glyph_ != nullptr && icon_glyph_[0] != '\0'
                         && icon_style_ != nullptr && icon_style_->font != nullptr;
    const bool has_label = label_ != nullptr && label_[0] != '\0';
    const int cx = rect_.x + rect_.w / 2;
    const int cy = rect_.y + rect_.h / 2;

    if (has_icon && has_label) {
      // Try horizontal first (icon left of label). Falls back to the
      // stacked layout when either the label can't be reasonably
      // truncated next to the icon (e.g. very narrow button) or the
      // button is tall enough that stacking reads better anyway.
      int ix, iy, iw, ih;
      it.get_text_bounds(0, 0, icon_glyph_, icon_style_->font, TextAlign::TOP_LEFT, &ix, &iy, &iw, &ih);
      const int gap = 6;
      const int side_pad = 8;
      const int horiz_budget = rect_.w - 2 * side_pad - iw - gap;
      // Minimum label budget to bother going horizontal: room for at
      // least ~3 chars + ellipsis. Below that, vertical is more legible.
      int eps_x, eps_y, eps_w, eps_h;
      it.get_text_bounds(0, 0, "W...", f, TextAlign::TOP_LEFT, &eps_x, &eps_y, &eps_w, &eps_h);
      const bool horiz_fits = horiz_budget >= eps_w;
      // Stack only when the button is clearly tall enough for two
      // legible lines; otherwise prefer the horizontal layout even on
      // small buttons because the alternative is a clipped stack.
      const bool tall_enough_for_stack = rect_.h >= 56;

      if (horiz_fits && !tall_enough_for_stack) {
        bool truncated = false;
        std::string disp = ui_truncate_to_width(it, f, label_, horiz_budget, &truncated);
        int lx, ly, lw, lh;
        it.get_text_bounds(0, 0, disp.c_str(), f, TextAlign::TOP_LEFT, &lx, &ly, &lw, &lh);
        // Reserve the indicator's width in the group total so the icon+label
        // pair stays visually centered even when truncated.
        const int extra = truncated ? (UI_TRUNC_DOTS_W + 2) : 0;
        const int total_w = iw + gap + lw + extra;
        const int start_x = rect_.x + (rect_.w - total_w) / 2;
        it.printf(start_x + iw / 2, cy, icon_style_->font, tc, TextAlign::CENTER, "%s", icon_glyph_);
        const int label_x = start_x + iw + gap;
        it.printf(label_x, cy, f, tc, TextAlign::CENTER_LEFT, "%s", disp.c_str());
        if (truncated && !disp.empty()) {
          int tx, ty, tw, th;
          it.get_text_bounds(label_x, cy, disp.c_str(), f, TextAlign::CENTER_LEFT, &tx, &ty, &tw, &th);
          int baseline_y = ui_get_baseline(it, label_x, cy, f, TextAlign::CENTER_LEFT);
          ui_draw_truncation_dots(it, tx + tw, baseline_y, tc);
        }
      } else {
        it.printf(cx, cy - 12, icon_style_->font, tc, TextAlign::CENTER, "%s", icon_glyph_);
        ui_print_truncated(it, cx, cy + 14, f, tc, TextAlign::CENTER, label_, rect_.w - 12);
      }
    } else if (has_icon) {
      it.printf(cx, cy, icon_style_->font, tc, TextAlign::CENTER, "%s", icon_glyph_);
    } else if (has_label) {
      ui_print_truncated(it, cx, cy, f, tc, TextAlign::CENTER, label_, rect_.w - 12);
    }
  }

 private:
  bool hit_test(int tx, int ty) const {
    const int sx = rect_.w < 40 ? 15 : (rect_.w < 60 ? 10 : 0);
    const int sy = rect_.h < 40 ? 15 : (rect_.h < 60 ? 10 : 0);
    return rect_.contains(tx, ty, sx, sy);
  }

  UiRect rect_;
  const char *label_;
  Callback callback_;
  const Theme::ButtonStyle *style_ = nullptr;
  const char *icon_glyph_ = nullptr;
  const Theme::TextStyle *icon_style_ = nullptr;
  bool loading_ = false;
  uint32_t loading_start_ms_ = 0;
  uint32_t loading_timeout_ms_ = 350;
};

class ImageToggleWidget : public Widget {
 public:
  using Callback = std::function<void()>;

  ImageToggleWidget(UiRect rect, const char *label, const bool *on_state,
                    const char *icon_glyph, Callback callback,
                    Color on_color = Color(255, 180, 0),
                    Color off_color = Color(80, 80, 80))
      : rect_(rect), label_(label), on_state_(on_state),
        icon_glyph_(icon_glyph), callback_(std::move(callback)), on_color_(on_color),
        off_color_(off_color) {}

  void bind(const bool *on_state) { on_state_ = on_state; }

  UiRect bounds() const override { return rect_; }

  void update(uint32_t now) override {
    if (loading_timeout_ms_ > 0 && loading_ &&
        (now - loading_start_ms_ > loading_timeout_ms_)) {
      loading_ = false;
      mark_dirty();
    }
    if (on_state_ != nullptr) {
      bool current = *on_state_;
      if (current != last_on_state_) {
        mark_dirty();
      }
    }
    Widget::update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (event.type != TouchType::Tap) return false;
    if (loading_) return false;

    if (esphome::api::global_api_server == nullptr ||
        !esphome::api::global_api_server->is_connected()) {
      return false;
    }

    if (!hit_test(event.x, event.y)) return false;
    loading_ = true;
    loading_start_ms_ = now;
    mark_dirty();
    if (callback_) callback_();

    char name_buf[24];
    snprintf(name_buf, sizeof(name_buf), "itg_%p", this);
    esphome::App.scheduler.set_timeout(
        nullptr, name_buf, loading_timeout_ms_, [this]() {
          loading_ = false;
          mark_dirty();
          UiRedraw::trigger_display_update();
        });
    return true;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    bool is_on = on_state_ != nullptr ? *on_state_ : false;

    Color icon_color = is_on ? on_color_ : off_color_;

    int c = 6;
    draw_clipped_box(it, rect_.x, rect_.y, rect_.w, rect_.h,
                     c, icon_color, RetroColors::DIM, true);

    if (loading_) {
      float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
      int cx = rect_.x + 28;
      int cy = rect_.y + rect_.h / 2;
      int r = 10;
      it.line(cx, cy, cx + (int)(cosf(angle) * r),
              cy + (int)(sinf(angle) * r), icon_color);
      if (label_ != nullptr && g_theme.label.font != nullptr) {
        const int max_w = rect_.x + rect_.w - (rect_.x + 52) - 6;
        ui_print_truncated(it, rect_.x + 52, rect_.y + rect_.h / 2,
                           g_theme.label.font, icon_color,
                           TextAlign::CENTER_LEFT, label_, max_w);
      }
      return;
    }

    int icon_x = rect_.x + 28;
    int icon_y = rect_.y + rect_.h / 2;
    const bool has_mdi_icon =
        icon_glyph_ != nullptr && icon_glyph_[0] != '\0' &&
        g_theme.icon.font != nullptr;

    if (has_mdi_icon) {
      it.printf(icon_x, icon_y, g_theme.icon.font, icon_color, TextAlign::CENTER,
                "%s", icon_glyph_);
    } else {
      it.circle(icon_x, icon_y, 9, icon_color);
      if (is_on) {
        it.filled_circle(icon_x, icon_y, 6, icon_color);
        for (int i = 0; i < 8; i++) {
          float a = i * 3.14159265f / 4.0f;
          it.line(icon_x + (int)(cosf(a) * 11), icon_y + (int)(sinf(a) * 11),
                  icon_x + (int)(cosf(a) * 15), icon_y + (int)(sinf(a) * 15), icon_color);
        }
      }
    }

    if (label_ != nullptr && g_theme.label.font != nullptr) {
      const int max_w = rect_.x + rect_.w - (rect_.x + 52) - 6;
      ui_print_truncated(it, rect_.x + 52, rect_.y + rect_.h / 2,
                         g_theme.label.font, Color(255, 255, 255),
                         TextAlign::CENTER_LEFT, label_, max_w);
    }

    last_on_state_ = is_on;
  }

 private:
  bool hit_test(int tx, int ty) const {
    const int sx = rect_.w < 40 ? 15 : (rect_.w < 60 ? 10 : 0);
    const int sy = rect_.h < 40 ? 15 : (rect_.h < 60 ? 10 : 0);
    return rect_.contains(tx, ty, sx, sy);
  }

  UiRect rect_;
  const char *label_;
  const bool *on_state_ = nullptr;
  const char *icon_glyph_ = nullptr;
  Callback callback_;
  Color on_color_;
  Color off_color_;
  bool loading_ = false;
  uint32_t loading_start_ms_ = 0;
  uint32_t loading_timeout_ms_ = 350;
  bool last_on_state_ = false;
};

class TodoPreviewWidget : public Widget {
 public:
  using Callback = std::function<void()>;

  TodoPreviewWidget(UiRect rect, const std::string *items,
                    int max_items = 4, int row_height = 30,
                    bool scrollable = false, bool checkable = false,
                    Callback on_tap = nullptr,
                    const char *incomplete_icon = "",
                    const char *complete_icon = "",
                    const char *todo_entity = "")
      : rect_(rect), items_(items), scrollable_(scrollable),
        checkable_(checkable), on_tap_(std::move(on_tap)),
        incomplete_icon_(incomplete_icon),
        complete_icon_(complete_icon), todo_entity_(todo_entity) {
    if (max_items < 1) max_items_ = 1;
    else if (max_items > 10) max_items_ = 10;
    else max_items_ = max_items;

    if (row_height < 20) row_height_ = 20;
    else if (row_height > 80) row_height_ = 80;
    else row_height_ = row_height;
  }

  UiRect bounds() const override { return rect_; }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (!rect_.contains(event.x, event.y)) return false;

    if (event.type == TouchType::Down && scrollable_) {
      dragging_ = true;
      return true;
    }

    if (event.type == TouchType::Move && dragging_ && scrollable_) {
      const int content_h = static_cast<int>(rows_.size()) * row_height_;
      const int view_h = content_height();
      const int max_scroll = content_h > view_h ? (content_h - view_h) : 0;
      int next = scroll_offset_ - event.dy;
      if (next < 0) next = 0;
      if (next > max_scroll) next = max_scroll;
      if (next != scroll_offset_) {
        scroll_offset_ = next;
        mark_dirty();
      }
      return true;
    }

    if (event.type == TouchType::Up) {
      dragging_ = false;
      return scrollable_;
    }

    if (event.type == TouchType::Tap && checkable_) {
      const int idx = row_at(event.x, event.y);
      if (idx < 0 || idx >= static_cast<int>(rows_.size())) return true;
      rows_[idx].completed = !rows_[idx].completed;
      mark_dirty();
      if (rows_[idx].completed) {
        push_complete_to_ha(rows_[idx].summary);
      } else {
        push_needs_action_to_ha(rows_[idx].summary);
      }
      return true;
    }

    if (event.type == TouchType::Tap && !checkable_) {
      if (on_tap_) on_tap_();
      return true;
    }

    return true;
  }

  void update(uint32_t now) override {
    (void)now;
    if (items_ == nullptr) return;
    if (!baseline_set_ || *items_ != last_items_) {
      parse_rows(*items_);
      if (!scrollable_) scroll_offset_ = 0;
      mark_dirty();
    }
    Widget::update(now);
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    const Color border = RetroColors::AMBER;
    const Color bg(10, 12, 18);
    const Color text = RetroColors::WHITE;
    const Color due_ok = RetroColors::AMBER;
    const Color due_overdue = RetroColors::RED;
    const Color dim = RetroColors::GRAY;

    // Clipped-corner container
    draw_clipped_box(it, rect_.x, rect_.y, rect_.w, rect_.h,
                     8, border, bg, false);
    // Inner double-line
    draw_clipped_border(it, rect_.x + 2, rect_.y + 2, rect_.w - 4, rect_.h - 4,
                        6, 6, 6, 6, RetroColors::AMBER_DIM);

    if (items_ == nullptr || items_->empty()) {
      if (g_theme.label.font != nullptr) {
        it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, g_theme.label.font,
                  dim, TextAlign::CENTER, "LIST EMPTY");
      }
      last_items_.clear();
      baseline_set_ = true;
      return;
    }

    if (!baseline_set_ || *items_ != last_items_) {
      parse_rows(*items_);
    }

    if (rows_.empty()) {
      if (g_theme.label.font != nullptr) {
        it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, g_theme.label.font,
                  dim, TextAlign::CENTER, "LIST EMPTY");
      }
      last_items_ = *items_;
      baseline_set_ = true;
      return;
    }

    const int top_padding = 8;
    const int available_h = content_height();
    const int content_h = static_cast<int>(rows_.size()) * row_height_;
    const int max_scroll = content_h > available_h ? (content_h - available_h) : 0;
    if (!scrollable_) {
      scroll_offset_ = 0;
    } else if (scroll_offset_ > max_scroll) {
      scroll_offset_ = max_scroll;
    }

    int drawn = 0;
    const int max_rows_by_height = rect_.h > top_padding
        ? (rect_.h - top_padding) / row_height_ : 0;
    const int row_limit = (max_rows_by_height < max_items_) ? max_rows_by_height : max_items_;
    const int start_index = scrollable_ ? (scroll_offset_ / row_height_) : 0;
    const int pixel_offset = scrollable_ ? (scroll_offset_ % row_height_) : 0;

    for (int i = start_index; i < static_cast<int>(rows_.size()) && drawn < row_limit; i++) {
      auto &row = rows_[i];
      const int y = rect_.y + top_padding + drawn * row_height_ - pixel_offset;
      if (y + row_height_ < rect_.y + top_padding) {
        continue;
      }
      if (y > rect_.y + rect_.h - 2) {
        break;
      }

      const int row_cy = y + row_height_ / 2;
      const bool overdue = row.overdue;
      const bool completed = row.completed;
      std::string summary = row.summary;

      if (g_theme.label.font != nullptr) {
        const Color check_color = completed ? Color(0, 220, 120) : border;
        if (g_theme.icon.font != nullptr &&
            incomplete_icon_ != nullptr && complete_icon_ != nullptr &&
            incomplete_icon_[0] != '\0' && complete_icon_[0] != '\0') {
          it.printf(rect_.x + 16, row_cy, g_theme.icon.font,
                    check_color, TextAlign::CENTER,
                    "%s", completed ? complete_icon_ : incomplete_icon_);
        } else {
          it.printf(rect_.x + 10, row_cy, g_theme.label.font,
                    check_color, TextAlign::CENTER_LEFT,
                    "%s", completed ? "[x]" : "[ ]");
        }
      }

      int text_x = rect_.x + 38;
      if (!row.due.empty() && g_theme.label.font != nullptr) {
        const int due_max_w = 92;
        ui_print_truncated(it, rect_.x + 38, row_cy, g_theme.label.font,
                           overdue ? due_overdue : due_ok,
                           TextAlign::CENTER_LEFT, row.due, due_max_w);
        text_x = rect_.x + 134;
      }
      if (g_theme.label.font != nullptr) {
        const int summary_max_w = rect_.x + rect_.w - text_x - 4;
        bool summary_truncated = false;
        summary = ui_truncate_to_width(it, g_theme.label.font, summary, summary_max_w, &summary_truncated);
        const Color summary_color = completed ? dim : text;
        it.printf(text_x, row_cy, g_theme.label.font, summary_color, TextAlign::CENTER_LEFT,
                  "%s", summary.c_str());

        int tx, ty, tw, th;
        it.get_text_bounds(text_x, row_cy, summary.c_str(), g_theme.label.font, TextAlign::CENTER_LEFT, &tx, &ty, &tw, &th);
        int baseline_y = ui_get_baseline(it, text_x, row_cy, g_theme.label.font, TextAlign::CENTER_LEFT);
        if (summary_truncated && !summary.empty()) {
          ui_draw_truncation_dots(it, tx + tw, baseline_y, summary_color);
        }
        if (completed) {
          // Centered on the cap height of a standard non-descender letter "A"
          int bx, by, bw, bh;
          it.get_text_bounds(text_x, row_cy, "A", g_theme.label.font, TextAlign::CENTER_LEFT, &bx, &by, &bw, &bh);
          int line_y = by + bh / 2;
          // Extend the strikethrough through the truncation dots so the
          // visual cue stays continuous on long completed items.
          const int line_end = summary_truncated ? (tx + tw + UI_TRUNC_DOTS_W + 2) : (tx + tw);
          it.line(tx, line_y, line_end, line_y, dim);
        }
      }

      drawn++;
    }

    if (drawn == 0 && g_theme.label.font != nullptr) {
      it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, g_theme.label.font,
                dim, TextAlign::CENTER, "LIST EMPTY");
    }

    last_items_ = *items_;
    baseline_set_ = true;
  }

 private:
  struct TodoRow {
    std::string summary;
    std::string due;
    bool overdue = false;
    bool completed = false;
  };

  static void trim_inplace(std::string &value) {
    std::size_t f = value.find_first_not_of(" \t\r\n");
    if (f == std::string::npos) {
      value.clear();
      return;
    }
    std::size_t l = value.find_last_not_of(" \t\r\n");
    value = value.substr(f, l - f + 1);
  }

  int content_height() const {
    const int top_padding = 8;
    int h = rect_.h - top_padding - 2;
    return h > 0 ? h : 0;
  }

  int row_at(int tx, int ty) const {
    (void)tx;
    const int top = rect_.y + 8;
    const int local_y = ty - top + (scrollable_ ? scroll_offset_ : 0);
    if (local_y < 0) return -1;
    const int idx = local_y / row_height_;
    if (idx < 0 || idx >= static_cast<int>(rows_.size())) return -1;
    return idx;
  }

  void parse_rows(const std::string &src) {
    rows_.clear();
    std::size_t start = 0;
    while (start <= src.size()) {
      std::size_t end = src.find('\n', start);
      std::string line = (end == std::string::npos)
          ? src.substr(start)
          : src.substr(start, end - start);
      trim_inplace(line);
      if (!line.empty() && line != "LIST EMPTY") {
        TodoRow row;
        row.summary = line;
        std::size_t p1 = line.find('|');
        if (p1 != std::string::npos) {
          row.summary = line.substr(0, p1);
          std::string rest = line.substr(p1 + 1);
          std::size_t p2 = rest.find('|');
          std::string status;
          if (p2 != std::string::npos) {
            row.due = rest.substr(0, p2);
            status = rest.substr(p2 + 1);
          } else {
            row.due = rest;
          }
          trim_inplace(status);
          row.overdue = status.find("overdue") != std::string::npos;
          row.completed = status.find("completed") != std::string::npos;
        }
        trim_inplace(row.summary);
        trim_inplace(row.due);
        if (row.due == "none" || row.due == "no-date") {
          row.due.clear();
        }
        if (!row.summary.empty()) {
          rows_.push_back(row);
        }
      }
      if (end == std::string::npos) break;
      start = end + 1;
    }
  }

  void push_todo_status(const std::string &summary, const char *status) {
    if (todo_entity_ == nullptr || todo_entity_[0] == '\0') return;
    auto *api = esphome::api::global_api_server;
    if (api == nullptr || !api->is_connected()) return;
    esphome::api::HomeAssistantServiceCallAction<> call(api, false);
    call.set_service("todo.update_item");
    call.init_data(3);
    call.add_data("entity_id", todo_entity_);
    call.add_data("item", summary);
    call.add_data("status", status);
    call.play();
  }

  void push_complete_to_ha(const std::string &summary) {
    push_todo_status(summary, "completed");
  }

  void push_needs_action_to_ha(const std::string &summary) {
    push_todo_status(summary, "needs_action");
  }

  UiRect rect_;
  const std::string *items_ = nullptr;
  int max_items_ = 4;
  int row_height_ = 30;
  bool scrollable_ = false;
  bool checkable_ = false;
  Callback on_tap_;
  const char *incomplete_icon_ = nullptr;
  const char *complete_icon_ = nullptr;
  const char *todo_entity_ = nullptr;
  std::vector<TodoRow> rows_;
  int scroll_offset_ = 0;
  bool dragging_ = false;
  std::string last_items_;
  bool baseline_set_ = false;
};

class NotificationOverlayWidget : public Widget {
 public:
  NotificationOverlayWidget(const std::string *title, const std::string *body,
                            const std::string *severity,
                            const std::string *dismissed,
                            int display_w = 480, int display_h = 480)
      : title_(title), body_(body), severity_(severity),
        dismissed_(dismissed), display_w_(display_w), display_h_(display_h) {}

  void set_dismiss_callback(std::function<void()> cb) {
    dismiss_callback_ = std::move(cb);
  }

  UiRect bounds() const override { return UiRect{0, 0, display_w_, display_h_}; }

  bool is_visible(const UiState &state) const override {
    (void)state;
    if (body_ == nullptr || body_->empty()) return false;
    if (dismissed_ != nullptr && !dismissed_->empty() && *dismissed_ == *body_) return false;
    return true;
  }

  void update(uint32_t now) override {
    Widget::update(now);
    if (body_ == nullptr) return;
    const bool visible_now = is_visible_state();
    if (!baseline_set_) {
      last_body_ = *body_;
      if (dismissed_ != nullptr) last_dismissed_ = *dismissed_;
      was_visible_ = visible_now;
      baseline_set_ = true;
      if (visible_now) mark_dirty();
      return;
    }
    bool changed = false;
    if (*body_ != last_body_) { last_body_ = *body_; changed = true; }
    if (dismissed_ != nullptr && *dismissed_ != last_dismissed_) {
      last_dismissed_ = *dismissed_;
      changed = true;
    }
    if (was_visible_ != visible_now) {
      UiInvalidation::request_full();
      was_visible_ = visible_now;
    } else if (changed && visible_now) {
      mark_dirty();
    }
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (event.type != TouchType::Tap) return false;
    // Dismiss button hit test (bottom-center region of the panel).
    if (!is_visible_state()) return false;
    if (hit_test_dismiss(event.x, event.y)) {
      if (dismiss_callback_) dismiss_callback_();
      mark_dirty();
      return true;
    }
    // Consume all taps while visible so they don't fall through to
    // the underlying screen.
    return true;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    if (!is_visible_state()) return;

    ui_fast_filled_rectangle(it, 0, 0, display_w_, display_h_, Color(0, 0, 0));

    const int panel_w = (display_w_ * 5) / 6;
    const int panel_h = (display_h_ * 3) / 5;
    const int panel_x = (display_w_ - panel_w) / 2;
    const int panel_y = (display_h_ - panel_h) / 2;

    const Color accent = severity_color();
    const Color accent_dim = severity_dim_color();
    const Color panel_bg(16, 18, 22);
    const Color header_bg(24, 28, 34);
    const Color text_primary(245, 248, 255);
    const Color text_secondary(180, 188, 202);

    // Shadow and card shell.
    ui_fast_filled_rectangle(it, panel_x + 6, panel_y + 7, panel_w, panel_h, Color(3, 4, 6));
    ui_fast_filled_rectangle(it, panel_x, panel_y, panel_w, panel_h, panel_bg);
    it.rectangle(panel_x, panel_y, panel_w, panel_h, accent);
    it.rectangle(panel_x + 1, panel_y + 1, panel_w - 2, panel_h - 2, accent_dim);
    ui_fast_filled_rectangle(it, panel_x + 2, panel_y + 2, panel_w - 4, 58, header_bg);
    ui_fast_filled_rectangle(it, panel_x + 2, panel_y + 58, panel_w - 4, 3, accent);

    const int icon_cx = panel_x + 36;
    const int icon_cy = panel_y + 30;
    it.filled_circle(icon_cx, icon_cy, 18, accent_dim);
    it.circle(icon_cx, icon_cy, 18, accent);
    const char *icon = severity_icon();
    if (g_theme.icon.font != nullptr) {
      it.printf(icon_cx, icon_cy + 1, g_theme.icon.font, accent,
                TextAlign::CENTER, "%s", icon);
    } else if (g_theme.header.font != nullptr) {
      it.printf(icon_cx, icon_cy, g_theme.header.font, accent,
                TextAlign::CENTER, "!");
    }

    const std::string display_title =
        (title_ != nullptr && !title_->empty()) ? *title_ : std::string("Notification");
    if (g_theme.header.font != nullptr) {
      ui_print_truncated(it, panel_x + 66, panel_y + 13, g_theme.header.font,
                         text_primary, TextAlign::TOP_LEFT, display_title, panel_w - 86);
    }
    if (g_theme.label.font != nullptr) {
      it.printf(panel_x + 66, panel_y + 38, g_theme.label.font, text_secondary,
                TextAlign::TOP_LEFT, "%s", severity_label());
    }

    if (g_theme.label.font != nullptr && body_ != nullptr) {
      const int body_y = panel_y + 78;
      const int body_w = panel_w - 24;
      const int body_h = panel_h - 140;
      const int max_body_h = body_h > 0 ? body_h : 0;
      int tx, ty, tw, th;
      const std::string &body_text = *body_;
      it.get_text_bounds(panel_x + 12, body_y, body_text.c_str(),
                         g_theme.label.font, TextAlign::TOP_LEFT, &tx, &ty, &tw, &th);
      if (tw <= body_w) {
        ui_print_truncated(it, panel_x + 12, body_y, g_theme.label.font,
                           text_primary, TextAlign::TOP_LEFT, body_text, body_w);
      } else {
        int line_y = body_y;
        int remaining = body_text.size();
        int offset = 0;
        const int line_height = 22;
        while (remaining > 0 && line_y + line_height <= body_y + max_body_h) {
          int best_w = 0;
          int best_len = 0;
          for (int len = 1; len <= remaining; len++) {
            std::string sub = body_text.substr(offset, len);
            it.get_text_bounds(panel_x + 12, line_y, sub.c_str(),
                               g_theme.label.font, TextAlign::TOP_LEFT, &tx, &ty, &tw, &th);
            if (tw > body_w) break;
            if (tw > best_w) { best_w = tw; best_len = len; }
          }
          if (best_len == 0) best_len = 1;
          std::string line = body_text.substr(offset, best_len);
          const bool is_last = offset + best_len >= remaining;
          if (is_last) {
            ui_print_truncated(it, panel_x + 12, line_y, g_theme.label.font,
                               text_primary, TextAlign::TOP_LEFT, body_text.substr(offset), body_w);
          } else {
            it.printf(panel_x + 12, line_y, g_theme.label.font,
                      text_primary, TextAlign::TOP_LEFT, "%s", line.c_str());
          }
          offset += best_len;
          remaining -= best_len;
          line_y += line_height;
        }
      }
    }

    const int btn_w = panel_w - 48;
    const int btn_h = 40;
    const int btn_x = panel_x + (panel_w - btn_w) / 2;
    const int btn_y = panel_y + panel_h - btn_h - 16;
    ui_fast_filled_rectangle(it, btn_x, btn_y, btn_w, btn_h, accent_dim);
    it.rectangle(btn_x, btn_y, btn_w, btn_h, accent);
    if (g_theme.label.font != nullptr) {
      it.printf(btn_x + btn_w / 2, btn_y + btn_h / 2, g_theme.label.font,
                text_primary, TextAlign::CENTER, "Dismiss");
    }

    last_body_ = body_ != nullptr ? *body_ : std::string();
    if (dismissed_ != nullptr) last_dismissed_ = *dismissed_;
  }

 private:
  bool is_visible_state() const {
    if (body_ == nullptr || body_->empty()) return false;
    if (dismissed_ != nullptr && !dismissed_->empty() && *dismissed_ == *body_) return false;
    return true;
  }

  Color severity_color() const {
    if (severity_ == nullptr || severity_->empty()) return Color(0, 200, 255);
    const std::string s = *severity_;
    if (s == "error" || s == "alert") return Color(255, 60, 60);
    if (s == "warning" || s == "warn") return Color(255, 180, 0);
    if (s == "info") return Color(80, 200, 255);
    if (s == "question") return Color(160, 80, 255);
    return Color(0, 200, 255);
  }

  Color severity_dim_color() const {
    if (severity_ == nullptr || severity_->empty()) return Color(0, 44, 56);
    const std::string s = *severity_;
    if (s == "error" || s == "alert") return Color(72, 18, 22);
    if (s == "warning" || s == "warn") return Color(72, 48, 6);
    if (s == "info") return Color(12, 52, 72);
    if (s == "question") return Color(42, 24, 72);
    return Color(0, 44, 56);
  }

  const char *severity_icon() const {
    if (severity_ == nullptr || severity_->empty()) return "\xF3\xB0\x8B\xBC";
    const std::string s = *severity_;
    if (s == "error" || s == "alert") return "\xF3\xB0\x80\xA8";
    if (s == "warning" || s == "warn") return "\xF3\xB0\x80\xA6";
    if (s == "question") return "\xF3\xB0\x8B\x97";
    return "\xF3\xB0\x8B\xBC";
  }

  const char *severity_label() const {
    if (severity_ == nullptr || severity_->empty()) return "INFO";
    const std::string s = *severity_;
    if (s == "error") return "ERROR";
    if (s == "alert") return "ALERT";
    if (s == "warning" || s == "warn") return "WARNING";
    if (s == "question") return "QUESTION";
    if (s == "info") return "INFO";
    return "NOTIFICATION";
  }

  bool hit_test_dismiss(int tx, int ty) const {
    const int panel_w = (display_w_ * 5) / 6;
    const int panel_h = (display_h_ * 3) / 5;
    const int panel_x = (display_w_ - panel_w) / 2;
    const int panel_y = (display_h_ - panel_h) / 2;
    const int btn_w = panel_w - 48;
    const int btn_h = 40;
    const int btn_x = panel_x + (panel_w - btn_w) / 2;
    const int btn_y = panel_y + panel_h - btn_h - 16;
    return tx >= btn_x - 10 && tx <= btn_x + btn_w + 10 &&
           ty >= btn_y - 10 && ty <= btn_y + btn_h + 10;
  }

  const std::string *title_;
  const std::string *body_;
  const std::string *severity_;
  const std::string *dismissed_;
  std::function<void()> dismiss_callback_;
  int display_w_;
  int display_h_;
  std::string last_body_;
  std::string last_dismissed_;
  bool baseline_set_ = false;
  bool was_visible_ = false;
};

class LoadingWidget : public Widget {
 public:
  UiRect bounds() const override { return UiRect{0, 0, 480, 480}; }

  bool is_visible(const UiState &state) const override {
    return state.should_show_loading();
  }

  bool is_loading_widget() const override { return true; }

  void update(uint32_t now) override {
    (void)now;
    mark_dirty();
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    const int fx = 120, fy = 190, fw = 240, fh = 170;
    ui_fast_filled_rectangle(it, fx, fy, fw, fh, RetroColors::VOID);

    const int cx = 240, cy = 240;
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
      it.printf(cx, cy + 36, g_theme.header.font, RetroColors::CYAN,
                TextAlign::CENTER, "CONNECTING");
    }

    draw_clipped_border(it, 150, 280, 180, 4, 2, 2, 2, 2, RetroColors::DIMMER);
    const float progress = (float)(t % 2000) / 2000.0f;
    const int pw = (int)(180.0f * progress);
    if (pw > 0) {
      ui_fast_filled_rectangle(it, 150, 280, pw, 4, RetroColors::CYAN);
    }

    if (g_theme.label.font != nullptr) {
      it.printf(cx, cy + 54, g_theme.label.font, RetroColors::STEEL,
                TextAlign::CENTER, "Home Display v2.0");
    }
  }
};

#include "ui_tab_container.h"
#include "ui_chrome.h"
