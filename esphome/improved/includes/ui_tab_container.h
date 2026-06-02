#pragma once

#include "ui_widgets.h"
#include "ui_retro.h"

class TabContainerWidget : public Widget {
 public:
  TabContainerWidget(UiRect rect, Color bg_color,
                     const Theme::ButtonStyle &tab_style,
                     bool clip_content = false)
      : rect_(rect), bg_color_(bg_color), tab_style_(&tab_style),
        clip_content_(clip_content) {}

  int add_tab(const char *label) {
    tabs_.push_back({label, {}});
    return static_cast<int>(tabs_.size()) - 1;
  }

  void set_default_tab(int tab_index) {
    if (tab_index >= 0 && tab_index < static_cast<int>(tabs_.size())) {
      active_tab_ = tab_index;
    }
  }

  template<typename T, typename... Args>
  T* emplace_child(int tab_index, Args&&... args) {
    auto widget = std::make_unique<T>(std::forward<Args>(args)...);
    T* ptr = widget.get();
    if (tab_index >= 0 && tab_index < static_cast<int>(tabs_.size())) {
      tabs_[tab_index].widgets.push_back(std::move(widget));
    }
    return ptr;
  }

  UiRect bounds() const override { return rect_; }

  void draw(display::Display &it, const UiState &state) override {
    const bool full = UiInvalidation::is_full_dirty();
    const bool legacy_partial =
        !full && UiInvalidation::dirty_count() == 0 && UiInvalidation::needs_redraw();

    const int bar_y = rect_.y;
    const int bar_h = kTabBarHeight;
    const int body_y = rect_.y + kTabBarHeight;
    const int body_h = rect_.h - kTabBarHeight;

    const bool draw_bar = full || legacy_partial ||
        rect_fully_covered(rect_.x, bar_y, rect_.w, bar_h);
    const bool draw_body_bg = full || legacy_partial ||
        rect_fully_covered(rect_.x, body_y, rect_.w, body_h);

    if (draw_body_bg) {
      draw_background(it);
    }
    if (draw_bar) {
      draw_tab_bar(it);
    }

    for (auto &w : tabs_[active_tab_].widgets) {
      if (!w->is_visible(state)) continue;
      if (draw_body_bg) {
        w->draw(it, state);
        continue;
      }
      if (full || legacy_partial) {
        w->draw(it, state);
        continue;
      }
      const auto b = w->bounds();
      if (!UiInvalidation::needs_redraw_in(b.x, b.y, b.w, b.h)) continue;
      w->draw(it, state);
    }
  }

  static bool rect_fully_covered(int x, int y, int w, int h) {
    for (int i = 0; i < UiInvalidation::dirty_count(); i++) {
      const auto &r = UiInvalidation::dirty_rect(i);
      if (r.x <= x && r.x + r.w >= x + w &&
          r.y <= y && r.y + r.h >= y + h) {
        return true;
      }
    }
    return false;
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (event.type == TouchType::Tap) {
      int tab_idx = hit_test_tab(event.x, event.y);
      if (tab_idx >= 0) {
        if (tab_idx != active_tab_) {
          switch_to_tab(tab_idx);
        }
        return true;
      }
    }

    for (auto it_w = tabs_[active_tab_].widgets.rbegin();
         it_w != tabs_[active_tab_].widgets.rend(); ++it_w) {
      if ((*it_w)->handle_touch(event, now)) {
        return true;
      }
    }
    return false;
  }

  void update(uint32_t now) override {
    for (auto &w : tabs_[active_tab_].widgets) {
      w->update(now);
    }
  }

 private:
  struct Tab {
    const char *label;
    std::vector<std::unique_ptr<Widget>> widgets;
  };

  UiRect rect_;
  Color bg_color_;
  const Theme::ButtonStyle *tab_style_;
  bool clip_content_;
  std::vector<Tab> tabs_;
  int active_tab_ = 0;

  static constexpr int kTabBarHeight = 36;
  static constexpr int kTabPadding = 6;
  static constexpr int kTabVertPadding = 2;

  void switch_to_tab(int tab_index) {
    for (auto &w : tabs_[active_tab_].widgets) w->exit();
    active_tab_ = tab_index;
    for (auto &w : tabs_[active_tab_].widgets) w->enter();
    mark_dirty();
  }

  void draw_background(display::Display &it) const {
    // Fill body area
    ui_fast_filled_rectangle(it, rect_.x, rect_.y + kTabBarHeight,
                             rect_.w, rect_.h - kTabBarHeight, bg_color_);
    // Clipped-corner border around the entire container
    draw_double_clipped_border(it, rect_.x, rect_.y, rect_.w, rect_.h,
                               8, 3, RetroColors::CYAN, RetroColors::CYAN_DIM);
  }

  void draw_tab_bar(display::Display &it) const {
    ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, kTabBarHeight,
                             RetroColors::DARK);

    if (tabs_.empty()) return;

    int tab_count = static_cast<int>(tabs_.size());
    int tab_w = (rect_.w - kTabPadding * (tab_count + 1)) / tab_count;
    auto *font = tab_style_->font;

    for (int i = 0; i < tab_count; i++) {
      int tx = rect_.x + kTabPadding + i * (tab_w + kTabPadding);
      int ty = rect_.y + kTabVertPadding;
      int th = kTabBarHeight - kTabVertPadding * 2;

      if (i == active_tab_) {
        // Active tab: filled with cyan, clipped-corner outline
        draw_clipped_box(it, tx, ty, tab_w, th, 3,
                         tab_style_->border_color,
                         tab_style_->border_color, false);
        if (font) {
          it.printf(tx + tab_w / 2, ty + th / 2, font,
                    RetroColors::BLACK, TextAlign::CENTER, "%s", tabs_[i].label);
        }
      } else {
        // Inactive tab: clipped-corner outline only
        draw_clipped_border(it, tx, ty, tab_w, th, 3, 3, 3, 3,
                            RetroColors::DIMMER);
        if (font) {
          it.printf(tx + tab_w / 2, ty + th / 2, font,
                    RetroColors::GRAY, TextAlign::CENTER, "%s", tabs_[i].label);
        }
      }
    }
  }

  int hit_test_tab(int tx, int ty) const {
    if (tabs_.empty()) return -1;
    if (ty < rect_.y || ty > rect_.y + kTabBarHeight) return -1;

    int tab_count = static_cast<int>(tabs_.size());
    int tab_w = (rect_.w - kTabPadding * (tab_count + 1)) / tab_count;

    for (int i = 0; i < tab_count; i++) {
      int tab_x = rect_.x + kTabPadding + i * (tab_w + kTabPadding);
      if (tx >= tab_x && tx <= tab_x + tab_w) return i;
    }
    return -1;
  }
};
