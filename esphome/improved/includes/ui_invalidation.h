#pragma once

constexpr int UI_MAX_IMAGES_PER_FRAME = 2;

struct UiDirtyRect {
  int x = 0;
  int y = 0;
  int w = 0;
  int h = 0;
};

class UiInvalidation {
 public:
  static constexpr int MAX_DIRTY_RECTS = 16;

  static void request_full() {
    full_dirty_ = true;
    dirty_count_ = 0;
    needs_redraw_ = true;
  }

  static void request_partial() {
    if (!full_dirty_) {
      needs_redraw_ = true;
    }
  }

  static void request_rect(const UiDirtyRect &rect) {
    if (full_dirty_) {
      needs_redraw_ = true;
      return;
    }

    if (dirty_count_ >= MAX_DIRTY_RECTS) {
      request_full();
      return;
    }

    dirty_rects_[dirty_count_++] = rect;
    needs_redraw_ = true;
  }

  static bool needs_redraw() { return needs_redraw_; }

  static bool is_full_dirty() { return full_dirty_; }

  static int dirty_count() { return dirty_count_; }

  static const UiDirtyRect &dirty_rect(int index) { return dirty_rects_[index]; }

  // Returns true iff the given rect needs to be redrawn given the current
  // invalidation state. Used by Screen::draw() and TabContainerWidget::draw()
  // to skip widgets whose bounds don't overlap any dirty rect.
  //
  // Semantics:
  //  * full_dirty   -> everything redraws
  //  * dirty_count_ > 0 -> only widgets overlapping a dirty rect redraw
  //  * needs_redraw_ but no rects -> legacy "partial" fallback: everything
  //    redraws (some caller didn't migrate to mark_dirty() yet)
  //  * nothing set -> nothing redraws (and we shouldn't be inside a draw)
  static bool needs_redraw_in(int x, int y, int w, int h) {
    if (full_dirty_) return true;
    if (dirty_count_ == 0) return needs_redraw_;
    for (int i = 0; i < dirty_count_; i++) {
      const auto &r = dirty_rects_[i];
      if (x + w <= r.x || r.x + r.w <= x) continue;
      if (y + h <= r.y || r.y + r.h <= y) continue;
      return true;
    }
    return false;
  }

  static void request_continue() { render_continue_ = true; }

  static bool should_continue() { return render_continue_; }

  static void clear() {
    if (render_continue_) {
      needs_redraw_ = true;
      full_dirty_ = false;
      dirty_count_ = 0;
      render_continue_ = false;
    } else {
      needs_redraw_ = false;
      full_dirty_ = false;
      dirty_count_ = 0;
    }
  }

 private:
  inline static bool needs_redraw_ = true;
  inline static bool full_dirty_ = true;
  inline static bool render_continue_ = false;
  inline static UiDirtyRect dirty_rects_[MAX_DIRTY_RECTS];
  inline static int dirty_count_ = 0;
};
