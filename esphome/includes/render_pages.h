#pragma once
#include "esphome.h"
#include "state_manager.h"
#include "render_helpers.h"
#include "scrolling_text.h"

void renderPage0_Status(display::Display& it) {
  gState.climateDetailBtn.draw(it, "", C_CYAN, gState.climateDetailLoading, gState.climateDetailLoadingStartTime, 0, font_tiny, 0, nullptr);
  
  auto drawMetric = [&](int x, float val, const char* unit, Color c) {
    if (val != 0)
      it.printf(x, 53, font_small, c, TextAlign::CENTER, "%.0f%s", val, unit);
    else
      it.printf(x, 53, font_small, C_DIMMER, TextAlign::CENTER, "--");
  };

  drawMetric(45, gState.outsideTemp, "C", C_CYAN);
  drawMetric(95, gState.avgTemp, "C", C_AMBER);
  drawMetric(145, gState.avgHumidity, "%", C_DIM);
  
  Color co2_color = gState.co2 < 800 ? C_GREEN : (gState.co2 < 1200 ? C_AMBER : C_RED);
  drawMetric(195, gState.co2, "", co2_color);

  int open_count = gState.getOpenWindowCount();
  if (open_count > 0) {
    it.printf(120, 80, font_tiny, C_RED, TextAlign::CENTER, "!! %d WINDOWS OPEN !!", open_count);
  }

  gState.todoDetailBtn.draw(it, "", C_AMBER, gState.todoDetailLoading, gState.todoDetailLoadingStartTime, 0, font_tiny, 0, nullptr);
  
  auto drawPreviewItems = [&](int startY) {
    int ty = startY;
    int count = 0;
    
    auto drawFromList = [&](std::string listStr, Color checkColor) {
      size_t pos = 0;
      while (((pos = listStr.find("\n")) != std::string::npos || !listStr.empty()) && count < 3) {
        std::string line;
        if (pos != std::string::npos) {
          line = listStr.substr(0, pos);
          listStr.erase(0, pos + 1);
        } else {
          line = listStr;
          listStr.clear();
        }

        size_t first = line.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) continue;
        size_t last = line.find_last_not_of(" \t\r\n");
        line = line.substr(first, (last - first + 1));

        if (line.empty() || line == "LIST EMPTY") continue;

        size_t p1 = line.find("|");
        std::string summary = line;
        std::string due = "";
        bool overdue = false;
        if (p1 != std::string::npos) {
            summary = line.substr(0, p1);
            std::string rest = line.substr(p1 + 1);
            size_t p2 = rest.find("|");
            if (p2 != std::string::npos) {
                due = rest.substr(0, p2);
                std::string ovrStr = rest.substr(p2 + 1);
                overdue = (ovrStr.find("overdue") != std::string::npos);
            } else {
                due = rest;
            }
        }

        auto trimS = [](std::string& s) {
            size_t f = s.find_first_not_of(" \t\r\n");
            if (f == std::string::npos) { s = ""; return; }
            size_t l = s.find_last_not_of(" \t\r\n");
            s = s.substr(f, (l - f + 1));
        };
        trimS(summary);
        trimS(due);
        if (summary.empty()) continue;

        it.printf(25, ty, font_small, checkColor, TextAlign::TOP_LEFT, "[ ]");

        int textX = 55;
        int textWidth = 170;
        if (due != "none" && !due.empty()) {
            Color dColor = overdue ? C_RED : C_AMBER;
            it.printf(55, ty + 2, font_tiny, dColor, TextAlign::TOP_LEFT, "%s", due.c_str());
            textX = 100;
            textWidth = 125;
        }
        ScrollingText::draw(it, textX, ty, textWidth, summary, font_small, C_WHITE);
        ty += 22;
        count++;
      }
    };

    drawFromList(gState.todoListFormatted, C_AMBER);

    if (count == 0) {
      it.printf(120, ty + 22, font_tiny, C_DIMMER, TextAlign::CENTER, "LIST EMPTY");
    }
  };

  drawPreviewItems(105);

  int btnY = 195;
  
  // Timer Button
  gState.timerLinkBtn.x = 15;
  gState.timerLinkBtn.y = btnY;
  gState.timerLinkBtn.w = 100;
  gState.timerLinkBtn.h = 35;
  gState.timerLinkBtn.draw(it, "   TIMER", C_AMBER, gState.timerLinkLoading, gState.timerLinkLoadingStartTime, 0, font_small);
  
  int tcx = 30; // 15 + 15
  int tcy = btnY + 17;
  it.circle(tcx, tcy, 7, C_AMBER);
  it.line(tcx, tcy, tcx, tcy - 4, C_AMBER);
  it.line(tcx, tcy, tcx + 3, tcy, C_AMBER);

  // Scenes Button
  gState.scenesLinkBtn.x = 125;
  gState.scenesLinkBtn.y = btnY;
  gState.scenesLinkBtn.w = 100;
  gState.scenesLinkBtn.h = 35;
  gState.scenesLinkBtn.draw(it, "   SCENES", C_AMBER, gState.scenesLinkLoading, gState.scenesLinkLoadingStartTime, 0, font_small);
  
  int scx = 140; // 125 + 15
  int scy = btnY + 17;
  it.filled_circle(scx, scy, 7, C_AMBER); // Solid circle for scenes
  
  drawRetroBox(it, 10, 260, 220, 40, nullptr, C_DIM);
  
  int badge_x = 15;
  int badge_y = 273;
  bool any_active = false;
  
  auto drawMiniBadge = [&](const char* label, Color c, bool condition, Button* btn = nullptr) {
    if (!condition) return;
    
    if (btn) {
      btn->x = badge_x;
      btn->y = badge_y;
      btn->w = 45;
      btn->h = 14;
      btn->draw(it, label, c, gState.vacuumBadgeLoading, gState.vacuumBadgeLoadingStartTime, 200, font_tiny);
    } else {
      it.rectangle(badge_x + 2, badge_y + 2, 45, 14, Color(20, 20, 20));
      it.rectangle(badge_x, badge_y, 45, 14, Color(40, 40, 40));
      it.rectangle(badge_x - 1, badge_y - 1, 47, 16, c);
      it.printf(badge_x + 22, badge_y + 7, font_tiny, c, TextAlign::CENTER, "%s", label);
    }
    
    badge_x += 55;
    any_active = true;
  };

  drawMiniBadge("VAC", C_GREEN, gState.vacuumCleaning, &gState.vacuumBadgeBtn);
  drawMiniBadge("WASH", C_MAGENTA, (gState.washingMachineStatus != "All Done!" && !gState.washingMachineStatus.empty()));
  drawMiniBadge("PRNT", C_AMBER, gState.printerProgress > 0);
  drawMiniBadge("BEAM", C_BLUE, gState.beamerOn);
  
  if (!any_active) {
    it.printf(120, badge_y + 7, font_tiny, C_DIMMER, TextAlign::CENTER, "ALL SYSTEMS IDLE");
  }
}

void renderPage1_Music(display::Display& it) {
  bool mainActive = (gState.musicViewTab == 0);
  bool boseActive = (gState.musicViewTab == 1);
  bool dummyLoading = false;
  unsigned long dummyTime = 0;

  gState.musicMainTabBtn.draw(it, "LIVING", mainActive ? C_CYAN : C_DIM, dummyLoading, dummyTime, 0, font_tiny);
  gState.musicBoseTabBtn.draw(it, "BOSE", boseActive ? C_AMBER : C_DIM, dummyLoading, dummyTime, 0, font_tiny);

  gState.musicDetailBtn.draw(it, "", C_CYAN, gState.musicDetailLoading, gState.musicDetailLoadingStartTime, 0, font_tiny, 0, "NOW_PLAYING");
  
  it.printf(225, 80, font_tiny, C_CYAN, TextAlign::TOP_RIGHT, "OPTIONS >");

  if (mainActive) {
    if (gState.mediaStatus == "playing") {
      ScrollingText::draw(it, 30, 100, 180, gState.mediaTitle, font_medium, C_WHITE);
      it.printf(30, 130, font_small, C_DIM, TextAlign::TOP_LEFT, "%s", gState.mediaArtist.c_str());
      
      int bars = 15;
      int bx = 30;
      int by = 165;
      for (int i = 0; i < bars; i++) {
        int h = 5 + (rand() % 15);
        it.filled_rectangle(bx + i * 12, by - h, 8, h, C_CYAN);
      }
    } else {
      it.printf(120, 125, font_medium, C_DIMMER, TextAlign::CENTER, "IDLE");
    }

    gState.musicPlayBtn.draw(it, "START MUSIC", C_GREEN, gState.musicPlayLoading, gState.musicPlayLoadingStartTime, 2000, font_small);

    gState.musicLikeBtn.draw(it, "LIKE", C_MAGENTA, gState.musicLikeLoading, gState.musicLikeLoadingStartTime, 1000, font_small);
    gState.musicSkipBtn.draw(it, "SKIP", C_AMBER, gState.musicSkipLoading, gState.musicSkipLoadingStartTime, 1000, font_small);
  
  } else {
    if (gState.mediaStatusBose == "playing") {
      ScrollingText::draw(it, 30, 100, 180, gState.mediaTitleBose, font_medium, C_WHITE);
      it.printf(30, 130, font_small, C_DIM, TextAlign::TOP_LEFT, "%s", gState.mediaArtistBose.c_str());
      
      int bars = 15;
      int bx = 30;
      int by = 165;
      for (int i = 0; i < bars; i++) {
        int h = 5 + (rand() % 15);
        it.filled_rectangle(bx + i * 12, by - h, 8, h, C_AMBER);
      }
    } else {
      it.printf(120, 125, font_medium, C_DIMMER, TextAlign::CENTER, "IDLE");
    }

    it.printf(120, 200, font_small, C_DIM, TextAlign::CENTER, "CONTROLS UNAVAILABLE");
  }
}

void renderPage3_House(display::Display& it) {
  drawRetroBox(it, 10, 40, 220, 85, "PERIMETER", C_GREEN);
  
  auto drawWindow = [&](int x, int y, const char* label, bool is_open) {
    Color c = is_open ? C_RED : C_GREEN;
    it.rectangle(x-10, y, 20, 25, c);
    it.line(x, y, x, y+25, c);
    it.line(x-10, y+12, x+10, y+12, c);
    it.printf(x, y + 30, font_tiny, c, TextAlign::CENTER, "%s", is_open ? "OPEN" : "SHUT");
    it.printf(x, y + 42, font_tiny, C_DIM, TextAlign::CENTER, "%s", label);
  };

  drawWindow(50, 60, "WOHN", gState.windowLiving);
  drawWindow(120, 60, "BAD", gState.windowBath);
  drawWindow(190, 60, "WORK", gState.windowWork);
  
  gState.lightsDetailBtn.x = 10;
  gState.lightsDetailBtn.y = 140;
  gState.lightsDetailBtn.w = 220;
  gState.lightsDetailBtn.h = 75;
  gState.lightsDetailBtn.draw(it, "", C_AMBER, gState.lightsDetailLoading, gState.lightsDetailLoadingStartTime, 0, font_tiny, 0, "ILLUMINATION");

  int livingOn = gState.getLivingRoomActiveCount();
  int officeOn = gState.getOfficeActiveCount();

  it.printf(70, 160, font_medium, livingOn > 0 ? C_AMBER : C_DIM, TextAlign::CENTER, "%d", livingOn);
  it.printf(70, 185, font_tiny, C_DIM, TextAlign::CENTER, "LIVING_RM");

  it.printf(170, 160, font_medium, officeOn > 0 ? C_AMBER : C_DIM, TextAlign::CENTER, "%d", officeOn);
  it.printf(170, 185, font_tiny, C_DIM, TextAlign::CENTER, "OFFICE_RM");
  
  it.printf(120, 198, font_tiny, C_DIM, TextAlign::CENTER, "TAP TO CONFIGURE");

  drawRetroBox(it, 10, 230, 220, 55, "BIOMETRICS", C_BLUE);
  
  auto drawPresence = [&](int x, const char* label, bool val) {
    it.printf(x, 245, font_tiny, C_DIM, TextAlign::CENTER, "%s", label);
    it.filled_circle(x, 265, 7, val ? C_GREEN : C_DIMMER);
    it.circle(x, 265, 9, val ? C_GREEN : C_DIMMER);
  };

  drawPresence(70, "MOTION", gState.motionLiving);
  drawPresence(170, "OCCUPIED", gState.occupancyRadar);
}

void renderPage4_Devices(display::Display& it) {
  Color vac_c = gState.vacuumCleaning ? C_GREEN : C_CYAN;
  gState.vacuumCardBtn.y = 40;
  gState.vacuumCardBtn.h = 75;
  gState.vacuumCardBtn.draw(it, "", vac_c, gState.vacuumCardLoading, gState.vacuumCardLoadingStartTime, 0, font_tiny, 0, "UNIT_ROBOROCK");

  it.printf(30, 60, font_small, vac_c, TextAlign::TOP_LEFT, "%s", gState.vacuumStatus.c_str());
  it.printf(30, 80, font_tiny, C_DIM, TextAlign::TOP_LEFT, "BATT: %.0f%%", gState.vacuumBattery);
  
  it.rectangle(110, 80, 100, 10, C_DIMMER);
  it.filled_rectangle(112, 82, (int)(gState.vacuumBattery * 0.96f), 6, vac_c);
  
  std::string wash_status = gState.washingMachineStatus;
  if(wash_status.empty()) wash_status = "IDLE";
  Color wash_c = C_DIM;
  if (wash_status == "Scrubbing Away!") wash_c = C_CYAN;
  else if (wash_status == "Drama in the Drum!") wash_c = C_MAGENTA;
  else if (wash_status == "All Done!") wash_c = C_GREEN;
  else if (wash_status == "Wrinkle Risk Rising!") wash_c = C_RED;
  
  drawRetroBox(it, 10, 130, 220, 65, "UNIT_WASHER", wash_c);
  it.printf(30, 155, font_small, wash_c, TextAlign::TOP_LEFT, "%.20s", wash_status.c_str());
  
  Color prnt_c = gState.printerProgress > 0 ? C_AMBER : C_DIM;
  drawRetroBox(it, 10, 210, 220, 75, "UNIT_PRINTER", prnt_c);
  
  if (gState.printerProgress > 0.0f) {
    it.printf(30, 230, font_small, C_AMBER, TextAlign::TOP_LEFT, "PROGRESS: %.0f%%", gState.printerProgress);
    it.rectangle(30, 255, 180, 10, C_DIMMER);
    it.filled_rectangle(32, 257, (int)(gState.printerProgress * 1.76f), 6, C_AMBER);
  } else {
    it.printf(120, 245, font_small, C_DIM, TextAlign::CENTER, "SYSTEM_READY");
  }
}
