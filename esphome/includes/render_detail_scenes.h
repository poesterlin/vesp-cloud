#pragma once
#include "esphome.h"
#include "state_manager.h"
#include "render_helpers.h"

void renderDetail_Scenes(display::Display& it) {
  drawDetailHeader(it, "SCENES");
  
  auto getSY = [&](int logicalY) { return logicalY + gState.scrollY; };
  
  int ly = 60; // Start below header

  // Scene Buttons
  gState.sceneAllOffBtn.y = getSY(ly);
  gState.sceneAllOffBtn.draw(it, "ALL OFF", C_RED, gState.sceneAllOffLoading, gState.sceneAllOffStartTime, 1000, font_small, gState.scrollY);
  
  ly += 60;
  gState.sceneCozyBtn.y = getSY(ly);
  gState.sceneCozyBtn.draw(it, "COZY", C_AMBER, gState.sceneCozyLoading, gState.sceneCozyStartTime, 1000, font_small, gState.scrollY);

  ly += 60;
  gState.sceneBeamerBtn.y = getSY(ly);
  gState.sceneBeamerBtn.draw(it, "COZY BEAMER", C_BLUE, gState.sceneBeamerLoading, gState.sceneBeamerStartTime, 1000, font_small, gState.scrollY);
  
  ly += 60;
  gState.sceneDayBtn.y = getSY(ly);
  gState.sceneDayBtn.draw(it, "DAYLIGHT", C_WHITE, gState.sceneDayLoading, gState.sceneDayStartTime, 1000, font_small, gState.scrollY);

  // Set max scroll
  int totalContentHeight = ly + 60;
  gState.maxScrollY = totalContentHeight > 280 ? (totalContentHeight - 280) : 0;
}
