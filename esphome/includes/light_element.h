#pragma once
#include "button.h"

// Forward declare colors from display_renderer.h if possible, or just define them
// Since we can't easily include display_renderer.h here without circular dependencies,
// we'll use the literal values or ensure they are passed.
// Actually, C_AMBER and C_DIM are in display_renderer.h which includes state_manager.h.
// light_element.h is included by state_manager.h.
// So let's just define them locally if not available, or use literal values.

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
    Color activeColor = is_on ? Color(255, 180, 0) : Color(80, 80, 80); 
    Button::draw(it, label, activeColor, loading, loadingStartTime, 2000, font, scrollOffset);
  }
};
