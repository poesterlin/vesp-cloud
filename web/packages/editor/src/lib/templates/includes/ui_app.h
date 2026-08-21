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
    UiInvalidation::request_full("UiApp::init");
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

  // Rotary encoder navigation (wayfinder ticket 04). One detent: +1
  // clockwise / -1 anticlockwise.
  //
  // Semantics:
  //  1. An open scrollable surface consumes the step first (clamped at
  //     both ends -- rotation never wraps a detail view into a page
  //     switch).
  //  2. Otherwise, on the Home screen, rotation rotates dashboard pages
  //     with wrap-around (knob semantics).
  //  3. Everywhere else the step is a no-op.
  void on_encoder_step(int delta) {
    init();
    if (delta == 0) return;
    if (screens_.current()->scroll_by(delta)) return;
    if (screens_.current_id() == UiScreenId::Home && state_.home_total_pages > 1) {
      const int pages = state_.home_total_pages;
      int next = (state_.home_page_index + delta) % pages;
      if (next < 0) next += pages;
      if (next != state_.home_page_index) {
        state_.home_page_index = next;
        UiInvalidation::request_full();
      }
    }
  }

  void update(uint32_t now) {
    init();
    screens_.update(now, state_);
  }

  void draw(display::Display &it, uint32_t now) {
    init();
    state_.images_rendered_this_frame = 0;
    (void)now;
#if UI_PROFILE
    if (UiInvalidation::is_full_dirty() &&
        !screens_.current()->draws_own_background() &&
        !state_.should_show_loading()) {
      const uint32_t t = micros();
      draw_retro_background(it);
      UiProfileTimer::fill_us = micros() - t;
    }
    const uint32_t t = micros();
    screens_.draw(it, state_);
    UiProfileTimer::screens_us = micros() - t;
#else
    if (UiInvalidation::is_full_dirty() &&
        !screens_.current()->draws_own_background() &&
        !state_.should_show_loading()) {
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
