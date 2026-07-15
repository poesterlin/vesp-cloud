#pragma once

#include "ui_rendering_utils.h"

class Widget {
 public:
  virtual ~Widget() = default;
  virtual void enter() {}
  virtual void exit() {}
  virtual void layout() {}

  // Default update() polls the visibility_check_ lambda and self-marks dirty
  // when its result flips. This is what makes conditional-area variants (and
  // anything else using set_visibility_condition) repaint when the underlying
  // state changes -- the codegen sets a visibility lambda on each variant
  // child, and this poll detects the flip from active->inactive / vice versa.
  //
  // Subclasses that override update() MUST call Widget::update(now) at the
  // end (or beginning) or they'll lose visibility-driven dirty marking.
  virtual void update(uint32_t now) {
    (void)now;
    (void)this->poll_visibility_state();
  }

  virtual bool handle_touch(const TouchEvent &event, uint32_t now) { return false; }
  virtual void draw(display::Display &it, const UiState &state) = 0;
  virtual bool is_background_widget() const { return false; }
  virtual bool is_top_widget() const { return false; }

  // Bounding box used by the dirty-rect machinery. Widgets with a fixed
  // rectangle override this to return their rect_; widgets that paint
  // outside a single box can return a conservative superset. Default is
  // the full screen, which means "I might be anywhere -> always redraw me".
  virtual UiRect bounds() const { return UiRect{0, 0, 480, 480}; }

  // Keep painting, invalidation, and interaction geometry separate. Most
  // widgets use the same rectangle for all three, while containers can widen
  // dirty_bounds() and touch handlers can add slop without widening paint.
  virtual UiRect paint_bounds() const { return bounds(); }
  virtual UiRect touch_bounds() const { return bounds(); }

  UiRect dirty_bounds() const {
    return has_custom_dirty_bounds_ ? screen_rect(dirty_bounds_) : paint_bounds();
  }

  // Enforce the paint-bounds contract at the last common point before a
  // widget draws. The optional constraint is used for scroll viewports and
  // partial background intersections.
  void draw_clipped(display::Display &it, const UiState &state) {
    draw_clipped(it, state, paint_bounds());
  }

  void draw_clipped(display::Display &it, const UiState &state,
                    const UiRect &constraint) {
    const UiRect paint = paint_bounds();
    const int left = std::max(paint.x, constraint.x);
    const int top = std::max(paint.y, constraint.y);
    const int right = std::min(paint.x + paint.w, constraint.x + constraint.w);
    const int bottom = std::min(paint.y + paint.h, constraint.y + constraint.h);
    if (right <= left || bottom <= top) return;
    it.start_clipping(left, top, right, bottom);
    draw(it, state);
    it.end_clipping();
  }

  // Draw a widget once, clipped to the union of the current damage that
  // intersects it. This keeps small animated/state regions from repainting an
  // entire large widget while avoiding repeated draw() calls when several
  // dirty rectangles touch the same widget.
  bool draw_dirty_clipped(display::Display &it, const UiState &state,
                          const UiRect &constraint) {
    const UiRect gate = redraw_gate_bounds();
    const UiRect paint = paint_bounds();
    bool found = false;
    UiRect damage{};
    for (int i = 0; i < UiInvalidation::dirty_count(); i++) {
      const auto &dr = UiInvalidation::dirty_rect(i);
      const int left = std::max(std::max(gate.x, paint.x),
                                std::max(constraint.x, dr.x));
      const int top = std::max(std::max(gate.y, paint.y),
                               std::max(constraint.y, dr.y));
      const int right = std::min(std::min(gate.x + gate.w, paint.x + paint.w),
                                 std::min(constraint.x + constraint.w, dr.x + dr.w));
      const int bottom = std::min(std::min(gate.y + gate.h, paint.y + paint.h),
                                  std::min(constraint.y + constraint.h, dr.y + dr.h));
      if (right <= left || bottom <= top) continue;
      if (!found) {
        damage = UiRect{left, top, right - left, bottom - top};
        found = true;
      } else {
        const int union_left = std::min(damage.x, left);
        const int union_top = std::min(damage.y, top);
        const int union_right = std::max(damage.x + damage.w, right);
        const int union_bottom = std::max(damage.y + damage.h, bottom);
        damage = UiRect{union_left, union_top,
                        union_right - union_left, union_bottom - union_top};
      }
    }
    if (!found) return false;
    draw_clipped(it, state, damage);
    return true;
  }

  bool draw_dirty_clipped(display::Display &it, const UiState &state) {
    return draw_dirty_clipped(it, state, paint_bounds());
  }

  void set_render_offset_y(int y) { render_offset_y_ = y; }
  void set_scroll_exempt(bool exempt) { scroll_exempt_ = exempt; }
  bool scroll_exempt() const { return scroll_exempt_; }

  // Override the rect that mark_dirty() invalidates. By default mark_dirty
  // invalidates bounds(); widgets inside a "container" like a conditional
  // area set this to the container rect so that when they (dis)appear, the
  // shared background + sibling variant widgets all repaint together. Without
  // this, a small per-widget dirty rect would cause the bg to fill the whole
  // container and erase siblings that don't intersect the dirty rect.
  void set_dirty_bounds(UiRect b) {
    dirty_bounds_ = b;
    has_custom_dirty_bounds_ = true;
  }

  // Name used in debug logging to identify which widget type called mark_dirty.
  virtual const char *widget_label() const { return "Widget"; }

  // Mark this widget's bounds dirty so it (and only it) is redrawn on the
  // next render pass. Use this from state-change handlers / update() polls.
  void mark_dirty() {
    const UiRect b = dirty_bounds();
    UiInvalidation::request_rect(UiDirtyRect{b.x, b.y, b.w, b.h}, widget_label());
  }

  void mark_dirty_tagged(const char *tag) {
    const UiRect b = dirty_bounds();
    UiInvalidation::request_rect(UiDirtyRect{b.x, b.y, b.w, b.h}, tag);
  }

  // Region used by the GenericScreen redraw gate. Keep this in sync with
  // mark_dirty() so container-linked widgets (set_dirty_bounds) are either
  // skipped or redrawn atomically with their container eraser.
  UiRect redraw_gate_bounds() const {
    return dirty_bounds();
  }

  // Should this widget actually be drawn this frame? Combines visibility
  // and dirty-rect intersection.
  bool needs_draw(const UiState &state) const {
    if (!is_visible(state)) return false;
    const auto b = redraw_gate_bounds();
    return UiInvalidation::needs_redraw_in(b.x, b.y, b.w, b.h);
  }

  virtual bool is_visible(const UiState &state) const {
    (void)state;
    if (visibility_check_) return visibility_check_();
    return true;
  }

  virtual bool is_loading_widget() const { return false; }

  // Poll visibility condition and mark dirty on edge changes. This can be
  // called by screens before deciding whether to run the heavier update() on
  // hidden widgets.
  bool poll_visibility(const UiState &state) {
    (void)state;
    return poll_visibility_state();
  }

  void set_visibility_condition(std::function<bool()> check) {
    visibility_check_ = std::move(check);
    visibility_baseline_set_ = false;
    mark_dirty();
  }

 protected:
  UiRect screen_rect(UiRect r) const {
    r.y += render_offset_y_;
    return r;
  }

  std::function<bool()> visibility_check_;
  UiRect dirty_bounds_{0, 0, 0, 0};
  int render_offset_y_ = 0;
  bool has_custom_dirty_bounds_ = false;
  bool scroll_exempt_ = false;
  bool last_visibility_ = false;
  bool visibility_baseline_set_ = false;

 private:
  bool poll_visibility_state() {
    if (!visibility_check_) return true;
    const bool current = visibility_check_();
    if (!visibility_baseline_set_ || current != last_visibility_) {
      ESP_LOGW("vis", "[f=%u t=%u] %s -> %s", UiInvalidation::frame(), millis(),
               widget_label(), current ? "VISIBLE" : "hidden");
      mark_dirty();
      last_visibility_ = current;
      visibility_baseline_set_ = true;
    }
    return current;
  }
};
