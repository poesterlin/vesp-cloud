#pragma once

#include "ui_runtime_session.h"
#include "esphome/components/lvgl/lvgl_esphome.h"
#include <array>
#include <algorithm>

#if defined(USE_HOST)
#include <malloc.h>
#elif defined(USE_ESP32)
#include <esp_heap_caps.h>
#endif

namespace vespui {

// Experimental v2 backend. ESPHome owns the display, input and refresh timer.
class LvglRuntime {
 public:
  struct Counters {
    uint32_t text_updates = 0, visibility_updates = 0, flushes = 0, renders = 0;
    uint64_t flush_pixels = 0;
    uint32_t render_us_last = 0, render_us_max = 0;
    uint64_t render_us_total = 0;
    uint32_t flush_us_last = 0, flush_us_max = 0;
    uint64_t flush_us_total = 0;
    uint32_t update_calls = 0, update_gap_us_max = 0;
    uint32_t action_latency_us_last = 0, action_latency_us_max = 0;
    uint64_t action_latency_us_total = 0;
    uint32_t action_samples = 0;
    uint32_t mem_free = 0, mem_free_min = 0xFFFFFFFFu, mem_largest = 0, mem_external = 0;
  };
  struct MemoryInfo {
    uint32_t free_bytes = 0, largest_block = 0, min_free_bytes = 0, external_free_bytes = 0;
  };
  // On ESP32 this reports internal-heap free/largest/minimum and PSRAM free. On
  // the host it reports the process arena via mallinfo2(), where largest_block
  // is the top releasable block rather than a heap-caps figure.
  static MemoryInfo sample_memory() {
    MemoryInfo info;
#if defined(USE_HOST)
    const struct mallinfo2 mi = mallinfo2();
    info.free_bytes = static_cast<uint32_t>(mi.fordblks);
    info.largest_block = static_cast<uint32_t>(mi.keepcost);
    info.min_free_bytes = info.free_bytes;
#elif defined(USE_ESP32)
    info.free_bytes = static_cast<uint32_t>(heap_caps_get_free_size(MALLOC_CAP_INTERNAL));
    info.largest_block = static_cast<uint32_t>(heap_caps_get_largest_free_block(MALLOC_CAP_INTERNAL));
    info.min_free_bytes = static_cast<uint32_t>(heap_caps_get_minimum_free_size(MALLOC_CAP_INTERNAL));
    info.external_free_bytes = static_cast<uint32_t>(heap_caps_get_free_size(MALLOC_CAP_SPIRAM));
#endif
    return info;
  }
  void sample_memory_now() {
    const auto info = sample_memory();
    counters_.mem_free = info.free_bytes;
    counters_.mem_largest = info.largest_block;
    counters_.mem_external = info.external_free_bytes;
    const uint32_t minimum = info.min_free_bytes < info.free_bytes ? info.min_free_bytes : info.free_bytes;
    if (minimum < counters_.mem_free_min) counters_.mem_free_min = minimum;
  }
  void configure(esphome::lvgl::LvglComponent *component,
                 std::array<const lv_font_t *, 3> text_fonts,
                 const lv_font_t *icon_font, bool retro) {
    component_ = component; fonts_ = text_fonts; icon_font_ = icon_font; retro_ = retro;
    if (component_ && component_->get_disp()) {
      auto *display = component_->get_disp();
      lv_display_add_event_cb(display, display_event, LV_EVENT_FLUSH_START, this);
      lv_display_add_event_cb(display, display_event, LV_EVENT_FLUSH_FINISH, this);
      lv_display_add_event_cb(display, display_event, LV_EVENT_RENDER_START, this);
      lv_display_add_event_cb(display, display_event, LV_EVENT_RENDER_READY, this);
    }
  }
  bool load(const uint8_t *bytes, size_t size, RuntimeContext context, std::string *error = nullptr) {
    if (!component_ || component_->is_failed() || !component_->get_disp()) {
      if (error) *error = "LVGL display unavailable"; return false;
    }
    const bool loaded = session_.load(bytes, size, std::move(context),
        [this](const Manifest &model, std::string *why) { return mount(model, why); },
        [this](size_t screen) {
          lv_display_set_default(component_->get_disp());
          lv_screen_load(screens_[screen]);
          ESP_LOGI("simulator", "Screen changed: %u", static_cast<unsigned>(screen));
        }, [] {}, error);
    if (loaded) { update(0); component_->set_paused(false, false); sample_memory_now(); }
    return loaded;
  }
  void set_ha_connected(bool connected) { ha_connected_ = connected; }
  void update(uint32_t now) {
    if (!session_.loaded()) return;
    const uint32_t now_us = esphome::micros();
    ++counters_.update_calls;
    if (last_update_us_ != 0 && now_us - last_update_us_ > counters_.update_gap_us_max)
      counters_.update_gap_us_max = now_us - last_update_us_;
    last_update_us_ = now_us;
    const auto &model = session_.manifest();
    const bool state_changed = !polled_ || last_revision_ != session_.revision();
    polled_ = true;
    last_revision_ = session_.revision();
    for (auto &handle : handles_) {
      const auto &record = model.widgets[handle.index];
      if (!state_changed && !handle.loading && !handle.text_dirty) continue;
      const bool visible = (record.flags & 1) && model.condition_matches(record.condition);
      if (handle.visible != visible) {
        ++counters_.visibility_updates;
        handle.visible = visible;
        if (visible) lv_obj_remove_flag(handle.object, LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(handle.object, LV_OBJ_FLAG_HIDDEN);
      }
      if (handle.loading && static_cast<uint32_t>(now - handle.loading_start) >= 350) handle.loading = false;
      if (record.kind == WidgetKind::Text || record.kind == WidgetKind::Button) {
        const auto text = handle.loading ? std::string("...") : model.text_value(record);
        if (handle.text != text) {
          ++counters_.text_updates;
          handle.text = text;
          lv_label_set_text(handle.label, text.c_str());
        }
      }
      handle.text_dirty = false;
    }
  }
  const RuntimeSession &session() const { return session_; }
  const Counters &counters() const { return counters_; }

 private:
  struct Handle {
    LvglRuntime *owner = nullptr;
    size_t index = 0;
    lv_obj_t *object = nullptr;
    lv_obj_t *label = nullptr;
    bool visible = true;
    bool loading = false;
    bool text_dirty = false;
    uint32_t loading_start = 0;
    std::string text;
  };
  static lv_color_t color(const std::array<uint8_t, 3> &rgb) {
    return lv_color_make(rgb[0], rgb[1], rgb[2]);
  }
  static int click_extension(const Widget &record) {
    return std::max({0, (49 - record.w) / 2, (49 - record.h) / 2});
  }
  static void display_event(lv_event_t *event) {
    auto *runtime = static_cast<LvglRuntime *>(lv_event_get_user_data(event));
    switch (lv_event_get_code(event)) {
      case LV_EVENT_FLUSH_START: {
        runtime->flush_start_us_ = esphome::micros();
        ++runtime->counters_.flushes;
        auto *area = static_cast<const lv_area_t *>(lv_event_get_param(event));
        if (area != nullptr) runtime->counters_.flush_pixels += lv_area_get_size(area);
        break;
      }
      case LV_EVENT_FLUSH_FINISH:
        runtime->record_flush_(esphome::micros());
        break;
      case LV_EVENT_RENDER_START:
        runtime->render_start_us_ = esphome::micros();
        break;
      case LV_EVENT_RENDER_READY: {
        const uint32_t elapsed = esphome::micros() - runtime->render_start_us_;
        ++runtime->counters_.renders;
        runtime->counters_.render_us_last = elapsed;
        runtime->counters_.render_us_total += elapsed;
        if (elapsed > runtime->counters_.render_us_max) runtime->counters_.render_us_max = elapsed;
        break;
      }
      default:
        break;
    }
  }
  void record_flush_(uint32_t now) {
    const uint32_t elapsed = now - flush_start_us_;
    counters_.flush_us_last = elapsed;
    counters_.flush_us_total += elapsed;
    if (elapsed > counters_.flush_us_max) counters_.flush_us_max = elapsed;
    if (press_pending_us_ == 0) return;
    const uint32_t latency = now - press_pending_us_;
    press_pending_us_ = 0;
    if (latency > 1000000u) return;  // stale press with no visible frame
    counters_.action_latency_us_last = latency;
    counters_.action_latency_us_total += latency;
    if (latency > counters_.action_latency_us_max) counters_.action_latency_us_max = latency;
    ++counters_.action_samples;
  }
  static void pressed(lv_event_t *event) {
    static_cast<Handle *>(lv_event_get_user_data(event))->owner->note_press();
  }
  void note_press() {
    if (press_pending_us_ == 0) press_pending_us_ = esphome::micros();
  }
  void clear() {
    for (auto *screen : screens_) lv_obj_delete(screen);
    screens_.clear();
    handles_.clear();
  }
  static void clicked(lv_event_t *event) {
    auto *handle = static_cast<Handle *>(lv_event_get_user_data(event));
    auto &runtime = *handle->owner;
    const auto &model = runtime.session_.manifest();
    const auto action = model.widgets[handle->index].action;
    if (handle->loading || action == kNone8) return;
    const auto point = esphome::lvgl::LvglComponent::get_touch_relative_to_obj(handle->object);
    const auto &record = model.widgets[handle->index];
    const int extension = click_extension(record);
    // LVGL may retain the pressed object outside its bounds. Keep release and
    // drag cancellation independent of native topmost-object hit testing.
    if (point.x < -extension || point.y < -extension || point.x >= record.w + extension ||
        point.y >= record.h + extension) return;
    if (model.actions[action].kind == ActionKind::Service && !runtime.ha_connected_) return;
    handle->loading = true;
    handle->text_dirty = true;
    handle->loading_start = esphome::millis();
    runtime.session_.dispatch(action);
    runtime.update(handle->loading_start);
    ESP_LOGI("lvgl_runtime", "Action dispatched: %u", action);
  }
  bool mount(const Manifest &model, std::string *error) {
    clear();
    bool needs_icon_font = false;
    for (const auto &record : model.widgets)
      if (record.kind == WidgetKind::Icon) needs_icon_font = true;
    if (!fonts_[0] || !fonts_[1] || !fonts_[2] || (needs_icon_font && !icon_font_)) {
      if (error) *error = "LVGL font resource unavailable"; return false;
    }
    lv_display_set_default(component_->get_disp());
    auto fail = [&]() { clear(); if (error) *error = "LVGL object allocation failed"; return false; };
    for (const auto &record : model.screens) {
      auto *screen = lv_obj_create(nullptr);
      if (!screen) return fail();
      screens_.push_back(screen);
      lv_obj_remove_style_all(screen);
      lv_obj_set_style_bg_color(screen, color(record.background), 0);
      lv_obj_set_style_bg_opa(screen, LV_OPA_COVER, 0);
      lv_obj_remove_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
    }
    // Resize once before registering callbacks: user-data addresses stay stable.
    handles_.resize(model.widgets.size());
    for (size_t i = 0; i < model.widgets.size(); ++i) {
      const auto &record = model.widgets[i];
      auto &handle = handles_[i];
      handle.owner = this; handle.index = i;
      auto *parent = screens_[record.screen];
      handle.object = record.kind == WidgetKind::Button ? lv_button_create(parent) : lv_obj_create(parent);
      if (!handle.object) return fail();
      auto *object = handle.object;
      lv_obj_remove_style_all(object);
      lv_obj_set_pos(object, record.x, record.y);
      lv_obj_set_size(object, record.w, record.h);
      lv_obj_remove_flag(object, LV_OBJ_FLAG_SCROLLABLE);
      if (record.kind != WidgetKind::Button) lv_obj_remove_flag(object, LV_OBJ_FLAG_CLICKABLE);
      if (record.kind == WidgetKind::Rectangle || record.kind == WidgetKind::Button) {
        lv_obj_set_style_bg_color(object, color(record.background), 0);
        lv_obj_set_style_bg_opa(object, LV_OPA_COVER, 0);
      }
      if (record.kind == WidgetKind::Button) {
        const int radius = record.h < 40 ? 4 : record.h < 80 ? 6 : 9;
        lv_obj_set_style_radius(object, retro_ ? 0 : radius, 0);
        lv_obj_set_style_border_width(object, 1, 0);
        lv_obj_set_style_border_color(object, lv_color_hex(retro_ ? 0x00f0ff : 0x00e676), 0);
        lv_obj_set_style_bg_opa(object, LV_OPA_80, LV_STATE_PRESSED);
        lv_obj_set_style_opa(object, LV_OPA_50, LV_STATE_DISABLED);
        lv_obj_set_style_pad_all(object, 0, 0);
        lv_obj_set_ext_click_area(object, click_extension(record));
        lv_obj_add_event_cb(object, clicked, LV_EVENT_CLICKED, &handle);
        lv_obj_add_event_cb(object, pressed, LV_EVENT_PRESSED, &handle);
      }
      if (record.kind != WidgetKind::Rectangle) {
        handle.label = lv_label_create(object);
        if (!handle.label) return fail();
        lv_obj_remove_style_all(handle.label);
        lv_obj_remove_flag(handle.label, LV_OBJ_FLAG_CLICKABLE);
        const auto *font = record.kind == WidgetKind::Icon ? icon_font_ : fonts_[record.font_size];
        lv_obj_set_style_text_font(handle.label, font, 0);
        lv_obj_set_style_text_color(handle.label, color(record.foreground), 0);
        lv_obj_set_style_text_align(handle.label, record.kind == WidgetKind::Text ?
            (record.align == 2 ? LV_TEXT_ALIGN_RIGHT : record.align == 1 ? LV_TEXT_ALIGN_CENTER : LV_TEXT_ALIGN_LEFT) :
            LV_TEXT_ALIGN_CENTER, 0);
        lv_label_set_long_mode(handle.label, record.kind == WidgetKind::Icon ? LV_LABEL_LONG_MODE_CLIP : LV_LABEL_LONG_MODE_DOTS);
        lv_obj_set_size(handle.label, std::max(1, record.w - (record.kind == WidgetKind::Button ? 12 : 0)),
                        std::min<int>(record.h, lv_font_get_line_height(font)));
        lv_obj_align(handle.label, LV_ALIGN_CENTER, 0, 0);
        handle.text = model.text_value(record);
        lv_label_set_text(handle.label, handle.text.c_str());
      }
    }
    // Background rectangles paint before foreground objects regardless of the
    // manifest position. Handles remain indexed by their original records.
    for (size_t i = model.widgets.size(); i > 0; --i)
      if (model.widgets[i - 1].kind == WidgetKind::Rectangle)
        lv_obj_move_to_index(handles_[i - 1].object, 0);
    return true;
  }
  RuntimeSession session_;
  esphome::lvgl::LvglComponent *component_ = nullptr;
  std::array<const lv_font_t *, 3> fonts_{};
  const lv_font_t *icon_font_ = nullptr;
  std::vector<lv_obj_t *> screens_;
  std::vector<Handle> handles_;
  bool retro_ = false;
  bool ha_connected_ = false;
  Counters counters_;
  bool polled_ = false;
  uint32_t last_revision_ = 0;
  uint32_t flush_start_us_ = 0;
  uint32_t render_start_us_ = 0;
  uint32_t last_update_us_ = 0;
  uint32_t press_pending_us_ = 0;
};
}  // namespace vespui
