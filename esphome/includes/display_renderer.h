#pragma once
#include "esphome.h"
#include "state_manager.h"
#include "dial.h"
#include "notification.h"
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

  // Time Section
  auto time_now = sntp_time->now();
  if (time_now.is_valid()) {
    it.printf(10, 10, font_medium, C_WHITE, TextAlign::TOP_LEFT, "%02d:%02d", 
              time_now.hour, time_now.minute);
    it.printf(75, 12, font_tiny, C_DIM, TextAlign::TOP_LEFT, ":%02d", time_now.second);
  }
  
  it.printf(230, 12, font_tiny, C_GREEN, TextAlign::TOP_RIGHT, "SYS_NOMINAL");
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

void drawTodoItem(display::Display& it, int y, const DisplayState::TodoItem& item) {
  if (item.hasData && !item.title.empty() && item.title != "No tasks") {
    it.printf(25, y, font_small, C_CYAN, TextAlign::TOP_LEFT, "[ ]");
    
    int text_offset = 55;
    if (item.due != "none" && !item.due.empty()) {
       Color date_color = item.isOverdue ? C_RED : C_AMBER;
       it.printf(55, y + 2, font_tiny, date_color, TextAlign::TOP_LEFT, "%s", item.due.c_str());
       text_offset = 100;
    }

    if (text_offset > 60)
      it.printf(text_offset, y, font_small, C_WHITE, TextAlign::TOP_LEFT, "%.14s", item.title.c_str());
    else
      it.printf(text_offset, y, font_small, C_WHITE, TextAlign::TOP_LEFT, "%.22s", item.title.c_str());

  } else if (y == 178) { // Only show "Empty" for the first slot if it's empty
     it.printf(120, y, font_tiny, C_DIMMER, TextAlign::CENTER, "LIST EMPTY");
  }
}

void renderPage0_Status(display::Display& it) {
  auto time_now = sntp_time->now();
  
  // Date & System ID
  if (time_now.is_valid()) {
    const char* days[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
    const char* months[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN", 
                            "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};
    int dayIdx = time_now.day_of_week - 1;
    if(dayIdx < 0) dayIdx = 0;
    
    it.printf(10, 42, font_tiny, C_DIM, TextAlign::TOP_LEFT, "ID: HD-D01 // %s %02d %s", 
              days[dayIdx], time_now.day_of_month, months[time_now.month-1]);
  }
  
  // --- ENVIRONMENT BOX ---
  drawRetroBox(it, 10, 65, 220, 75, "ENVIRONS", C_CYAN);
  
  auto drawMetric = [&](int x, const char* label, float val, const char* unit, Color c) {
    it.printf(x, 82, font_tiny, C_DIM, TextAlign::CENTER, "%s", label);
    if (val != 0)
      it.printf(x, 105, font_small, c, TextAlign::CENTER, "%.0f%s", val, unit);
    else
      it.printf(x, 105, font_small, C_DIMMER, TextAlign::CENTER, "--");
  };

  drawMetric(45, "OUT", gState.outsideTemp, "C", C_CYAN);
  drawMetric(95, "IN", gState.indoorTemp, "C", C_AMBER);
  
  Color co2_color = gState.co2 < 800 ? C_GREEN : (gState.co2 < 1200 ? C_AMBER : C_RED);
  drawMetric(145, "CO2", gState.co2, "", co2_color);
  
  it.printf(195, 82, font_tiny, C_DIM, TextAlign::CENTER, "PRSC");
  it.filled_circle(195, 105, 6, gState.occupancyRadar ? C_GREEN : C_DIMMER);

  // Windows Alert within Environs box if active
  int open_count = gState.getOpenWindowCount();
  if (open_count > 0) {
    it.printf(120, 122, font_tiny, C_RED, TextAlign::CENTER, "!! %d WINDOWS OPEN !!", open_count);
  }

  // --- LOGISTICS BOX (TO-DO) ---
  drawRetroBox(it, 10, 155, 220, 95, "LOGISTICS", C_AMBER);
  drawTodoItem(it, 172, gState.todos[0]);
  drawTodoItem(it, 194, gState.todos[1]);
  drawTodoItem(it, 216, gState.todos[2]);

  // --- HARDWARE STATUS (BADGES) ---
  drawRetroBox(it, 10, 265, 220, 40, "ACTIVE_SUBSYSTEMS", C_DIM);
  
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

// --- PAGE 1: CLIMATE ---

void renderPage1_Climate(display::Display& it) {
  it.printf(10, 42, font_tiny, C_DIM, TextAlign::TOP_LEFT, "SUBSYSTEM: ENVIRONMENT_MONITOR");
  
  // --- AIR QUALITY BOX ---
  drawRetroBox(it, 10, 60, 220, 110, "AIR_QUALITY", C_GREEN);
  
  float co2_val = gState.co2;
  Color co2_color = co2_val < 800.0f ? C_GREEN : (co2_val < 1200.0f ? C_AMBER : C_RED);
  
  it.printf(30, 85, font_tiny, C_DIM, TextAlign::TOP_LEFT, "CO2 CONCENTRATION");
  it.printf(30, 105, font_large, co2_color, TextAlign::TOP_LEFT, "%.0f", co2_val);
  it.printf(110, 120, font_tiny, C_DIM, TextAlign::TOP_LEFT, "PPM");

  // Retro bar gauge
  it.rectangle(30, 140, 180, 10, C_DIMMER);
  float mapped = (co2_val - 400.0f) / 1600.0f;
  if (mapped < 0) mapped = 0; if (mapped > 1) mapped = 1;
  it.filled_rectangle(32, 142, (int)(mapped * 176), 6, co2_color);
  
  // --- THERMAL DYNAMICS BOX ---
  drawRetroBox(it, 10, 185, 220, 115, "THERMAL_DYNAMICS", C_AMBER);
  
  auto drawReadout = [&](int x, int y, const char* label, float val, const char* unit, Color c) {
    it.printf(x, y, font_tiny, C_DIM, TextAlign::TOP_LEFT, "%s", label);
    it.printf(x, y + 15, font_medium, c, TextAlign::TOP_LEFT, "%.1f%s", val, unit);
  };

  drawReadout(30, 210, "INDOOR_TEMP", gState.indoorTemp, "C", C_AMBER);
  drawReadout(130, 210, "INDOOR_HUM", gState.indoorHumidity, "%", C_DIM);
  
  drawReadout(30, 255, "OUTDOOR_TEMP", gState.outsideTemp, "C", C_CYAN);
  drawReadout(130, 255, "OUTDOOR_HUM", gState.outsideHumidity, "%", C_DIM);
}

// --- PAGE 2: HOUSE STATUS ---

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

void renderPage2_House(display::Display& it) {
  it.printf(10, 42, font_tiny, C_DIM, TextAlign::TOP_LEFT, "SUBSYSTEM: DOMICILE_STATUS");
  
  // --- PERIMETER BOX (WINDOWS) ---
  drawRetroBox(it, 10, 60, 220, 85, "PERIMETER", C_GREEN);
  
  auto drawWindow = [&](int x, int y, const char* label, bool is_open) {
    Color c = is_open ? C_RED : C_GREEN;
    it.rectangle(x-10, y, 20, 25, c);
    it.line(x, y, x, y+25, c);
    it.line(x-10, y+12, x+10, y+12, c);
    it.printf(x, y + 30, font_tiny, c, TextAlign::CENTER, "%s", is_open ? "OPEN" : "SHUT");
    it.printf(x, y + 42, font_tiny, C_DIM, TextAlign::CENTER, "%s", label);
  };

  drawWindow(50, 80, "WOHN", gState.windowLiving);
  drawWindow(120, 80, "BAD", gState.windowBath);
  drawWindow(190, 80, "WORK", gState.windowWork);
  
  // --- ILLUMINATION BOX ---
  // Button serves as the boundary
  gState.lightsDetailBtn.x = 10;
  gState.lightsDetailBtn.y = 160;
  gState.lightsDetailBtn.w = 220;
  gState.lightsDetailBtn.h = 75;
  gState.lightsDetailBtn.draw(it, "", C_AMBER, gState.lightsDetailLoading, gState.lightsDetailLoadingStartTime, 0, font_tiny, 0, "ILLUMINATION");

  int livingOn = gState.getLivingRoomActiveCount();
  int officeOn = gState.getOfficeActiveCount();

  it.printf(70, 180, font_medium, livingOn > 0 ? C_AMBER : C_DIM, TextAlign::CENTER, "%d", livingOn);
  it.printf(70, 205, font_tiny, C_DIM, TextAlign::CENTER, "LIVING_RM");

  it.printf(170, 180, font_medium, officeOn > 0 ? C_AMBER : C_DIM, TextAlign::CENTER, "%d", officeOn);
  it.printf(170, 205, font_tiny, C_DIM, TextAlign::CENTER, "OFFICE_RM");
  
  it.printf(120, 218, font_tiny, C_DIM, TextAlign::CENTER, "TAP TO CONFIGURE");

  // --- BIOMETRIC BOX (PRESENCE) ---
  drawRetroBox(it, 10, 250, 220, 55, "BIOMETRICS", C_BLUE);
  
  auto drawPresence = [&](int x, const char* label, bool val) {
    it.printf(x, 265, font_tiny, C_DIM, TextAlign::CENTER, "%s", label);
    it.filled_circle(x, 285, 7, val ? C_GREEN : C_DIMMER);
    it.circle(x, 285, 9, val ? C_GREEN : C_DIMMER);
  };

  drawPresence(70, "MOTION", gState.motionLiving);
  drawPresence(170, "OCCUPIED", gState.occupancyRadar);
}

// --- PAGE 3: DEVICES ---

void renderPage3_Devices(display::Display& it) {
  it.printf(10, 42, font_tiny, C_DIM, TextAlign::TOP_LEFT, "SUBSYSTEM: HARDWARE_INTERFACE");
  
  // --- ROBOROCK BOX ---
  Color vac_c = gState.vacuumCleaning ? C_GREEN : C_CYAN;
  gState.vacuumCardBtn.y = 60;
  gState.vacuumCardBtn.h = 75;
  gState.vacuumCardBtn.draw(it, "", vac_c, gState.vacuumCardLoading, gState.vacuumCardLoadingStartTime, 0, font_tiny, 0, "UNIT_ROBOROCK");

  it.printf(30, 80, font_small, vac_c, TextAlign::TOP_LEFT, "%s", gState.vacuumStatus.c_str());
  it.printf(30, 100, font_tiny, C_DIM, TextAlign::TOP_LEFT, "BATT: %.0f%%", gState.vacuumBattery);
  
  it.rectangle(110, 100, 100, 10, C_DIMMER);
  it.filled_rectangle(112, 102, (int)(gState.vacuumBattery * 0.96f), 6, vac_c);
  
  // --- WASHING MACHINE BOX ---
  std::string wash_status = gState.washingMachineStatus;
  if(wash_status.empty()) wash_status = "IDLE";
  Color wash_c = C_DIM;
  if (wash_status == "Scrubbing Away!") wash_c = C_CYAN;
  else if (wash_status == "Drama in the Drum!") wash_c = C_MAGENTA;
  else if (wash_status == "All Done!") wash_c = C_GREEN;
  else if (wash_status == "Wrinkle Risk Rising!") wash_c = C_RED;
  
  drawRetroBox(it, 10, 150, 220, 65, "UNIT_WASHER", wash_c);
  it.printf(30, 175, font_small, wash_c, TextAlign::TOP_LEFT, "%.20s", wash_status.c_str());
  
  // --- 3D PRINTER BOX ---
  Color prnt_c = gState.printerProgress > 0 ? C_AMBER : C_DIM;
  drawRetroBox(it, 10, 230, 220, 75, "UNIT_PRINTER", prnt_c);
  
  if (gState.printerProgress > 0.0f) {
    it.printf(30, 250, font_small, C_AMBER, TextAlign::TOP_LEFT, "PROGRESS: %.0f%%", gState.printerProgress);
    it.rectangle(30, 275, 180, 10, C_DIMMER);
    it.filled_rectangle(32, 277, (int)(gState.printerProgress * 1.76f), 6, C_AMBER);
  } else {
    it.printf(120, 265, font_small, C_DIM, TextAlign::CENTER, "SYSTEM_READY");
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
      case 1: renderPage1_Climate(it); break;
      case 2: renderPage2_House(it); break;
      case 3: renderPage3_Devices(it); break;
    }
  } else {
    // Detail Views
    switch (gState.currentView) {
      case VIEW_DETAIL_VACUUM: renderDetail_Vacuum(it); break;
      case VIEW_DETAIL_LIGHTS: renderDetail_Lights(it); break;
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
