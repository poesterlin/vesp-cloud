#pragma once

#include "ui_runtime_session.h"
#include "esphome/components/lvgl/lvgl_esphome.h"
#include <array>

namespace vespui {

// Experimental v2 backend. ESPHome owns the display, input and refresh timer.
class LvglRuntime {
 public:
  void configure(esphome::lvgl::LvglComponent *component,
                 std::array<const lv_font_t *, 3> text_fonts,
                 const lv_font_t *icon_font, bool retro) {
    component_ = component; fonts_ = text_fonts; icon_font_ = icon_font; retro_ = retro;
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
    for (auto &handle : handles_) {
      const auto &record = model.widgets[handle.index];
      const bool visible = (record.flags & 1) && model.condition_matches(record.condition);
      if (handle.visible != visible) {
        handle.visible = visible;
        if (visible) lv_obj_remove_flag(handle.object, LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(handle.object, LV_OBJ_FLAG_HIDDEN);
      }
      if (handle.loading && static_cast<uint32_t>(now - handle.loading_start) >= 350) handle.loading = false;
      if (record.kind == WidgetKind::Text || record.kind == WidgetKind::Button) {
        const auto text = handle.loading ? std::string("...") : model.text_value(record);
        if (handle.text != text) {
          handle.text = text;
          lv_label_set_text(handle.label, text.c_str());
        }
      }
    }
  }
  const RuntimeSession &session() const { return session_; }

 private:
  struct Handle {
    LvglRuntime *owner = nullptr;
    size_t index = 0;
    lv_obj_t *object = nullptr;
    lv_obj_t *label = nullptr;
    bool visible = true;
    bool loading = false;
    uint32_t loading_start = 0;
    std::string text;
  };
  static lv_color_t color(const std::array<uint8_t, 3> &rgb) {
    return lv_color_make(rgb[0], rgb[1], rgb[2]);
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
    if (model.actions[action].kind == ActionKind::Service && !runtime.ha_connected_) return;
    handle->loading = true;
    handle->loading_start = esphome::millis();
    runtime.session_.dispatch(action);
    runtime.update(handle->loading_start);
    ESP_LOGI("lvgl_runtime", "Action dispatched: %u", action);
  }
  bool mount(const Manifest &model, std::string *error) {
    clear();
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
      if (record.kind != WidgetKind::Rectangle) {
        handle.label = lv_label_create(object);
        if (!handle.label) return fail();
        lv_obj_remove_style_all(handle.label);
        lv_obj_remove_flag(handle.label, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_style_text_font(handle.label, record.kind == WidgetKind::Icon ? icon_font_ : fonts_[record.font_size], 0);
        lv_obj_set_style_text_color(handle.label, color(record.foreground), 0);
        handle.text = model.text_value(record);
        lv_label_set_text(handle.label, handle.text.c_str());
        if (record.kind == WidgetKind::Button || record.kind == WidgetKind::Icon) lv_obj_center(handle.label);
        else {
          lv_obj_set_width(handle.label, record.w);
          lv_label_set_long_mode(handle.label, LV_LABEL_LONG_CLIP);
          lv_obj_set_style_text_align(handle.label, record.align == 2 ? LV_TEXT_ALIGN_RIGHT :
              record.align == 1 ? LV_TEXT_ALIGN_CENTER : LV_TEXT_ALIGN_LEFT, 0);
        }
      }
      if (record.kind == WidgetKind::Button) {
        lv_obj_set_style_radius(object, retro_ ? 0 : 8, 0);
        lv_obj_set_style_bg_color(object, lv_color_darken(color(record.background), LV_OPA_20), LV_STATE_PRESSED);
        lv_obj_add_event_cb(object, clicked, LV_EVENT_CLICKED, &handle);
      }
    }
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
};
}  // namespace vespui
