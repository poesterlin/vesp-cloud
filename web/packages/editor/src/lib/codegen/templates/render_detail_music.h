#pragma once
#include "esphome.h"
#include "state_manager.h"
#include "render_helpers.h"

void renderDetail_Music(display::Display& it) {
  drawDetailHeader(it, "Music");
  
  // Placeholder content for music detail view
  it.printf(10, 60, id(font_medium), Theme::FOREGROUND, TextAlign::TOP_LEFT, "Music Player");
  it.printf(10, 80, id(font_small), Theme::FOREGROUND_MUTED, TextAlign::TOP_LEFT, "Not implemented yet");
}