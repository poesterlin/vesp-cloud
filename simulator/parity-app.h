#pragma once
#include "esphome.h"
#include "ui_state.h"
#include "ui_redraw.h"
#ifdef VESPUI_PARITY_GENERATED
#include "ui_screens.h"
#else
#include "ui_manifest.h"
#include "ui_runtime.h"
#endif

// Identical mock state delivery for the real generated and manifest renderers.
class UiApp {
 public:
  void init() {
    if (initialized_) return;
    initialized_ = true;
    state_.ha_connected.set(true);
#ifdef VESPUI_PARITY_GENERATED
    setup_ui_screens(screens_, state_, [](const std::string &, const std::string &) {}, []{});
    state_.txt_sensor_demo.set("off");
#else
    vespui::RuntimeContext context;
    context.subscribe_state = [this](const std::string &, const std::string &, vespui::RuntimeContext::StateSink sink) { sink_ = std::move(sink); };
    std::string error;
    if (!runtime_.load(vespui_embedded_manifest, vespui_embedded_manifest_size, std::move(context), &error))
      ESP_LOGE("simulator", "Parity manifest rejected: %s", error.c_str());
    if (sink_) sink_("off");
#endif
    UiInvalidation::request_full("parity init");
  }
  void touch_activity() { last_interaction_time = millis(); }
  void on_touch_event(const TouchEvent &event) {
    init();
    if (event.type == TouchType::Tap && event.x < 300 && event.y >= 140 && event.y < 185) {
      on_ = !on_;
#ifdef VESPUI_PARITY_GENERATED
      state_.txt_sensor_demo.set(on_ ? "on" : "off");
#else
      if (sink_) sink_(on_ ? "on" : "off");
#endif
    }
    if (event.type == TouchType::Tap && event.y >= 350 && event.y < 390) {
      // Repaint two separated areas without dirtying the labels/icon between
      // them. Background clipping must not erase the undamaged gap.
      UiInvalidation::request_rect({20,20,440,45}, "parity:top");
      UiInvalidation::request_rect({330,432,130,36}, "parity:bottom");
    }
  }
  void update(uint32_t now) {
    init();
#ifdef VESPUI_PARITY_GENERATED
    screens_.update(now, state_);
#else
    runtime_.update(now, state_);
#endif
  }
  void draw(display::Display &it, uint32_t) {
    init();
#ifdef VESPUI_PARITY_GENERATED
    screens_.draw(it, state_);
#else
    runtime_.draw(it, state_);
#endif
  }
  UiState &state() { return state_; }
  uint32_t last_interaction_time = 0;
 private:
  bool initialized_ = false, on_ = false;
  UiState state_;
#ifdef VESPUI_PARITY_GENERATED
  ScreenController screens_;
#else
  vespui::RuntimeUi runtime_;
  vespui::RuntimeContext::StateSink sink_;
#endif
};
inline UiApp g_ui_app;
