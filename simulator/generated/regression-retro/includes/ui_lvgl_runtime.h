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
          update_text(handle, text);
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
    lv_point_t press_start{};
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
    const auto point = esphome::lvgl::LvglComponent::get_touch_relative_to_obj(handle->object);
    const auto &record = model.widgets[handle->index];
    const int sx = std::max({0, (49 - record.w) / 2, (49 - record.h) / 2}), sy = sx;
    if (point.x < -sx || point.y < -sy || point.x >= record.w + sx || point.y >= record.h + sy ||
        std::abs(point.x - handle->press_start.x) >= 20 || std::abs(point.y - handle->press_start.y) >= 20) return;
    if (model.actions[action].kind == ActionKind::Service && !runtime.ha_connected_) return;
    handle->loading = true;
    handle->text_dirty = true;
    handle->loading_start = esphome::millis();
    runtime.session_.dispatch(action);
    runtime.update(handle->loading_start);
    ESP_LOGI("lvgl_runtime", "Action dispatched: %u", action);
  }
  static void pressed(lv_event_t *event) {
    auto *handle = static_cast<Handle *>(lv_event_get_user_data(event));
    handle->press_start = esphome::lvgl::LvglComponent::get_touch_relative_to_obj(handle->object);
  }
  static void hit_test(lv_event_t *event) {
    auto *handle = static_cast<Handle *>(lv_event_get_user_data(event));
    auto *info = static_cast<lv_hit_test_info_t *>(lv_event_get_param(event));
    const auto &model = handle->owner->session_.manifest();
    const auto &record = model.widgets[handle->index];
    const auto hits = [&](const Widget &candidate) {
      const int sx = std::max(0, (48 - candidate.w) / 2), sy = std::max(0, (48 - candidate.h) / 2);
      return info->point.x >= candidate.x - sx && info->point.x < candidate.x + candidate.w + sx &&
             info->point.y >= candidate.y - sy && info->point.y < candidate.y + candidate.h + sy;
    };
    info->res = hits(record);
    // Native LVGL searches topmost siblings first; custom screens dispatch in
    // manifest order. Give earlier eligible buttons the shared overlap region.
    for (size_t i = 0; info->res && i < handle->index; ++i) {
      const auto &earlier = model.widgets[i];
      if (earlier.screen != record.screen || earlier.kind != WidgetKind::Button ||
          !handle->owner->handles_[i].visible || handle->owner->handles_[i].loading) continue;
      if (earlier.action != kNone8 && model.actions[earlier.action].kind == ActionKind::Service &&
          !handle->owner->ha_connected_) continue;
      if (hits(earlier)) info->res = false;
    }
  }
  void update_text(Handle &handle, const std::string &text) {
    const auto &record = session_.manifest().widgets[handle.index];
    const auto *font = record.kind == WidgetKind::Icon ? icon_font_ : fonts_[record.font_size];
    auto *source_font = static_cast<esphome::font::Font *>(font->dsc);
    int width, offset, baseline, height;
    auto measure = [&](const std::string &value) {
      source_font->measure(value.c_str(), &width, &offset, &baseline, &height);
      return width;
    };
    const int budget = record.kind == WidgetKind::Button ? std::max(0, record.w - 12) :
        record.kind == WidgetKind::Text && record.w > 4 ? record.w - 4 : record.w;
    std::string display = text;
    bool truncated = record.kind != WidgetKind::Icon && !handle.loading && measure(display) > budget;
    if (truncated) {
      // Binary-search UTF-8 boundaries instead of repeatedly removing bytes and
      // remeasuring the entire string. This runs only after visible text changes.
      std::vector<size_t> ends{0};
      for (size_t i = 1; i <= text.size(); ++i)
        if (i == text.size() || (static_cast<uint8_t>(text[i]) & 0xc0) != 0x80) ends.push_back(i);
      size_t low = 0, high = ends.size() - 1;
      const int text_budget = std::max(0, budget - 10);
      while (low < high) {
        const size_t mid = (low + high + 1) / 2;
        if (measure(text.substr(0, ends[mid])) <= text_budget) low = mid; else high = mid - 1;
      }
      display = text.substr(0, ends[low]);
    }
    measure(display);
    const int alignment = record.kind == WidgetKind::Text ? record.align : 1;
    const int extra = truncated ? 10 : 0;
    const int x = alignment == 2 ? record.w - width - offset - extra :
        alignment == 1 ? record.w / 2 - (width + offset) / 2 - extra / 2 : 0;
    const int y = record.h / 2 - height / 2;
    lv_label_set_text(handle.label, display.c_str());
    lv_obj_set_pos(handle.label, x, y);
    if (handle.dots) {
      if (truncated && !display.empty()) {
        lv_obj_set_pos(handle.dots, x + width + 2, y + baseline - 4);
        lv_obj_remove_flag(handle.dots, LV_OBJ_FLAG_HIDDEN);
      } else lv_obj_add_flag(handle.dots, LV_OBJ_FLAG_HIDDEN);
    }
  }
  static void decorations(lv_event_t *event) {
    auto *handle = static_cast<Handle *>(lv_event_get_user_data(event));
    auto *runtime = handle->owner;
    lv_area_t area;
    lv_obj_get_coords(handle->object, &area);
    const int w = lv_area_get_width(&area), h = lv_area_get_height(&area);
    const int c = h < 40 ? 4 : h < 80 ? 6 : 9;
    auto *layer = lv_event_get_layer(event);
    const auto accent = runtime->retro_ ? lv_color_hex(0x00f0ff) : lv_color_hex(0x00e676);
    auto rect = [&](int x, int y, int width, int height, lv_color_t color) {
      if (width <= 0 || height <= 0) return;
      lv_draw_rect_dsc_t desc;
      lv_draw_rect_dsc_init(&desc); desc.bg_color = color;
      const lv_area_t target{area.x1 + x, area.y1 + y, area.x1 + x + width - 1, area.y1 + y + height - 1};
      lv_draw_rect(layer, &desc, &target);
    };
    if (runtime->retro_) {
      auto line = [&](int x1, int y1, int x2, int y2) {
        lv_draw_line_dsc_t desc; lv_draw_line_dsc_init(&desc);
        desc.color = accent; desc.width = 1;
        desc.p1 = {static_cast<lv_value_precise_t>(area.x1 + x1), static_cast<lv_value_precise_t>(area.y1 + y1)};
        desc.p2 = {static_cast<lv_value_precise_t>(area.x1 + x2), static_cast<lv_value_precise_t>(area.y1 + y2)};
        lv_draw_line(layer, &desc);
      };
      line(c, 0, w - c - 1, 0); line(w - c - 1, 0, w - 1, c);
      line(w - 1, c, w - 1, h - c - 1); line(w - 1, h - c - 1, w - c - 1, h - 1);
      line(w - c - 1, h - 1, c, h - 1); line(c, h - 1, 0, h - c - 1);
      line(0, h - c - 1, 0, c); line(0, c, c, 0);
      if (w >= 56 && h >= 30) {
        const auto rail = lv_color_hex(0x00787f);
        rect(c + 5, 3, w - 2 * c - 16, 1, rail);
        rect(w - c - 8, 2, 3, 3, accent);
        for (int i = 0; i < 3; ++i) rect(c + 5 + i * 6, h - 4, i == 0 ? 8 : 3, 1, i == 0 ? accent : rail);
      }
    } else if (w >= 44 && h >= 28) {
      rect(c + 3, 2, std::max(1, w - 2 * c - 6), 1, lv_color_hex(0x1c683c));
      rect(w / 2 - 9, h - 3, 18, 2, accent);
    }
  }
  bool mount(const Manifest &model, std::string *error) {
    clear();
    if (!fonts_[0] || !fonts_[1] || !fonts_[2] || !icon_font_) {
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
      if (record.kind != WidgetKind::Rectangle) {
        handle.label = lv_label_create(object);
        if (!handle.label) return fail();
        lv_obj_remove_style_all(handle.label);
        lv_obj_remove_flag(handle.label, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_style_text_font(handle.label, record.kind == WidgetKind::Icon ? icon_font_ : fonts_[record.font_size], 0);
        lv_obj_set_style_text_color(handle.label, color(record.foreground), 0);
        lv_label_set_long_mode(handle.label, LV_LABEL_LONG_CLIP);
        if (record.kind != WidgetKind::Icon) {
          handle.dots = lv_obj_create(object);
          if (!handle.dots) return fail();
          lv_obj_remove_style_all(handle.dots);
          lv_obj_set_size(handle.dots, 8, 2);
          lv_obj_remove_flag(handle.dots, LV_OBJ_FLAG_CLICKABLE);
          lv_obj_remove_flag(handle.dots, LV_OBJ_FLAG_SCROLLABLE);
          lv_obj_add_flag(handle.dots, LV_OBJ_FLAG_HIDDEN);
          for (int d = 0; d < 3; ++d) {
            auto *dot = lv_obj_create(handle.dots);
            if (!dot) return fail();
            lv_obj_remove_style_all(dot);
            lv_obj_remove_flag(dot, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_remove_flag(dot, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_set_pos(dot, d * 3, 0); lv_obj_set_size(dot, 2, 2);
            lv_obj_set_style_bg_opa(dot, LV_OPA_COVER, 0);
            lv_obj_set_style_bg_color(dot, color(record.foreground), 0);
          }
        }
        handle.text = model.text_value(record);
        update_text(handle, handle.text);
      }
      if (record.kind == WidgetKind::Button) {
        const int radius = record.h < 40 ? 4 : record.h < 80 ? 6 : 9;
        lv_obj_set_style_radius(object, retro_ ? 0 : radius, 0);
        if (!retro_) {
          lv_obj_set_style_border_width(object, 1, 0);
          lv_obj_set_style_border_color(object, lv_color_hex(0x00e676), 0);
        }
        lv_obj_set_ext_click_area(object, std::max({0, (48 - record.w) / 2, (48 - record.h) / 2}));
        lv_obj_add_flag(object, LV_OBJ_FLAG_ADV_HITTEST);
        lv_obj_add_event_cb(object, hit_test, LV_EVENT_HIT_TEST, &handle);
        lv_obj_add_event_cb(object, pressed, LV_EVENT_PRESSED, &handle);
        lv_obj_add_event_cb(object, decorations, LV_EVENT_DRAW_MAIN, &handle);
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
  Counters counters_;
  bool polled_ = false;
  uint32_t last_revision_ = 0;
};
}  // namespace vespui
