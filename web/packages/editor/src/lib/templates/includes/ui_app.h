#pragma once

#include "esphome.h"
#include "ui_redraw.h"
#include "ui_screens.h"
#include "ui_state.h"
#include "ui_types.h"
#include "ui_retro.h"

void ui_fast_fill(display::Display &it, Color color);

#ifndef UI_PROFILE
#define UI_PROFILE 1
#endif

#if UI_PROFILE
struct UiProfileTimer {
  inline static uint32_t fill_us = 0;
  inline static uint32_t screens_us = 0;
};
#endif

class UiApp {
 public:
  void init() {
    if (initialized_) return;
    initialized_ = true;
    setup_ui_screens(screens_, state_, [this](const std::string& e, const std::string& a) {
      if (this->on_action) this->on_action(e, a);
    }, [this]() {
      if (this->dismiss_notification) this->dismiss_notification();
    });
    UiRedraw::request_full();
  }

  void on_touch_event(const TouchEvent &event) {
    init();
    const uint32_t now = millis();
    // Touch handlers (buttons, tabs, page-swipe, scrollable entries) are
    // responsible for marking their own dirty rects via mark_dirty() /
    // request_full(). We deliberately don't blanket-request a partial repaint
    // here -- doing so would force every widget to redraw on every touch.
    (void)screens_.handle_touch(event, now, state_);
  }

  void update(uint32_t now) {
    init();
    screens_.update(now);
  }

  void draw(display::Display &it, uint32_t now) {
    init();
    (void)now;
#if UI_PROFILE
    if (UiInvalidation::is_full_dirty() &&
        !screens_.current()->draws_own_background()) {
      const uint32_t t = micros();
      draw_retro_background(it);
      UiProfileTimer::fill_us = micros() - t;
    }
    const uint32_t t = micros();
    screens_.draw(it, state_);
    UiProfileTimer::screens_us = micros() - t;
#else
    if (UiInvalidation::is_full_dirty() &&
        !screens_.current()->draws_own_background()) {
      draw_retro_background(it);
    }
    screens_.draw(it, state_);
#endif
  }

  ScreenController& screens() { return screens_; }
  UiState& state() { return state_; }

  std::function<void(const std::string&, const std::string&)> on_action;
  std::function<void()> dismiss_notification;

  uint32_t last_interaction_time = 0;

  void touch_activity() { last_interaction_time = millis(); }

  void dispatch_action(const std::string& entity_id, const std::string& action) {
    if (on_action) on_action(entity_id, action);
  }

 private:
  bool initialized_ = false;
  UiState state_;
  ScreenController screens_;
};

inline UiApp g_ui_app;
