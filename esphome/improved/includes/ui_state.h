#pragma once

#include "esphome.h"
#include "ui_types.h"
#include "ui_invalidation.h"
#include <string>

template<typename T>
class Observable {
 public:
  Observable() : value_(T{}) {}
  explicit Observable(const T &v) : value_(v) {}

  Observable &operator=(const T &v) {
    if (value_ != v) {
      value_ = v;
      // No invalidation here: bound widgets poll their values in update()
      // and self-mark dirty via mark_dirty(). The render is still triggered
      // by whoever owns the state change (HA callback -> trigger_display_update,
      // touch handler -> main_display.update()).
    }
    return *this;
  }

  operator T() const { return value_; }

  const T *ptr() const { return &value_; }

  void set(const T &v) { *this = v; }

 private:
  T value_;
};

struct RenderScheduler {
  bool full_redraw = true;
  uint32_t last_frame = 0;
  uint32_t active_interval_ms = 33;
  uint32_t idle_interval_ms = 300;
  bool active_animation = false;

  void invalidate_all() { full_redraw = true; }

  bool should_draw(uint32_t now) const {
    if (full_redraw) {
      return true;
    }
    const uint32_t interval = active_animation ? active_interval_ms : idle_interval_ms;
    return (now - last_frame) >= interval;
  }

  void did_draw(uint32_t now) {
    last_frame = now;
    full_redraw = false;
  }
};

enum class AppStage {
  Booting,
  AwaitingConnection,
  Ready
};

struct UiState {
  UiScreenId current_screen = UiScreenId::Home;
  int home_page_index = 0;
  int home_total_pages = 4;
  Observable<bool> button_a_on{false};
  Observable<bool> button_b_on{false};
  Observable<bool> led_switch{false};
  Observable<int> todo_pending_count{0};
  Observable<std::string> todo_items_formatted{"LIST EMPTY"};
  Observable<bool> ha_connected{false};

  AppStage app_stage = AppStage::Booting;
  uint32_t ha_connected_at = 0;

  int images_rendered_this_frame = 0;
  static constexpr int MAX_IMAGES_PER_FRAME = 2;
};
