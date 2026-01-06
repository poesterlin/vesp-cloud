#pragma once
#include "button.h"
#include <cmath>

class LightElement : public Button {
public:
  LightElement(int x=0, int y=0, int w=0, int h=0) : Button(x, y, w, h) {}

  void draw(
    display::Display& it,
    const std::string& label,
    bool is_on,
    volatile bool& loading,
    unsigned long& loadingStartTime,
    esphome::font::Font* font,
    int scrollOffset = 0
  ) {
    int drawY = y + scrollOffset;
    Color color = is_on ? Color(255, 180, 0) : Color(80, 80, 80); 

    if (loading && (millis() - loadingStartTime > 2000)) {
      loading = false;
    }

    // Glow effect (outer rectangle) - using a dimmed version of the color
    Color glowColor = Color(color.r / 4, color.g / 4, color.b / 4);
    it.rectangle(x - 1, drawY - 1, w + 2, h + 2, glowColor);
    it.rectangle(x, drawY, w, h, color);
    
    if (loading) {
      // Spinner animation based on millis
      float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
      int cx = x + w / 2;
      int cy = drawY + h / 2;
      int r = 10;
      it.line(cx, cy, cx + (int)(cosf(angle) * r), cy + (int)(sinf(angle) * r), color);
      it.circle(cx, cy, r, Color(40, 40, 40)); 
    } else {
      // Draw Bulb Icon inside on the left
      int bx = x + 18;
      int by = drawY + h / 2;
      
      it.circle(bx, by, 8, color);
      if (is_on) {
        it.filled_circle(bx, by, 5, color);
        for (int i = 0; i < 8; i++) {
          float a = i * 3.14159265f / 4.0f;
          it.line(bx + (int)(cosf(a)*10), by + (int)(sinf(a)*10), bx + (int)(cosf(a)*13), by + (int)(sinf(a)*13), color);
        }
      }

      // Label on the right
      it.printf(x + 35, drawY + h / 2, font, color, TextAlign::CENTER_LEFT, "%s", label.c_str());
      
      // Decorative corners
      it.line(x, drawY, x + 5, drawY, color);
      it.line(x, drawY, x, drawY + 5, color);
      it.line(x + w, drawY + h, x + w - 5, drawY + h, color);
      it.line(x + w, drawY + h, x + w, drawY + h - 5, color);
    }
  }
};