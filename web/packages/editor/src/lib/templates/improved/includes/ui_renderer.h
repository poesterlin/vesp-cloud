#pragma once

#include "esphome.h"
#include "ui_app.h"
#include "ui_invalidation.h"
#include "ui_redraw.h"

inline void ui_fast_filled_rectangle(display::Display &it, int x, int y, int w, int h, Color color) {
  if (w <= 0 || h <= 0) {
    return;
  }

  uint16_t pixel = display::ColorUtil::color_to_565(color);
  pixel = (pixel >> 8) | (pixel << 8);

  uint16_t line[480];
  const int line_w = (w > 480) ? 480 : w;
  for (int i = 0; i < line_w; i++) {
    line[i] = pixel;
  }

  for (int current_y = y; current_y < y + h; current_y++) {
    it.draw_pixels_at(x, current_y, line_w, 1, reinterpret_cast<const uint8_t *>(line), display::COLOR_ORDER_RGB, display::COLOR_BITNESS_565,
                      true, 0, 0, 0);
  }
}

inline void ui_fast_fill(display::Display &it, Color color) { ui_fast_filled_rectangle(it, 0, 0, it.get_width(), it.get_height(), color); }

inline void render_basic_ui(display::Display &it) {
  const uint32_t now = millis();
  g_ui_app.update(now);

  if (!UiInvalidation::needs_redraw()) {
    return;
  }

  UiRedraw::begin_draw();
  g_ui_app.draw(it, now);
  UiRedraw::end_draw();
}
