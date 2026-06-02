#pragma once

#include "esphome.h"
#include "ui_types.h"
#include "ui_state.h"
#include "ui_screen_base.h"
#include "ui_invalidation.h"
#include "ui_redraw.h"
#include "ui_chrome.h"
#include "ui_retro.h"
#include <vector>
#include <functional>

struct ScrollEntry {
  const char *text;
  Color color;
  std::function<void()> callback;
  bool loading = false;
  uint32_t loading_start = 0;
  uint32_t loading_timeout_ms = 350;
};

class ScrollableDetailScreen : public Screen {
 public:
  ScrollableDetailScreen(const char *title, esphome::font::Font *title_font,
                         esphome::font::Font *btn_font, esphome::font::Font *entry_font,
                         std::function<void()> back_callback)
      : title_(title), title_font_(title_font), btn_font_(btn_font),
        entry_font_(entry_font), back_callback_(back_callback) {
    header_ = std::make_unique<DetailHeaderWidget>(title_font, btn_font, title, back_callback_);
  }

  void set_title(const char *title) {
    title_ = title;
    header_->set_title(title);
  }

  void add_entry(const char *text, Color color, std::function<void()> callback) {
    entries_.push_back({text, color, callback});
    content_height_ += 55;
  }

  void reset_entries() { entries_.clear(); content_height_ = 0; }

  void enter() override {
    scroll_y_ = 0;
    fast_scroll_ = false;
    max_scroll_ = (content_height_ > content_area_h_) ? (content_height_ - content_area_h_) : 0;
    if (max_scroll_ < 0) max_scroll_ = 0;
  }

  void update(uint32_t now) override {
    for (size_t i = 0; i < entries_.size(); i++) {
      auto &e = entries_[i];
      if (e.loading && e.loading_timeout_ms > 0
          && (now - e.loading_start > e.loading_timeout_ms)) {
        e.loading = false;
        mark_entry_dirty(static_cast<int>(i));
      }
    }
  }

  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) override {
    (void)state;

    if (header_space().contains(event.x, event.y)) {
      fast_scroll_ = false;
      return header_->handle_touch(event, now);
    }

    if (event.type == TouchType::Down) {
      fast_scroll_ = true;
      return true;
    }

    if (event.type == TouchType::Move) {
      int new_y = scroll_y_ + event.dy;
      if (new_y > 0) new_y = 0;
      if (new_y < -max_scroll_) new_y = -max_scroll_;
      if (new_y == scroll_y_) return false;
      scroll_y_ = new_y;
      fast_scroll_ = (scroll_y_ != 0 && scroll_y_ != -max_scroll_);
      UiInvalidation::request_partial();
      return true;
    }

    if (event.type == TouchType::Up) {
      fast_scroll_ = false;
      if (scroll_y_ == 0 || scroll_y_ == -max_scroll_) {
        return false;
      }
      UiInvalidation::request_partial();
      return true;
    }

    if (event.type == TouchType::Tap && !content_space().contains(event.x, event.y)) {
      return false;
    }

    if (event.type == TouchType::Tap) {
      int ty = event.y - content_y_ - scroll_y_;
      for (size_t i = 0; i < entries_.size(); i++) {
        int ey = 10 + static_cast<int>(i) * 55;
        int eh = 50;
        if (ty >= ey && ty <= ey + eh) {
          auto &e = entries_[i];
          if (e.loading) return true;
          e.loading = true;
          e.loading_start = now;
          mark_entry_dirty(i);
          if (e.callback) e.callback();

          char name_buf[24];
          snprintf(name_buf, sizeof(name_buf), "se_%p", &e);
          const int idx = static_cast<int>(i);
          esphome::App.scheduler.set_timeout(nullptr, name_buf, e.loading_timeout_ms,
              [this, &e, idx]() {
                e.loading = false;
                mark_entry_dirty(idx);
                UiRedraw::trigger_display_update();
              });
          return true;
        }
      }
    }

    return true;
  }

  bool draws_own_background() const override { return true; }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    const bool full = UiInvalidation::is_full_dirty();
    const bool legacy_partial =
        !full && UiInvalidation::dirty_count() == 0 && UiInvalidation::needs_redraw();
    const bool draw_all = full || legacy_partial;

    if (fast_scroll_ && !full && millis() - last_full_draw_ms_ < 1000) {
      if (max_scroll_ > 0) {
        ui_fast_filled_rectangle(it, 475, content_y_, 3, content_area_h_, RetroColors::DARK);
        int sb_h = content_area_h_ * content_area_h_ / content_height_;
        int sb_y = content_y_ + (-scroll_y_ * content_area_h_ / content_height_);
        if (sb_h < 20) sb_h = 20;
        ui_fast_filled_rectangle(it, 475, sb_y, 3, sb_h, RetroColors::DIMMER);
      }
      return;
    }

    last_full_draw_ms_ = millis();

    // Header
    if (draw_all || header_->needs_draw(state)) {
      header_->draw(it, state);
    }

    // Content background
    bool need_content_bg = draw_all;
    if (!need_content_bg) {
      for (int i = 0; i < UiInvalidation::dirty_count(); i++) {
        const auto &r = UiInvalidation::dirty_rect(i);
        if (r.x <= 0 && r.x + r.w >= 480 &&
            r.y <= content_y_ && r.y + r.h >= 480) {
          need_content_bg = true;
          break;
        }
      }
    }
    if (need_content_bg) {
      ui_fast_filled_rectangle(it, 0, content_y_, 480, 480 - content_y_, RetroColors::VOID);
      // Decorative border between header and content
      it.line(0, content_y_, 480, content_y_, RetroColors::DIMMER);
    }

    for (size_t i = 0; i < entries_.size(); i++) {
      auto &e = entries_[i];
      int sy = content_y_ + 10 + static_cast<int>(i) * 55 + scroll_y_;

      if (sy + 50 <= content_y_ || sy >= content_y_ + content_area_h_) continue;

      int draw_y = sy;
      int draw_h = 50;
      if (draw_y < content_y_) {
        draw_h -= (content_y_ - draw_y);
        draw_y = content_y_;
      }
      if (draw_y + draw_h > content_y_ + content_area_h_) {
        draw_h = content_y_ + content_area_h_ - draw_y;
      }
      if (draw_h <= 0) continue;

      if (!draw_all && !need_content_bg &&
          !UiInvalidation::needs_redraw_in(20, draw_y, 440, draw_h)) {
        continue;
      }

      // Clipped-corner entry border
      if (draw_y == sy && draw_h == 50) {
        if (!need_content_bg) {
          ui_fast_filled_rectangle(it, 21, draw_y + 1, 438, draw_h - 2, RetroColors::VOID);
        }
        draw_clipped_border(it, 20, draw_y, 440, draw_h, 5, 5, 5, 5, e.color);
        if (e.loading) {
          it.printf(240, draw_y + draw_h / 2, entry_font_, e.color, TextAlign::CENTER, "...");
        } else {
          it.printf(240, draw_y + draw_h / 2, entry_font_, e.color, TextAlign::CENTER, "%s", e.text);
        }
      }
    }

    if (max_scroll_ > 0) {
      int sb_h = content_area_h_ * content_area_h_ / content_height_;
      int sb_y = content_y_ + (-scroll_y_ * content_area_h_ / content_height_);
      if (sb_h < 20) sb_h = 20;
      if (!need_content_bg) {
        ui_fast_filled_rectangle(it, 475, content_y_, 3, content_area_h_, RetroColors::VOID);
      }
      ui_fast_filled_rectangle(it, 475, sb_y, 3, sb_h, RetroColors::DIMMER);
    }
  }

  void mark_entry_dirty(int index) {
    int sy = content_y_ + 10 + index * 55 + scroll_y_;
    int draw_y = sy;
    int draw_h = 50;
    if (draw_y < content_y_) {
      draw_h -= (content_y_ - draw_y);
      draw_y = content_y_;
    }
    if (draw_y + draw_h > content_y_ + content_area_h_) {
      draw_h = content_y_ + content_area_h_ - draw_y;
    }
    if (draw_h <= 0) return;
    UiInvalidation::request_rect(UiDirtyRect{20, draw_y, 440, draw_h});
  }

  void layout() override {}

  void exit() override {}

 private:
  UiRect header_space() const { return {0, 0, 480, 50}; }
  UiRect content_space() const { return {0, content_y_, 480, content_area_h_}; }

  const char *title_;
  esphome::font::Font *title_font_;
  esphome::font::Font *btn_font_;
  esphome::font::Font *entry_font_;
  std::function<void()> back_callback_;
  std::unique_ptr<DetailHeaderWidget> header_;
  std::vector<ScrollEntry> entries_;
  int scroll_y_ = 0;
  int max_scroll_ = 0;
  int content_height_ = 0;
  bool fast_scroll_ = false;
  uint32_t last_full_draw_ms_ = 0;
  static constexpr int content_y_ = 52;
  static constexpr int content_area_h_ = 406;
};
