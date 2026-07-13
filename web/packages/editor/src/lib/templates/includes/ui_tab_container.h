#pragma once

#include "ui_widgets.h"

class TabContainerWidget : public Widget {
 public:
  const char *widget_label() const override { return "TabContainer"; }
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
      if (active_tab_ == tab_index) return;
      active_tab_ = tab_index;
      mark_dirty();
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

  UiRect bounds() const override { return screen_rect(rect_); }

  void draw(display::Display &it, const UiState &state) override {
    const UiRect r = screen_rect(rect_);
    const bool full = UiInvalidation::is_full_dirty();

    // Repaint the tab-bar/body backgrounds ONLY when a dirty rect actually
    // covers their full area (e.g. tab switch marks the container's whole
    // rect). A small dirty rect from a child must NOT trigger a bg repaint,
    // because that would erase sibling widgets that won't redraw this frame.
    const int bar_y = r.y;
    const int bar_h = kTabBarHeight;
    const int body_y = r.y + kTabBarHeight;
    const int body_h = r.h - kTabBarHeight;

    const bool draw_bar = full ||
        rect_fully_covered(r.x, bar_y, r.w, bar_h);
    const bool draw_body_bg = full ||
        rect_fully_covered(r.x, body_y, r.w, body_h);

    if (draw_body_bg) {
      draw_background(it);
    }
    if (draw_bar) {
      draw_tab_bar(it);
    }

    auto draw_children_pass = [&](bool background_only) {
      for (auto &w : tabs_[active_tab_].widgets) {
        if (w->is_background_widget() != background_only) continue;
        if (!w->is_visible(state)) continue;
        // If we repainted the body bg we must redraw every child that lives
        // there or it'll vanish.
        if (draw_body_bg) {
          w->set_render_offset_y(render_offset_y_);
          draw_child_(it, state, *w);
          continue;
        }
        if (full) {
          w->set_render_offset_y(render_offset_y_);
          draw_child_(it, state, *w);
          continue;
        }
        w->set_render_offset_y(render_offset_y_);
        const auto b = w->bounds();
        if (!UiInvalidation::needs_redraw_in(b.x, b.y, b.w, b.h)) continue;
        draw_child_(it, state, *w);
      }
    };
    draw_children_pass(true);
    draw_children_pass(false);
  }

  // Returns true iff some dirty rect fully covers the given area.
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
      (*it_w)->set_render_offset_y(render_offset_y_);
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
    Widget::update(now);
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
    const UiRect r = screen_rect(rect_);
    ui_fast_filled_rectangle(it, r.x, r.y, r.w, r.h, bg_color_);
  }

  void draw_tab_bar(display::Display &it) const {
    const UiRect r = screen_rect(rect_);
    ui_fast_filled_rectangle(it, r.x, r.y, r.w, kTabBarHeight,
                             RetroColors::DIM);

    if (tabs_.empty()) return;

    int tab_count = static_cast<int>(tabs_.size());
    int tab_w = (r.w - kTabPadding * (tab_count + 1)) / tab_count;
    auto *font = tab_style_->font;

    for (int i = 0; i < tab_count; i++) {
      int tx = r.x + kTabPadding + i * (tab_w + kTabPadding);
      int ty = r.y + kTabVertPadding;
      int th = kTabBarHeight - kTabVertPadding * 2;

      if (i == active_tab_) {
        ui_fast_filled_rectangle(it, tx, ty, tab_w, th,
                                 tab_style_->border_color);
        draw_clipped_border(it, tx, ty, tab_w, th, 3, 3, 3, 3,
                            tab_style_->border_color);
        if (font) {
          it.printf(tx + tab_w / 2, ty + th / 2, font,
                    RetroColors::BLACK, TextAlign::CENTER, "%s", tabs_[i].label);
        }
      } else {
        draw_clipped_border(it, tx, ty, tab_w, th, 3, 3, 3, 3,
                            tab_style_->border_color);
        if (font) {
          it.printf(tx + tab_w / 2, ty + th / 2, font,
                    tab_style_->text_color, TextAlign::CENTER, "%s", tabs_[i].label);
        }
      }
    }
  }

  void draw_active_children(display::Display &it, const UiState &state) const {
    for (auto &w : tabs_[active_tab_].widgets) {
      if (w->is_visible(state)) draw_child_(it, state, *w);
    }
  }

  void draw_child_(display::Display &it, const UiState &state, Widget &widget) const {
    if (clip_content_) {
      const UiRect r = screen_rect(rect_);
      widget.draw_clipped(
          it, state,
          UiRect{r.x, r.y + kTabBarHeight, r.w, r.h - kTabBarHeight});
    } else {
      widget.draw_clipped(it, state);
    }
  }

  int hit_test_tab(int tx, int ty) const {
    if (tabs_.empty()) return -1;
    const UiRect r = screen_rect(rect_);
    if (ty < r.y || ty > r.y + kTabBarHeight) return -1;

    int tab_count = static_cast<int>(tabs_.size());
    int tab_w = (r.w - kTabPadding * (tab_count + 1)) / tab_count;

    for (int i = 0; i < tab_count; i++) {
      int tab_x = r.x + kTabPadding + i * (tab_w + kTabPadding);
      if (tx >= tab_x && tx <= tab_x + tab_w) return i;
    }
    return -1;
  }
};
