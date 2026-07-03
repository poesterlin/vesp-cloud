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
  virtual void update(uint32_t now, const UiState &state) = 0;
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

  void update(uint32_t now, const UiState &state) override {
    const bool show_loading = state.should_show_loading();
    for (auto &w : widgets_) {
      const bool visible = w->poll_visibility(state);
      if (!visible) continue;
      if (show_loading && !w->is_loading_widget()) continue;
      if (!show_loading && w->is_loading_widget()) continue;
      w->update(now);
    }
  }

  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) override {
    apply_scroll_offsets();

    if (scroll_enabled_) {
      for (auto &w : widgets_) {
        if (w->scroll_exempt() && w->is_visible(state) && w->handle_touch(event, now)) return true;
      }

      // Give scrollable/non-exempt widgets first chance to claim touch
      // sequences (e.g. nested TodoPreviewWidget scrolling) before the
      // screen-level drag handler starts capturing the gesture.
      if (!dragging_scroll_) {
        for (auto &w : widgets_) {
          if (w->scroll_exempt()) continue;
          if (w->is_visible(state) && w->handle_touch(event, now)) return true;
        }
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

      return false;
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
    apply_scroll_offsets();
    if (scroll_partial) {
      ui_fast_filled_rectangle(it, scroll_area_x_, scroll_area_y_, scroll_area_w_, scroll_area_h_,
                               RetroColors::VOID);
    }
    auto draw_pass = [&](bool background_only, bool top_only) {
      for (auto &w : widgets_) {
        if (w->is_background_widget() != background_only) continue;
        if (w->is_top_widget() != top_only) continue;
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
        if (!full && background_only && !scroll_partial) {
          // Background widgets repaint large areas. On partial redraws we must
          // confine them to dirty intersections, otherwise they can overpaint
          // foreground widgets that are outside the current dirty rect.
          const auto b = w->redraw_gate_bounds();
          bool drew_partial_bg = false;
          for (int i = 0; i < UiInvalidation::dirty_count(); i++) {
            const auto &dr = UiInvalidation::dirty_rect(i);
            const int ix = std::max(b.x, dr.x);
            const int iy = std::max(b.y, dr.y);
            const int ir = std::min(b.x + b.w, dr.x + dr.w);
            const int ib = std::min(b.y + b.h, dr.y + dr.h);
            if (ir <= ix || ib <= iy) continue;
            int clip_l = ix;
            int clip_t = iy;
            int clip_r = ir;
            int clip_b = ib;
            if (clip_to_scroll_area) {
              const int sx = scroll_area_x_;
              const int sy = scroll_area_y_;
              const int sr = scroll_area_x_ + scroll_area_w_;
              const int sb = scroll_area_y_ + scroll_area_h_;
              clip_l = std::max(clip_l, sx);
              clip_t = std::max(clip_t, sy);
              clip_r = std::min(clip_r, sr);
              clip_b = std::min(clip_b, sb);
              if (clip_r <= clip_l || clip_b <= clip_t) continue;
            }
            it.start_clipping(clip_l, clip_t, clip_r, clip_b);
            w->draw(it, state);
            it.end_clipping();
            drew_partial_bg = true;
          }
          if (!drew_partial_bg) continue;
          continue;
        }
        if (!full) {
          const auto b = w->redraw_gate_bounds();
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
    };
    // 1) backgrounds (rectangles, fills)
    // 2) normal widgets
    // 3) top widgets (headers/chrome)
    draw_pass(true, false);
    draw_pass(false, false);
    draw_pass(false, true);
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
