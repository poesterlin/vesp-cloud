#pragma once

#include "esphome.h"
#include "ui_redraw.h"
#include "ui_screens.h"
#include "ui_state.h"
#include "ui_types.h"

void ui_fast_fill(display::Display &it, Color color);

class UiApp {
 public:
  void init() {
    if (initialized_) return;
    initialized_ = true;
    setup_ui_screens(screens_, state_, [this](const std::string& e, const std::string& a) {
      if (this->on_action) this->on_action(e, a);
    });
    UiRedraw::request_full();
  }

  void on_touch_event(const TouchEvent &event) {
    init();
    const uint32_t now = millis();
    screens_.handle_touch(event, now, state_);
    UiInvalidation::request_partial();
  }

  void update(uint32_t now) {
    init();
    screens_.update(now);
  }

  void draw(display::Display &it, uint32_t now) {
    init();
    (void)now;
    if (UiInvalidation::is_full_dirty()) {
      ui_fast_fill(it, Color(0, 0, 0));
    }
    screens_.draw(it, state_);
  }

  ScreenController& screens() { return screens_; }
  UiState& state() { return state_; }

  std::function<void(const std::string&, const std::string&)> on_action;

  void dispatch_action(const std::string& entity_id, const std::string& action) {
    if (on_action) on_action(entity_id, action);
  }

 private:
  bool initialized_ = false;
  UiState state_;
  ScreenController screens_;
};

inline UiApp g_ui_app;
