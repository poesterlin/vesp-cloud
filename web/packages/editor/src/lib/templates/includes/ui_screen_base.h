#pragma once

#include "esphome.h"
#include "ui_invalidation.h"
#include "ui_types.h"
#include "ui_widgets.h"
#include <memory>
#include <vector>

struct UiState;

class Screen {
 public:
  virtual ~Screen() = default;
  virtual void enter() {}
  virtual void exit() {}
  virtual void layout() {}
  virtual void update(uint32_t now) = 0;
  virtual bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) = 0;
  virtual void draw(display::Display &it, const UiState &state) = 0;

  // If true, the screen's draw() is responsible for painting every pixel
  // (or knowingly accepts leftover content from the previous frame). When set,
  // UiApp skips the full-screen black fill on a full redraw, eliminating the
  // brief black flash you otherwise see between the clear and the repaint.
  virtual bool draws_own_background() const { return false; }
};

class GenericScreen : public Screen {
 public:
  GenericScreen() = default;

  void add_widget(std::unique_ptr<Widget> widget) {
    widgets_.push_back(std::move(widget));
  }

  void set_scroll_area(int y, int h, int content_h) {
    scroll_enabled_ = content_h > h;
    scroll_y_ = 0;
    scroll_start_y_ = 0;
    scroll_area_x_ = 0;
    scroll_area_w_ = kScreenWidth;
    scroll_area_y_ = y;
    scroll_area_h_ = h;
    max_scroll_ = scroll_enabled_ ? (content_h - h) : 0;
    if (max_scroll_ < 0) max_scroll_ = 0;
  }

  template<typename T, typename... Args>
  T* emplace_widget(Args&&... args) {
    auto widget = std::make_unique<T>(std::forward<Args>(args)...);
    T* ptr = widget.get();
    widgets_.push_back(std::move(widget));
    return ptr;
  }

  void enter() override {
    scroll_y_ = 0;
    dragging_scroll_ = false;
    apply_scroll_offsets();
    for (auto &w : widgets_) w->enter();
  }

  void exit() override {
    for (auto &w : widgets_) w->exit();
  }

  void layout() override {
    for (auto &w : widgets_) w->layout();
  }

  void update(uint32_t now) override {
    for (auto &w : widgets_) w->update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) override {
    apply_scroll_offsets();

    if (scroll_enabled_) {
      for (auto &w : widgets_) {
        if (w->scroll_exempt() && w->is_visible(state) && w->handle_touch(event, now)) return true;
      }

      const bool in_scroll_area = event.y >= scroll_area_y_ && event.y < scroll_area_y_ + scroll_area_h_;
      if (event.type == TouchType::Down && in_scroll_area) {
        dragging_scroll_ = true;
        scroll_start_y_ = scroll_y_;
        return true;
      }
      if (event.type == TouchType::Move && dragging_scroll_) {
        int next = scroll_start_y_ + event.dy;
        if (next > 0) next = 0;
        if (next < -max_scroll_) next = -max_scroll_;
        if (next != scroll_y_) {
          scroll_y_ = next;
          apply_scroll_offsets();
          scroll_dirty_ = true;
          UiInvalidation::request_partial();
        }
        return true;
      }
      if (event.type == TouchType::Up && dragging_scroll_) {
        dragging_scroll_ = false;
        return true;
      }
    }

    for (auto &w : widgets_) {
      if (w->is_visible(state) && w->handle_touch(event, now)) return true;
    }
    return false;
  }

  void draw(display::Display &it, const UiState &state) override {
    if (state.should_show_loading()) {
      for (auto &w : widgets_) {
        if (w->is_loading_widget()) { w->draw(it, state); return; }
      }
      return;
    }
    const bool full = UiInvalidation::is_full_dirty();
    const bool scroll_partial = scroll_enabled_ && scroll_dirty_ && !full;
    const bool legacy_partial =
        !full && !scroll_partial && UiInvalidation::dirty_count() == 0 && UiInvalidation::needs_redraw();
    apply_scroll_offsets();
    if (scroll_partial) {
      ui_fast_filled_rectangle(it, scroll_area_x_, scroll_area_y_, scroll_area_w_, scroll_area_h_,
                               RetroColors::VOID);
    }
    for (auto &w : widgets_) {
      if (!w->is_visible(state)) continue;
      // During a scroll-only repaint we erase + redraw just the scroll area,
      // so fixed (exempt) widgets are untouched and must NOT be repainted --
      // repainting them every scroll frame is what caused header flicker.
      if (scroll_partial && w->scroll_exempt()) continue;
      bool clip_to_scroll_area = false;
      if (scroll_enabled_ && !w->scroll_exempt()) {
        const auto b = w->bounds();
        const int view_top = scroll_area_y_;
        const int view_bottom = scroll_area_y_ + scroll_area_h_;
        // Draw only when the widget intersects the viewport. Rendering is
        // clipped to the scroll area so partially visible widgets remain
        // smooth while fixed header/footer regions stay protected.
        const bool intersects = (b.y < view_bottom) && (b.y + b.h > view_top);
        if (!intersects) continue;
        clip_to_scroll_area = true;
      }
      if (!full && !legacy_partial) {
        const auto b = w->bounds();
        if (!scroll_partial) {
          if (!UiInvalidation::needs_redraw_in(b.x, b.y, b.w, b.h)) continue;
        }
      }
      if (clip_to_scroll_area) {
        // ESPHome start_clipping(l, t, r, b) treats r/b as exclusive edges
        // (it stores w = r - l), so pass x + w / y + h directly.
        const int clip_right = scroll_area_x_ + scroll_area_w_;
        const int clip_bottom = scroll_area_y_ + scroll_area_h_;
        it.start_clipping(scroll_area_x_, scroll_area_y_, clip_right, clip_bottom);
      }
      w->draw(it, state);
      if (clip_to_scroll_area) {
        it.end_clipping();
      }
    }
    scroll_dirty_ = false;
  }

 private:
  void apply_scroll_offsets() {
    for (auto &w : widgets_) {
      w->set_render_offset_y((scroll_enabled_ && !w->scroll_exempt()) ? scroll_y_ : 0);
    }
  }

  std::vector<std::unique_ptr<Widget>> widgets_;
  static constexpr int kScreenWidth = 480;
  bool scroll_enabled_ = false;
  bool dragging_scroll_ = false;
  bool scroll_dirty_ = false;
  int scroll_y_ = 0;
  int scroll_start_y_ = 0;
  int scroll_area_x_ = 0;
  int scroll_area_w_ = kScreenWidth;
  int scroll_area_y_ = 0;
  int scroll_area_h_ = 480;
  int max_scroll_ = 0;
};
