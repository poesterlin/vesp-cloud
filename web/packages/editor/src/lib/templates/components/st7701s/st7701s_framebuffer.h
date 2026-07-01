#pragma once

#include "esphome/components/st7701s/st7701s.h"

namespace esphome {
namespace st7701s {

// Patched ST7701S exposing the panel's framebuffer pointer so the
// screenshot debug feature can read pixels at runtime. The upstream
// component keeps `handle_` protected; this subclass lifts the access
// into a single public method and forwards through to the esp_lcd API.

class ST7701SWithFrameBuffer : public ST7701S {
 public:
  esphome::display::DisplayError get_frame_buffer(void **fb) {
    if (this->handle_ == nullptr) {
      return esphome::display::DISPLAY_FAILURE;
    }
    return esp_lcd_rgb_panel_get_frame_buffer(this->handle_, fb);
  }
};

}  // namespace st7701s
}  // namespace esphome
