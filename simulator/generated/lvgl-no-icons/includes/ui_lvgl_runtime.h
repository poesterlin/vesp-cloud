#pragma once

#include "ui_runtime_session.h"
#include "esphome/components/lvgl/lvgl_esphome.h"
#include <array>
#include <algorithm>

namespace vespui {

// Experimental v2 backend. ESPHome owns the display, input and refresh timer.
class LvglRuntime {
 public:
  struct Counters { uint32_t text_updates = 0, visibility_updates = 0, flushes = 0; };
  void configure(esphome::lvgl::LvglComponent *component,
                 std::array<const lv_font_t *, 3> text_fonts,
                 const lv_font_t *icon_font, bool retro) {
    component_ = component; fonts_ = text_fonts; icon_font_ = icon_font; retro_ = retro;
    if (component_ && component_->get_disp()) lv_display_add_event_cb(component_->get_disp(), [](lv_event_t *event) {
      ++static_cast<LvglRuntime *>(lv_event_get_user_data(event))->counters_.flushes;
    }, LV_EVENT_FLUSH_START, this);
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
    if (loaded) { update(0); component_->set_paused(false, false); }
    return loaded;
  }
  void set_ha_connected(bool connected) { ha_connected_ = connected; }
  void update(uint32_t now) {
    if (!session_.loaded()) return;
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
};
}  // namespace vespui
