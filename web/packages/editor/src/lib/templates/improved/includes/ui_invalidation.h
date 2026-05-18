#pragma once

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

  static void clear() {
    needs_redraw_ = false;
    full_dirty_ = false;
    dirty_count_ = 0;
  }

 private:
  inline static bool needs_redraw_ = true;
  inline static bool full_dirty_ = true;
  inline static UiDirtyRect dirty_rects_[MAX_DIRTY_RECTS];
  inline static int dirty_count_ = 0;
};
