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

    // 1. Parallax / Shadow Border (Offset by 3px)
    Color shadowColor = Color(20, 20, 20);
    it.rectangle(x + 3, drawY + 3, w, h, shadowColor);

    // 2. Main Pronounced Border
    it.rectangle(x, drawY, w, h, Color(40, 40, 40)); // Dark base
    it.rectangle(x - 1, drawY - 1, w + 2, h + 2, color); // Primary highlight border
    
    if (loading) {
      float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
      int cx = x + w / 2;
      int cy = drawY + h / 2;
      int r = 10;
      it.line(cx, cy, cx + (int)(cosf(angle) * r), cy + (int)(sinf(angle) * r), color);
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
      
      // 3. Bright Corner Accents
      int s = 6;
      it.line(x - 1, drawY - 1, x + s, drawY - 1, is_on ? C_WHITE : color);
      it.line(x - 1, drawY - 1, x - 1, drawY + s, is_on ? C_WHITE : color);
      it.line(x + w + 1, drawY + h + 1, x + w + 1 - s, drawY + h + 1, is_on ? C_WHITE : color);
      it.line(x + w + 1, drawY + h + 1, x + w + 1, drawY + h + 1 - s, is_on ? C_WHITE : color);
    }
  }
};