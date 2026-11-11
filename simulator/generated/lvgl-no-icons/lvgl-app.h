#pragma once
#include "ui_lvgl_runtime.h"
#include "ui_manifest.h"
#include <cstdlib>
#include <fstream>
#include <map>

// Host-only adapters. Production session/backend headers remain shared.
class LvglSimulatorApp {
 public:
  void init(esphome::lvgl::LvglComponent *component,
            std::array<const lv_font_t *, 3> fonts, const lv_font_t *icons, bool retro) {
    runtime_.configure(component, fonts, icons, retro);
    runtime_.set_ha_connected(true);
    vespui::RuntimeContext context;
    if (std::getenv("VESPUI_MANIFEST_PATH")) context.boot_manifest_source = [](auto &bytes, auto &error) {
      std::ifstream file(std::getenv("VESPUI_MANIFEST_PATH"), std::ios::binary | std::ios::ate);
      if (!file) { error = "cannot open boot manifest"; return false; }
      const auto size = file.tellg();
      if (size <= 0 || size > static_cast<std::streamoff>(vespui::kMaxManifestBytes)) {
        error = "boot manifest size out of bounds"; return false;
      }
      bytes.resize(static_cast<size_t>(size)); file.seekg(0);
      if (!file.read(reinterpret_cast<char *>(bytes.data()), bytes.size())) {
        error = "cannot read boot manifest"; return false;
      }
      return true;
    };
    context.subscribe_state = [this](const auto &entity, const auto &attribute, auto sink) {
      sinks_[entity + "\n" + attribute].push_back(std::move(sink));
    };
    context.call_service = [this](const auto &service, const auto &entity) {
      auto &value = values_[entity];
      value = service.find("turn_on") != std::string::npos ? "on" :
              service.find("turn_off") != std::string::npos ? "off" : value == "on" ? "off" : "on";
      ESP_LOGI("simulator", "Mock service %s -> %s = %s", service.c_str(), entity.c_str(), value.c_str());
      for (auto &sink : sinks_[entity + "\n"]) sink(value);
    };
    std::string error;
    if (!runtime_.load(vespui_embedded_manifest, vespui_embedded_manifest_size, std::move(context), &error)) {
      ESP_LOGE("simulator", "Manifest rejected: %s", error.c_str()); return;
    }
    for (auto &entry : sinks_) for (auto &sink : entry.second) sink("off");
    ESP_LOGI("simulator", "Manifest source: %s", runtime_.session().uses_external_manifest() ? "external" : "embedded");
    if (!runtime_.session().boot_source_error().empty())
      ESP_LOGW("simulator", "Boot manifest fallback: %s", runtime_.session().boot_source_error().c_str());
    ESP_LOGI("simulator", "Loaded LVGL runtime: %u screens, %u widgets, %u bindings",
      static_cast<unsigned>(runtime_.session().manifest().screens.size()),
      static_cast<unsigned>(runtime_.session().manifest().widgets.size()), static_cast<unsigned>(sinks_.size()));
    runtime_.update(esphome::millis());
  }
  void update(uint32_t now) {
    runtime_.update(now);
    if (now - last_stats_ >= 2000) {
      last_stats_ = now;
      const auto &stats = runtime_.counters();
      ESP_LOGI("lvgl_stats", "text=%u visibility=%u flushes=%u bindings=%u", stats.text_updates,
        stats.visibility_updates, stats.flushes, static_cast<unsigned>(sinks_.size()));
    }
  }
 private:
  vespui::LvglRuntime runtime_;
  std::map<std::string, std::string> values_;
  std::map<std::string, std::vector<vespui::RuntimeContext::StateSink>> sinks_;
  uint32_t last_stats_ = 0;
};
inline LvglSimulatorApp g_lvgl_app;
