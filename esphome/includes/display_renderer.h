#pragma once
#include "esphome.h"
#include "state_manager.h"
#include "dial.h"
#include "notification.h"
#include "scrolling_text.h"
#include "colors.h"
#include <cmath>

// Forward declare fonts

// --- HELPER FUNCTIONS ---

void drawRetroBox(display::Display& it, int x, int y, int w, int h, const char* label = nullptr, Color color = C_DIM) {
  // Main Border
  it.rectangle(x, y, w, h, C_DIMMER);
  
  // High-Contrast Pronounced Corners (Double thick)
  int s = 10;
  // Top Left
  it.line(x, y, x + s, y, color);
  it.line(x, y, x, y + s, color);
  it.line(x+1, y+1, x + s, y+1, color);
  it.line(x+1, y+1, x+1, y + s, color);
  
  // Top Right
  it.line(x + w, y, x + w - s, y, color);
  it.line(x + w, y, x + w, y + s, color);
  it.line(x + w - 1, y+1, x + w - s, y+1, color);
  it.line(x + w - 1, y+1, x + w - 1, y + s, color);
  
  // Bottom Left
  it.line(x, y + h, x + s, y + h, color);
  it.line(x, y + h, x, y + h - s, color);
  it.line(x+1, y + h - 1, x + s, y + h - 1, color);
  it.line(x+1, y + h - 1, x+1, y + h - s, color);
  
  // Bottom Right
  it.line(x + w, y + h, x + w - s, y + h, color);
  it.line(x + w, y + h, x + w, y + h - s, color);
  it.line(x + w - 1, y + h - 1, x + w - s, y + h - 1, color);
  it.line(x + w - 1, y + h - 1, x + w - 1, y + h - s, color);

  if (label) {
    it.printf(x + 12, y - 7, font_tiny, color, TextAlign::TOP_LEFT, " %s ", label);
  }
}

void drawCommonHeader(display::Display& it) {
  // Edge Accents
  it.line(0, 0, 0, 320, C_DIMMER);
  it.line(239, 0, 239, 320, C_DIMMER);

  // Timer Override or Time & Date
  if (gState.timerActive) {
    int minutes = gState.timerRemaining / 60;
    int seconds = gState.timerRemaining % 60;
    Color timerColor = (gState.timerRemaining == 0) ? C_RED : C_CYAN;
    
    // Draw Timer Icon
    it.circle(25, 20, 8, timerColor);
    it.line(25, 20, 25, 15, timerColor);
    it.line(25, 20, 29, 20, timerColor);
    
    it.printf(42, 10, font_medium, timerColor, TextAlign::TOP_LEFT, "%02d:%02d", minutes, seconds);
    it.printf(230, 12, font_tiny, timerColor, TextAlign::TOP_RIGHT, "TIMER RUNNING");
  } else {
    // Time & Date Section
    auto time_now = sntp_time->now();
    if (time_now.is_valid()) {
      it.printf(10, 10, font_medium, C_WHITE, TextAlign::TOP_LEFT, "%02d:%02d", 
                time_now.hour, time_now.minute);
      it.printf(75, 12, font_tiny, C_DIM, TextAlign::TOP_LEFT, ":%02d", time_now.second);

      const char* days[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
      const char* months[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN", 
                              "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};
      int dayIdx = time_now.day_of_week - 1;
      if(dayIdx < 0) dayIdx = 0;
      
      it.printf(230, 12, font_tiny, C_DIM, TextAlign::TOP_RIGHT, "%s %02d %s", 
                days[dayIdx], time_now.day_of_month, months[time_now.month-1]);
    }
  }
  
  it.line(10, 35, 230, 35, C_DIM);
}

void drawPageIndicator(display::Display& it, int page, int count) {
  for (int i = 0; i < count; i++) {
    int dot_x = 120 - (count * 7) + (i * 14) + 7;
    if (i == page) {
      it.filled_circle(dot_x, 306, 4, C_CYAN);
    } else {
      it.circle(dot_x, 306, 3, C_DIM);
    }
  }
}

void drawDetailHeader(display::Display& it, const char* title) {
  it.filled_rectangle(0, 0, 240, 40, C_DIMMER);
  it.line(0, 40, 240, 40, C_DIM);
  
  // Back button - very short timeout as it's just for feedback
  gState.backBtn.draw(it, "<", C_CYAN, gState.backLoading, gState.backLoadingStartTime, 150, font_small);
  
  // Title
  it.printf(120, 20, font_small, C_WHITE, TextAlign::CENTER, "%s", title);
}

// --- PAGE 0: STATUS ---

void renderPage0_Status(display::Display& it) {
  // --- ENVIRONMENT BAR (LINK TO CLIMATE) ---
  gState.climateDetailBtn.draw(it, "", C_CYAN, gState.climateDetailLoading, gState.climateDetailLoadingStartTime, 0, font_tiny, 0, nullptr);
  
  auto drawMetric = [&](int x, float val, const char* unit, Color c) {
    if (val != 0)
      it.printf(x, 55, font_small, c, TextAlign::CENTER, "%.0f%s", val, unit);
    else
      it.printf(x, 55, font_small, C_DIMMER, TextAlign::CENTER, "--");
  };

  drawMetric(40, gState.outsideTemp, "C", C_CYAN);
  drawMetric(90, gState.avgTemp, "C", C_AMBER);
  drawMetric(140, gState.avgHumidity, "%", C_DIM);
  


  Color co2_color = gState.co2 < 800 ? C_GREEN : (gState.co2 < 1200 ? C_AMBER : C_RED);
  drawMetric(195, gState.co2, "", co2_color);

  // Windows Alert below bar
  int open_count = gState.getOpenWindowCount();
  if (open_count > 0) {
    it.printf(120, 80, font_tiny, C_RED, TextAlign::CENTER, "!! %d WINDOWS OPEN !!", open_count);
  }

  // --- LOGISTICS BOX (TO-DO PREVIEW) ---
  gState.todoDetailBtn.draw(it, "", C_AMBER, gState.todoDetailLoading, gState.todoDetailLoadingStartTime, 0, font_tiny, 0, nullptr);
  
  auto drawPreviewItems = [&](int startY) {
    int ty = startY;
    int count = 0;
    
    // Helper to draw from a list string
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

        // Trim line
        size_t first = line.find_first_not_of(" \t\r\n");
        if (first == std::string::npos) continue;
        size_t last = line.find_last_not_of(" \t\r\n");
        line = line.substr(first, (last - first + 1));

        if (line.empty() || line == "LIST EMPTY") continue;

        // Preview Parsing (Original Formatting)
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

        // Trim summary and due
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

  // --- TIMER BUTTON ---
  int timerBtnY = 195; // More spacing after the 3 todo items
  gState.timerLinkBtn.x = 70;
  gState.timerLinkBtn.y = timerBtnY;
  gState.timerLinkBtn.w = 100;
  gState.timerLinkBtn.h = 35;
  gState.timerLinkBtn.draw(it, "   TIMER", C_AMBER, gState.timerLinkLoading, gState.timerLinkLoadingStartTime, 0, font_small);
  
  // Custom Clock Icon
  int cx = 85;
  int cy = timerBtnY + 17;
  it.circle(cx, cy, 7, C_AMBER);
  it.line(cx, cy, cx, cy - 4, C_AMBER); // Hour hand
  it.line(cx, cy, cx + 3, cy, C_AMBER); // Minute hand

  // --- HARDWARE STATUS (BADGES) ---
  drawRetroBox(it, 10, 260, 220, 40, nullptr, C_DIM);
  
  int badge_x = 20;
  int badge_y = 278;
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
      // Shadow
      it.rectangle(badge_x + 2, badge_y + 2, 45, 14, Color(20, 20, 20));
      // Main
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

// --- PAGE 1: MUSIC ---

void renderPage1_Music(display::Display& it) {
  // Tabs
  bool mainActive = (gState.musicViewTab == 0);
  bool boseActive = (gState.musicViewTab == 1);
  bool dummyLoading = false;
  unsigned long dummyTime = 0;

  gState.musicMainTabBtn.draw(it, "LIVING", mainActive ? C_CYAN : C_DIM, dummyLoading, dummyTime, 0, font_tiny);
  gState.musicBoseTabBtn.draw(it, "BOSE", boseActive ? C_AMBER : C_DIM, dummyLoading, dummyTime, 0, font_tiny);

  // Main Info Box
  gState.musicDetailBtn.draw(it, "", C_CYAN, gState.musicDetailLoading, gState.musicDetailLoadingStartTime, 0, font_tiny, 0, "NOW_PLAYING");
  
  // Add a small indicator that this box is clickable
  it.printf(225, 80, font_tiny, C_CYAN, TextAlign::TOP_RIGHT, "OPTIONS >");

  if (mainActive) {
    if (gState.mediaStatus == "playing") {
      ScrollingText::draw(it, 30, 100, 180, gState.mediaTitle, font_medium, C_WHITE);
      it.printf(30, 130, font_small, C_DIM, TextAlign::TOP_LEFT, "%s", gState.mediaArtist.c_str());
      
      // Simple animated bar visualizer
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

    // Play Music Button
    gState.musicPlayBtn.draw(it, "START MUSIC", C_GREEN, gState.musicPlayLoading, gState.musicPlayLoadingStartTime, 2000, font_small);

    // Bottom Buttons
    gState.musicLikeBtn.draw(it, "LIKE", C_MAGENTA, gState.musicLikeLoading, gState.musicLikeLoadingStartTime, 1000, font_small);
    gState.musicSkipBtn.draw(it, "SKIP", C_AMBER, gState.musicSkipLoading, gState.musicSkipLoadingStartTime, 1000, font_small);
  
  } else {
    // Bose Player
    if (gState.mediaStatusBose == "playing") {
      ScrollingText::draw(it, 30, 100, 180, gState.mediaTitleBose, font_medium, C_WHITE);
      it.printf(30, 130, font_small, C_DIM, TextAlign::TOP_LEFT, "%s", gState.mediaArtistBose.c_str());
      
      // Visualizer (Amber)
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

    // No controls available message
    it.printf(120, 200, font_small, C_DIM, TextAlign::CENTER, "CONTROLS UNAVAILABLE");
  }
}

// --- DETAIL VIEW: MUSIC ---

void renderDetail_Music(display::Display& it) {
  int ly = 50;
  auto getSY = [&](int logicalY) { return logicalY + gState.scrollY; };

  it.printf(120, getSY(ly), font_small, C_WHITE, TextAlign::CENTER, "TRANSFER PLAYBACK");
  ly += 25;

  // Side-by-side transfer buttons
  gState.musicTransferOfficeBtn.x = 10;
  gState.musicTransferOfficeBtn.y = ly;
  gState.musicTransferOfficeBtn.w = 105;
  gState.musicTransferOfficeBtn.h = 45;
  gState.musicTransferOfficeBtn.draw(it, "OFFICE", C_CYAN, gState.musicTransferOfficeLoading, gState.musicTransferOfficeStartTime, 2000, font_small, gState.scrollY);

  gState.musicTransferLivingBtn.x = 125;
  gState.musicTransferLivingBtn.y = ly;
  gState.musicTransferLivingBtn.w = 105;
  gState.musicTransferLivingBtn.h = 45;
  gState.musicTransferLivingBtn.draw(it, "LIVING", C_CYAN, gState.musicTransferLivingLoading, gState.musicTransferLivingStartTime, 2000, font_small, gState.scrollY);
  
  ly += 60; // Reduced spacing

  // --- VOLUME SLIDER ---
  drawRetroBox(it, 10, getSY(ly), 220, 70, "VOLUME_CONTROL", C_DIM);
  
  float currentVol = (gState.musicViewTab == 0) ? gState.mediaVolume : gState.mediaVolumeBose;
  
  // Slider Params
  int sliderX = 25;
  int sliderW = 190;
  int sliderY = getSY(ly + 40);
  
  // Track
  it.line(sliderX, sliderY, sliderX + sliderW, sliderY, C_DIMMER);
  it.line(sliderX, sliderY+1, sliderX + sliderW, sliderY+1, C_DIMMER);
  
  // Progress - Map 0..0.25 to 0..1.0 for visual bar
  float visualProgress = currentVol / 0.25f;
  if (visualProgress > 1.0f) visualProgress = 1.0f;
  if (visualProgress < 0.0f) visualProgress = 0.0f;
  int handleX = sliderX + (int)(visualProgress * sliderW);
  
  it.line(sliderX, sliderY, handleX, sliderY, C_CYAN);
  it.line(sliderX, sliderY+1, handleX, sliderY+1, C_CYAN);
  
  // Handle
  it.filled_circle(handleX, sliderY, 8, C_CYAN);
  it.circle(handleX, sliderY, 10, C_WHITE);
  
  it.printf(120, getSY(ly + 15), font_tiny, C_DIM, TextAlign::CENTER, "VOLUME: %.0f%%", currentVol * 100);
  
  ly += 80;

  // --- TRACK CONTROLS ---
  gState.musicPrevBtn.y = ly;
  gState.musicNextBtn.y = ly;
  
  gState.musicPrevBtn.draw(it, "PREV", C_AMBER, gState.musicPrevLoading, gState.musicPrevStartTime, 500, font_small, gState.scrollY);
  gState.musicNextBtn.draw(it, "NEXT", C_AMBER, gState.musicNextLoading, gState.musicNextStartTime, 500, font_small, gState.scrollY);

  ly += 60;

  int totalContentHeight = ly - 40;
  gState.maxScrollY = totalContentHeight > 280 ? (totalContentHeight - 280) : 0;

  drawDetailHeader(it, "MUSIC OPTIONS");
}

// --- DETAIL VIEW: TIMER ---

void renderDetail_Timer(display::Display& it) {
  int ly = 60;
  auto getSY = [&](int logicalY) { return logicalY + gState.scrollY; };

  // 1. Large Countdown Text
  int minutes = gState.timerRemaining / 60;
  int seconds = gState.timerRemaining % 60;
  Color timeColor = gState.timerActive ? C_CYAN : C_WHITE;
  if (gState.timerRemaining == 0 && gState.timerActive) timeColor = C_RED;

  it.printf(120, getSY(ly + 40), font_large, timeColor, TextAlign::CENTER, "%02d:%02d", minutes, seconds);
  
  // Adjustment Buttons (only if not running)
  if (!gState.timerActive) {
    bool dummyLoading = false;
    unsigned long dummyStartTime = 0;
    gState.timerMinusBtn.y = ly + 20;
    gState.timerPlusBtn.y = ly + 20;
    gState.timerMinusBtn.draw(it, "-1", C_CYAN, dummyLoading, dummyStartTime, 0, font_small, gState.scrollY);
    gState.timerPlusBtn.draw(it, "+1", C_CYAN, dummyLoading, dummyStartTime, 0, font_small, gState.scrollY);
  }

  ly += 90;

  // 2. Draggable Slider UI (blocked when running)
  drawRetroBox(it, 10, getSY(ly), 220, 60, "TIME_ADJUST", gState.timerActive ? C_DIMMER : C_DIM);
  
  int sliderX = 25;
  int sliderW = 190;
  int sliderY = getSY(ly + 35);
  
  // Track
  Color trackColor = gState.timerActive ? C_DIMMER : C_DIMMER;
  it.line(sliderX, sliderY, sliderX + sliderW, sliderY, trackColor);
  it.line(sliderX, sliderY+1, sliderX + sliderW, sliderY+1, trackColor);
  
  // Progress (dimmed when running)
  float progress = (float)gState.timerRemaining / 3600.0f; // Max 60 mins
  if (progress > 1.0f) progress = 1.0f;
  int handleX = sliderX + (int)(progress * sliderW);
  
  Color sliderColor = gState.timerActive ? C_DIMMER : C_CYAN;
  it.line(sliderX, sliderY, handleX, sliderY, sliderColor);
  it.line(sliderX, sliderY+1, handleX, sliderY+1, sliderColor);
  
  // Handle (dimmed when running)
  Color handleColor = gState.timerActive ? C_DIMMER : C_CYAN;
  it.filled_circle(handleX, sliderY, 8, handleColor);
  it.circle(handleX, sliderY, 10, gState.timerActive ? C_DIMMER : C_WHITE);
  
  const char* sliderText = gState.timerActive ? "TIMER RUNNING - SLIDER LOCKED" : "SLIDE TO SET (MAX 60M)";
  Color textColor = gState.timerActive ? C_DIMMER : C_DIM;
  it.printf(120, getSY(ly + 15), font_tiny, textColor, TextAlign::CENTER, "%s", sliderText);
  
  ly += 80;

  // 3. Control Buttons
  gState.timerStartBtn.y = ly;
  gState.timerResetBtn.y = ly;
  
  const char* startLabel = gState.timerActive ? "STOP" : "START";
  Color startColor = gState.timerActive ? C_RED : C_GREEN;
  
  bool dummyLoading = false;
  unsigned long dummyStartTime = 0;
  
  gState.timerStartBtn.draw(it, startLabel, startColor, gState.timerStartLoading, gState.timerStartLoadingStartTime, 2000, font_small, gState.scrollY);
  gState.timerResetBtn.draw(it, "RESET", C_AMBER, gState.timerResetLoading, gState.timerResetLoadingStartTime, 1000, font_small, gState.scrollY);

  ly += 60;

  int totalContentHeight = ly - 40;
  gState.maxScrollY = totalContentHeight > 280 ? (totalContentHeight - 280) : 0;

  drawDetailHeader(it, "KITCHEN TIMER");
}

// --- DETAIL VIEW: CLIMATE ---

void renderDetail_Climate(display::Display& it) {
  int ly = 45; 
  auto getSY = [&](int logicalY) { return logicalY + gState.scrollY; };

  // --- AIR QUALITY BOX ---
  drawRetroBox(it, 10, getSY(ly), 220, 110, "AIR_QUALITY", C_GREEN);
  
  float co2_val = gState.co2;
  Color co2_color = co2_val < 800.0f ? C_GREEN : (co2_val < 1200.0f ? C_AMBER : C_RED);
  
  it.printf(30, getSY(ly + 25), font_tiny, C_DIM, TextAlign::TOP_LEFT, "CO2 CONCENTRATION");
  it.printf(30, getSY(ly + 45), font_large, co2_color, TextAlign::TOP_LEFT, "%.0f", co2_val);
  it.printf(110, getSY(ly + 60), font_tiny, C_DIM, TextAlign::TOP_LEFT, "PPM");

  // Retro bar gauge
  it.rectangle(30, getSY(ly + 80), 180, 10, C_DIMMER);
  float mapped = (co2_val - 400.0f) / 1600.0f;
  if (mapped < 0) mapped = 0; if (mapped > 1) mapped = 1;
  it.filled_rectangle(32, getSY(ly + 82), (int)(mapped * 176), 6, co2_color);
  
  ly += 125;

  // --- THERMAL DYNAMICS BOX ---
  drawRetroBox(it, 10, getSY(ly), 220, 115, "THERMAL_DYNAMICS", C_AMBER);
  
  auto drawReadout = [&](int x, int y, const char* label, float val, const char* unit, Color c) {
    it.printf(x, getSY(y), font_tiny, C_DIM, TextAlign::TOP_LEFT, "%s", label);
    it.printf(x, getSY(y + 15), font_medium, c, TextAlign::TOP_LEFT, "%.1f%s", val, unit);
  };

  drawReadout(30, ly + 25, "INDOOR_TEMP", gState.indoorTemp, "C", C_AMBER);
  drawReadout(130, ly + 25, "INDOOR_HUM", gState.indoorHumidity, "%", C_DIM);
  
  drawReadout(30, ly + 70, "OUTDOOR_TEMP", gState.outsideTemp, "C", C_CYAN);
  drawReadout(130, ly + 70, "OUTDOOR_HUM", gState.outsideHumidity, "%", C_DIM);
  
  ly += 130;

  // Additional detail for climate view
  drawRetroBox(it, 10, getSY(ly), 220, 60, "ENVIRONMENT_STATS", C_DIM);
  it.printf(30, getSY(ly + 20), font_tiny, C_DIM, TextAlign::TOP_LEFT, "INDOOR_LIGHT");
  it.printf(30, getSY(ly + 35), font_small, C_WHITE, TextAlign::TOP_LEFT, "%.0f lx", gState.indoorLight);
  ly += 70;

  int totalContentHeight = ly - 40;
  gState.maxScrollY = totalContentHeight > 280 ? (totalContentHeight - 280) : 0;

  drawDetailHeader(it, "CLIMATE DETAIL");
}

// --- PAGE 3: HOUSE STATUS ---

void drawWindowIcon(display::Display& it, int x, int y, const char* label, bool is_open) {
  Color c = is_open ? C_RED : C_GREEN;
  it.rectangle(x-12, y, 24, 28, c);
  it.line(x, y, x, y+28, c);
  it.line(x-12, y+14, x+12, y+14, c);
  it.printf(x, y + 35, font_tiny, c, TextAlign::CENTER, "%s", is_open ? "OPEN" : "SHUT");
  it.printf(x, y + 48, font_tiny, C_DIM, TextAlign::CENTER, "%s", label);
}

void drawBulbIcon(display::Display& it, int x, int y, const char* label, bool is_on) {
  Color c = is_on ? C_AMBER : C_DIM;
  it.circle(x, y, 10, c);
  if (is_on) {
    it.filled_circle(x, y, 6, C_AMBER);
    for (int i = 0; i < 8; i++) {
      float a = i * 3.14159265f / 4.0f;
      it.line(x + (int)(cosf(a)*13), y + (int)(sinf(a)*13), x + (int)(cosf(a)*17), y + (int)(sinf(a)*17), C_AMBER);
    }
  }
  it.printf(x, y + 22, font_tiny, c, TextAlign::CENTER, "%s", label);
}

void renderPage3_House(display::Display& it) {
  // --- PERIMETER BOX (WINDOWS) ---
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
  
  // --- ILLUMINATION BOX ---
  // Button serves as the boundary
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

  // --- BIOMETRIC BOX (PRESENCE) ---
  drawRetroBox(it, 10, 230, 220, 55, "BIOMETRICS", C_BLUE);
  
  auto drawPresence = [&](int x, const char* label, bool val) {
    it.printf(x, 245, font_tiny, C_DIM, TextAlign::CENTER, "%s", label);
    it.filled_circle(x, 265, 7, val ? C_GREEN : C_DIMMER);
    it.circle(x, 265, 9, val ? C_GREEN : C_DIMMER);
  };

  drawPresence(70, "MOTION", gState.motionLiving);
  drawPresence(170, "OCCUPIED", gState.occupancyRadar);
}

// --- PAGE 4: DEVICES ---

void renderPage4_Devices(display::Display& it) {
  // --- ROBOROCK BOX ---
  Color vac_c = gState.vacuumCleaning ? C_GREEN : C_CYAN;
  gState.vacuumCardBtn.y = 40;
  gState.vacuumCardBtn.h = 75;
  gState.vacuumCardBtn.draw(it, "", vac_c, gState.vacuumCardLoading, gState.vacuumCardLoadingStartTime, 0, font_tiny, 0, "UNIT_ROBOROCK");

  it.printf(30, 60, font_small, vac_c, TextAlign::TOP_LEFT, "%s", gState.vacuumStatus.c_str());
  it.printf(30, 80, font_tiny, C_DIM, TextAlign::TOP_LEFT, "BATT: %.0f%%", gState.vacuumBattery);
  
  it.rectangle(110, 80, 100, 10, C_DIMMER);
  it.filled_rectangle(112, 82, (int)(gState.vacuumBattery * 0.96f), 6, vac_c);
  
  // --- WASHING MACHINE BOX ---
  std::string wash_status = gState.washingMachineStatus;
  if(wash_status.empty()) wash_status = "IDLE";
  Color wash_c = C_DIM;
  if (wash_status == "Scrubbing Away!") wash_c = C_CYAN;
  else if (wash_status == "Drama in the Drum!") wash_c = C_MAGENTA;
  else if (wash_status == "All Done!") wash_c = C_GREEN;
  else if (wash_status == "Wrinkle Risk Rising!") wash_c = C_RED;
  
  drawRetroBox(it, 10, 130, 220, 65, "UNIT_WASHER", wash_c);
  it.printf(30, 155, font_small, wash_c, TextAlign::TOP_LEFT, "%.20s", wash_status.c_str());
  
  // --- 3D PRINTER BOX ---
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

// --- DETAIL VIEW: VACUUM ---

void renderDetail_Vacuum(display::Display& it) {
  // Logical Y position for content (relative to screen top, before scroll)
  int ly = 40; 
  
  // Helper to get actual screen Y
  auto getSY = [&](int logicalY) { return logicalY + gState.scrollY; };

  // Status Card
  int sy = getSY(ly);
  it.rectangle(10, sy, 220, 60, C_DIM);
  it.printf(20, sy + 5, font_tiny, C_DIM, TextAlign::TOP_LEFT, "STATUS");
  it.printf(20, sy + 25, font_small, gState.vacuumCleaning ? C_GREEN : C_CYAN, TextAlign::TOP_LEFT, "%s", 
            gState.vacuumStatus.c_str());
  ly += 70;
  
  // Battery Card
  sy = getSY(ly);
  it.rectangle(10, sy, 220, 60, C_DIM);
  it.printf(20, sy + 5, font_tiny, C_DIM, TextAlign::TOP_LEFT, "BATTERY");
  // Battery bar
  it.rectangle(20, sy + 25, 140, 14, C_DIM);
  Color batt_color = gState.vacuumBattery > 50.0f ? C_GREEN : (gState.vacuumBattery > 20.0f ? C_AMBER : C_RED);
  it.filled_rectangle(22, sy + 27, (int)((gState.vacuumBattery / 100.0f) * 136), 10, batt_color);
  it.printf(170, sy + 25, font_tiny, batt_color, TextAlign::TOP_LEFT, "%.0f%%", gState.vacuumBattery);
  ly += 70;
  
  // Start Button
  // Ensure button logical Y matches our layout
  gState.vacuumBtn.y = ly; 
  if (!gState.vacuumCleaning) {
    gState.vacuumBtn.draw(it, "START CLEANING", C_GREEN, gState.vacuumLoading, gState.vacuumLoadingStartTime, 5000, font_small, gState.scrollY);
  } else {
    gState.vacuumBtn.draw(it, "STOP VACUUM", C_RED, gState.vacuumLoading, gState.vacuumLoadingStartTime, 5000, font_small, gState.scrollY);
  }
  ly += 60;
  
  // Info Section
  it.printf(10, getSY(ly), font_tiny, C_DIM, TextAlign::TOP_LEFT, "Last Clean: Today 10:00");
  ly += 20;
  it.printf(10, getSY(ly), font_tiny, C_DIM, TextAlign::TOP_LEFT, "Map Saved: Yes");
  ly += 20;
  it.printf(10, getSY(ly), font_tiny, C_DIM, TextAlign::TOP_LEFT, "Total Runtime: 2h 34m");
  ly += 30;
  
  // Consumables Section
  it.printf(10, getSY(ly), font_small, C_WHITE, TextAlign::TOP_LEFT, "CONSUMABLES");
  ly += 25;
  
  auto drawConsumable = [&](int logicalY, const char* name, int pct) {
    int cur_sy = getSY(logicalY);
    it.printf(20, cur_sy, font_tiny, C_DIM, TextAlign::TOP_LEFT, "%s", name);
    it.rectangle(80, cur_sy + 2, 100, 8, C_DIM);
    it.filled_rectangle(82, cur_sy + 4, (int)(pct * 0.96f), 4, pct > 20 ? C_CYAN : C_RED);
    it.printf(190, cur_sy, font_tiny, C_DIM, TextAlign::TOP_LEFT, "%d%%", pct);
  };
  
  drawConsumable(ly, "Filter", 85); ly += 18;
  drawConsumable(ly, "Side B.", 42); ly += 18;
  drawConsumable(ly, "Main B.", 91); ly += 18;
  drawConsumable(ly, "Sensor", 12); ly += 30;
  
  // History Section
  it.printf(10, getSY(ly), font_small, C_WHITE, TextAlign::TOP_LEFT, "RECENT HISTORY");
  ly += 25;
  
  auto drawHistory = [&](int logicalY, const char* date, const char* dur, const char* area) {
    int cur_sy = getSY(logicalY);
    it.printf(20, cur_sy, font_tiny, C_WHITE, TextAlign::TOP_LEFT, "%s", date);
    it.printf(120, cur_sy, font_tiny, C_DIM, TextAlign::TOP_LEFT, "%s", dur);
    it.printf(190, cur_sy, font_tiny, C_AMBER, TextAlign::TOP_LEFT, "%s", area);
  };
  
  drawHistory(ly, "05 JAN", "45m", "32m2"); ly += 18;
  drawHistory(ly, "04 JAN", "12m", "8m2"); ly += 18;
  drawHistory(ly, "03 JAN", "52m", "41m2"); ly += 18;
  drawHistory(ly, "01 JAN", "38m", "29m2"); ly += 18;
  ly += 20;

  // Footer spacing
  ly += 10;
  
  // Set content height for scrolling based on logical Y
  int totalContentHeight = ly - 40;
  gState.maxScrollY = totalContentHeight > 280 ? (totalContentHeight - 280) : 0;

  // Draw Header LAST to ensure it covers scrolled content
  drawDetailHeader(it, "VACUUM DETAIL");
}

// --- DETAIL VIEW: LIGHTS ---

void renderDetail_Lights(display::Display& it) {
  int ly = 45; 
  auto getSY = [&](int logicalY) { return logicalY + gState.scrollY; };

  it.printf(120, getSY(ly), font_small, C_WHITE, TextAlign::CENTER, "LIVING ROOM");
  ly += 25;

  int col1 = 15;
  int col2 = 125;
  int btnW = 100;
  int btnH = 40;
  int spacing = 10;

  // Use the reusable draw method
  gState.lightStehlampe.btn.x = col1;
  gState.lightStehlampe.btn.y = ly;
  gState.lightStehlampe.btn.w = btnW;
  gState.lightStehlampe.btn.h = btnH;
  gState.lightStehlampe.btn.draw(it, "STEH-L.", gState.lightStehlampe.state, gState.lightStehlampe.loading, gState.lightStehlampe.loadingStartTime, font_tiny, gState.scrollY);

  gState.lightWohnzimmer.btn.x = col2;
  gState.lightWohnzimmer.btn.y = ly;
  gState.lightWohnzimmer.btn.w = btnW;
  gState.lightWohnzimmer.btn.h = btnH;
  gState.lightWohnzimmer.btn.draw(it, "WOHNZ.", gState.lightWohnzimmer.state, gState.lightWohnzimmer.loading, gState.lightWohnzimmer.loadingStartTime, font_tiny, gState.scrollY);
  
  ly += btnH + spacing;

  gState.lightKleineLampe.btn.x = col1;
  gState.lightKleineLampe.btn.y = ly;
  gState.lightKleineLampe.btn.w = btnW;
  gState.lightKleineLampe.btn.h = btnH;
  gState.lightKleineLampe.btn.draw(it, "KLEINE L.", gState.lightKleineLampe.state, gState.lightKleineLampe.loading, gState.lightKleineLampe.loadingStartTime, font_tiny, gState.scrollY);

  gState.lightWLED.btn.x = col2;
  gState.lightWLED.btn.y = ly;
  gState.lightWLED.btn.w = btnW;
  gState.lightWLED.btn.h = btnH;
  gState.lightWLED.btn.draw(it, "WLED", gState.lightWLED.state, gState.lightWLED.loading, gState.lightWLED.loadingStartTime, font_tiny, gState.scrollY);

  ly += btnH + spacing;

  gState.lightStehlampeOben.btn.x = col1;
  gState.lightStehlampeOben.btn.y = ly;
  gState.lightStehlampeOben.btn.w = btnW;
  gState.lightStehlampeOben.btn.h = btnH;
  gState.lightStehlampeOben.btn.draw(it, "ST-OBEN", gState.lightStehlampeOben.state, gState.lightStehlampeOben.loading, gState.lightStehlampeOben.loadingStartTime, font_tiny, gState.scrollY);

  gState.lightKamera.btn.x = col2;
  gState.lightKamera.btn.y = ly;
  gState.lightKamera.btn.w = btnW;
  gState.lightKamera.btn.h = btnH;
  gState.lightKamera.btn.draw(it, "KAMERA", gState.lightKamera.state, gState.lightKamera.loading, gState.lightKamera.loadingStartTime, font_tiny, gState.scrollY);

  ly += btnH + spacing + 10;

  it.printf(120, getSY(ly), font_small, C_WHITE, TextAlign::CENTER, "OFFICE");
  ly += 25;

  gState.lightOffice.btn.x = col1;
  gState.lightOffice.btn.y = ly;
  gState.lightOffice.btn.w = btnW;
  gState.lightOffice.btn.h = btnH;
  gState.lightOffice.btn.draw(it, "OFFICE", gState.lightOffice.state, gState.lightOffice.loading, gState.lightOffice.loadingStartTime, font_tiny, gState.scrollY);

  gState.lightGrosseLED.btn.x = col2;
  gState.lightGrosseLED.btn.y = ly;
  gState.lightGrosseLED.btn.w = btnW;
  gState.lightGrosseLED.btn.h = btnH;
  gState.lightGrosseLED.btn.draw(it, "GR. LED", gState.lightGrosseLED.state, gState.lightGrosseLED.loading, gState.lightGrosseLED.loadingStartTime, font_tiny, gState.scrollY);

  ly += btnH + spacing;

  int totalContentHeight = ly - 40;
  gState.maxScrollY = totalContentHeight > 280 ? (totalContentHeight - 280) : 0;

  drawDetailHeader(it, "LIGHTS CONTROL");
}

// --- DETAIL VIEW: LOGISTICS (TO-DO & SHOPPING) ---

void renderDetail_Todo(display::Display& it) {
  int ly = 95; // Start lower to accommodate tabs
  auto getSY = [&](int logicalY) { return logicalY + gState.scrollY; };

  // Draw Tabs
  bool shopActive = (gState.todoViewTab == 0);
  bool todoActive = (gState.todoViewTab == 1);
  
  bool dummyLoading = false;
  unsigned long dummyTime = 0;
  
  gState.shoppingTabBtn.draw(it, "", shopActive ? C_CYAN : C_DIM, dummyLoading, dummyTime, 0, font_tiny);
  gState.todoTabBtn.draw(it, "", todoActive ? C_AMBER : C_DIM, dummyLoading, dummyTime, 0, font_tiny);

  auto drawTabContent = [&](int x, int y, const char* label, int count, bool active, Color color) {
    Color c = active ? color : C_DIM;
    // Icon (3 lines)
    int ix = x + 10;
    int iy = y + 12;
    for(int i=0; i<3; i++) it.line(ix, iy + i*4, ix + 8, iy + i*4, c);
    
    it.printf(x + 25, y + 10, font_tiny, c, TextAlign::TOP_LEFT, "%s", label);
    it.printf(x + 95, y + 10, font_tiny, c, TextAlign::TOP_RIGHT, "%d", count);
  };

  it.start_clipping(0, 85, 240, 320); // Clip items so they don't overlap tabs/header

  auto drawList = [&](std::string listStr) {
    size_t pos = 0;
    bool empty = true;
    while ((pos = listStr.find("\n")) != std::string::npos || !listStr.empty()) {
      std::string line;
      if (pos != std::string::npos) {
        line = listStr.substr(0, pos);
        listStr.erase(0, pos + 1);
      } else {
        line = listStr;
        listStr.clear();
      }

      // Trim line helper
      auto trim = [](std::string& s) {
          size_t first = s.find_first_not_of(" \t\r\n");
          if (first == std::string::npos) { s = ""; return; }
          size_t last = s.find_last_not_of(" \t\r\n");
          s = s.substr(first, (last - first + 1));
      };
      trim(line);

      if (line.empty() || line == "LIST EMPTY") continue;

      // Robust Parsing: Summary|Due|Overdue
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

      trim(summary);
      trim(due);
      if (summary.empty()) continue;

      int sy = getSY(ly);
      
      // Hit detection area for touch handler (invisible but logical)
      // Card Background
      it.rectangle(10, sy, 220, 40, C_DIM);
      
      // Loading spinner if this item is being checked off
      if (gState.todoActionLoading && gState.todoActionSummary == summary) {
          float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
          it.line(30, sy + 20, 30 + (int)(cosf(angle)*8), sy + 20 + (int)(sinf(angle)*8), C_WHITE);
      } else {
          it.printf(20, sy + 10, font_small, C_CYAN, TextAlign::TOP_LEFT, "[ ]");
      }

      // Title & Due Date (Original Formatting)
      int textX = 55;
      int textWidth = 165;
      if (due != "none" && !due.empty()) {
          Color dColor = overdue ? C_RED : C_AMBER;
          it.printf(55, sy + 12, font_tiny, dColor, TextAlign::TOP_LEFT, "%s", due.c_str());
          textX = 100;
          textWidth = 120;
      }
      ScrollingText::draw(it, textX, sy + 10, textWidth, summary, font_small, C_WHITE);
      
      ly += 50;
      empty = false;
    }

    if (empty) {
      it.printf(120, getSY(ly + 40), font_small, C_DIMMER, TextAlign::CENTER, "LIST EMPTY");
      ly += 100;
    }
  };
  
  if (shopActive) drawList(gState.shoppingListFormatted);
  else drawList(gState.todoListFormatted);
  
  it.end_clipping();
  
  drawTabContent(10, 45, "SHOP", gState.shoppingListCount, shopActive, C_CYAN);
  drawTabContent(125, 45, "TASKS", gState.todoListCount, todoActive, C_AMBER);

  int totalContentHeight = ly - 40;
  gState.maxScrollY = totalContentHeight > 280 ? (totalContentHeight - 280) : 0;

  drawDetailHeader(it, "LOGISTICS DETAIL");
}

// --- MAIN RENDERER ---

void renderDisplay(display::Display& it) {
  it.fill(C_BLACK);
  
  if (gState.currentView == VIEW_MAIN_DASHBOARD) {
    // Global Header
    drawCommonHeader(it);
    
    // Page Indicator
    drawPageIndicator(it, gState.mainPageIndex, gState.totalMainPages);
    
    // Page Content
    switch (gState.mainPageIndex) {
      case 0: renderPage0_Status(it); break;
      case 1: renderPage1_Music(it); break;
      case 2: renderPage3_House(it); break;
      case 3: renderPage4_Devices(it); break;
    }
  } else {
    // Detail Views
    switch (gState.currentView) {
      case VIEW_DETAIL_VACUUM: renderDetail_Vacuum(it); break;
      case VIEW_DETAIL_LIGHTS: renderDetail_Lights(it); break;
      case VIEW_DETAIL_TODO:   renderDetail_Todo(it); break;
      case VIEW_DETAIL_CLIMATE: renderDetail_Climate(it); break;
      case VIEW_DETAIL_MUSIC:   renderDetail_Music(it); break;
      case VIEW_DETAIL_TIMER:   renderDetail_Timer(it); break;
      default: break;
    }
  }

  // Notification Overlay
  if (!gState.notificationBody.empty()) {
    NotificationRenderer::draw(
      it, 
      gState.notificationSeverity,
      gState.notificationTitle,
      gState.notificationBody,
      font_medium, font_small
    );

    // Full-width clean dismiss button at bottom
    gState.notificationDismissBtn.x = 20;
    gState.notificationDismissBtn.y = 250;
    gState.notificationDismissBtn.w = 200;
    gState.notificationDismissBtn.h = 45;
    gState.notificationDismissBtn.draw(it, "DISMISS", C_WHITE, gState.notificationLoading, gState.notificationLoadingStartTime, 1000, font_small);
  }
}
