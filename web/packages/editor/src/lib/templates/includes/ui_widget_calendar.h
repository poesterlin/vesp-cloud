#pragma once

#include "ui_widget_base.h"

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

      const std::string date_text = row.start.empty() ? "--" : ui_format_date_display(row.start);
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
