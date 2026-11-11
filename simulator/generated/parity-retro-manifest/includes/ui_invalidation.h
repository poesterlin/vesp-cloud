#pragma once

#include <algorithm>

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
  static constexpr int SCREEN_WIDTH = 480;
  static constexpr int SCREEN_HEIGHT = 480;
  static constexpr int MERGE_AREA_PENALTY = 512;

  static uint32_t frame() { return frame_count_; }
  static void inc_frame() { frame_count_++; }

  static void request_full(const char *why = nullptr) {
    DamageSet &damage = target_damage_();
    ESP_LOGD("inval", "[f=%u] request_full   why=%s target=%s", frame_count_,
             why ? why : "?", drawing_ ? "next" : "current");
    damage.full = true;
    damage.count = 0;
  }

  static void request_rect(const UiDirtyRect &rect, const char *who = nullptr) {
    add_rect_(target_damage_(), rect, who);
  }

  // Schedule a concrete region for the following frame. Multi-frame painters
  // use this instead of a regionless continuation, which cannot preserve the
  // affected paint area across frames.
  static void request_continue(const UiDirtyRect &rect, const char *who = nullptr) {
    add_rect_(next_, rect, who ? who : "continue");
  }

  static bool needs_redraw() { return current_.full || current_.count > 0; }
  static bool is_full_dirty() { return current_.full; }
  static int dirty_count() { return current_.count; }
  static const UiDirtyRect &dirty_rect(int index) { return current_.rects[index]; }

  static bool needs_redraw_in(int x, int y, int w, int h) {
    if (current_.full) return true;
    if (w <= 0 || h <= 0) return false;
    for (int i = 0; i < current_.count; i++) {
      if (intersects_(UiDirtyRect{x, y, w, h}, current_.rects[i])) return true;
    }
    return false;
  }

  static void begin_draw() { drawing_ = true; }

  static bool should_continue() {
    return next_.full || next_.count > 0;
  }

  // Finish consuming the current damage and promote any invalidations raised
  // during drawing to the next display frame.
  static void end_draw() {
    drawing_ = false;
    current_ = next_;
    next_ = DamageSet{};
  }

 private:
  struct DamageSet {
    UiDirtyRect rects[MAX_DIRTY_RECTS];
    int count;
    bool full;

    DamageSet() : rects{}, count(0), full(false) {}
    explicit DamageSet(bool full_dirty)
        : rects{}, count(0), full(full_dirty) {}
  };

  static DamageSet &target_damage_() { return drawing_ ? next_ : current_; }

  static bool normalize_(const UiDirtyRect &input, UiDirtyRect &out) {
    const int left = std::max(0, input.x);
    const int top = std::max(0, input.y);
    const int right = std::min(SCREEN_WIDTH, input.x + input.w);
    const int bottom = std::min(SCREEN_HEIGHT, input.y + input.h);
    if (input.w <= 0 || input.h <= 0 || right <= left || bottom <= top) return false;
    out = UiDirtyRect{left, top, right - left, bottom - top};
    return true;
  }

  static bool intersects_(const UiDirtyRect &a, const UiDirtyRect &b) {
    return a.x < b.x + b.w && b.x < a.x + a.w &&
           a.y < b.y + b.h && b.y < a.y + a.h;
  }

  static bool touches_(const UiDirtyRect &a, const UiDirtyRect &b) {
    return a.x <= b.x + b.w && b.x <= a.x + a.w &&
           a.y <= b.y + b.h && b.y <= a.y + a.h;
  }

  static bool equal_(const UiDirtyRect &a, const UiDirtyRect &b) {
    return a.x == b.x && a.y == b.y && a.w == b.w && a.h == b.h;
  }

  static UiDirtyRect union_(const UiDirtyRect &a, const UiDirtyRect &b) {
    const int left = std::min(a.x, b.x);
    const int top = std::min(a.y, b.y);
    const int right = std::max(a.x + a.w, b.x + b.w);
    const int bottom = std::max(a.y + a.h, b.y + b.h);
    return UiDirtyRect{left, top, right - left, bottom - top};
  }

  static int area_(const UiDirtyRect &r) { return r.w * r.h; }

  static bool should_merge_(const UiDirtyRect &a, const UiDirtyRect &b) {
    if (!touches_(a, b)) return false;
    const UiDirtyRect combined = union_(a, b);
    return area_(combined) <= area_(a) + area_(b) + MERGE_AREA_PENALTY;
  }

  static void add_rect_(DamageSet &damage, const UiDirtyRect &input,
                        const char *who) {
    if (damage.full) return;
    UiDirtyRect rect;
    if (!normalize_(input, rect)) return;

    for (int i = 0; i < damage.count; i++) {
      if (equal_(damage.rects[i], rect)) return;
      if (!should_merge_(damage.rects[i], rect)) continue;
      rect = union_(damage.rects[i], rect);
      damage.rects[i] = damage.rects[--damage.count];
      i = -1;  // The enlarged rect may now merge with an earlier entry.
    }

    if (damage.count >= MAX_DIRTY_RECTS) {
      ESP_LOGD("inval", "[f=%u] request_rect who=%s -> full (overflow)",
               frame_count_, who ? who : "?");
      damage.full = true;
      damage.count = 0;
      return;
    }

    ESP_LOGD("inval", "[f=%u] request_rect x=%d y=%d w=%d h=%d who=%s target=%s",
             frame_count_, rect.x, rect.y, rect.w, rect.h, who ? who : "?",
             (&damage == &next_) ? "next" : "current");
    damage.rects[damage.count++] = rect;
  }

  inline static uint32_t frame_count_ = 0;
  inline static bool drawing_ = false;
  inline static DamageSet current_{true};
  inline static DamageSet next_{};
};
