#pragma once
#include "esphome.h"
#include "esphome/components/lvgl/lvgl_esphome.h"

// Integration probe: all visible widgets are constructed at runtime.
inline void mount_lvgl_probe(esphome::lvgl::LvglComponent *component) {
  if (component->is_failed() || component->get_disp() == nullptr) {
    ESP_LOGE("lvgl_probe", "LVGL display initialization failed");
    return;
  }
  auto *screen = component->get_screen_active();
  lv_obj_set_style_bg_color(screen, lv_color_hex(0x121820), 0);
  lv_obj_set_style_pad_all(screen, 0, 0);
  lv_obj_remove_flag(screen, LV_OBJ_FLAG_SCROLLABLE);
  auto *label = lv_label_create(screen);
  lv_label_set_text(label, "Modern LVGL runtime probe");
  lv_obj_set_pos(label, 24, 40);
  lv_obj_set_style_text_color(label, lv_color_hex(0xf0f6fc), 0);
  auto *button = lv_button_create(screen);
  lv_obj_set_pos(button, 24, 120);
  lv_obj_set_size(button, 432, 80);
  lv_obj_set_style_radius(button, 12, 0);
  lv_obj_set_style_bg_color(button, lv_color_hex(0x246080), 0);
  auto *caption = lv_label_create(button);
  lv_label_set_text(caption, "Tap to verify runtime events");
  lv_obj_center(caption);
  lv_obj_add_event_cb(button, [](lv_event_t *event) {
    auto *caption = static_cast<lv_obj_t *>(lv_event_get_user_data(event));
    lv_label_set_text(caption, "Runtime event received");
    lv_obj_center(caption);
    ESP_LOGI("lvgl_probe", "runtime button clicked");
  }, LV_EVENT_CLICKED, caption);
  // No slider appears in YAML: compilation proves LV_USE_SLIDER enablement.
  auto *slider = lv_slider_create(screen);
  lv_obj_set_pos(slider, 40, 260);
  lv_obj_set_size(slider, 400, 24);
  lv_slider_set_value(slider, 40, LV_ANIM_OFF);
  component->set_paused(false, false);
  ESP_LOGI("lvgl_probe", "runtime objects mounted; LVGL %d.%d.%d", LVGL_VERSION_MAJOR, LVGL_VERSION_MINOR, LVGL_VERSION_PATCH);
}
