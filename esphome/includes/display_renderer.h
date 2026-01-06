#pragma once
#include "esphome.h"
#include "state_manager.h"
#include "dial.h"
#include <cmath>

// Forward declare fonts
namespace esphome {
  namespace font {
    class Font;
  }
}
extern esphome::font::Font* font_tiny;
extern esphome::font::Font* font_small;
extern esphome::font::Font* font_medium;
extern esphome::font::Font* font_large;

// Forward declare time
extern esphome::sntp::SNTPComponent *sntp_time;

// Colors
const Color C_BLACK(0, 0, 0);
const Color C_WHITE(255, 255, 255);
const Color C_CYAN(0, 255, 255);
const Color C_AMBER(255, 180, 0);
const Color C_GREEN(0, 255, 100);
const Color C_RED(255, 60, 60);
const Color C_BLUE(80, 140, 255);
const Color C_MAGENTA(255, 0, 200);
const Color C_DIM(80, 80, 80);
const Color C_DIMMER(40, 40, 40);

// --- HELPER FUNCTIONS ---

void drawCommonHeader(display::Display& it) {
  // Decorative Frame
  it.rectangle(4, 4, 232, 312, C_DIMMER);
  it.line(8, 8, 25, 8, C_DIM);
  it.line(8, 8, 8, 25, C_DIM);
  it.line(232, 8, 215, 8, C_DIM);
  it.line(232, 8, 232, 25, C_DIM);
  it.line(8, 312, 25, 312, C_DIM);
  it.line(8, 312, 8, 295, C_DIM);
  it.line(232, 312, 215, 312, C_DIM);
  it.line(232, 312, 232, 295, C_DIM);

  // Time
  auto time_now = sntp_time->now();
  if (time_now.is_valid()) {
    it.printf(120, 18, font_medium, C_WHITE, TextAlign::CENTER, "%02d:%02d", 
              time_now.hour, time_now.minute);
    it.printf(200, 20, font_tiny, C_DIM, TextAlign::CENTER, "%02d", time_now.second);
  }
  it.line(15, 38, 225, 38, C_DIM);
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
  
  // Date
  if (time_now.is_valid()) {
    const char* days[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
    const char* months[] = {"JAN", "FEB", "MAR", "APR", "MAY", "JUN", 
                            "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"};
    int dayIdx = time_now.day_of_week - 1;
    if(dayIdx < 0) dayIdx = 0;
    int monthIdx = time_now.month - 1;
    if(monthIdx < 0) monthIdx = 0;
    
    it.printf(120, 52, font_small, C_AMBER, TextAlign::CENTER, "%s %02d %s", 
              days[dayIdx], time_now.day_of_month, months[monthIdx]);
  }
  
  // Quick Status Row
  it.line(15, 70, 225, 70, C_DIM);
  it.printf(120, 77, font_tiny, C_DIM, TextAlign::CENTER, "STATUS");
  
  // Temp OUT
  it.printf(45, 95, font_tiny, C_CYAN, TextAlign::CENTER, "OUT");
  if (gState.outsideTemp != 0) {  // Simple validation since sensors initialize to 0
    it.printf(45, 110, font_small, C_CYAN, TextAlign::CENTER, "%.0fC", gState.outsideTemp);
  } else {
    it.printf(45, 110, font_small, C_DIM, TextAlign::CENTER, "--");
  }
  
  // Temp IN
  it.printf(95, 95, font_tiny, C_AMBER, TextAlign::CENTER, "IN");
  if (gState.indoorTemp != 0) {
    it.printf(95, 110, font_small, C_AMBER, TextAlign::CENTER, "%.0fC", gState.indoorTemp);
  } else {
    it.printf(95, 110, font_small, C_DIM, TextAlign::CENTER, "--");
  }
  
  // CO2
  it.printf(145, 95, font_tiny, C_DIM, TextAlign::CENTER, "CO2");
  if (gState.co2 != 0) {
    Color co2_color = gState.co2 < 800 ? C_GREEN : (gState.co2 < 1200 ? C_AMBER : C_RED);
    it.printf(145, 110, font_small, co2_color, TextAlign::CENTER, "%.0f", gState.co2);
  } else {
    it.printf(145, 110, font_small, C_DIM, TextAlign::CENTER, "--");
  }
  
  // Presence
  it.printf(195, 95, font_tiny, C_DIM, TextAlign::CENTER, "HOME");
  it.filled_circle(195, 115, 6, gState.occupancyRadar ? C_GREEN : C_DIMMER);
  
  // Windows Alert
  int open_count = gState.getOpenWindowCount();
  if (open_count > 0) {
    char buf[32];
    snprintf(buf, sizeof(buf), "%d WINDOW%s OPEN", open_count, open_count > 1 ? "S" : "");
    gState.windowsAlertBtn.draw(it, buf, C_RED, gState.windowsAlertLoading, gState.windowsAlertLoadingStartTime, 200, font_small);
  }
  
  // To-Do List
  it.line(15, 155, 225, 155, C_DIM);
  it.printf(120, 162, font_tiny, C_DIM, TextAlign::CENTER, "TO-DO LIST");
  
  drawTodoItem(it, 178, gState.todos[0]);
  drawTodoItem(it, 200, gState.todos[1]);
  drawTodoItem(it, 222, gState.todos[2]);
  
  // Active Devices Badge
  it.line(15, 248, 225, 248, C_DIM);
  it.printf(120, 255, font_tiny, C_DIM, TextAlign::CENTER, "ACTIVE DEVICES");
  
  int badge_x = 25;
  int badge_y = 272;
  bool any_active = false;
  
  // Vacuum
  if (gState.vacuumCleaning) {
    gState.vacuumBadgeBtn.x = badge_x;
    gState.vacuumBadgeBtn.y = badge_y;
    gState.vacuumBadgeBtn.w = 60;
    gState.vacuumBadgeBtn.h = 18;
    gState.vacuumBadgeBtn.draw(it, "VACUUM", C_GREEN, gState.vacuumBadgeLoading, gState.vacuumBadgeLoadingStartTime, 200, font_tiny);
    
    badge_x += 65;
    any_active = true;
  }
  
  // Washer
  bool washer_active = (gState.washingMachineStatus != "All Done!" && 
                        !gState.washingMachineStatus.empty() && 
                        gState.washingMachineStatus != "Next Load Please!");
  if (washer_active) {
    Color w_color = (gState.washingMachineStatus == "Wrinkle Risk Rising!") ? C_RED : C_MAGENTA;
    it.filled_rectangle(badge_x, badge_y, 60, 18, w_color);
    it.printf(badge_x + 30, badge_y + 9, font_tiny, C_BLACK, TextAlign::CENTER, "WASHER");
    badge_x += 65;
    any_active = true;
  }
  
  // Printer
  if (gState.printerProgress > 0) {
    it.filled_rectangle(badge_x, badge_y, 60, 18, C_AMBER);
    it.printf(badge_x + 30, badge_y + 9, font_tiny, C_BLACK, TextAlign::CENTER, "PRINT");
    badge_x += 65;
    any_active = true;
  }
  
  // Beamer
  if (gState.beamerOn) {
    it.filled_rectangle(badge_x, badge_y, 60, 18, C_BLUE);
    it.printf(badge_x + 30, badge_y + 9, font_tiny, C_BLACK, TextAlign::CENTER, "BEAMER");
    badge_x += 65;
    any_active = true;
  }
  
  if (!any_active) {
    it.printf(120, badge_y + 6, font_tiny, C_DIMMER, TextAlign::CENTER, "ALL IDLE");
  }
}

// --- PAGE 1: CLIMATE ---

void renderPage1_Climate(display::Display& it) {
  it.printf(120, 48, font_tiny, C_DIM, TextAlign::CENTER, "CLIMATE MONITOR");
  
  // CO2 Gauge
  int gx = 120, gy = 120, gr = 65;
  
  for (int i = -45; i <= 225; i += 4) {
    float angle = i * 3.14159265f / 180.0f;
    it.draw_pixel_at(gx + cosf(angle) * gr, gy + sinf(angle) * gr, C_DIM);
  }
  
  const char* labels[] = {"400", "800", "1200", "1600", "2000"};
  for (int i = 0; i <= 4; i++) {
    float angle = (225 - i * 67.5f) * 3.14159265f / 180.0f;
    int x1 = gx + (int)(cosf(angle) * (gr - 6));
    int y1 = gy + (int)(sinf(angle) * (gr - 6));
    int x2 = gx + (int)(cosf(angle) * gr);
    int y2 = gy + (int)(sinf(angle) * gr);
    it.line(x1, y1, x2, y2, C_WHITE);
    
    int lx = gx + (int)(cosf(angle) * (gr - 18));
    int ly = gy + (int)(sinf(angle) * (gr - 18));
    it.printf(lx, ly, font_tiny, C_DIM, TextAlign::CENTER, "%s", labels[i]);
  }
  
  float co2_val = gState.co2;
  if(co2_val < 400.0f) co2_val = 400.0f;
  Color needle_color = co2_val < 800.0f ? C_GREEN : (co2_val < 1200.0f ? C_AMBER : C_RED);
  
  float mapped = (co2_val - 400.0f) / 1600.0f;
  if (mapped < 0.0f) mapped = 0.0f;
  if (mapped > 1.0f) mapped = 1.0f;
  float needle_angle = (225.0f - mapped * 270.0f) * 3.14159265f / 180.0f;
  
  int nx = gx + (int)(cosf(needle_angle) * (gr - 10));
  int ny = gy + (int)(sinf(needle_angle) * (gr - 10));
  it.line(gx, gy, nx, ny, needle_color);
  it.filled_circle(gx, gy, 4, C_WHITE);
  
  it.printf(120, 185, font_tiny, C_DIM, TextAlign::CENTER, "CO2 ppm");
  it.printf(120, 202, font_large, needle_color, TextAlign::TOP_CENTER, "%.0f", gState.co2);
  
  it.line(20, 235, 220, 235, C_DIM);
  
  // Outdoor
  it.printf(70, 242, font_tiny, C_CYAN, TextAlign::CENTER, "OUTDOOR");
  it.printf(70, 260, font_medium, C_CYAN, TextAlign::CENTER, "%.1fC", gState.outsideTemp);
  it.printf(70, 282, font_small, C_DIM, TextAlign::CENTER, "%.0f%% RH", gState.outsideHumidity);
  
  it.line(120, 245, 120, 285, C_DIMMER);
  
  // Indoor
  it.printf(170, 242, font_tiny, C_AMBER, TextAlign::CENTER, "INDOOR");
  it.printf(170, 260, font_medium, C_AMBER, TextAlign::CENTER, "%.1fC", gState.indoorTemp);
  it.printf(170, 282, font_small, C_DIM, TextAlign::CENTER, "%.0f%% RH", gState.indoorHumidity);
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
  it.printf(120, 48, font_tiny, C_DIM, TextAlign::CENTER, "HOUSE STATUS");
  
  // Windows
  it.printf(120, 65, font_small, C_WHITE, TextAlign::CENTER, "WINDOWS");
  it.line(40, 78, 200, 78, C_DIM);
  
  drawWindowIcon(it, 50, 88, "WOHN", gState.windowLiving);
  drawWindowIcon(it, 120, 88, "BAD", gState.windowBath);
  drawWindowIcon(it, 190, 88, "WORK", gState.windowWork);
  
  // Lights
  it.printf(120, 155, font_small, C_WHITE, TextAlign::CENTER, "LIGHTS");
  it.line(40, 168, 200, 168, C_DIM);
  
  // Invisible button overlay for the lights section
  gState.lightsDetailBtn.draw(it, "", Color(0,0,0,0), gState.lightsDetailLoading, gState.lightsDetailLoadingStartTime, 0, font_tiny);

  drawBulbIcon(it, 50, 190, "WOHN", gState.lightLiving);
  drawBulbIcon(it, 120, 190, "DESK", gState.lightDesk);
  drawBulbIcon(it, 190, 190, "LAMP", gState.lightLamp);
  
  // Presence
  it.printf(120, 235, font_small, C_WHITE, TextAlign::CENTER, "PRESENCE");
  it.line(40, 248, 200, 248, C_DIM);
  
  it.printf(80, 262, font_tiny, C_DIM, TextAlign::CENTER, "MOTION");
  it.filled_circle(80, 280, 8, gState.motionLiving ? C_GREEN : C_DIMMER);
  
  it.printf(160, 262, font_tiny, C_DIM, TextAlign::CENTER, "OCCUPIED");
  it.filled_circle(160, 280, 8, gState.occupancyRadar ? C_GREEN : C_DIMMER);
}

// --- PAGE 3: DEVICES ---

void renderPage3_Devices(display::Display& it) {
  it.printf(120, 48, font_tiny, C_DIM, TextAlign::CENTER, "DEVICES");
  
  // Roborock Card
  Color vac_base_color = gState.vacuumCleaning ? C_GREEN : C_CYAN;
  gState.vacuumCardBtn.draw(it, "", vac_base_color, gState.vacuumCardLoading, gState.vacuumCardLoadingStartTime, 200, font_small);

  it.printf(120, 65, font_small, C_WHITE, TextAlign::CENTER, "ROBOROCK");
  // it.line(40, 78, 200, 78, C_DIM); // Removed line as button draws border
  
  Color vac_color = gState.vacuumCleaning ? C_GREEN : C_CYAN;
  it.printf(120, 92, font_medium, vac_color, TextAlign::CENTER, "%s", 
            gState.vacuumStatus.c_str());
  
  it.printf(35, 118, font_tiny, C_DIM, TextAlign::TOP_LEFT, "BAT");
  it.rectangle(55, 115, 120, 14, C_DIM);
  float batt = gState.vacuumBattery;
  Color bc = batt > 50.0f ? C_GREEN : (batt > 20.0f ? C_AMBER : C_RED);
  it.filled_rectangle(57, 117, (int)((batt / 100.0f) * 116), 10, bc);
  it.printf(185, 116, font_tiny, bc, TextAlign::TOP_LEFT, "%.0f%%", batt);
  
  // Washing Machine (positioned lower)
  it.printf(120, 150, font_small, C_WHITE, TextAlign::CENTER, "WASHING MACHINE");
  it.line(40, 163, 200, 163, C_DIM);
  
  std::string wash_status = gState.washingMachineStatus;
  if(wash_status.empty()) wash_status = "---";
  
  Color wash_color = C_DIM;
  if (wash_status == "Scrubbing Away!") wash_color = C_CYAN;
  else if (wash_status == "Drama in the Drum!") wash_color = C_MAGENTA;
  else if (wash_status == "All Done!") wash_color = C_GREEN;
  else if (wash_status == "Wrinkle Risk Rising!") wash_color = C_RED;
  else if (wash_status == "Next Load Please!") wash_color = C_DIM;
  
  it.printf(120, 175, font_medium, wash_color, TextAlign::CENTER, "%.18s", wash_status.c_str());
  
  // 3D Printer
  it.printf(120, 210, font_small, C_WHITE, TextAlign::CENTER, "3D PRINTER");
  it.line(40, 223, 200, 223, C_DIM);
  
  if (gState.printerProgress > 0.0f) {
    it.printf(120, 238, font_tiny, C_AMBER, TextAlign::CENTER, "PRINTING");
    it.rectangle(30, 253, 180, 14, C_DIM);
    it.filled_rectangle(32, 255, (int)((gState.printerProgress / 100.0f) * 176), 10, C_AMBER);
    it.printf(120, 272, font_medium, C_AMBER, TextAlign::CENTER, "%.0f%%", gState.printerProgress);
  } else {
    it.printf(120, 255, font_medium, C_DIM, TextAlign::CENTER, "IDLE");
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
}
