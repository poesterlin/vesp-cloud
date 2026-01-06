#pragma once
#include "esphome.h"

class Button {
public:
  int x, y, w, h;

  Button(int x=0, int y=0, int w=0, int h=0) : x(x), y(y), w(w), h(h) {}

  bool isHit(int tx, int ty, int scrollOffset = 0) {
    int actualY = y + scrollOffset;
    return (tx >= x && tx <= x + w && ty >= actualY && ty <= actualY + h);
  }

  bool processTap(int tx, int ty, bool& loading, unsigned long& loadingStartTime, bool& actionRequested, int scrollOffset = 0) {
    if (isHit(tx, ty, scrollOffset) && !loading) {
      loading = true;
      actionRequested = true;
      loadingStartTime = millis();
      return true;
    }
    return false;
  }

  void draw(
    display::Display& it,
    const std::string& label,
    Color color,
    bool& loading,
    unsigned long& loadingStartTime,
    unsigned long timeout,
    esphome::font::Font* font,
    int scrollOffset = 0
  ) {
    int drawY = y + scrollOffset;

    // Handle timeout internally
    if (loading && (millis() - loadingStartTime > timeout)) {
      loading = false;
    }

    // Glow effect (outer rectangle) - using a dimmed version of the color
    Color glowColor = Color(color.r / 4, color.g / 4, color.b / 4);
    it.rectangle(x - 2, drawY - 2, w + 4, h + 4, glowColor);
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
      // Retro font style
      it.printf(x + w / 2, drawY + h / 2, font, color, TextAlign::CENTER, "%s", label.c_str());
      
      // Decorative corners
      it.line(x, drawY, x + 10, drawY, color);
      it.line(x, drawY, x, drawY + 10, color);
      it.line(x + w, drawY, x + w - 10, drawY, color);
      it.line(x + w, drawY, x + w, drawY + 10, color);
      it.line(x, drawY + h, x + 10, drawY + h, color);
      it.line(x, drawY + h, x, drawY + h - 10, color);
      it.line(x + w, drawY + h, x + w - 10, drawY + h, color);
      it.line(x + w, drawY + h, x + w, drawY + h - 10, color);
    }
  }
};
