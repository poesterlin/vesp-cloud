#pragma once
#include "esphome.h"

class Button {
public:
  static void draw(
    display::Display& it,
    int x, int y, int w, int h,
    const std::string& label,
    Color color,
    bool& loading,
    unsigned long& loadingStartTime,
    unsigned long timeout,
    esphome::font::Font* font
  ) {
    // Handle timeout internally
    if (loading && (millis() - loadingStartTime > timeout)) {
      loading = false;
    }

    // Glow effect (outer rectangle) - using a dimmed version of the color
    Color glowColor = Color(color.r / 4, color.g / 4, color.b / 4);
    it.rectangle(x - 2, y - 2, w + 4, h + 4, glowColor);
    it.rectangle(x, y, w, h, color);
    
    if (loading) {
      // Spinner animation based on millis
      float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
      int cx = x + w / 2;
      int cy = y + h / 2;
      int r = 10;
      it.line(cx, cy, cx + (int)(cosf(angle) * r), cy + (int)(sinf(angle) * r), color);
      it.circle(cx, cy, r, Color(40, 40, 40)); 
    } else {
      // Retro font style
      it.printf(x + w / 2, y + h / 2, font, color, TextAlign::CENTER, "%s", label.c_str());
      
      // Decorative corners
      it.line(x, y, x + 10, y, color);
      it.line(x, y, x, y + 10, color);
      it.line(x + w, y, x + w - 10, y, color);
      it.line(x + w, y, x + w, y + 10, color);
      it.line(x, y + h, x + 10, y + h, color);
      it.line(x, y + h, x, y + h - 10, color);
      it.line(x + w, y + h, x + w - 10, y + h, color);
      it.line(x + w, y + h, x + w, y + h - 10, color);
    }
  }
};
