#pragma once

#include "ui_widget_base.h"

class DigitalClockWidget : public Widget {
 public:
  const char *widget_label() const override { return "DigitalClock"; }
  using Callback = std::function<void()>;

  DigitalClockWidget(UiRect rect, Callback on_tap = nullptr)
      : rect_(rect), on_tap_(std::move(on_tap)) {}

  UiRect bounds() const override { return screen_rect(rect_); }

  void set_color(Color c) {
    color_ = c;
    mark_dirty();
  }

  void update(uint32_t now) override {
    auto time_now = sntp_time->now();
    if (time_now.is_valid()) {
      if (!baseline_set_ || time_now.hour != last_hour_ || time_now.minute != last_minute_) {
        mark_dirty();
      }
    }
    Widget::update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (event.type != TouchType::Tap) return false;
    if (!on_tap_) return false;
    if (!ui_hit_test_with_slop(touch_bounds(), event.x, event.y)) return false;
    on_tap_();
    return true;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    const UiRect r = screen_rect(rect_);

#if UI_THEME_RETRO
    const Color panel_bg(2, 15, 31);
#else
    const Color panel_bg(12, 19, 32);
#endif
    const int panel_radius = 9;
    ui_fast_filled_rectangle(it, r.x, r.y, r.w, r.h, panel_bg);
    draw_clipped_border(it, r.x, r.y, r.w, r.h,
                        panel_radius, panel_radius, panel_radius, panel_radius,
                        color_);
#if UI_THEME_RETRO
    if (r.w > 2 && r.h > 2) {
      draw_scanline_overlay(it, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 4, RetroColors::SCANLINE);
    }
    if (r.w >= 80 && r.h >= 44) {
      // Cockpit-style registration marks and a tiny signal meter turn the
      // clock into a piece of shipboard instrumentation.
      draw_corner_accent_tl(it, r.x + 4, r.y + 4, 7, RetroColors::CYAN_DIM);
      draw_corner_accent_br(it, r.x + r.w - 5, r.y + r.h - 5, 7,
                            RetroColors::CYAN_DIM);
      ui_fast_filled_rectangle(it, r.x + r.w - 17, r.y + 5, 3, 3, color_);
      ui_fast_filled_rectangle(it, r.x + r.w - 11, r.y + 5, 3, 3,
                               RetroColors::CYAN_DIM);
      draw_segmented_bar(it, r.x + r.w - 48, r.y + r.h - 7, 36, 2,
                         6, 4, 2, color_, RetroColors::DARK_GRAY);
    }
#else
    if (r.w >= 80 && r.h >= 44) {
      // A recessed inner edge and compact live-status accent give the clock
      // the feel of a premium ambient dashboard card.
      draw_clipped_border(it, r.x + 2, r.y + 2, r.w - 4, r.h - 4,
                          7, 7, 7, 7, RetroColors::DARK_GRAY);
      ui_fast_filled_rectangle(it, r.x + 10, r.y + r.h - 4,
                               std::min(42, r.w / 4), 2, color_);
      it.filled_circle(r.x + r.w - 12, r.y + 11, 2, color_);
    }
#endif

    auto now = sntp_time->now();
    char clock_buf[8] = "--:--";
    if (now.is_valid()) {
      snprintf(clock_buf, sizeof(clock_buf), "%02d:%02d", now.hour, now.minute);
      last_hour_ = now.hour;
      last_minute_ = now.minute;
      baseline_set_ = true;
    }

    auto *time_font = g_theme.header_large.font != nullptr
        ? g_theme.header_large.font
        : (g_theme.header.font != nullptr ? g_theme.header.font : g_theme.label.font);
    auto *date_font = g_theme.label.font != nullptr ? g_theme.label.font : time_font;
    if (time_font == nullptr || date_font == nullptr) return;

    const int pad_x = 10;
    const int left_x = r.x + pad_x;

    if (r.h < 56) {
      const int cx = r.x + (r.w / 2);
      const int cy = r.y + (r.h / 2);
      it.printf(cx, cy, time_font, color_, TextAlign::CENTER, "%s", clock_buf);
      return;
    }

    const int time_y = r.y + 4;
    const Color shadow_color(0, 0, 0);
    it.printf(left_x + 1, time_y + 1, time_font, shadow_color, TextAlign::TOP_LEFT, "%s", clock_buf);
    it.printf(left_x, time_y, time_font, color_, TextAlign::TOP_LEFT, "%s", clock_buf);
    it.printf(left_x + 1, time_y, time_font, color_, TextAlign::TOP_LEFT, "%s", clock_buf);

    auto now_for_date = sntp_time->now();
    const char *days[] = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};
    const char *months[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};
    char date_buf[32] = "";
    if (now_for_date.is_valid()) {
      int day_index = now_for_date.day_of_week - 1;
      if (day_index < 0) day_index = 0;
      if (day_index > 6) day_index = 6;
      int month_index = now_for_date.month - 1;
      if (month_index < 0) month_index = 0;
      if (month_index > 11) month_index = 11;
      snprintf(date_buf, sizeof(date_buf), "%s %d %s", days[day_index], now_for_date.day_of_month, months[month_index]);
    }

    if (date_buf[0] != '\0') {
      const Color sub_color(
          static_cast<uint8_t>(std::max(0, static_cast<int>(color_.r) - 85)),
          static_cast<uint8_t>(std::max(0, static_cast<int>(color_.g) - 85)),
          static_cast<uint8_t>(std::max(0, static_cast<int>(color_.b) - 85)));
      int tx, ty, tw, th;
      it.get_text_bounds(left_x, time_y, clock_buf, time_font, TextAlign::TOP_LEFT, &tx, &ty, &tw, &th);
      int date_y = ty + th + 4;
      const int date_bottom = date_y + 14;
      const int max_bottom = r.y + r.h - 2;
      if (date_bottom > max_bottom) {
        date_y = std::max(r.y + 4, max_bottom - 14);
      }
      it.printf(left_x + 1, date_y + 1, date_font, shadow_color, TextAlign::TOP_LEFT, "%s", date_buf);
      it.printf(left_x, date_y, date_font, sub_color, TextAlign::TOP_LEFT, "%s", date_buf);
    }
  }

 private:
  UiRect rect_;
  Callback on_tap_;
  Color color_{RetroColors::CYAN};
  int last_hour_ = -1;
  int last_minute_ = -1;
  bool baseline_set_ = false;
};
