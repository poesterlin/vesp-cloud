#pragma once
#include "esphome.h"
#include "ui_state.h"
#include "ui_widgets.h"
#include "ui_retro.h"

inline void draw_retro_box(display::Display& it, int x, int y, int w, int h,
                           esphome::font::Font* font = nullptr,
                           const char* label = nullptr, Color color = RetroColors::DIM) {
  draw_double_clipped_border(it, x, y, w, h, 6, 2, RetroColors::CYAN, RetroColors::DIMMER);

  if (label && font) {
    int tx, ty, tw, th;
    it.get_text_bounds(x + 12, y - 7, label, font, TextAlign::TOP_LEFT, &tx, &ty, &tw, &th);
    ui_fast_filled_rectangle(it, tx - 2, ty, tw + 4, th, RetroColors::VOID);
    it.printf(x + 12, y - 7, font, color, TextAlign::TOP_LEFT, " %s ", label);
  }
}

class PageIndicatorWidget : public Widget {
 public:
  const char *widget_label() const override { return "PageIndicator"; }
  PageIndicatorWidget(int y, int dot_spacing = 28, int radius_active = 7, int radius_inactive = 5)
      : y_(y), dot_spacing_(dot_spacing), radius_active_(radius_active), radius_inactive_(radius_inactive) {}

  UiRect bounds() const override {
    return UiRect{0, y_ - radius_active_ - 2, 480, 2 * (radius_active_ + 2)};
  }

  void draw(display::Display& it, const UiState& state) override {
    int total = state.home_total_pages;
    if (total <= 1) return;
    int page = state.home_page_index;
    int center_x = 240;
    int total_width = total * dot_spacing_;
    int start_x = center_x - total_width / 2 + dot_spacing_ / 2;

    for (int i = 0; i < total; i++) {
      int dot_x = start_x + i * dot_spacing_;
      if (i == page) {
#if UI_THEME_RETRO
        // Active page: filled diamond
        it.line(dot_x, y_ - radius_active_, dot_x + radius_active_, y_, RetroColors::CYAN);
        it.line(dot_x + radius_active_, y_, dot_x, y_ + radius_active_, RetroColors::CYAN);
        it.line(dot_x, y_ + radius_active_, dot_x - radius_active_, y_, RetroColors::CYAN);
        it.line(dot_x - radius_active_, y_, dot_x, y_ - radius_active_, RetroColors::CYAN);
#else
        // Active page: filled circle
        it.filled_circle(dot_x, y_, radius_active_ - 2, RetroColors::CYAN);
#endif
      } else {
#if UI_THEME_RETRO
        // Inactive page: outline diamond
        int r = radius_inactive_;
        it.line(dot_x, y_ - r, dot_x + r, y_, RetroColors::DIMMER);
        it.line(dot_x + r, y_, dot_x, y_ + r, RetroColors::DIMMER);
        it.line(dot_x, y_ + r, dot_x - r, y_, RetroColors::DIMMER);
        it.line(dot_x - r, y_, dot_x, y_ - r, RetroColors::DIMMER);
#else
        // Inactive page: smaller filled circle
        it.filled_circle(dot_x, y_, radius_inactive_ - 2, RetroColors::DIMMER);
#endif
      }
    }
    last_page_ = page;
    last_total_ = total;
    page_baseline_set_ = true;
  }

  void update(uint32_t now) override {
    if (!page_baseline_set_)
      mark_dirty();
    Widget::update(now);
  }

 private:
  int y_;
  int dot_spacing_;
  int radius_active_;
  int radius_inactive_;
  int last_page_ = -1;
  int last_total_ = -1;
  bool page_baseline_set_ = false;
};

class HeaderWidget : public Widget {
 public:
  const char *widget_label() const override { return "Header"; }
  HeaderWidget(esphome::font::Font* time_font, esphome::font::Font* detail_font,
               const bool* timer_active, const int* timer_remaining)
      : time_font_(time_font), detail_font_(detail_font),
        timer_active_(timer_active), timer_remaining_(timer_remaining) {}

  UiRect bounds() const override { return UiRect{0, 0, 480, 49}; }
  bool is_top_widget() const override { return true; }

  void update(uint32_t now) override {
    bool changed = false;

    const bool t_active = timer_active_ ? *timer_active_ : false;
    const int t_rem = timer_remaining_ ? *timer_remaining_ : 0;
    if (t_active != last_timer_active_ || t_rem != last_timer_remaining_) {
      changed = true;
    }

    if (!t_active) {
      auto time_now = sntp_time->now();
      if (time_now.is_valid()) {
        if (time_now.hour != last_hour_ ||
            time_now.minute != last_minute_ ||
            time_now.day_of_month != last_day_) {
          changed = true;
        }
      }
    }

    if (!baseline_set_)
      changed = true;

    if (changed) mark_dirty();
    Widget::update(now);
  }

  void draw(display::Display& it, const UiState& state) override {
    (void)state;

    // Header background - blank the retro background in this zone
    ui_fast_filled_rectangle(it, 0, 0, 480, 49, RetroColors::VOID);

    // Left/right frame lines
    it.line(0, 0, 0, 480, RetroColors::DARK);
    it.line(479, 0, 479, 480, RetroColors::DARK);

    const bool t_active = timer_active_ ? *timer_active_ : false;
    const int t_rem = timer_remaining_ ? *timer_remaining_ : 0;

    if (t_active) {
      int minutes = t_rem / 60;
      int seconds = t_rem % 60;
      Color tc = (t_rem == 0) ? RetroColors::RED : RetroColors::CYAN;

      int cx = 40, cy = 25;
      it.circle(cx, cy, 10, tc);
      it.line(cx, cy, cx, cy - 6, tc);
      it.line(cx, cy, cx + 5, cy, tc);

      it.printf(60, 12, time_font_, tc, TextAlign::TOP_LEFT, "%02d:%02d", minutes, seconds);
      it.printf(460, 14, detail_font_, tc, TextAlign::TOP_RIGHT, "TIMER RUNNING");
    } else {
      auto time_now = sntp_time->now();
      if (time_now.is_valid()) {
#if UI_THEME_RETRO
        // Time display with cyan accent
        it.printf(18, 8, time_font_, RetroColors::CYAN, TextAlign::TOP_LEFT, "%02d", time_now.hour);
        it.printf(18 + 32, 8, time_font_, RetroColors::WHITE, TextAlign::TOP_LEFT, ":");
        it.printf(18 + 44, 8, time_font_, RetroColors::CYAN, TextAlign::TOP_LEFT, "%02d", time_now.minute);
#else
        // Time display as a single string (avoiding hardcoded character offsets)
        it.printf(18, 8, time_font_, RetroColors::CYAN, TextAlign::TOP_LEFT, "%02d:%02d", time_now.hour, time_now.minute);
#endif

        const char* days[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
        const char* months[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                                "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};
        int dayIdx = time_now.day_of_week - 1;
        if (dayIdx < 0) dayIdx = 0;

        it.printf(460, 14, detail_font_, RetroColors::GRAY, TextAlign::TOP_RIGHT, "%s %02d %s",
                  days[dayIdx], time_now.day_of_month, months[time_now.month - 1]);

        last_hour_ = time_now.hour;
        last_minute_ = time_now.minute;
        last_day_ = time_now.day_of_month;
      }
    }

#if UI_THEME_RETRO
    // Bottom separator with double-line effect
    it.line(18, 47, 462, 47, RetroColors::DIMMER);
#else
    // Bottom separator (single clean thin line)
#endif
    it.line(18, 48, 462, 48, RetroColors::DARK);

#if UI_THEME_RETRO
    // Hatch pattern in the top-right corner (decorative)
    draw_hatch_pattern(it, 460, 2, 10, 4, 4, Color(0, 30, 45));

    // Corner accents on the top edge
    draw_corner_accent_tl(it, 3, 3, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_tr(it, 476, 3, 5, RetroColors::CYAN_DIM);
#endif

    last_timer_active_ = t_active;
    last_timer_remaining_ = t_rem;
    baseline_set_ = true;
  }

 private:
  esphome::font::Font* time_font_;
  esphome::font::Font* detail_font_;
  const bool* timer_active_ = nullptr;
  const int* timer_remaining_ = nullptr;
  bool last_timer_active_ = false;
  int last_timer_remaining_ = 0;
  int last_hour_ = -1;
  int last_minute_ = -1;
  int last_day_ = -1;
  bool baseline_set_ = false;
};

class DetailHeaderWidget : public Widget {
 public:
  const char *widget_label() const override { return "DetailHeader"; }
  DetailHeaderWidget(esphome::font::Font* title_font, esphome::font::Font* btn_font,
                     const char* title, std::function<void()> back_callback)
      : title_font_(title_font), btn_font_(btn_font), title_(title), back_callback_(back_callback) {}

  UiRect bounds() const override { return UiRect{0, 0, 480, 50}; }
  bool is_top_widget() const override { return true; }

  void set_title(const char* title) {
    if (title_ != title) {
      title_ = title;
      mark_dirty();
    }
  }

  bool handle_touch(const TouchEvent& event, uint32_t now) override {
    (void)now;
    if (event.type != TouchType::Tap) return false;
    if (event.x >= 14 && event.x <= 66 && event.y >= 6 && event.y <= 44) {
      if (back_callback_) back_callback_();
      return true;
    }
    return false;
  }

  void draw(display::Display& it, const UiState& state) override {
    (void)state;
    ui_fast_filled_rectangle(it, 0, 0, 480, 50, RetroColors::VOID);
    it.line(0, 49, 480, 49, RetroColors::DIMMER);
    it.line(0, 50, 480, 50, RetroColors::DARK);

    it.line(0, 0, 0, 480, RetroColors::DARK);
    it.line(479, 0, 479, 480, RetroColors::DARK);

    // Back button — filled clipped box with drawn chevron
    const int bx = 14, by = 6, bw = 52, bh = 38;
    draw_clipped_box(it, bx, by, bw, bh, 5, RetroColors::CYAN, RetroColors::DIM, true);
    const int cx = bx + bw / 2;
    const int cy = by + bh / 2;
    it.line(cx + 6, cy - 7, cx - 4, cy, RetroColors::CYAN);
    it.line(cx - 4, cy, cx + 6, cy + 7, RetroColors::CYAN);

    if (title_ && title_font_) {
      // Section label in brackets for retro terminal feel
      it.printf(240, 20, title_font_, RetroColors::CYAN, TextAlign::CENTER, "[ %s ]", title_);
    }

    // Hatch pattern decoration top-right
    draw_hatch_pattern(it, 465, 2, 12, 3, 4, Color(0, 30, 45));

    draw_corner_accent_tl(it, 3, 3, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_tr(it, 476, 3, 5, RetroColors::CYAN_DIM);
  }

 private:
  esphome::font::Font* title_font_;
  esphome::font::Font* btn_font_;
  const char* title_ = nullptr;
  std::function<void()> back_callback_;
};
