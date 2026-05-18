#pragma once

#include "ui_invalidation.h"
#include <functional>

using UiFlushCallback = void (*)();

class UiRedraw {
 public:
  static void set_flush_callback(UiFlushCallback callback) { flush_callback_ = callback; }

  static void set_display_updater(std::function<void()> updater) { display_updater_ = std::move(updater); }

  static void trigger_display_update() {
    if (display_updater_) display_updater_();
  }

  static void request_full() { UiInvalidation::request_full(); }

  static void request_rect(const UiDirtyRect &rect) { UiInvalidation::request_rect(rect); }

  static void flush_now() {
    if (is_drawing_) {
      return;
    }
    if (!UiInvalidation::needs_redraw()) {
      return;
    }
    if (flush_callback_ != nullptr) {
      flush_callback_();
    }
  }

  static void begin_draw() { is_drawing_ = true; }

  static void end_draw() {
    UiInvalidation::clear();
    is_drawing_ = false;
  }

 private:
  inline static UiFlushCallback flush_callback_ = nullptr;
  inline static std::function<void()> display_updater_;
  inline static bool is_drawing_ = false;
};
