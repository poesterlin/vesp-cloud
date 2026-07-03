#pragma once

#include "esphome.h"
#include "ui_invalidation.h"
#include "ui_types.h"
#include "ui_retro.h"
#if __has_include("esphome/components/image/image.h")
#include "esphome/components/image/image.h"
#define UI_HAS_ESPHOME_IMAGE_COMPONENT 1
#else
#define UI_HAS_ESPHOME_IMAGE_COMPONENT 0
#endif
#include <algorithm>
#include <cmath>
#include <ctime>
#include <initializer_list>
#include <map>
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

// Shared spacing scale. Every "magic" padding/inset in widget code should
// pull from this scale so per-widget tweaks stay in lockstep across the
// dashboard. Values are in display pixels (480x480 target).
namespace ui_spacing {
constexpr int xs = 4;   // tight inner offsets (borders, hit-test slop)
constexpr int sm = 6;   // inter-element gap (button rows, icon-to-label)
constexpr int md = 8;   // widget inner top/bottom padding
constexpr int lg = 9;   // widget outer padding (HVAC/Weather/Todo containers)
constexpr int xl = 12;  // generous outer padding (modal panels, hero cards)
}  // namespace ui_spacing

// Corner radius scales with widget height so small controls don't look
// pillow-y and large cards still read as rounded. Centralised here so
// the visual rule is documented in one place.
inline int ui_corner_radius_for_height(int h) {
  if (h < 40) return 4;
  if (h < 80) return 6;
  return 9;
}

// Minimum touch target side, in pixels. Small visual buttons grow their
// hit region to at least this size on each axis so the dashboard stays
// finger-friendly (matches the mobile UI accessibility guideline).
constexpr int UI_MIN_TOUCH_TARGET = 48;

// A tiny 1D vertical layout helper. Construct with the centerline you
// want a stack to be centered on, plus a list of (height, gap, height,
// gap, ..., height) values. Iterate with next(h) to get the y of the
// next line -- the cursor advances by `h` after each call, so callers
// can ignore the gap bookkeeping entirely. Replaces the manual
// `cy - 13` / `cy + 13` / `y_cursor += h + gap` math that used to live
// in HvacWidget, ButtonWidget, and the weather forecast columns.
struct VStack {
  int y_cursor;

  VStack(int center_y, std::initializer_list<int> heights_and_gaps) {
    int total_h = 0;
    for (int v : heights_and_gaps) total_h += v;
    y_cursor = center_y - (total_h / 2);
  }

  // Overload for callers that need to compute the total height
  // dynamically (e.g. when one of the lines is conditional). The
  // semantics are identical to the initializer_list constructor.
  VStack(int center_y, int total_h) {
    y_cursor = center_y - (total_h / 2);
  }

  // Returns the y of the current line, then advances the cursor by
  // `height`. The next call (with its own height) lands immediately
  // below, with no manual gap tracking required by the caller.
  int next(int height) {
    const int current = y_cursor;
    y_cursor += height;
    return current;
  }

  // Advance the cursor by `gap` without emitting a line. Use between
  // next() calls when you need a non-uniform spacer.
  void skip(int gap) { y_cursor += gap; }
};

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

inline bool ui_value_changed_quantized(float current, float last,
                                       float step = 0.1f) {
  const bool current_finite = std::isfinite(current);
  const bool last_finite = std::isfinite(last);
  if (current_finite != last_finite) return true;
  if (!current_finite) return false;
  if (step <= 0.0f) return current != last;
  const int current_q = static_cast<int>(std::lround(current / step));
  const int last_q = static_cast<int>(std::lround(last / step));
  return current_q != last_q;
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

  // Shrink the rect by `amount` on every side. Useful for inner borders
  // and focus rings that want to share the same offset as the rest of
  // the design system (typically ui_spacing::xs).
  UiRect inset(int amount) const {
    return UiRect{x + amount, y + amount, w - (amount * 2), h - (amount * 2)};
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

  TextStyle header       = {nullptr, RetroColors::CYAN, TextAlign::TOP_LEFT};
  TextStyle label        = {nullptr, RetroColors::LIGHT, TextAlign::TOP_LEFT};
  TextStyle weather_tiny = {nullptr, RetroColors::LIGHT, TextAlign::TOP_LEFT};
  TextStyle icon         = {nullptr, RetroColors::WHITE, TextAlign::CENTER};
  TextStyle weather_icon = {nullptr, RetroColors::WHITE, TextAlign::CENTER};
  Color     info_bg      = RetroColors::VOID;

  ButtonStyle primary = {RetroColors::CYAN, RetroColors::WHITE, nullptr};
  ButtonStyle accent  = {RetroColors::AMBER, RetroColors::WHITE, nullptr};
  ButtonStyle neutral = {RetroColors::GRAY, RetroColors::WHITE, nullptr};
  ButtonStyle success = {RetroColors::GREEN, RetroColors::WHITE, nullptr};
};

inline Theme g_theme;

// Standard touch test with a slop that's auto-computed from the rect's
// smaller side. Replaces the per-widget "w < 40 ? 15 : w < 60 ? 10 : 0"
// ladders with a single rule, and gives every interactive widget a
// consistent minimum-target guarantee.
inline bool ui_hit_test_with_slop(const UiRect &r, int tx, int ty,
                                  int min_target_size = UI_MIN_TOUCH_TARGET) {
  const int slop_x = (r.w < min_target_size) ? (min_target_size - r.w) / 2 : 0;
  const int slop_y = (r.h < min_target_size) ? (min_target_size - r.h) / 2 : 0;
  return r.contains(tx, ty, slop_x, slop_y);
}

// A small label-over-value "data pill" -- a filled rounded rectangle
// with a dim caption on top and a value underneath. Used by the
// weather widget for HUM/RAIN/WIND; any future sensor readout should
// reuse this so the visual treatment stays consistent across the
// dashboard.
//
// `value` may be nullptr (renders the dim em-dash placeholder).
// `unit` is appended to the value (e.g. "%", " mm"). Pass an empty
// string to suppress the unit entirely. `value_decimals` controls the
// numeric precision (default 0 matches the original weather look:
// "23%" not "23.0%").
inline void ui_draw_data_pill(display::Display &it, int x, int y, int w, int h,
                              const char *label, const float *value,
                              const char *unit = "",
                              Color label_color = RetroColors::GRAY,
                              Color value_color = Color(255, 255, 255),
                              Color pill_bg = Color(18, 22, 32),
                              Color pill_border = Color(35, 40, 55),
                              int value_decimals = 0,
                              esphome::font::Font *value_font = nullptr) {
  it.filled_rectangle(x, y, w, h, pill_bg);
  it.rectangle(x, y, w, h, pill_border);
  it.horizontal_line(x + 1, y + h - 1, w - 1, pill_border);

  auto *caption_font = g_theme.weather_tiny.font ? g_theme.weather_tiny.font : g_theme.label.font;
  auto *resolved_value_font = value_font != nullptr
    ? value_font
    : (g_theme.weather_tiny.font ? g_theme.weather_tiny.font : g_theme.header.font);

  if (caption_font == nullptr || resolved_value_font == nullptr) return;

  it.printf(x + w / 2, y + 4, caption_font, label_color,
            TextAlign::TOP_CENTER, "%s", label ? label : "");

  auto valid_value = [](const float *p) {
    return p != nullptr && !std::isnan(*p) && !std::isinf(*p);
  };
  if (valid_value(value)) {
    char buf[24];
    if (value_decimals > 0) {
      float v = *value;
      if (std::floor(v) == v) {
        snprintf(buf, sizeof(buf), "%d%s", (int)v, unit ? unit : "");
      } else {
        char fmt[16];
        snprintf(fmt, sizeof(fmt), "%%.%df%%s", value_decimals);
        snprintf(buf, sizeof(buf), fmt, v, unit ? unit : "");
      }
    } else {
      snprintf(buf, sizeof(buf), "%.0f%s", *value, unit ? unit : "");
    }
    it.printf(x + w / 2, y + 19, resolved_value_font, value_color,
              TextAlign::TOP_CENTER, "%s", buf);
  } else {
    it.printf(x + w / 2, y + 19, resolved_value_font, label_color,
              TextAlign::TOP_CENTER, "—");
  }
}

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
    (void)this->poll_visibility_state();
  }

  virtual bool handle_touch(const TouchEvent &event, uint32_t now) { return false; }
  virtual void draw(display::Display &it, const UiState &state) = 0;
  virtual bool is_background_widget() const { return false; }
  virtual bool is_top_widget() const { return false; }

  // Bounding box used by the dirty-rect machinery. Widgets with a fixed
  // rectangle override this to return their rect_; widgets that paint
  // outside a single box can return a conservative superset. Default is
  // the full screen, which means "I might be anywhere -> always redraw me".
  virtual UiRect bounds() const { return UiRect{0, 0, 480, 480}; }

  void set_render_offset_y(int y) { render_offset_y_ = y; }
  void set_scroll_exempt(bool exempt) { scroll_exempt_ = exempt; }
  bool scroll_exempt() const { return scroll_exempt_; }

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

  // Name used in debug logging to identify which widget type called mark_dirty.
  virtual const char *widget_label() const { return "Widget"; }

  // Mark this widget's bounds dirty so it (and only it) is redrawn on the
  // next render pass. Use this from state-change handlers / update() polls.
  void mark_dirty() {
    const UiRect b = has_custom_dirty_bounds_ ? screen_rect(dirty_bounds_) : bounds();
    UiInvalidation::request_rect(UiDirtyRect{b.x, b.y, b.w, b.h}, widget_label());
  }

  void mark_dirty_tagged(const char *tag) {
    const UiRect b = has_custom_dirty_bounds_ ? screen_rect(dirty_bounds_) : bounds();
    UiInvalidation::request_rect(UiDirtyRect{b.x, b.y, b.w, b.h}, tag);
  }

  // Region used by the GenericScreen redraw gate. Keep this in sync with
  // mark_dirty() so container-linked widgets (set_dirty_bounds) are either
  // skipped or redrawn atomically with their container eraser.
  UiRect redraw_gate_bounds() const {
    return has_custom_dirty_bounds_ ? screen_rect(dirty_bounds_) : bounds();
  }

  // Should this widget actually be drawn this frame? Combines visibility
  // and dirty-rect intersection.
  bool needs_draw(const UiState &state) const {
    if (!is_visible(state)) return false;
    const auto b = redraw_gate_bounds();
    return UiInvalidation::needs_redraw_in(b.x, b.y, b.w, b.h);
  }

  virtual bool is_visible(const UiState &state) const {
    (void)state;
    if (visibility_check_) return visibility_check_();
    return true;
  }

  virtual bool is_loading_widget() const { return false; }

  // Poll visibility condition and mark dirty on edge changes. This can be
  // called by screens before deciding whether to run the heavier update() on
  // hidden widgets.
  bool poll_visibility(const UiState &state) {
    (void)state;
    return poll_visibility_state();
  }

  void set_visibility_condition(std::function<bool()> check) {
    visibility_check_ = std::move(check);
  }

 protected:
  UiRect screen_rect(UiRect r) const {
    r.y += render_offset_y_;
    return r;
  }

  std::function<bool()> visibility_check_;
  UiRect dirty_bounds_{0, 0, 0, 0};
  int render_offset_y_ = 0;
  bool has_custom_dirty_bounds_ = false;
  bool scroll_exempt_ = false;
  bool last_visibility_ = false;
  bool visibility_baseline_set_ = false;

 private:
  bool poll_visibility_state() {
    if (!visibility_check_) return true;
    const bool current = visibility_check_();
    if (!visibility_baseline_set_ || current != last_visibility_) {
      ESP_LOGW("vis", "[f=%u t=%u] %s -> %s", UiInvalidation::frame(), millis(),
               widget_label(), current ? "VISIBLE" : "hidden");
      mark_dirty();
      last_visibility_ = current;
      visibility_baseline_set_ = true;
    }
    return current;
  }
};

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

#if UI_HAS_ESPHOME_IMAGE_COMPONENT
class ImageWidget : public Widget {
 public:
  const char *widget_label() const override { return "Image"; }
  using Callback = std::function<void()>;

  static constexpr int TILE_ROWS = 32;

  ImageWidget(UiRect rect, esphome::image::Image *image,
              esphome::image::Image *fallback_image = nullptr,
              Color color_on = display::COLOR_ON,
              Color color_off = display::COLOR_OFF)
      : rect_(rect), image_(image), fallback_image_(fallback_image),
        color_on_(color_on), color_off_(color_off) {}

  ImageWidget(UiRect rect, esphome::image::Image &image,
              Color color_on = display::COLOR_ON,
              Color color_off = display::COLOR_OFF)
      : ImageWidget(rect, &image, nullptr, color_on, color_off) {}

  ImageWidget(UiRect rect, esphome::image::Image &image,
              esphome::image::Image &fallback_image,
              Color color_on = display::COLOR_ON,
              Color color_off = display::COLOR_OFF)
      : ImageWidget(rect, &image, &fallback_image, color_on, color_off) {}

  void on_tap(Callback cb) { tap_callback_ = std::move(cb); }

  void set_tint(Color on, Color off) {
    color_on_ = on;
    color_off_ = off;
  }

  void set_bg_color(Color c) { bg_color_ = c; }

  UiRect bounds() const override { return screen_rect(rect_); }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (!tap_callback_ || !fully_rendered_) return false;
    if (event.type != TouchType::Tap) return false;
    if (bounds().contains(event.x, event.y)) {
      tap_callback_();
      return true;
    }
    return false;
  }

  void draw(display::Display &it, const UiState &state) override {
    auto *img = select_image_();
    if (img == nullptr) return;

    if (img->get_data_start() == nullptr) {
      draw_placeholder(it, true);
      return;
    }

    if (active_image_ != img) {
      active_image_ = img;
      fully_rendered_ = false;
      deferred_ = false;
      tile_row_ = 0;
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
      render_tile(it, state, img);
      return;
    }

    const UiRect r = screen_rect(rect_);
    const int iw = img->get_width();
    const int ih = img->get_height();
    const int ox = r.x + (r.w - iw) / 2;
    const int oy = r.y + (r.h - ih) / 2;
    ui_fast_filled_rectangle(it, r.x, r.y, r.w, r.h, bg_color_);
    it.image(ox, oy, img, color_on_, color_off_);
  }

 private:
  esphome::image::Image *select_image_() const {
    if (image_ != nullptr && image_->get_data_start() != nullptr) return image_;
    if (fallback_image_ != nullptr && fallback_image_->get_data_start() != nullptr) return fallback_image_;
    if (image_ != nullptr) return image_;
    return fallback_image_;
  }

  void render_tile(display::Display &it, const UiState &state, esphome::image::Image *img) {
    const int iw = img->get_width();
    const int ih = img->get_height();
    if (iw <= 0 || ih <= 0) { fully_rendered_ = true; return; }

    const UiRect r = screen_rect(rect_);
    const int ox = r.x + (r.w - iw) / 2;
    const int oy = r.y + (r.h - ih) / 2;

    if (tile_row_ == 0) {
      ui_fast_filled_rectangle(it, r.x, r.y, r.w, r.h, bg_color_);
    }

    int tile_h = TILE_ROWS;
    if (tile_row_ + tile_h > ih) tile_h = ih - tile_row_;

    const uint8_t *data = img->get_data_start();
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
    const UiRect r = screen_rect(rect_);
    ui_fast_filled_rectangle(it, r.x, r.y, r.w, r.h, bg_color_);
    const UiRect inner = r.inset(2);
    draw_clipped_border(it, inner.x, inner.y, inner.w, inner.h,
                        4, 4, 4, 4, RetroColors::DIMMER);
    if (g_theme.label.font != nullptr) {
      it.printf(r.x + r.w / 2, r.y + r.h / 2,
                g_theme.label.font, RetroColors::DIMMER,
                TextAlign::CENTER, downloading ? "LOADING..." : "...");
    }
  }

  UiRect rect_;
  esphome::image::Image *image_;
  esphome::image::Image *fallback_image_ = nullptr;
  esphome::image::Image *active_image_ = nullptr;
  Color color_on_;
  Color color_off_;
  Color bg_color_{RetroColors::VOID};
  Callback tap_callback_;
  bool fully_rendered_ = false;
  bool deferred_ = false;
  int tile_row_ = 0;
};
#endif  // UI_HAS_ESPHOME_IMAGE_COMPONENT

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

  void set_bg_color(Color c) { bg_color_ = c; }
  void set_color(Color c) {
    color_override_ = c;
    has_color_override_ = true;
  }
  void set_align(TextAlign a) {
    align_ = a;
    has_align_override_ = true;
  }

  UiRect bounds() const override { return screen_rect(rect_); }

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
      text_baseline_set_ = true;
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

class IconWidget : public Widget {
 public:
  const char *widget_label() const override { return "Icon"; }
  IconWidget(UiRect rect, const char *glyph, const Theme::TextStyle &style)
      : rect_(rect), glyph_(glyph), style_(&style) {}

  UiRect bounds() const override { return screen_rect(rect_); }

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

class ButtonWidget : public Widget {
 public:
  const char *widget_label() const override { return "Button"; }
  using Callback = std::function<void()>;

  ButtonWidget(UiRect rect, const char *label, Callback callback, const Theme::ButtonStyle &style)
      : rect_(rect), label_(label), callback_(callback), style_(&style) {}

  UiRect bounds() const override { return screen_rect(rect_); }

  // Configure an optional icon glyph drawn above the label using the
  // provided text style (typically `g_theme.icon` so the MDI font is used).
  void set_icon(const char *glyph, const Theme::TextStyle *icon_style) {
    icon_glyph_ = glyph;
    icon_style_ = icon_style;
  }

  void set_border_color(Color c) {
    border_color_override_ = c;
    has_border_color_override_ = true;
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
    auto bc = has_border_color_override_ ? border_color_override_ : style_->border_color;
    auto tc = style_->text_color;

    const UiRect r = screen_rect(rect_);
    const int c = ui_corner_radius_for_height(r.h);
    draw_clipped_box(it, r.x, r.y, r.w, r.h,
                     c, bc, RetroColors::DIM, true);

    if (loading_) {
      it.printf(r.x + r.w / 2, r.y + r.h / 2, f, tc, TextAlign::CENTER, "...");
      return;
    }

    const bool has_icon = icon_glyph_ != nullptr && icon_glyph_[0] != '\0'
                         && icon_style_ != nullptr && icon_style_->font != nullptr;
    const bool has_label = label_ != nullptr && label_[0] != '\0';
    const int cx = r.x + r.w / 2;
    const int cy = r.y + r.h / 2;

    if (has_icon && has_label) {
      // Try horizontal first (icon left of label). Falls back to the
      // stacked layout when either the label can't be reasonably
      // truncated next to the icon (e.g. very narrow button) or the
      // button is tall enough that stacking reads better anyway.
      int ix, iy, iw, ih;
      it.get_text_bounds(0, 0, icon_glyph_, icon_style_->font, TextAlign::TOP_LEFT, &ix, &iy, &iw, &ih);
      const int gap = ui_spacing::sm;
      const int side_pad = ui_spacing::md;
      const int horiz_budget = r.w - 2 * side_pad - iw - gap;
      // Minimum label budget to bother going horizontal: room for at
      // least ~3 chars + ellipsis. Below that, vertical is more legible.
      int eps_x, eps_y, eps_w, eps_h;
      it.get_text_bounds(0, 0, "W...", f, TextAlign::TOP_LEFT, &eps_x, &eps_y, &eps_w, &eps_h);
      const bool horiz_fits = horiz_budget >= eps_w;
      // Stack only when the button is clearly tall enough for two
      // legible lines; otherwise prefer the horizontal layout even on
      // small buttons because the alternative is a clipped stack.
      const bool tall_enough_for_stack = r.h >= 56;

      if (horiz_fits && !tall_enough_for_stack) {
        bool truncated = false;
        std::string disp = ui_truncate_to_width(it, f, label_, horiz_budget, &truncated);
        int lx, ly, lw, lh;
        it.get_text_bounds(0, 0, disp.c_str(), f, TextAlign::TOP_LEFT, &lx, &ly, &lw, &lh);
        // Reserve the indicator's width in the group total so the icon+label
        // pair stays visually centered even when truncated.
        const int extra = truncated ? (UI_TRUNC_DOTS_W + 2) : 0;
        const int total_w = iw + gap + lw + extra;
        const int start_x = r.x + (r.w - total_w) / 2;
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
        // Stacked: icon over label, centered as a unit on `cy`. The
        // VStack owns the centering math; previously this was a pair
        // of `cy - 13` / `cy + 13` magic numbers, which silently
        // assumed the same 26px split for any icon/label pair.
        const int stack_gap = ui_spacing::xs;
        const int label_h = 16;  // label font cap height
        VStack stack(cy, {ih, stack_gap, label_h});
        it.printf(cx, stack.next(ih), icon_style_->font, tc, TextAlign::TOP_CENTER, "%s", icon_glyph_);
        stack.skip(stack_gap);
        ui_print_truncated(it, cx, stack.next(label_h), f, tc, TextAlign::TOP_CENTER, label_, r.w - 12);
      }
    } else if (has_icon) {
      it.printf(cx, cy, icon_style_->font, tc, TextAlign::CENTER, "%s", icon_glyph_);
    } else if (has_label) {
      ui_print_truncated(it, cx, cy, f, tc, TextAlign::CENTER, label_, r.w - 12);
    }
  }

 private:
  bool hit_test(int tx, int ty) const {
    return ui_hit_test_with_slop(bounds(), tx, ty);
  }

  UiRect rect_;
  const char *label_;
  Callback callback_;
  const Theme::ButtonStyle *style_ = nullptr;
  const char *icon_glyph_ = nullptr;
  const Theme::TextStyle *icon_style_ = nullptr;
  Color border_color_override_{0, 0, 0};
  bool has_border_color_override_ = false;
  bool loading_ = false;
  uint32_t loading_start_ms_ = 0;
  uint32_t loading_timeout_ms_ = 350;
};

class ImageToggleWidget : public Widget {
 public:
  const char *widget_label() const override { return "ImgToggle"; }
  using Callback = std::function<void()>;

  ImageToggleWidget(UiRect rect, const char *label, const bool *on_state,
                    const char *icon_glyph, Callback callback,
                    Color on_color = Color(255, 180, 0),
                    Color off_color = Color(80, 80, 80))
      : rect_(rect), label_(label), on_state_(on_state),
        icon_glyph_(icon_glyph), callback_(std::move(callback)), on_color_(on_color),
        off_color_(off_color) {}

  void bind(const bool *on_state) { on_state_ = on_state; }

  UiRect bounds() const override { return screen_rect(rect_); }

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

    const UiRect r = screen_rect(rect_);
    const int c = ui_corner_radius_for_height(r.h);
    draw_clipped_box(it, r.x, r.y, r.w, r.h,
                     c, icon_color, RetroColors::DIM, true);

    // Single source of truth for icon/label geometry. The icon sits on
    // the left at kIconCenterOffset, the label starts at kLabelStartOffset,
    // and the label is allowed to consume everything from there to the
    // right edge minus a small right padding.
    const int kIconCenterOffset = 28;
    const int kLabelStartOffset = 52;
    const int icon_x = r.x + kIconCenterOffset;
    const int icon_y = r.y + r.h / 2;
    const int label_x = r.x + kLabelStartOffset;
    const int label_max_w = r.w - kLabelStartOffset - ui_spacing::sm;

    if (loading_) {
      float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
      const int radius = 10;
      it.line(icon_x, icon_y, icon_x + (int)(cosf(angle) * radius),
              icon_y + (int)(sinf(angle) * radius), icon_color);
      if (label_ != nullptr && g_theme.label.font != nullptr) {
        ui_print_truncated(it, label_x, icon_y,
                           g_theme.label.font, icon_color,
                           TextAlign::CENTER_LEFT, label_, label_max_w);
      }
      return;
    }

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
      ui_print_truncated(it, label_x, icon_y,
                         g_theme.label.font, Color(255, 255, 255),
                         TextAlign::CENTER_LEFT, label_, label_max_w);
    }

    last_on_state_ = is_on;
  }

 private:
  bool hit_test(int tx, int ty) const {
    return ui_hit_test_with_slop(bounds(), tx, ty);
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
  const char *widget_label() const override { return "Todo"; }
  using Callback = std::function<void()>;

  TodoPreviewWidget(UiRect rect, const std::string *items,
                    int max_items = 4, int row_height = 30,
                    bool scrollable = false, bool checkable = false,
                    Callback on_tap = nullptr,
                    const char *incomplete_icon = "",
                    const char *complete_icon = "",
                    const char *todo_entity = "",
                    const char *bridge_entity = "")
      : rect_(rect), items_(items), scrollable_(scrollable),
        checkable_(checkable), on_tap_(std::move(on_tap)),
        incomplete_icon_(incomplete_icon),
        complete_icon_(complete_icon), todo_entity_(todo_entity),
        bridge_entity_(bridge_entity) {
    if (max_items < 1) max_items_ = 1;
    else if (max_items > 10) max_items_ = 10;
    else max_items_ = max_items;

    if (row_height < 20) row_height_ = 20;
    else if (row_height > 80) row_height_ = 80;
    else row_height_ = row_height;
  }

  UiRect bounds() const override { return screen_rect(rect_); }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (!bounds().contains(event.x, event.y)) return false;

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
      auto &row = rows_[idx];
      // Guard: at least one entity must be configured
      if (todo_entity_ == nullptr || todo_entity_[0] == '\0') {
        if (bridge_entity_ == nullptr || bridge_entity_[0] == '\0') return true;
      }
      // Second tap cancels a pending operation
      if (row.loading) {
        row.loading = false;
        row.ha_sent = false;
        mark_dirty();
        return true;
      }
      // First tap — start 2-second countdown; HA call is sent later
      row.loading = true;
      row.loading_start = now;
      row.ha_sent = false;
      mark_dirty();
      return true;
    }

    if (event.type == TouchType::Tap && !checkable_) {
      if (on_tap_) on_tap_();
      return true;
    }

    return true;
  }

  void update(uint32_t now) override {
    if (items_ == nullptr) return;
    if (!baseline_set_ || *items_ != last_items_) {
      // Preserve loading state across parse_rows by matching on summary
      // text (and UUID when present). Indices can shift when items leave
      // the pending list.
      struct Saved { uint32_t start; bool sent; };
      std::map<std::string, Saved> saved;
      for (auto &row : rows_) {
        if (!row.loading) continue;
        const std::string key = row.uid.empty() ? row.summary : row.uid;
        saved[key] = {row.loading_start, row.ha_sent};
      }
      parse_rows(*items_);
      for (auto &row : rows_) {
        const std::string key = row.uid.empty() ? row.summary : row.uid;
        auto it = saved.find(key);
        if (it != saved.end()) {
          row.loading = true;
          row.loading_start = it->second.start;
          row.ha_sent = it->second.sent;
        }
      }
      if (!scrollable_) scroll_offset_ = 0;
      mark_dirty();
    }
    // 2-second countdown before actually calling HA; second tap cancels.
    bool any_action = false;
    for (size_t i = 0; i < rows_.size(); i++) {
      auto &row = rows_[i];
      if (!row.loading) continue;
      if (!row.ha_sent && (now - row.loading_start > 2000)) {
        if (!row.completed)
          push_complete_to_ha(static_cast<int>(i));
        else
          push_needs_action_to_ha(static_cast<int>(i));
        row.ha_sent = true;
        any_action = true;
      }
      if (now - row.loading_start > TodoRow::loading_timeout_ms) {
        row.loading = false;
        row.ha_sent = false;
        any_action = true;
      }
    }
    if (any_action) mark_dirty();
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
    const UiRect r = screen_rect(rect_);

    // Clipped-corner container
    draw_clipped_box(it, r.x, r.y, r.w, r.h,
                     ui_corner_radius_for_height(r.h), border, bg, false);
    // Inner double-line
    {
      const UiRect inner = r.inset(2);
      draw_clipped_border(it, inner.x, inner.y, inner.w, inner.h,
                          6, 6, 6, 6, RetroColors::AMBER_DIM);
    }

    if (items_ == nullptr || items_->empty()) {
      if (g_theme.label.font != nullptr) {
        it.printf(r.x + r.w / 2, r.y + r.h / 2, g_theme.label.font,
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
        it.printf(r.x + r.w / 2, r.y + r.h / 2, g_theme.label.font,
                  dim, TextAlign::CENTER, "LIST EMPTY");
      }
      last_items_ = *items_;
      baseline_set_ = true;
      return;
    }

    const int top_padding = kTopPadding;
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
      const int y = r.y + top_padding + drawn * row_height_ - pixel_offset;
      if (y + row_height_ < r.y + top_padding) {
        continue;
      }
      if (y > r.y + r.h - 2) {
        break;
      }

      const int row_cy = y + row_height_ / 2 - 1;
      const bool overdue = row.overdue;
      const bool completed = row.completed && !row.loading;
      std::string summary = row.summary;

      if (g_theme.label.font != nullptr) {
        if (row.loading) {
          // Spinning line animation while waiting for HA confirmation
          float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
          int cx = r.x + kTodoIconCX;
          int cy = row_cy;
          it.line(cx, cy, cx + (int)(cosf(angle) * 8), cy + (int)(sinf(angle) * 8), border);
        }

        const Color check_color = completed ? Color(0, 220, 120) : border;
        if (g_theme.icon.font != nullptr &&
              incomplete_icon_ != nullptr && complete_icon_ != nullptr &&
              incomplete_icon_[0] != '\0' && complete_icon_[0] != '\0') {
          it.printf(r.x + kTodoIconCX, row_cy, g_theme.icon.font,
                    check_color, TextAlign::CENTER,
                    "%s", completed ? complete_icon_ : incomplete_icon_);
        }
      }

      int text_x = r.x + kTodoTextX;
      if (!row.due.empty() && g_theme.label.font != nullptr) {
        const int due_max_w = kTodoDueMaxW;
        ui_print_truncated(it, r.x + kTodoTextX, row_cy, g_theme.label.font,
                          overdue ? due_overdue : due_ok,
                          TextAlign::CENTER_LEFT, row.due, due_max_w);
        text_x = r.x + kTodoTextX + kTodoDueMaxW + ui_spacing::xs;
      }
      if (g_theme.label.font != nullptr) {
        const int summary_max_w = r.x + r.w - text_x - 4;
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
      it.printf(r.x + r.w / 2, r.y + r.h / 2, g_theme.label.font,
                dim, TextAlign::CENTER, "LIST EMPTY");
    }

    last_items_ = *items_;
    baseline_set_ = true;
  }

 private:
  struct TodoRow {
    std::string summary;
    std::string due;
    std::string uid;
    bool overdue = false;
    bool completed = false;
    bool loading = false;
    uint32_t loading_start = 0;
    bool ha_sent = false;
    static constexpr uint32_t loading_timeout_ms = 5000;
  };

  // Inner top padding used to leave room for the clipped-box border + the
  // inner double-line, in pixels. Referenced from draw (row positioning,
  // max-row-by-height calc), content_height (clamped height), and row_at
  // (touch hit-test) so all three stay in lockstep.
  static constexpr int kTopPadding = ui_spacing::md;

  // Horizontal offsets from the widget's left edge for the check-box
  // icon area and the text that follows. The values are tuned to leave
  // a comfortable gap between icon and text without eating into the
  // scrolling due-date column.
  static constexpr int kTodoCheckTextX = 10;  // fallback "[ ]" / "[x]" X
  static constexpr int kTodoIconCX = 22;     // MDI icon centre X
  static constexpr int kTodoTextX = 40;      // main text + due-date X
  static constexpr int kTodoDueMaxW = 92;    // width reserved for due date column

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
    int h = rect_.h - kTopPadding - 2;
    return h > 0 ? h : 0;
  }

  int row_at(int tx, int ty) const {
    (void)tx;
    const int top = screen_rect(rect_).y + kTopPadding;
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
          std::size_t p3 = (p2 == std::string::npos) ? std::string::npos : rest.find('|', p2 + 1);
          std::string status;
          if (p2 != std::string::npos) {
            row.due = rest.substr(0, p2);
            if (p3 != std::string::npos) {
              status = rest.substr(p2 + 1, p3 - p2 - 1);
              row.uid = rest.substr(p3 + 1);
            } else {
              status = rest.substr(p2 + 1);
            }
          } else {
            row.due = rest;
          }
          trim_inplace(status);
          row.overdue = status.find("overdue") != std::string::npos;
          row.completed = status.find("completed") != std::string::npos;
        }
        trim_inplace(row.summary);
        trim_inplace(row.due);
        trim_inplace(row.uid);
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

  void push_todo_status(int index, const char *status) {
    if (index < 0 || index >= static_cast<int>(rows_.size())) return;
    const std::string &summary = rows_[index].summary;
    const std::string &uid = rows_[index].uid;

    auto *api = esphome::api::global_api_server;
    if (api == nullptr || !api->is_connected()) return;

    // Prefer the HACS bridge service (uses the same entity for read &
    // write). Falls back to a direct todo.update_item call when a
    // standalone todo entity is configured instead.
    if (bridge_entity_ != nullptr && bridge_entity_[0] != '\0') {
      esphome::api::HomeAssistantServiceCallAction<> call(api, false);
      call.set_service("esphome_display.complete_item");
      const bool non_default = (status != nullptr && strcmp(status, "completed") != 0);
      call.init_data(non_default ? 3 : 2);
      call.add_data("entity_id", bridge_entity_);
      char idx_buf[12];
      snprintf(idx_buf, sizeof(idx_buf), "%d", index);
      call.add_data("index", idx_buf);
      if (non_default) {
        call.add_data("status", status);
      }
      call.play();
      return;
    }

    if (todo_entity_ == nullptr || todo_entity_[0] == '\0') return;
    esphome::api::HomeAssistantServiceCallAction<> call(api, false);
    call.set_service("todo.update_item");
    call.init_data(3);
    call.add_data("entity_id", todo_entity_);
    call.add_data("item", uid.empty() ? summary : uid);
    call.add_data("status", status);
    call.play();
  }

  void push_complete_to_ha(int index) {
    push_todo_status(index, "completed");
  }

  void push_needs_action_to_ha(int index) {
    push_todo_status(index, "needs_action");
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
  const char *bridge_entity_ = nullptr;
  std::vector<TodoRow> rows_;
  int scroll_offset_ = 0;
  bool dragging_ = false;
  std::string last_items_;
  bool baseline_set_ = false;
};

class CalendarListWidget : public Widget {
 public:
  const char *widget_label() const override { return "Calendar"; }
  using Callback = std::function<void()>;

  CalendarListWidget(UiRect rect, const std::string *events_raw,
                     const char *label = "Calendar",
                     const char *entity_id = "",
                     int max_items = 4,
                     int row_height = 40,
                     bool scrollable = false,
                     Callback on_tap = nullptr,
                     Color text_color = RetroColors::WHITE,
                     Color dim_color = RetroColors::GRAY)
      : rect_(rect), events_raw_(events_raw), label_(label),
        scrollable_(scrollable),
        on_tap_(std::move(on_tap)), text_color_(text_color),
        dim_color_(dim_color) {
    (void)entity_id;
    if (max_items < 1) max_items_ = 1;
    else if (max_items > 10) max_items_ = 10;
    else max_items_ = max_items;

    if (row_height < 20) row_height_ = 20;
    else if (row_height > 80) row_height_ = 80;
    else row_height_ = row_height;
  }

  UiRect bounds() const override { return screen_rect(rect_); }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    const UiRect r = bounds();
    if (!r.contains(event.x, event.y)) return false;

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

    if (event.type == TouchType::Tap) {
      if (on_tap_) on_tap_();
      return on_tap_ != nullptr;
    }

    return true;
  }

  void update(uint32_t now) override {
    (void)now;
    if (events_raw_ != nullptr) {
      if (!baseline_set_ || *events_raw_ != last_events_raw_) {
        parse_rows(*events_raw_);
        if (!scrollable_) scroll_offset_ = 0;
        mark_dirty();
      }
    }
    Widget::update(now);
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    const UiRect r = screen_rect(rect_);
    const Color border(25, 30, 40);
    const Color bg(10, 14, 22);
    draw_clipped_box(it, r.x, r.y, r.w, r.h,
                     ui_corner_radius_for_height(r.h), border, bg, false);
    const UiRect inner = r.inset(2);
    draw_clipped_border(it, inner.x, inner.y, inner.w, inner.h,
                        6, 6, 6, 6, Color(30, 36, 45));

    if (label_ != nullptr && label_[0] != '\0' && g_theme.label.font != nullptr) {
      const int max_label_w = r.w - (kPad * 2);
      ui_print_truncated(it, r.x + kPad, r.y + 6,
                         g_theme.label.font, dim_color_,
                         TextAlign::TOP_LEFT, label_, max_label_w);
    }

    if (events_raw_ == nullptr || events_raw_->empty() || *events_raw_ == "NO EVENTS") {
      draw_empty(it, r);
      last_events_raw_ = events_raw_ != nullptr ? *events_raw_ : "";
      baseline_set_ = true;
      return;
    }

    if (!baseline_set_ || *events_raw_ != last_events_raw_) {
      parse_rows(*events_raw_);
    }

    if (rows_.empty()) {
      draw_empty(it, r);
      last_events_raw_ = *events_raw_;
      baseline_set_ = true;
      return;
    }

    const int available_h = content_height();
    const int content_h = static_cast<int>(rows_.size()) * row_height_;
    const int max_scroll = content_h > available_h ? (content_h - available_h) : 0;
    if (!scrollable_) {
      scroll_offset_ = 0;
    } else if (scroll_offset_ > max_scroll) {
      scroll_offset_ = max_scroll;
    }

    const int max_rows_by_height = available_h > 0 ? (available_h / row_height_) : 0;
    const int row_limit = max_rows_by_height < max_items_ ? max_rows_by_height : max_items_;
    const int start_index = scrollable_ ? (scroll_offset_ / row_height_) : 0;
    const int pixel_offset = scrollable_ ? (scroll_offset_ % row_height_) : 0;

    int drawn = 0;
    const int body_top = r.y + kHeaderH;
    for (int i = start_index; i < static_cast<int>(rows_.size()) && drawn < row_limit; i++) {
      const CalendarRow &row = rows_[i];
      const int y = body_top + drawn * row_height_ - pixel_offset;
      if (y + row_height_ < body_top) continue;
      if (y > r.y + r.h - 2) break;

      const int row_y = y + 2;
      const int row_h = row_height_ - 4;
      const int row_x = r.x + kPad;
      const int row_w = r.w - (kPad * 2);

      ui_fast_filled_rectangle(it, row_x, row_y, row_w, row_h, Color(18, 22, 32));
      it.rectangle(row_x, row_y, row_w, row_h, Color(35, 40, 55));

      const std::string date_text = row.start.empty() ? "--" : format_start_(row.start);
      const bool date_includes_day = date_text.find(' ') != std::string::npos;
      const int date_w = date_includes_day ? 110 : 78;
      const int date_x = row_x + 6;
      const int date_mid_y = row_y + row_h / 2;
      if (g_theme.label.font != nullptr) {
        ui_print_truncated(it, date_x, date_mid_y, g_theme.label.font,
                           dim_color_, TextAlign::CENTER_LEFT,
                           date_text, date_w);
      }

      const int text_x = date_x + date_w + 6;
      const int text_w = row_x + row_w - text_x - 6;
      const bool has_location = !row.location.empty();
      const int summary_y = has_location ? (row_y + 6) : (row_y + row_h / 2);
      const int location_y = row_y + row_h - 6;
      auto *location_font = g_theme.weather_tiny.font ? g_theme.weather_tiny.font : g_theme.label.font;
      if (g_theme.label.font != nullptr) {
        ui_print_truncated(it, text_x, summary_y, g_theme.label.font,
                           text_color_, has_location ? TextAlign::TOP_LEFT : TextAlign::CENTER_LEFT,
                           row.summary.c_str(), text_w);
        if (has_location && location_font != nullptr) {
          ui_print_truncated(it, text_x, location_y, location_font,
                             dim_color_, TextAlign::BOTTOM_LEFT,
                             row.location.c_str(), text_w);
        }
      }

      drawn++;
    }

    if (drawn == 0) {
      draw_empty(it, r);
    }

    last_events_raw_ = *events_raw_;
    baseline_set_ = true;
  }

 private:
  struct CalendarRow {
    std::string start;
    std::string end;
    std::string summary;
    std::string location;
  };

  static constexpr int kPad = ui_spacing::md;
  static constexpr int kHeaderH = 28;

  int content_height() const {
    const int h = rect_.h - kHeaderH - 4;
    return h > 0 ? h : 0;
  }

  static void trim_inplace(std::string &value) {
    std::size_t f = value.find_first_not_of(" \t\r\n");
    if (f == std::string::npos) {
      value.clear();
      return;
    }
    std::size_t l = value.find_last_not_of(" \t\r\n");
    value = value.substr(f, l - f + 1);
  }

  static std::string format_start_(const std::string &start) {
    if (start.size() >= 16 && start[4] == '-' && start[7] == '-' && (start[10] == 'T' || start[10] == ' ')) {
      const std::string fallback = start.substr(8, 2) + "/" + start.substr(5, 2) + " " + start.substr(11, 5);
      if (sntp_time == nullptr) return fallback;

      auto now = sntp_time->now();
      if (!now.is_valid()) return fallback;

      int year = 0;
      int month = 0;
      int day = 0;
      int hour = 0;
      int minute = 0;
      const int parsed =
          sscanf(start.c_str(), "%4d-%2d-%2d%*[T ]%2d:%2d", &year, &month, &day, &hour, &minute);
      if (parsed != 5) return fallback;

      std::tm event_tm = {};
      event_tm.tm_year = year - 1900;
      event_tm.tm_mon = month - 1;
      event_tm.tm_mday = day;
      event_tm.tm_hour = hour;
      event_tm.tm_min = minute;
      event_tm.tm_sec = 0;
      event_tm.tm_isdst = -1;
      const std::time_t event_ts = std::mktime(&event_tm);
      if (event_ts == static_cast<std::time_t>(-1)) return fallback;

      constexpr std::time_t kDaySeconds = 24 * 60 * 60;
      std::time_t now_ts = static_cast<std::time_t>(now.timestamp);
      std::tm today_tm = *std::localtime(&now_ts);
      today_tm.tm_hour = 0;
      today_tm.tm_min = 0;
      today_tm.tm_sec = 0;
      const std::time_t today_midnight_ts = std::mktime(&today_tm);
      if (today_midnight_ts != static_cast<std::time_t>(-1) &&
          event_ts >= today_midnight_ts && event_ts < (today_midnight_ts + kDaySeconds)) {
        return start.substr(11, 5);
      }
      return fallback;
    }

    if (start.size() >= 10 && start[4] == '-' && start[7] == '-') {
      return start.substr(8, 2) + "/" + start.substr(5, 2);
    }
    if (start.size() >= 10 && start[4] == '/' && start[7] == '/') {
      return start.substr(8, 2) + "/" + start.substr(5, 2);
    }
    if (start.size() >= 5 &&
        std::isdigit(static_cast<unsigned char>(start[0])) &&
        std::isdigit(static_cast<unsigned char>(start[1])) &&
        std::isdigit(static_cast<unsigned char>(start[2])) &&
        std::isdigit(static_cast<unsigned char>(start[3])) &&
        (start[4] == '-' || start[4] == '/')) {
      return start.substr(5);
    }
    return start;
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
      if (!line.empty() && line != "NO EVENTS") {
        CalendarRow row;
        std::size_t p1 = line.find('|');
        std::size_t p2 = (p1 == std::string::npos) ? std::string::npos : line.find('|', p1 + 1);
        std::size_t p3 = (p2 == std::string::npos) ? std::string::npos : line.find('|', p2 + 1);
        if (p1 != std::string::npos) {
          row.start = line.substr(0, p1);
          if (p2 != std::string::npos) {
            row.end = line.substr(p1 + 1, p2 - p1 - 1);
            if (p3 != std::string::npos) {
              row.summary = line.substr(p2 + 1, p3 - p2 - 1);
              row.location = line.substr(p3 + 1);
            } else {
              row.summary = line.substr(p2 + 1);
            }
          } else {
            row.summary = line.substr(p1 + 1);
          }
        } else {
          row.summary = line;
        }
        trim_inplace(row.start);
        trim_inplace(row.end);
        trim_inplace(row.summary);
        trim_inplace(row.location);
        if (!row.summary.empty()) {
          rows_.push_back(row);
        }
      }
      if (end == std::string::npos) break;
      start = end + 1;
    }
  }

  void draw_empty(display::Display &it, const UiRect &r) {
    if (g_theme.label.font != nullptr) {
      it.printf(r.x + r.w / 2, r.y + r.h / 2, g_theme.label.font,
                dim_color_, TextAlign::CENTER, "NO EVENTS");
    }
  }

  UiRect rect_;
  const std::string *events_raw_ = nullptr;
  const char *label_ = nullptr;
  int max_items_ = 4;
  int row_height_ = 30;
  bool scrollable_ = false;
  Callback on_tap_;
  Color text_color_;
  Color dim_color_;
  std::vector<CalendarRow> rows_;
  int scroll_offset_ = 0;
  bool dragging_ = false;
  std::string last_events_raw_;
  bool baseline_set_ = false;
};

class NotificationOverlayWidget : public Widget {
 public:
  const char *widget_label() const override { return "NotifyOverlay"; }
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
      UiInvalidation::request_full(visible_now ? "NotifyOverlay appeared" : "NotifyOverlay dismissed");
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
    const NotificationLayout nl = compute_layout_();
    if (ui_hit_test_with_slop(nl.dismiss_btn, event.x, event.y)) {
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

    const NotificationLayout nl = compute_layout_();

    const Color accent = severity_color();
    const Color accent_dim = severity_dim_color();
    const Color panel_bg(16, 18, 22);
    const Color header_bg(24, 28, 34);
    const Color text_primary(245, 248, 255);
    const Color text_secondary(180, 188, 202);

    // Shadow and card shell. Outer padding (xl) frames the panel, inner
    // padding (md) separates the header band from the panel border.
    ui_fast_filled_rectangle(it, nl.panel.x + 6, nl.panel.y + 7,
                             nl.panel.w, nl.panel.h, Color(3, 4, 6));
    ui_fast_filled_rectangle(it, nl.panel.x, nl.panel.y, nl.panel.w, nl.panel.h, panel_bg);
    it.rectangle(nl.panel.x, nl.panel.y, nl.panel.w, nl.panel.h, accent);
    it.rectangle(nl.panel.x + 1, nl.panel.y + 1, nl.panel.w - 2, nl.panel.h - 2, accent_dim);
    {
      const UiRect header_band = nl.panel.inset(2);
      ui_fast_filled_rectangle(it, header_band.x, header_band.y,
                               header_band.w, nl.header_h, header_bg);
    }
    ui_fast_filled_rectangle(it, nl.panel.x + 2,
                             nl.panel.y + 2 + nl.header_h,
                             nl.panel.w - 4, 3, accent);

    // Severity icon sits inside the header band, vertically centered on it.
    it.filled_circle(nl.icon_cx, nl.icon_cy, 18, accent_dim);
    it.circle(nl.icon_cx, nl.icon_cy, 18, accent);
    const char *icon = severity_icon();
    if (g_theme.icon.font != nullptr) {
      it.printf(nl.icon_cx, nl.icon_cy + 1, g_theme.icon.font, accent,
                TextAlign::CENTER, "%s", icon);
    } else if (g_theme.header.font != nullptr) {
      it.printf(nl.icon_cx, nl.icon_cy, g_theme.header.font, accent,
                TextAlign::CENTER, "!");
    }

    const std::string display_title =
        (title_ != nullptr && !title_->empty()) ? *title_ : std::string("Notification");
    if (g_theme.header.font != nullptr) {
      ui_print_truncated(it, nl.title_x, nl.title_y, g_theme.header.font,
                         text_primary, TextAlign::TOP_LEFT, display_title, nl.panel.w - 86);
    }
    if (g_theme.label.font != nullptr) {
      it.printf(nl.title_x, nl.severity_y, g_theme.label.font, text_secondary,
                TextAlign::TOP_LEFT, "%s", severity_label());
    }

    if (g_theme.label.font != nullptr && body_ != nullptr) {
      const int body_x = nl.body.x;
      const int body_y = nl.body.y;
      const int body_w = nl.body.w;
      const int body_h = nl.body.h;
      const int max_body_h = body_h > 0 ? body_h : 0;
      int tx, ty, tw, th;
      const std::string &body_text = *body_;
      it.get_text_bounds(body_x, body_y, body_text.c_str(),
                         g_theme.label.font, TextAlign::TOP_LEFT, &tx, &ty, &tw, &th);
      if (tw <= body_w) {
        ui_print_truncated(it, body_x, body_y, g_theme.label.font,
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
            it.get_text_bounds(body_x, line_y, sub.c_str(),
                               g_theme.label.font, TextAlign::TOP_LEFT, &tx, &ty, &tw, &th);
            if (tw > body_w) break;
            if (tw > best_w) { best_w = tw; best_len = len; }
          }
          if (best_len == 0) best_len = 1;
          std::string line = body_text.substr(offset, best_len);
          const bool is_last = offset + best_len >= remaining;
          if (is_last) {
            ui_print_truncated(it, body_x, line_y, g_theme.label.font,
                               text_primary, TextAlign::TOP_LEFT, body_text.substr(offset), body_w);
          } else {
            it.printf(body_x, line_y, g_theme.label.font,
                      text_primary, TextAlign::TOP_LEFT, "%s", line.c_str());
          }
          offset += best_len;
          remaining -= best_len;
          line_y += line_height;
        }
      }
    }

    ui_fast_filled_rectangle(it, nl.dismiss_btn.x, nl.dismiss_btn.y,
                             nl.dismiss_btn.w, nl.dismiss_btn.h, accent_dim);
    it.rectangle(nl.dismiss_btn.x, nl.dismiss_btn.y,
                 nl.dismiss_btn.w, nl.dismiss_btn.h, accent);
    if (g_theme.label.font != nullptr) {
      it.printf(nl.dismiss_btn.x + nl.dismiss_btn.w / 2,
                nl.dismiss_btn.y + nl.dismiss_btn.h / 2,
                g_theme.label.font, text_primary, TextAlign::CENTER, "Dismiss");
    }

    last_body_ = body_ != nullptr ? *body_ : std::string();
    if (dismissed_ != nullptr) last_dismissed_ = *dismissed_;
  }

 private:
  // ---- Pre-computed layout geometry for the overlay panel ----
  // One struct drives both the draw and the touch hit-test, so the
  // painted visuals and the touch targets can never disagree. Magic
  // numbers from the previous version now come from ui_spacing and
  // a small set of named constants.
  struct NotificationLayout {
    UiRect panel;          // outer card rect (incl. shadow/border)
    UiRect body;           // body text box
    UiRect dismiss_btn;    // dismiss button rect
    int header_h;          // height of the dark header band
    int icon_cx, icon_cy;  // severity icon center
    int title_x, title_y;  // top-left of the title text
    int severity_y;        // top y of the severity label
  };
  NotificationLayout compute_layout_() const {
    NotificationLayout nl;
    const int panel_w = (display_w_ * 5) / 6;
    const int panel_h = (display_h_ * 3) / 5;
    const int panel_x = (display_w_ - panel_w) / 2;
    const int panel_y = (display_h_ - panel_h) / 2;
    nl.panel = UiRect{panel_x, panel_y, panel_w, panel_h};

    nl.header_h = 58;
    const int body_x = panel_x + ui_spacing::xl;
    const int body_w = panel_w - 2 * ui_spacing::xl;
    const int body_y = panel_y + nl.header_h + ui_spacing::md;
    const int btn_h = 40;
    const int btn_w = panel_w - 2 * (2 * ui_spacing::xl);
    const int btn_x = panel_x + (panel_w - btn_w) / 2;
    const int btn_y = panel_y + panel_h - btn_h - (2 * ui_spacing::xl);
    const int body_h = btn_y - body_y - ui_spacing::md;
    nl.body = UiRect{body_x, body_y, body_w, body_h > 0 ? body_h : 0};
    nl.dismiss_btn = UiRect{btn_x, btn_y, btn_w, btn_h};

    nl.icon_cx = panel_x + 36;
    nl.icon_cy = panel_y + 30;
    nl.title_x = panel_x + 66;
    nl.title_y = panel_y + 13;
    nl.severity_y = panel_y + 38;
    return nl;
  }

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

class HvacWidget : public Widget {
 public:
  const char *widget_label() const override { return "Hvac"; }
  using Callback = std::function<void()>;

  HvacWidget(UiRect rect, const char *label,
             const std::string *hvac_mode, const float *current_temp,
             const float *target_temp, const std::string *action,
             const char *entity_id,
             const char *icon_down = "\uF0374", const char *icon_up = "\uF0415",
             const char *icon_power = "\uF040E",
             float temp_step = 0.5f, float min_temp = 10.0f, float max_temp = 30.0f,
             const char *on_mode = "heat",
             Color on_color = Color(255, 180, 0),
             Color off_color = Color(80, 80, 80))
      : rect_(rect), label_(label),
        hvac_mode_ptr_(hvac_mode), current_temp_ptr_(current_temp),
        target_temp_ptr_(target_temp), action_ptr_(action),
        entity_id_(entity_id),
        icon_down_(icon_down), icon_up_(icon_up), icon_power_(icon_power),
        temp_step_(temp_step), min_temp_(min_temp), max_temp_(max_temp),
        on_mode_(on_mode),
        on_color_(on_color), off_color_(off_color) {}

  UiRect bounds() const override { return screen_rect(rect_); }

  void update(uint32_t now) override {
    if (loading_timeout_ms_ > 0 && loading_ &&
        (now - loading_start_ms_ > loading_timeout_ms_)) {
      loading_ = false;
      mark_dirty();
    }
    bool changed = false;
    if (hvac_mode_ptr_ && *hvac_mode_ptr_ != last_hvac_mode_) { changed = true; }
    if (current_temp_ptr_ &&
        ui_value_changed_quantized(*current_temp_ptr_, last_current_temp_)) {
      changed = true;
    }
    if (target_temp_ptr_ &&
        ui_value_changed_quantized(*target_temp_ptr_, last_target_temp_)) {
      changed = true;
    }
    if (action_ptr_ && *action_ptr_ != last_action_) { changed = true; }
    if (changed) mark_dirty();
    Widget::update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (event.type != TouchType::Tap) return false;
    if (loading_) return false;
    if (esphome::api::global_api_server == nullptr ||
        !esphome::api::global_api_server->is_connected()) {
      return false;
    }

    const HvacButtonLayout bl = compute_button_layout_(screen_rect(rect_));
    if (bl.contains(BtnTempDown, event.x, event.y)) {
      temp_down(now);
      return true;
    }
    if (bl.contains(BtnTempUp, event.x, event.y)) {
      temp_up(now);
      return true;
    }
    if (bl.contains(BtnPower, event.x, event.y)) {
      toggle_power(now);
      return true;
    }
    return false;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    const UiRect r = screen_rect(rect_);
    const int w = r.w;
    const int h = r.h;

    const bool is_on = hvac_mode_ptr_ && *hvac_mode_ptr_ != "off";
    const Color accent = is_on ? on_color_ : off_color_;
    const Color dim = RetroColors::STEEL;
    const Color text = RetroColors::WHITE;
    const int pad = ui_spacing::lg;
    const int top_y = r.y + pad + 3;
    const int top_row_h = 22;  // header font cap height

#if UI_THEME_RETRO
    // ---- Retro: clipped-corner container with glow halo, inner double-line
    // border, CRT scanline overlay and decorative corner ticks. The accent
    // colour mirrors the modern path: amber when on, dim grey when off.
    const Color bg = RetroColors::VOID;
    draw_clipped_box(it, r.x, r.y, w, h, ui_corner_radius_for_height(h), accent, bg, true);
    draw_clipped_border(it, r.x + 2, r.y + 2, w - 4, h - 4,
                        7, 7, 7, 7,
                        is_on ? RetroColors::AMBER_DIM : RetroColors::DIMMER);
    // Tiny corner accents (L-shapes) in cyan dim to echo the screen frame
    draw_corner_accent_tl(it, r.x + 4, r.y + 4, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_tr(it, r.x + w - 5, r.y + 4, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_bl(it, r.x + 4, r.y + h - 5, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_br(it, r.x + w - 5, r.y + h - 5, 5,
                          RetroColors::CYAN_DIM);
#else
    const Color bg(10, 14, 22);
    draw_clipped_box(it, r.x, r.y, w, h, ui_corner_radius_for_height(h), accent, bg, false);
#endif

    // ---- Top row: label (left) + mode (right) ----
    {
      if (label_ && label_[0] && g_theme.header.font != nullptr) {
        const int max_label_w = w - pad * 2 - 70;
        ui_print_truncated(it, r.x + pad, top_y,
                           g_theme.header.font, dim,
                           TextAlign::TOP_LEFT, label_, max_label_w);
      }

      if (hvac_mode_ptr_ && !hvac_mode_ptr_->empty() && g_theme.header.font != nullptr) {
        Color mode_color = is_on ? accent : dim;
        it.printf(r.x + w - pad, top_y, g_theme.header.font, mode_color,
                  TextAlign::TOP_RIGHT, "%s", hvac_mode_ptr_->c_str());
      }
    }

#if UI_THEME_RETRO
    // Dashed divider between the header and the temperature readout
    {
      const int div_y = top_y + top_row_h + 2;
      draw_dashed_hline(it, r.x + pad, r.x + w - pad, div_y,
                        RetroColors::DIMMER, 3, 3);
    }
#endif

    // ---- Shared button-row layout ----
    // Computed once and reused by both the center stack (to find the
    // content's bottom edge) and the button draw block below. Keeping
    // this in a single value means touch hit-test (in handle_touch) and
    // the painted visuals can never disagree.
    const HvacButtonLayout bl = compute_button_layout_(r);

    // ---- Center: current temp (optional) + target temp + "Target" label ----
    // Stack drawn with TOP_CENTER so y tracks the top of each line; the
    // whole stack is centered in the content area between the top row and
    // the button row.
    {
      const int content_top = top_y + top_row_h + 6;
      const int content_bottom = bl.btns_y - bl.pad;
      const int center_y = content_top + (content_bottom - content_top) / 2;

      const int target_h = 22;   // header font cap height
      const int label_h = 16;    // label font cap height
      const int gap = 5;
      const bool has_current =
          current_temp_ptr_ != nullptr && g_theme.label.font != nullptr &&
          *current_temp_ptr_ > 0.0f &&
          !std::isnan(*current_temp_ptr_) && !std::isinf(*current_temp_ptr_);

      // The VStack owns the "center on this y" math. The total height
      // depends on whether the optional current-temp line is present;
      // pass that precomputed total directly into the int overload.
      int total_h = target_h + gap + label_h;
      if (has_current) total_h += label_h + gap;
      VStack stack(center_y, total_h);

      if (has_current) {
        const int y = stack.next(label_h);
        char buf[16];
        snprintf(buf, sizeof(buf), "%.1f°", *current_temp_ptr_);
        it.printf(r.x + w / 2, y, g_theme.label.font, dim,
                  TextAlign::TOP_CENTER, "%s", buf);
        stack.skip(gap);
      }

      if (target_temp_ptr_ && g_theme.header.font != nullptr) {
        const int y = stack.next(target_h);
        char buf[16];
        snprintf(buf, sizeof(buf), "%.1f°", *target_temp_ptr_);
        const int ttx = r.x + w / 2;
        it.printf(ttx, y, g_theme.header.font, text,
                  TextAlign::TOP_CENTER, "%s", buf);
        stack.skip(gap);
#if UI_THEME_RETRO
        // Bracket the target readout with small L-shaped ticks to make it
        // read as the primary gauge rather than ordinary text.
        int tx, ty, tw, th;
        it.get_text_bounds(ttx, y, buf,
                           g_theme.header.font, TextAlign::TOP_CENTER,
                           &tx, &ty, &tw, &th);
        const int arm = 4;
        const int offX = 7;
        const int offY = 3;
        const Color bc = is_on ? accent : RetroColors::CYAN_DIM;
        draw_corner_accent_tl(it, tx - offX, ty - offY, arm, bc);
        draw_corner_accent_tr(it, tx + tw + offX, ty - offY, arm, bc);
        draw_corner_accent_bl(it, tx - offX, ty + th + offY, arm, bc);
        draw_corner_accent_br(it, tx + tw + offX, ty + th + offY, arm, bc);
#endif
      }

      if (g_theme.label.font != nullptr) {
        const int y = stack.next(label_h);
        it.printf(r.x + w / 2, y, g_theme.label.font, dim,
                  TextAlign::TOP_CENTER, "Target");
      }
    }

    // ---- Bottom buttons ----
    // One layout struct drives both the hit-test in handle_touch() and the
    // draws below; keeping both paths in sync prevents touch targets from
    // drifting away from the painted buttons.
    {
      auto draw_icon_btn = [&](int bx, int bw, int bh, const char *glyph,
                                Color bc, Color tc) {
        const int mc = 5;
        draw_clipped_box(it, bx, bl.btns_y, bw, bh, mc, bc, RetroColors::DIM, true);
        if (glyph && glyph[0] && g_theme.icon.font != nullptr) {
          it.printf(bx + bw / 2, bl.btns_y + bh / 2 - 1, g_theme.icon.font, tc,
                    TextAlign::CENTER, "%s", glyph);
        } else if (g_theme.label.font != nullptr) {
          it.printf(bx + bw / 2, bl.btns_y + bh / 2 - 1, g_theme.label.font, tc,
                    TextAlign::CENTER, "%s", glyph && glyph[0] ? glyph : "?");
        }
      };

      const bool temp_down_active = loading_ && pending_action_ == 1;
      const bool temp_up_active = loading_ && pending_action_ == 2;
      const bool power_active = loading_ && pending_action_ == 3;

#if UI_THEME_RETRO
      // Retro: temp buttons adopt the cyber palette — cyan when idle, amber
      // flash when pressed — so they harmonise with the container accent.
      const Color temp_dim = RetroColors::DIMMER;
      const Color temp_accent = RetroColors::AMBER;
#else
      const Color temp_dim(60, 60, 80);
      const Color temp_accent(255, 180, 0);
#endif

      struct Spec {
        HvacButtonId id;
        const char *glyph;
        bool active;
        Color idle_color;
        Color active_color;
      };
      const Spec specs[3] = {
          {BtnTempDown, icon_down_,  temp_down_active, temp_dim,   temp_accent},
          {BtnTempUp,   icon_up_,    temp_up_active,   temp_dim,   temp_accent},
          {BtnPower,    icon_power_, power_active,     off_color_, on_color_  },
      };
      for (const Spec &s : specs) {
        const HvacButtonRect br = bl.rect(s.id);
        const Color bc = s.active ? s.active_color : s.idle_color;
        draw_icon_btn(br.x, br.w, bl.btn_h, s.glyph, bc, text);
      }
    }

    // Save last values
    if (hvac_mode_ptr_) last_hvac_mode_ = *hvac_mode_ptr_;
    if (current_temp_ptr_) last_current_temp_ = *current_temp_ptr_;
    if (target_temp_ptr_) last_target_temp_ = *target_temp_ptr_;
    if (action_ptr_) last_action_ = *action_ptr_;
  }

 private:
  // ---- Shared button-row layout for HVAC bottom controls ----
  // The temp +/- and power buttons all sit on a single row at the bottom
  // of the card. Computing this once per draw/touch means touch hit-test
  // and painted visuals can never drift apart.
  enum HvacButtonId { BtnTempDown = 0, BtnTempUp = 1, BtnPower = 2 };
  struct HvacButtonRect {
    int x, w;  // absolute screen x / width
  };
  struct HvacButtonLayout {
    int btn_h;
    int btns_y;       // absolute screen y of button row
    int left_x;       // absolute screen x of the first button's left edge
    int temp_btn_w;
    int power_btn_w;
    int btn_gap;
    int pad;
    HvacButtonRect rect(HvacButtonId id) const {
      const int slot = (int)id;
      HvacButtonRect r;
      r.x = left_x + slot * (temp_btn_w + btn_gap);
      r.w = (id == BtnPower) ? power_btn_w : temp_btn_w;
      return r;
    }
    bool contains(HvacButtonId id, int tx, int ty) const {
      const HvacButtonRect r = rect(id);
      return tx >= r.x && tx <= r.x + r.w &&
             ty >= btns_y && ty <= btns_y + btn_h;
    }
  };
  HvacButtonLayout compute_button_layout_(const UiRect &r) const {
    HvacButtonLayout bl;
    bl.pad = ui_spacing::lg;
    bl.btn_h = 39;
    bl.btns_y = r.y + r.h - bl.btn_h - bl.pad;
    bl.left_x = r.x + bl.pad;
    bl.btn_gap = ui_spacing::sm;
    const int total_w = r.w - bl.pad * 2 - bl.btn_gap * 2;
    bl.temp_btn_w = total_w / 5;
    bl.power_btn_w = total_w - bl.temp_btn_w * 2;
    return bl;
  }

  void send_ha_service(const std::string &service,
                       const std::vector<std::pair<std::string, std::string>> &data) {
    auto *api = esphome::api::global_api_server;
    if (api == nullptr || !api->is_connected()) return;
    esphome::api::HomeAssistantServiceCallAction<> call(api, false);
    call.set_service(service);
    call.init_data(data.size() + 1);
    call.add_data("entity_id", entity_id_);
    for (const auto &kv : data) {
      call.add_data(kv.first.c_str(), kv.second);
    }
    call.play();
  }

  void toggle_power(uint32_t now) {
    if (hvac_mode_ptr_ == nullptr) return;
    loading_ = true;
    pending_action_ = 3;
    loading_start_ms_ = now;
    mark_dirty();

    if (*hvac_mode_ptr_ == "off") {
      send_ha_service("climate.set_hvac_mode", {{"hvac_mode", on_mode_}});
    } else {
      send_ha_service("climate.set_hvac_mode", {{"hvac_mode", "off"}});
    }

    char name_buf[24];
    snprintf(name_buf, sizeof(name_buf), "hvacpw_%p", this);
    esphome::App.scheduler.set_timeout(nullptr, name_buf, loading_timeout_ms_,
        [this]() {
          loading_ = false;
          pending_action_ = 0;
          mark_dirty();
          UiRedraw::trigger_display_update();
        });
  }

  void temp_up(uint32_t now) {
    if (target_temp_ptr_ == nullptr || hvac_mode_ptr_ == nullptr) return;
    float new_temp = *target_temp_ptr_ + temp_step_;
    if (new_temp > max_temp_) new_temp = max_temp_;
    set_temperature(new_temp, now);
    pending_action_ = 2;
  }

  void temp_down(uint32_t now) {
    if (target_temp_ptr_ == nullptr || hvac_mode_ptr_ == nullptr) return;
    float new_temp = *target_temp_ptr_ - temp_step_;
    if (new_temp < min_temp_) new_temp = min_temp_;
    set_temperature(new_temp, now);
    pending_action_ = 1;
  }

  void set_temperature(float temperature, uint32_t now) {
    loading_ = true;
    loading_start_ms_ = now;
    mark_dirty();

    char temp_buf[16];
    snprintf(temp_buf, sizeof(temp_buf), "%.1f", temperature);
    send_ha_service("climate.set_temperature", {{"temperature", temp_buf}});

    char name_buf[24];
    snprintf(name_buf, sizeof(name_buf), "hvactm_%p", this);
    esphome::App.scheduler.set_timeout(nullptr, name_buf, loading_timeout_ms_,
        [this]() {
          loading_ = false;
          pending_action_ = 0;
          mark_dirty();
          UiRedraw::trigger_display_update();
        });
  }

  UiRect rect_;
  const char *label_;
  const std::string *hvac_mode_ptr_ = nullptr;
  const float *current_temp_ptr_ = nullptr;
  const float *target_temp_ptr_ = nullptr;
  const std::string *action_ptr_ = nullptr;
  std::string entity_id_;
  const char *icon_down_;
  const char *icon_up_;
  const char *icon_power_;
  float temp_step_;
  float min_temp_;
  float max_temp_;
  std::string on_mode_;
  Color on_color_;
  Color off_color_;
  bool loading_ = false;
  uint32_t loading_start_ms_ = 0;
  uint32_t loading_timeout_ms_ = 350;
  int pending_action_ = 0;
  std::string last_hvac_mode_;
  float last_current_temp_ = 0.0f;
  float last_target_temp_ = 0.0f;
  std::string last_action_;
};

struct WeatherDayPointers {
  const std::string *condition = nullptr;
  const float *temperature = nullptr;
  const float *humidity = nullptr;
  const float *wind_speed = nullptr;
  const float *precipitation = nullptr;
};

class WeatherWidget : public Widget {
 public:
  const char *widget_label() const override { return "Weather"; }
  using Callback = std::function<void()>;
  WeatherWidget(UiRect rect, const char *label,
                const char *entity_id,
                bool forecast_mode = false,
                WeatherDayPointers day1 = WeatherDayPointers{},
                WeatherDayPointers day2 = WeatherDayPointers{},
                WeatherDayPointers day3 = WeatherDayPointers{},
                Callback on_tap = nullptr,
                Color text_color = Color(255, 255, 255),
                Color dim_color  = Color(80, 80, 80))
      : rect_(rect), label_(label),
        entity_id_(entity_id),
        forecast_mode_(forecast_mode),
        on_tap_(std::move(on_tap)),
        text_color_(text_color), dim_color_(dim_color) {
    days_[0] = day1;
    days_[1] = day2;
    days_[2] = day3;
  }

  UiRect bounds() const override { return screen_rect(rect_); }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (event.type != TouchType::Tap) return false;
    const UiRect r = screen_rect(rect_);
    if (event.x < r.x || event.y < r.y || event.x >= r.x + r.w || event.y >= r.y + r.h) return false;
    if (on_tap_) on_tap_();
    return on_tap_ != nullptr;
  }

  void update(uint32_t now) override {
    (void)now;
    bool changed = false;
    const int n = forecast_mode_ ? 3 : 1;
    for (int d = 0; d < n; d++) {
      const auto &dp = days_[d];
      if (dp.condition && *dp.condition != last_condition_[d]) { changed = true; }
      if (changed_value(dp.temperature, last_temperature_[d])) { changed = true; }
      if (changed_value(dp.humidity, last_humidity_[d])) { changed = true; }
      if (changed_value(dp.wind_speed, last_wind_speed_[d])) { changed = true; }
      if (changed_value(dp.precipitation, last_precipitation_[d])) { changed = true; }
    }
    if (changed) mark_dirty();
    Widget::update(now);
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    const UiRect r = screen_rect(rect_);
    const int w = r.w;
    const int h = r.h;

    if (forecast_mode_) {
      draw_forecast(it, r);
    } else {
      draw_compact(it, r);
    }

    const int n = forecast_mode_ ? 3 : 1;
    for (int d = 0; d < n; d++) {
      if (days_[d].condition) last_condition_[d] = *days_[d].condition;
      copy_value(days_[d].temperature, last_temperature_[d]);
      copy_value(days_[d].humidity, last_humidity_[d]);
      copy_value(days_[d].wind_speed, last_wind_speed_[d]);
      copy_value(days_[d].precipitation, last_precipitation_[d]);
    }
  }

 private:
  // ---- Shared layout geometry for both compact + forecast modes ----
  // Both views share the same outer padding, header offset, and the
  // "content top" baseline (top of body, below the header). Only the
  // content_bottom and per-element offsets differ; those are configured
  // per-call below.
  struct WeatherLayout {
    int pad;            // outer widget padding (left/right/top)
    int top_y;          // y of header label (r.y + pad + 3)
    int header_row_h;   // height reserved for the header label band
    int content_top;    // y where body content starts (top_y + header_row_h)
    int content_bottom; // y where body content ends (mode-specific)
    int icon_y_offset;  // y of icon relative to content_top
    int temp_y_offset;  // y of temperature relative to content_top
  };
  WeatherLayout make_weather_layout_(const UiRect &r, bool with_pill_row) const {
    WeatherLayout l;
    l.pad = ui_spacing::lg;
    l.top_y = r.y + l.pad + 8;
    l.header_row_h = 20;
    l.content_top = l.top_y + l.header_row_h;
    if (with_pill_row) {
      // Compact: leave room for the bottom 3-pill row (48px from bottom).
      l.content_bottom = r.y + r.h - l.pad - 46;
      l.icon_y_offset = 14;
      l.temp_y_offset = 10;
    } else {
      // Forecast: bottom margin is small, stack is centered in the rest.
      l.content_bottom = r.y + r.h - l.pad - 10;
      l.icon_y_offset = 0;
      l.temp_y_offset = 0;
    }
    return l;
  }

  // ---- Today layout ----
  void draw_compact(display::Display &it, const UiRect &r) {
    const int w = r.w;
    const int h = r.h;
    const WeatherLayout l = make_weather_layout_(r, /*with_pill_row=*/true);
    const auto &dp = days_[0];
    const Color accent = condition_color(dp.condition ? dp.condition->c_str() : "");

#if UI_THEME_RETRO
    const Color bg = RetroColors::VOID;
    draw_clipped_box(it, r.x, r.y, w, h, ui_corner_radius_for_height(h), accent, bg, true);
    draw_clipped_border(it, r.x + 2, r.y + 2, w - 4, h - 4,
                        7, 7, 7, 7,
                        RetroColors::DIMMER);
    draw_scanline_overlay(it, r.x + 1, r.y + 1, w - 2, h - 2, 4,
                          RetroColors::SCANLINE);
    draw_corner_accent_tl(it, r.x + 4, r.y + 4, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_tr(it, r.x + w - 5, r.y + 4, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_bl(it, r.x + 4, r.y + h - 5, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_br(it, r.x + w - 5, r.y + h - 5, 5,
                          RetroColors::CYAN_DIM);
#else
    const Color bg(10, 14, 22);
    draw_clipped_box(it, r.x, r.y, w, h, ui_corner_radius_for_height(h), accent, bg, false);
#endif

    if (label_ && label_[0] && g_theme.label.font != nullptr) {
      const int max_label_w = w - ui_spacing::md * 2;
      ui_print_truncated(it, r.x + ui_spacing::md, r.y + 6,
                         g_theme.label.font, dim_color_,
                         TextAlign::TOP_LEFT, label_, max_label_w);
    }

    {
      const int cy = (l.content_top + l.content_bottom) / 2;

      if (dp.condition && !dp.condition->empty() && g_theme.icon.font != nullptr) {
        const char *glyph = condition_icon(dp.condition->c_str());
        draw_weather_icon(it, r.x + w / 2, l.content_top + l.icon_y_offset,
                          accent, glyph);
      }

      const int temp_y = cy + l.temp_y_offset;
      if (valid_value(dp.temperature)) {
        char buf[16];
        snprintf(buf, sizeof(buf), "%.1f°", *dp.temperature);
        it.printf(r.x + w / 2, temp_y, g_theme.header.font, text_color_,
                  TextAlign::TOP_CENTER, "%s", buf);
      } else {
        it.printf(r.x + w / 2, temp_y, g_theme.header.font, dim_color_,
                  TextAlign::TOP_CENTER, "—°");
      }
    }

    {
      const int pill_top = r.y + h - 48;
      const int pill_h = 40;
      const int pill_pad = 5;
      const int pill_w = (w - l.pad * 2 - pill_pad * 2) / 3;

      ui_draw_data_pill(it, r.x + l.pad, pill_top, pill_w, pill_h, "HUM",
                        dp.humidity, "%", dim_color_, text_color_);
      ui_draw_data_pill(it, r.x + l.pad + pill_w + pill_pad, pill_top,
                        pill_w, pill_h, "RAIN", dp.precipitation, " mm",
                        dim_color_, text_color_);
      ui_draw_data_pill(it, r.x + l.pad + (pill_w + pill_pad) * 2, pill_top,
                        pill_w, pill_h, "WIND", dp.wind_speed, " m/s",
                        dim_color_, text_color_);
    }
  }

  // ---- Forecast layout ----
  void draw_forecast(display::Display &it, const UiRect &r) {
    const int w = r.w;
    const int h = r.h;
    const WeatherLayout l = make_weather_layout_(r, /*with_pill_row=*/false);

    const Color accent = condition_color(days_[0].condition ? days_[0].condition->c_str() : "");
    const Color bg(10, 14, 22);
    draw_clipped_box(it, r.x, r.y, w, h, ui_corner_radius_for_height(h), accent, bg, false);

    if (label_ && label_[0] && g_theme.label.font != nullptr) {
      const int max_label_w = w - ui_spacing::md * 2;
      ui_print_truncated(it, r.x + ui_spacing::md, r.y + 6,
                         g_theme.label.font, dim_color_,
                         TextAlign::TOP_LEFT, label_, max_label_w);
    }

    const int col_gap = ui_spacing::sm;
    const int col_count = 3;
    const int col_w = (w - l.pad * 2 - col_gap * 2) / col_count;
    const int content_h = l.content_bottom - l.content_top;
    const int day_to_icon_gap = 24;
    const int icon_to_temp_gap = 54;
    const int temp_to_rain_gap = 30;
    const int rain_to_value_gap = 18;
    const int value_h = 16;
    const int stack_h = day_to_icon_gap + icon_to_temp_gap + temp_to_rain_gap + rain_to_value_gap + value_h;
    const int centered_top = l.content_top + (content_h - stack_h) / 2 + 2;

    const char *day_labels[3] = {"---", "---", "---"};
    {
      const char *weekday_short[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
      auto now = sntp_time->now();
      if (now.is_valid()) {
        int dow = now.day_of_week - 1; // 0=Sunday
        for (int i = 0; i < 3; i++) {
          day_labels[i] = weekday_short[(dow + i) % 7];
        }
      }
    }

    for (int d = 0; d < col_count; d++) {
      const int cx = r.x + l.pad + d * (col_w + col_gap);
      const int mid = cx + col_w / 2;
      const auto &dp = days_[d];
      const Color col_accent = condition_color(dp.condition ? dp.condition->c_str() : "");

      int cy = centered_top;

      // Day label
      if (g_theme.label.font != nullptr) {
        it.printf(mid, cy, g_theme.label.font, dim_color_,
                  TextAlign::TOP_CENTER, "%s", day_labels[d]);
      }
      cy += day_to_icon_gap;

      // Icon
      if (dp.condition && !dp.condition->empty() && g_theme.icon.font != nullptr) {
        const char *glyph = condition_icon(dp.condition->c_str());
        draw_weather_icon(it, mid, cy, col_accent, glyph);
      }
      cy += icon_to_temp_gap;

      // Temperature
      if (g_theme.label.font != nullptr) {
        if (valid_value(dp.temperature)) {
          char buf[16];
          snprintf(buf, sizeof(buf), "%.1f°", *dp.temperature);
          it.printf(mid, cy, g_theme.label.font, text_color_,
                    TextAlign::TOP_CENTER, "%s", buf);
        } else {
          it.printf(mid, cy, g_theme.label.font, dim_color_,
                    TextAlign::TOP_CENTER, "—°");
        }
      }
      cy += temp_to_rain_gap;

      // Rain detail
      if (g_theme.label.font != nullptr) {
        it.printf(mid, cy, g_theme.label.font, dim_color_,
                  TextAlign::TOP_CENTER, "RAIN");
        cy += rain_to_value_gap;
        if (valid_value(dp.precipitation)) {
          char buf[24];
          snprintf(buf, sizeof(buf), "%.1f mm", *dp.precipitation);
          it.printf(mid, cy, g_theme.label.font, text_color_,
                    TextAlign::TOP_CENTER, "%s", buf);
        } else {
          it.printf(mid, cy, g_theme.label.font, dim_color_,
                    TextAlign::TOP_CENTER, "\xE2\x80\x94");
        }
      }
    }
  }

  static bool valid_value(const float *p) {
    return p != nullptr && !std::isnan(*p) && !std::isinf(*p);
  }

  static bool changed_value(const float *p, float last) {
    if (p == nullptr) return false;
    return ui_value_changed_quantized(*p, last);
  }

  static void copy_value(const float *p, float &dest) {
    if (p != nullptr) dest = *p;
  }

  struct ConditionMeta {
    Color color;
    const char *icon;
  };

  static const std::map<std::string, ConditionMeta> kWeatherConditions;

  static const ConditionMeta* find_condition(const char *cond) {
    if (cond == nullptr) return nullptr;
    auto it = kWeatherConditions.find(cond);
    return it != kWeatherConditions.end() ? &it->second : nullptr;
  }

  static Color condition_color(const char *cond) {
    const ConditionMeta *m = find_condition(cond);
    return m ? m->color : Color(180, 190, 210);
  }

  static const char *condition_icon(const char *cond) {
    const ConditionMeta *m = find_condition(cond);
    return m ? m->icon : icon_weather_partly_cloudy;
  }

  // ---- MDI weather icon glyphs (UTF-8 C escapes) ----
  static const char icon_weather_cloudy[];
  static const char icon_weather_fog[];
  static const char icon_weather_hail[];
  static const char icon_weather_lightning[];
  static const char icon_weather_lightning_rainy[];
  static const char icon_weather_night[];
  static const char icon_weather_partly_cloudy[];
  static const char icon_weather_pouring[];
  static const char icon_weather_rainy[];
  static const char icon_weather_snowy[];
  static const char icon_weather_snowy_rainy[];
  static const char icon_weather_sunny[];
  static const char icon_weather_tornado[];
  static const char icon_weather_windy[];
  static const char icon_weather_windy_variant[];

  void draw_weather_icon(display::Display &it, int x, int y, Color color, const char *glyph) {
    auto *icon_font = g_theme.weather_icon.font ? g_theme.weather_icon.font : g_theme.icon.font;
    if (icon_font == nullptr || glyph == nullptr || glyph[0] == '\0') return;
    // When using the dedicated large weather font the glyph is already the
    // right size. Apply only a 1px stamp for weight/anti-aliasing. When
    // falling back to the small icon font (24px), use a wider stamp to
    // compensate for the smaller glyph.
    const bool using_large_font = g_theme.weather_icon.font != nullptr;
    const int spread = using_large_font ? 1 : 4;
    for (int dy = -spread; dy <= spread; dy++) {
      for (int dx = -spread; dx <= spread; dx++) {
        if (dx * dx + dy * dy > spread * spread) continue;
        it.printf(x + dx, y + dy, icon_font, color, TextAlign::TOP_CENTER, "%s", glyph);
      }
    }
  }

  UiRect rect_;
  const char *label_;
  std::string entity_id_;
  bool forecast_mode_ = false;
  Callback on_tap_;
  WeatherDayPointers days_[3];
  Color text_color_;
  Color dim_color_;
  std::string last_condition_[3];
  float last_temperature_[3] = {0.0f};
  float last_humidity_[3] = {0.0f};
  float last_wind_speed_[3] = {0.0f};
  float last_precipitation_[3] = {0.0f};
};

// ---- WeatherWidget static icon glyph definitions ----

const char WeatherWidget::icon_weather_cloudy[]           = "\xF3\xB0\x96\x90";
const char WeatherWidget::icon_weather_fog[]              = "\xF3\xB0\x96\x91";
const char WeatherWidget::icon_weather_hail[]             = "\xF3\xB0\x96\x92";
const char WeatherWidget::icon_weather_lightning[]        = "\xF3\xB0\x96\x93";
const char WeatherWidget::icon_weather_lightning_rainy[]  = "\xF3\xB0\x99\xBE";
const char WeatherWidget::icon_weather_night[]            = "\xF3\xB0\x96\x94";
const char WeatherWidget::icon_weather_partly_cloudy[]    = "\xF3\xB0\x96\x95";
const char WeatherWidget::icon_weather_pouring[]          = "\xF3\xB0\x96\x96";
const char WeatherWidget::icon_weather_rainy[]            = "\xF3\xB0\x96\x97";
const char WeatherWidget::icon_weather_snowy[]            = "\xF3\xB0\x96\x98";
const char WeatherWidget::icon_weather_snowy_rainy[]      = "\xF3\xB0\x99\xBF";
const char WeatherWidget::icon_weather_sunny[]            = "\xF3\xB0\x96\x99";
const char WeatherWidget::icon_weather_tornado[]          = "\xF3\xB0\xBC\xB8";
const char WeatherWidget::icon_weather_windy[]            = "\xF3\xB0\x96\x9D";
const char WeatherWidget::icon_weather_windy_variant[]    = "\xF3\xB0\x96\x9E";

// Single source of truth for weather-condition colour + icon. Both
// condition_color() and condition_icon() look up from this table so
// adding a new condition only requires one line.
const std::map<std::string, WeatherWidget::ConditionMeta> WeatherWidget::kWeatherConditions = {
  {"sunny",           {Color(255, 200, 50), WeatherWidget::icon_weather_sunny}},
  {"clear-night",     {Color(70, 90, 160),  WeatherWidget::icon_weather_night}},
  {"cloudy",          {Color(160, 170, 185),WeatherWidget::icon_weather_cloudy}},
  {"partlycloudy",    {Color(180, 190, 210),WeatherWidget::icon_weather_partly_cloudy}},
  {"partly_cloudy",   {Color(180, 190, 210),WeatherWidget::icon_weather_partly_cloudy}},
  {"rainy",           {Color(70, 130, 200), WeatherWidget::icon_weather_rainy}},
  {"pouring",         {Color(40, 90, 170),  WeatherWidget::icon_weather_pouring}},
  {"snowy",           {Color(215, 235, 250),WeatherWidget::icon_weather_snowy}},
  {"snowy-rainy",     {Color(150, 195, 220),WeatherWidget::icon_weather_snowy_rainy}},
  {"snowing",         {Color(210, 230, 245),WeatherWidget::icon_weather_snowy}},
  {"snow",            {Color(210, 230, 245),WeatherWidget::icon_weather_snowy}},
  {"fog",             {Color(150, 160, 175),WeatherWidget::icon_weather_fog}},
  {"hail",            {Color(170, 200, 220),WeatherWidget::icon_weather_hail}},
  {"lightning",       {Color(200, 180, 80), WeatherWidget::icon_weather_lightning}},
  {"lightning_rainy", {Color(200, 180, 80), WeatherWidget::icon_weather_lightning_rainy}},
  {"lightning-rainy", {Color(200, 180, 80), WeatherWidget::icon_weather_lightning_rainy}},
  {"windy",           {Color(130, 200, 180),WeatherWidget::icon_weather_windy}},
  {"windy-variant",   {Color(140, 180, 185),WeatherWidget::icon_weather_windy_variant}},
  {"exceptional",     {Color(200, 100, 100),WeatherWidget::icon_weather_tornado}},
};

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
                TextAlign::CENTER, "Home Display v2.0");
    }
  }

 private:
  static constexpr uint32_t loading_redraw_interval_ms = 200;
  uint32_t last_dirty_ms_ = 0;
  mutable bool loading_visible_ = true;
};

#include "ui_tab_container.h"
#include "ui_chrome.h"
