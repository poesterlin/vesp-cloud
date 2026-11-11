#pragma once

#include "ui_widget_base.h"

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
    if (!touch_bounds().contains(event.x, event.y)) return false;

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
        mark_checkbox_dirty_(idx);
        return true;
      }
      // First tap — start 2-second countdown; HA call is sent later
      row.loading = true;
      row.loading_start = now;
      row.ha_sent = false;
      mark_checkbox_dirty_(idx);
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
    for (size_t i = 0; i < rows_.size(); i++) {
      auto &row = rows_[i];
      if (!row.loading) continue;
      if (!row.ha_sent && (now - row.loading_start > 2000)) {
        if (!row.completed)
          push_complete_to_ha(static_cast<int>(i));
        else
          push_needs_action_to_ha(static_cast<int>(i));
        row.ha_sent = true;
      }
      if (now - row.loading_start > TodoRow::loading_timeout_ms) {
        row.loading = false;
        row.ha_sent = false;
        mark_checkbox_dirty_(static_cast<int>(i));
      }
    }
    Widget::update(now);
  }

  void set_color(Color c) { color_ = c; mark_dirty(); }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    const Color border = color_;
    const Color bg(10, 12, 18);
    const Color text = RetroColors::WHITE;
    const Color due_ok = color_;
    const Color due_overdue = RetroColors::RED;
    const Color dim = RetroColors::GRAY;
    const UiRect r = screen_rect(rect_);

    // Clipped-corner container
    draw_clipped_box(it, r.x, r.y, r.w, r.h,
                     ui_corner_radius_for_height(r.h), border, bg, false);
    // Inner double-line
    {
      const UiRect inner = r.inset(2);
      Color border_dim(color_.r * 0.6f, color_.g * 0.6f, color_.b * 0.6f);
      draw_clipped_border(it, inner.x, inner.y, inner.w, inner.h,
                          6, 6, 6, 6, border_dim);
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

    int due_max_w = 0;
    if (g_theme.label.font != nullptr) {
      for (auto &row : rows_) {
        if (row.due.empty()) continue;
        std::string due_fmt = ui_format_date_display(row.due);
        int tx, ty, tw, th;
        it.get_text_bounds(0, 0, due_fmt.c_str(), g_theme.label.font,
                          TextAlign::TOP_LEFT, &tx, &ty, &tw, &th);
        if (tw > due_max_w) due_max_w = tw;
      }
    }
    if (due_max_w > 0) {
      if (due_max_w < 30) due_max_w = 30;
      if (due_max_w > kTodoDueMaxW) due_max_w = kTodoDueMaxW;
    }

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

#if UI_THEME_RETRO
      // Broken separators distinguish task records without adding a rail
      // beside the checkbox.
      if (drawn > 0) {
        draw_dashed_hline(it, r.x + kTodoTextX, r.x + r.w - 7, y,
                          RetroColors::DARK_GRAY, 2, 4);
      }
#else
      // Modern rows sit on subtle alternating surface bands.
      if ((i & 1) != 0) {
        ui_fast_filled_rectangle(it, r.x + 5, y + 2, r.w - 10,
                                 std::max(1, row_height_ - 4), RetroColors::DARK);
      }
      if (drawn > 0) {
        it.horizontal_line(r.x + kTodoTextX, y,
                           std::max(1, r.w - kTodoTextX - 7),
                           RetroColors::DIMMER);
      }
#endif

      if (g_theme.label.font != nullptr) {
        if (row.loading) {
          // Spinning line animation while waiting for HA confirmation
          float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
          int cx = r.x + kTodoIconCX;
          int cy = row_cy;
          it.line(cx, cy, cx + (int)(cosf(angle) * 8), cy + (int)(sinf(angle) * 8), border);
          // Keep this row damaged until loading ends so the time-based angle
          // is painted on every display frame. request_continue() targets the
          // next damage set when called from draw().
          UiInvalidation::request_continue(
              checkbox_damage_at_y_(y), "todo:spinner");
        } else {
          const Color check_color = completed ? Color(0, 220, 120) : border;
          if (g_theme.icon.font != nullptr &&
                incomplete_icon_ != nullptr && complete_icon_ != nullptr &&
                incomplete_icon_[0] != '\0' && complete_icon_[0] != '\0') {
            it.printf(r.x + kTodoIconCX, row_cy, g_theme.icon.font,
                      check_color, TextAlign::CENTER,
                      "%s", completed ? complete_icon_ : incomplete_icon_);
          }
        }
      }

      int text_x = r.x + kTodoTextX;
      if (!row.due.empty() && g_theme.label.font != nullptr && due_max_w > 0) {
        std::string due_formatted = ui_format_date_display(row.due);
        ui_print_truncated(it, r.x + kTodoTextX, row_cy, g_theme.label.font,
                          overdue ? due_overdue : due_ok,
                          TextAlign::CENTER_LEFT, due_formatted, due_max_w);
        text_x = r.x + kTodoTextX + due_max_w + ui_spacing::xs;
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

  Color border_dim_color_() const {
    return Color(static_cast<uint8_t>(color_.red / 2),
                 static_cast<uint8_t>(color_.green / 2),
                 static_cast<uint8_t>(color_.blue / 2));
  }

  // Horizontal offsets from the widget's left edge for the check-box
  // icon area and the text that follows. The values are tuned to leave
  // a comfortable gap between icon and text without eating into the
  // scrolling due-date column.
  static constexpr int kTodoCheckTextX = 10;  // fallback "[ ]" / "[x]" X
  static constexpr int kTodoIconCX = 22;     // MDI icon centre X
  static constexpr int kTodoSpinnerDamageRadius = 13;
  static constexpr int kTodoTextX = 40;      // main text + due-date X
  static constexpr int kTodoDueMaxW = 64;    // width reserved for due date column

  UiDirtyRect checkbox_damage_at_y_(int y) const {
    const UiRect r = screen_rect(rect_);
    return UiDirtyRect{r.x + kTodoIconCX - kTodoSpinnerDamageRadius, y,
                       kTodoSpinnerDamageRadius * 2 + 1, row_height_};
  }

  void mark_checkbox_dirty_(int index) const {
    const UiRect r = screen_rect(rect_);
    const int y = r.y + kTopPadding + index * row_height_ -
                  (scrollable_ ? scroll_offset_ : 0);
    UiInvalidation::request_rect(checkbox_damage_at_y_(y), "todo:checkbox");
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
  Color color_{RetroColors::AMBER};
};
