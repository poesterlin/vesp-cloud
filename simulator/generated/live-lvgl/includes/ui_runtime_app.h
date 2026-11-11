#pragma once

#include "esphome.h"
#include "ui_runtime_state.h"
#include "ui_manifest.h"
#include "ui_runtime.h"
#include "ui_manifest_storage.h"
#include <esp_heap_caps.h>

#ifndef UI_PROFILE
#define UI_PROFILE 0
#endif

class UiApp {
 public:
  void init() {
    if (boot_attempted_) return;
    boot_attempted_ = true;
    vespui::RuntimeContext context;
    context.boot_manifest_source = std::move(boot_manifest_source_);
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
      if (!runtime_.boot_source_error().empty())
        ESP_LOGW("vespui", "Boot manifest fallback: %s", runtime_.boot_source_error().c_str());
      ESP_LOGI("vespui", "Manifest source: %s", runtime_.uses_external_manifest() ? "external" : "embedded");
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
    if (initialized_) runtime_.handle_touch(event, millis(), state_);
  }
  void update(uint32_t now) {
    state_.ha_connected = esphome::api::global_api_server != nullptr &&
                          esphome::api::global_api_server->is_connected();
    if (initialized_) runtime_.update(now, state_);
  }
  void draw(display::Display &display, uint32_t) {
    if (initialized_) runtime_.draw(display, state_);
  }
  UiState &state() { return state_; }
  void prepare_boot_manifest(const std::string &scope) {
    if (boot_attempted_) return;
    vespui::set_manifest_cache_scope(scope);
    set_boot_manifest_source(vespui::read_cached_manifest);
  }
  bool accept_boot_manifest(const std::string &body) {
    if (boot_attempted_) return false;
    const auto *bytes = reinterpret_cast<const uint8_t *>(body.data());
    vespui::Manifest checked;
    std::string error;
    if (!vespui::Reader::parse(bytes, body.size(), checked, &error)) {
      boot_download_error_ = error;
      ESP_LOGW("vespui", "Downloaded manifest rejected: %s", error.c_str());
      return false;
    }
    downloaded_ = true;
    if (!vespui::write_cached_manifest(bytes, body.size(), error)) {
      boot_download_error_ = error;
      ESP_LOGW("vespui", "Manifest valid but not persisted: %s", error.c_str());
    }
    // The download may still render this boot if NVS is full/unavailable.
    return set_boot_manifest_source([body](std::vector<uint8_t> &out, std::string &) {
      out.assign(body.begin(), body.end());
      return true;
    });
  }
  // Configure during early boot, before init(). Once attempted, the source and
  // active UI remain fixed until reboot; there is no runtime replacement path.
  bool set_boot_manifest_source(vespui::BootManifestSource source) {
    if (boot_attempted_) return false;
    boot_manifest_source_ = std::move(source);
    return true;
  }
  std::string manifest_fingerprint() const {
    char value[17];
    std::snprintf(value, sizeof(value), "%016llx", static_cast<unsigned long long>(runtime_.manifest_fingerprint()));
    return value;
  }
  const char *manifest_source() const {
    return downloaded_ ? "download" : runtime_.uses_external_manifest() ? "cache" : "embedded";
  }
  std::string boot_manifest_error() const {
    return boot_download_error_.empty() ? runtime_.boot_source_error() : boot_download_error_;
  }
  void set_boot_download_error(const std::string &error) {
    if (!boot_attempted_) boot_download_error_ = error;
  }
  void touch_activity() { last_interaction_time = millis(); }

  uint32_t last_interaction_time = 0;

 private:
  bool initialized_ = false;
  bool boot_attempted_ = false;
  vespui::BootManifestSource boot_manifest_source_;
  bool downloaded_ = false;
  std::string boot_download_error_;
  UiState state_;
  vespui::RuntimeUi runtime_;
};

inline UiApp g_ui_app;
