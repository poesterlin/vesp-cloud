#pragma once
#include "esphome.h"
#include "colors.h"

namespace esphome {
  namespace font {
    class Font;
  }
}
extern esphome::font::Font* font_tiny;

class Button {
public:
  int x, y, w, h;

  Button(int x=0, int y=0, int w=0, int h=0) : x(x), y(y), w(w), h(h) {}

  bool isHit(int tx, int ty, int scrollOffset = 0) {
    int actualY = y + scrollOffset;
    // Add "hit slop" for small buttons to make them easier to touch
    int sx = (w < 40) ? 15 : (w < 60 ? 10 : 0);
    int sy = (h < 40) ? 15 : (h < 60 ? 10 : 0);
    return (tx >= x - sx && tx <= x + w + sx && ty >= actualY - sy && ty <= actualY + h + sy);
  }

  bool processTap(int tx, int ty, volatile bool& loading, unsigned long& loadingStartTime, volatile bool& actionRequested, int scrollOffset = 0) {
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
    volatile bool& loading,
    unsigned long& loadingStartTime,
    unsigned long timeout,
    esphome::font::Font* font,
    int scrollOffset = 0,
    const char* header = nullptr
  ) {
    int drawY = y + scrollOffset;

    // Handle timeout internally
    if (loading && (millis() - loadingStartTime > timeout)) {
      loading = false;
    }

    // 1. Parallax / Shadow Border (Offset by 3px)
    Color shadowColor = Color(20, 20, 20);
    it.rectangle(x + 3, drawY + 3, w, h, shadowColor);

    // 2. Main Pronounced Border
    it.rectangle(x, drawY, w, h, Color(40, 40, 40)); // Dark base
    it.rectangle(x - 1, drawY - 1, w + 2, h + 2, color); // Primary highlight border
    
    // Header Label (if provided)
    if (header) {
      it.printf(x + 12, drawY - 7, font_tiny, color, TextAlign::TOP_LEFT, " %s ", header);
    }

    if (loading) {
      float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
      int cx = x + w / 2;
      int cy = drawY + h / 2;
      int r = 10;
      it.line(cx, cy, cx + (int)(cosf(angle) * r), cy + (int)(sinf(angle) * r), color);
    } else {
      if (!label.empty()) {
        it.printf(x + w / 2, drawY + h / 2, font, color, TextAlign::CENTER, "%s", label.c_str());
      }
      
      // 3. Bright Corner Accents (Interactive indicator)
      int s = 8;
      it.line(x - 1, drawY - 1, x + s, drawY - 1, C_WHITE);
      it.line(x - 1, drawY - 1, x - 1, drawY + s, C_WHITE);
      it.line(x + w + 1, drawY + h + 1, x + w + 1 - s, drawY + h + 1, C_WHITE);
      it.line(x + w + 1, drawY + h + 1, x + w + 1, drawY + h + 1 - s, C_WHITE);
    }
  }
};
