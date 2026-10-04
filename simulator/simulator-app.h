#pragma once

#include "esphome.h"
#include "ui_runtime_state.h"
#include "ui_manifest.h"
#include "ui_runtime.h"
#include <map>
#include <cstdlib>
#include <fstream>

// Only copied into the desktop build. Service calls update mock state and never
// reach Home Assistant. The manifest, widgets, drawing and touch code are shared.
class UiApp {
 public:
  void init() {
    if (boot_attempted_) return;
    boot_attempted_ = true;
    vespui::RuntimeContext context;
    if (std::getenv("VESPUI_MANIFEST_PATH")) context.boot_manifest_source = [](std::vector<uint8_t> &bytes, std::string &error) {
      const char *path = std::getenv("VESPUI_MANIFEST_PATH");
      if (!path || !*path) return false;
      std::ifstream file(path, std::ios::binary | std::ios::ate);
      if (!file) { error = "cannot open boot manifest"; return false; }
      const auto size = file.tellg();
      if (size <= 0 || size > static_cast<std::streamoff>(vespui::kMaxManifestBytes)) {
        error = "boot manifest size out of bounds"; return false;
      }
      bytes.resize(static_cast<size_t>(size));
      file.seekg(0);
      if (!file.read(reinterpret_cast<char *>(bytes.data()), bytes.size())) {
        error = "cannot read boot manifest"; return false;
      }
      return true;
    };
    context.subscribe_state = [this](const std::string &entity, const std::string &,
                                    vespui::RuntimeContext::StateSink sink) {
      sinks_[entity].push_back(sink);
    };
    context.call_service = [this](const std::string &service, const std::string &entity) {
      auto &value = values_[entity];
      if (service.find("turn_on") != std::string::npos) value = "on";
      else if (service.find("turn_off") != std::string::npos) value = "off";
      else value = value == "on" ? "off" : "on";
      ESP_LOGI("simulator", "Mock service %s -> %s = %s", service.c_str(), entity.c_str(), value.c_str());
      for (auto &sink : sinks_[entity]) sink(value);
    };
    std::string error;
    initialized_ = runtime_.load(vespui_embedded_manifest, vespui_embedded_manifest_size,
                                std::move(context), &error);
    if (!initialized_) ESP_LOGE("simulator", "Manifest rejected: %s", error.c_str());
    else {
      ESP_LOGI("simulator", "Manifest source: %s", runtime_.uses_external_manifest() ? "external" : "embedded");
      if (!runtime_.boot_source_error().empty())
        ESP_LOGW("simulator", "Boot manifest fallback: %s", runtime_.boot_source_error().c_str());
      ESP_LOGI("simulator", "Loaded real runtime: %u screens, %u widgets",
                 static_cast<unsigned>(runtime_.manifest().screens.size()),
                 static_cast<unsigned>(runtime_.manifest().widgets.size()));
      // State delivery can request a synchronous redraw. Wait until load has
      // returned before calling sinks, just like an asynchronous HA update.
      for (auto &entry : sinks_) for (auto &sink : entry.second) sink("off");
    }
  }
  void on_touch_event(const TouchEvent &event) {
    init();
    if (initialized_) {
      const auto previous = runtime_.current_screen_id();
      runtime_.handle_touch(event, millis(), state_);
      if (previous != runtime_.current_screen_id())
        ESP_LOGI("simulator", "Screen changed: %u", static_cast<unsigned>(runtime_.current_screen_id()));
    }
  }
  void update(uint32_t now) {
    init();
    state_.ha_connected = true;
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
  bool boot_attempted_ = false;
  UiState state_;
  vespui::RuntimeUi runtime_;
  std::map<std::string, std::string> values_;
  std::map<std::string, std::vector<vespui::RuntimeContext::StateSink>> sinks_;
};
inline UiApp g_ui_app;
