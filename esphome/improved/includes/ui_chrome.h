#pragma once
#include "esphome.h"
#include "ui_widgets.h"

namespace ChromeColors {
  const Color BLACK(0, 0, 0);
  const Color WHITE(255, 255, 255);
  const Color CYAN(0, 255, 255);
  const Color AMBER(255, 180, 0);
  const Color GREEN(0, 255, 100);
  const Color RED(255, 60, 60);
  const Color BLUE(80, 140, 255);
  const Color MAGENTA(255, 0, 200);
  const Color DIM(80, 80, 80);
  const Color DIMMER(40, 40, 40);
}

inline void draw_retro_box(display::Display& it, int x, int y, int w, int h,
                           esphome::font::Font* font = nullptr,
                           const char* label = nullptr, Color color = ChromeColors::DIM) {
  it.rectangle(x, y, w, h, ChromeColors::DIMMER);

  int s = 10;
  it.line(x, y, x + s, y, color);
  it.line(x, y, x, y + s, color);
  it.line(x+1, y+1, x + s, y+1, color);
  it.line(x+1, y+1, x+1, y + s, color);

  it.line(x + w, y, x + w - s, y, color);
  it.line(x + w, y, x + w, y + s, color);
  it.line(x + w - 1, y+1, x + w - s, y+1, color);
  it.line(x + w - 1, y+1, x + w - 1, y + s, color);

  it.line(x, y + h, x + s, y + h, color);
  it.line(x, y + h, x, y + h - s, color);
  it.line(x+1, y + h - 1, x + s, y + h - 1, color);
  it.line(x+1, y + h - 1, x+1, y + h - s, color);

  it.line(x + w, y + h, x + w - s, y + h, color);
  it.line(x + w, y + h, x + w, y + h - s, color);
  it.line(x + w - 1, y + h - 1, x + w - s, y + h - 1, color);
  it.line(x + w - 1, y + h - 1, x + w - 1, y + h - s, color);

  if (label && font) {
    int tx, ty, tw, th;
    it.get_text_bounds(x + 12, y - 7, label, font, TextAlign::TOP_LEFT, &tx, &ty, &tw, &th);
    it.filled_rectangle(tx - 2, ty, tw + 4, th, ChromeColors::BLACK);
    it.printf(x + 12, y - 7, font, color, TextAlign::TOP_LEFT, " %s ", label);
  }
}

class PageIndicatorWidget : public Widget {
 public:
  PageIndicatorWidget(int y, int dot_spacing = 28, int radius_active = 8, int radius_inactive = 6)
      : y_(y), dot_spacing_(dot_spacing), radius_active_(radius_active), radius_inactive_(radius_inactive) {}

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
        it.filled_circle(dot_x, y_, radius_active_, ChromeColors::CYAN);
      } else {
        it.filled_circle(dot_x, y_, radius_active_, ChromeColors::BLACK);
        it.circle(dot_x, y_, radius_inactive_, ChromeColors::DIM);
      }
    }
  }

 private:
  int y_;
  int dot_spacing_;
  int radius_active_;
  int radius_inactive_;
};

class HeaderWidget : public Widget {
 public:
  HeaderWidget(esphome::font::Font* time_font, esphome::font::Font* detail_font,
               const bool* timer_active, const int* timer_remaining)
      : time_font_(time_font), detail_font_(detail_font),
        timer_active_(timer_active), timer_remaining_(timer_remaining) {}

  void draw(display::Display& it, const UiState& state) override {
    (void)state;

    ui_fast_filled_rectangle(it, 0, 0, 480, 49, ChromeColors::BLACK);

    it.line(0, 0, 0, 480, ChromeColors::DIMMER);
    it.line(479, 0, 479, 480, ChromeColors::DIMMER);

    if (timer_active_ && *timer_active_ && timer_remaining_) {
      int minutes = *timer_remaining_ / 60;
      int seconds = *timer_remaining_ % 60;
      Color tc = (*timer_remaining_ == 0) ? ChromeColors::RED : ChromeColors::CYAN;

      int cx = 40, cy = 25;
      it.circle(cx, cy, 10, tc);
      it.line(cx, cy, cx, cy - 6, tc);
      it.line(cx, cy, cx + 5, cy, tc);

      it.printf(60, 12, time_font_, tc, TextAlign::TOP_LEFT, "%02d:%02d", minutes, seconds);
      it.printf(460, 14, detail_font_, tc, TextAlign::TOP_RIGHT, "TIMER RUNNING");
    } else {
      auto time_now = sntp_time->now();
      if (time_now.is_valid()) {
        it.printf(20, 12, time_font_, ChromeColors::WHITE, TextAlign::TOP_LEFT, "%02d:%02d",
                  time_now.hour, time_now.minute);

        const char* days[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
        const char* months[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                                "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};
        int dayIdx = time_now.day_of_week - 1;
        if (dayIdx < 0) dayIdx = 0;

        it.printf(460, 14, detail_font_, ChromeColors::DIM, TextAlign::TOP_RIGHT, "%s %02d %s",
                  days[dayIdx], time_now.day_of_month, months[time_now.month - 1]);
      }
    }

    it.line(20, 48, 460, 48, ChromeColors::DIM);
  }

 private:
  esphome::font::Font* time_font_;
  esphome::font::Font* detail_font_;
  const bool* timer_active_ = nullptr;
  const int* timer_remaining_ = nullptr;
};

class DetailHeaderWidget : public Widget {
 public:
  DetailHeaderWidget(esphome::font::Font* title_font, esphome::font::Font* btn_font,
                     const char* title, std::function<void()> back_callback)
      : title_font_(title_font), btn_font_(btn_font), title_(title), back_callback_(back_callback) {}

  void set_title(const char* title) { title_ = title; }

  bool handle_touch(const TouchEvent& event, uint32_t now) override {
    (void)now;
    if (event.type != TouchType::Tap) return false;
    if (event.x >= 10 && event.x <= 80 && event.y >= 5 && event.y <= 45) {
      if (back_callback_) back_callback_();
      return true;
    }
    return false;
  }

  void draw(display::Display& it, const UiState& state) override {
    (void)state;
    ui_fast_filled_rectangle(it, 0, 0, 480, 50, ChromeColors::BLACK);
    it.line(0, 50, 480, 50, ChromeColors::DIM);

    it.rectangle(12, 8, 56, 36, ChromeColors::CYAN);
    it.printf(40, 22, btn_font_, ChromeColors::CYAN, TextAlign::CENTER, "<");

    if (title_ && title_font_) {
      it.printf(240, 20, title_font_, ChromeColors::WHITE, TextAlign::CENTER, "%s", title_);
    }

    it.line(0, 0, 0, 480, ChromeColors::DIMMER);
    it.line(479, 0, 479, 480, ChromeColors::DIMMER);
  }

 private:
  esphome::font::Font* title_font_;
  esphome::font::Font* btn_font_;
  const char* title_ = nullptr;
  std::function<void()> back_callback_;
};
