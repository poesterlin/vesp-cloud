#pragma once
#include "esphome.h"

class ScrollingText {
public:
  static void draw(
    display::Display& it,
    int x, int y, int maxWidth,
    const std::string& text,
    font::Font* font,
    Color color,
    TextAlign align = TextAlign::TOP_LEFT
  ) {
    if (text.empty()) return;

    int x1, y1, width, height;
    // Measure the text width
    it.get_text_bounds(x, y, text.c_str(), font, align, &x1, &y1, &width, &height);

    // If it fits, just draw it normally
    if (width <= maxWidth) {
      it.printf(x, y, font, color, align, "%s", text.c_str());
      return;
    }

    // Parameters for scrolling behavior
    const uint32_t pauseTimeMs = 2000;
    const int pixelsPerSecond = 40;
    
    int scrollRange = width - maxWidth + 15; // Extra padding at the end
    int scrollTimeMs = (scrollRange * 1000) / pixelsPerSecond;
    int totalCycleTimeMs = scrollTimeMs + (pauseTimeMs * 2);
    
    uint32_t now = millis();
    int cyclePos = now % totalCycleTimeMs;
    
    int currentOffset = 0;
    if (cyclePos < (int)pauseTimeMs) {
      currentOffset = 0;
    } else if (cyclePos < (int)(pauseTimeMs + scrollTimeMs)) {
      currentOffset = (cyclePos - (int)pauseTimeMs) * pixelsPerSecond / 1000;
    } else {
      currentOffset = scrollRange;
    }

    // Clip the drawing area to the maxWidth
    // Note: start_clipping takes (x1, y1, x2, y2)
    it.start_clipping(x, y, x + maxWidth, y + height + 5);
    it.printf(x - currentOffset, y, font, color, align, "%s", text.c_str());
    it.end_clipping();
  }
};
