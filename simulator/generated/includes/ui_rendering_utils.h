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

// Format a calendar-like date string for compact display.
//   "2026-05-19T14:30:00" (today)     → "14:30"
//   "2026-05-19T14:30:00" (not today) → "19/05 14:30"
//   "2026-05-19"                       → "19/05"
//   Non-ISO strings                    → unchanged
inline std::string ui_format_date_display(const std::string &date_str) {
  if (date_str.size() >= 16 && date_str[4] == '-' && date_str[7] == '-' &&
      (date_str[10] == 'T' || date_str[10] == ' ')) {
    const std::string fallback = date_str.substr(8, 2) + "/" +
                                 date_str.substr(5, 2) + " " +
                                 date_str.substr(11, 5);
    if (sntp_time != nullptr) {
      auto now = sntp_time->now();
      if (now.is_valid()) {
        int year = 0, month = 0, day = 0, hour = 0, minute = 0;
        const int parsed = sscanf(date_str.c_str(), "%4d-%2d-%2d%*[T ]%2d:%2d",
                                  &year, &month, &day, &hour, &minute);
        if (parsed == 5) {
          std::tm event_tm = {};
          event_tm.tm_year = year - 1900;
          event_tm.tm_mon = month - 1;
          event_tm.tm_mday = day;
          event_tm.tm_hour = hour;
          event_tm.tm_min = minute;
          event_tm.tm_sec = 0;
          event_tm.tm_isdst = -1;
          const std::time_t event_ts = std::mktime(&event_tm);
          if (event_ts != static_cast<std::time_t>(-1)) {
            constexpr std::time_t kDaySeconds = 24 * 60 * 60;
            std::time_t now_ts = static_cast<std::time_t>(now.timestamp);
            std::tm today_tm = *std::localtime(&now_ts);
            today_tm.tm_hour = 0;
            today_tm.tm_min = 0;
            today_tm.tm_sec = 0;
            const std::time_t today_midnight_ts = std::mktime(&today_tm);
            if (today_midnight_ts != static_cast<std::time_t>(-1) &&
                event_ts >= today_midnight_ts &&
                event_ts < (today_midnight_ts + kDaySeconds)) {
              return date_str.substr(11, 5);
            }
          }
        }
      }
    }
    return fallback;
  }

  if (date_str.size() >= 10 && date_str[4] == '-' && date_str[7] == '-') {
    return date_str.substr(8, 2) + "/" + date_str.substr(5, 2);
  }
  if (date_str.size() >= 10 && date_str[4] == '/' && date_str[7] == '/') {
    return date_str.substr(8, 2) + "/" + date_str.substr(5, 2);
  }
  if (date_str.size() >= 5 &&
      std::isdigit(static_cast<unsigned char>(date_str[0])) &&
      std::isdigit(static_cast<unsigned char>(date_str[1])) &&
      std::isdigit(static_cast<unsigned char>(date_str[2])) &&
      std::isdigit(static_cast<unsigned char>(date_str[3])) &&
      (date_str[4] == '-' || date_str[4] == '/')) {
    return date_str.substr(5);
  }
  return date_str;
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
  TextStyle header_large = {nullptr, RetroColors::CYAN, TextAlign::TOP_LEFT};
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

