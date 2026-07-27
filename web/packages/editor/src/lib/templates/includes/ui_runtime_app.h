#pragma once

#include "esphome.h"
#include "ui_runtime_state.h"
#include "ui_manifest.h"
#include "ui_runtime.h"
#include <esp_heap_caps.h>

#ifndef UI_PROFILE
#define UI_PROFILE 0
#endif

class UiApp {
 public:
  void init() {
    if (initialized_) return;
    vespui::RuntimeContext context;
    context.subscribe_state = [](const std::string &entity,
                                 const std::string &attribute,
                                 vespui::RuntimeContext::StateSink sink) {
      auto *api = esphome::api::global_api_server;
      if (api == nullptr) return;
      esphome::optional<std::string> attr = attribute.empty()
          ? esphome::optional<std::string>()
          : esphome::optional<std::string>(attribute);
      api->subscribe_home_assistant_state(
          entity, attr,
          [sink](esphome::StringRef value) {
            sink(std::string(value.c_str(), value.size()));
          });
    };
    context.call_service = [](const std::string &service,
                              const std::string &entity) {
      auto *api = esphome::api::global_api_server;
      if (api == nullptr || !api->is_connected()) return;
      esphome::api::HomeAssistantServiceCallAction<> call(api, false);
      call.set_service(service);
      if (entity.empty()) {
        call.init_data(0);
      } else {
        call.init_data(1);
        call.add_data("entity_id", entity);
      }
      call.play();
    };
    std::string error;
    initialized_ = runtime_.load(
        vespui_embedded_manifest, vespui_embedded_manifest_size,
        std::move(context), &error);
    if (!initialized_) {
      ESP_LOGE("vespui", "Manifest rejected: %s", error.c_str());
    } else {
      ESP_LOGI("vespui", "Loaded %u screens, %u widgets, %u bindings",
               static_cast<unsigned>(runtime_.manifest().screens.size()),
               static_cast<unsigned>(runtime_.manifest().widgets.size()),
               static_cast<unsigned>(runtime_.manifest().bindings.size()));
      ESP_LOGI("vespui", "Heap after UI: free=%u internal=%u psram=%u",
               static_cast<unsigned>(heap_caps_get_free_size(MALLOC_CAP_8BIT)),
               static_cast<unsigned>(heap_caps_get_free_size(MALLOC_CAP_INTERNAL)),
               static_cast<unsigned>(heap_caps_get_free_size(MALLOC_CAP_SPIRAM)));
    }
  }

  void on_touch_event(const TouchEvent &event) {
    init();
    if (initialized_) runtime_.handle_touch(event, millis(), state_);
  }
  void update(uint32_t now) {
    init();
    state_.ha_connected = esphome::api::global_api_server != nullptr &&
                          esphome::api::global_api_server->is_connected();
    if (initialized_) runtime_.update(now, state_);
  }
  void draw(display::Display &display, uint32_t) {
    init();
    if (initialized_) runtime_.draw(display, state_);
  }
  UiState &state() { return state_; }
  void touch_activity() { last_interaction_time = millis(); }

  uint32_t last_interaction_time = 0;

 private:
  bool initialized_ = false;
  UiState state_;
  vespui::RuntimeUi runtime_;
};

inline UiApp g_ui_app;
