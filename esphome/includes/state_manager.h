#pragma once
#include "esphome.h"
#include "light_element.h"

// --- NAVIGATION STATE ---
enum ViewState {
  VIEW_MAIN_DASHBOARD,
  VIEW_DETAIL_VACUUM,
  VIEW_DETAIL_LIGHTS,
  VIEW_DETAIL_TODO
};

struct LightControl {
  bool state = false;
  volatile bool loading = false;
  volatile bool actionRequested = false;
  unsigned long loadingStartTime = 0;
  LightElement btn;
};

// Centralized state for the display
struct DisplayState {
  // Page management
  ViewState currentView = VIEW_MAIN_DASHBOARD;
  int mainPageIndex = 0; // Tracks the carousel index (0-3)
  int totalMainPages = 4;
  
  // Scrolling for Detail Views
  int scrollY = 0;
  int maxScrollY = 0; // Updated by renderer based on content height
  
  // Touch State
  unsigned long lastTouchTime = 0;
  volatile bool backLoading = false;
  volatile bool backActionRequested = false;
  unsigned long backLoadingStartTime = 0;
  Button backBtn = Button(5, 5, 40, 30);
  
  // Windows Alert Button
  volatile bool windowsAlertLoading = false;
  unsigned long windowsAlertLoadingStartTime = 0;
  volatile bool windowsAlertActionRequested = false;
  Button windowsAlertBtn = Button(20, 132, 200, 20);

  // Vacuum Badge Button (Page 0)
  volatile bool vacuumBadgeLoading = false;
  unsigned long vacuumBadgeLoadingStartTime = 0;
  volatile bool vacuumBadgeActionRequested = false;
  Button vacuumBadgeBtn = Button(0, 0, 60, 20);

  // Lights Detail Navigation
  volatile bool lightsDetailLoading = false;
  unsigned long lightsDetailLoadingStartTime = 0;
  volatile bool lightsDetailActionRequested = false; // Dummy
  Button lightsDetailBtn = Button(40, 155, 160, 80); // Overlay for Page 2 lights section

  // --- SENSORS ---
  
  // Climate
  float outsideTemp = 0;
  float outsideHumidity = 0;
  float indoorTemp = 0;
  float indoorHumidity = 0;
  float co2 = 0;
  float indoorLight = 0;
  
  // Status
  bool wifiConnected = false;
  
  // Windows (true = open)
  bool windowLiving = false;
  bool windowBath = false;
  bool windowWork = false;
  
  // Lights (true = on)
  LightControl lightStehlampe;      // switch.stehlampe_switch
  LightControl lightWohnzimmer;     // light.wohnzimmer_licht_light
  LightControl lightKleineLampe;    // switch.kleine_lampe_switch
  LightControl lightWLED;           // light.wled
  LightControl lightStehlampeOben;  // light.stehlampe_oben
  LightControl lightKamera;         // light.innr_rf_262_light

  LightControl lightOffice;         // light.schlafzimmer_licht_light
  LightControl lightGrosseLED;      // switch.grosse_led_switch

  // Legacy (mapping for compatibility if needed, or we can just replace them)
  bool lightLiving = false;
  bool lightDesk = false;
  bool lightLamp = false;
  
  // Presence
  bool motionLiving = false;
  bool occupancyRadar = false;
  
  // Devices
  float vacuumBattery = 0;
  bool vacuumCleaning = false;
  volatile bool vacuumLoading = false;
  volatile bool vacuumActionRequested = false;
  unsigned long vacuumLoadingStartTime = 0;
  std::string vacuumStatus = "Unknown";
  Button vacuumBtn = Button(10, 180, 220, 50);

  volatile bool vacuumCardLoading = false;
  unsigned long vacuumCardLoadingStartTime = 0;
  volatile bool vacuumCardActionRequested = false; // Dummy for processTap
  Button vacuumCardBtn = Button(15, 60, 210, 75);

  float printerProgress = 0;
  std::string printerFilename = "";
  
  std::string washingMachineStatus = "";
  
  bool beamerOn = false;
  float beamerPower = 0;
  
  // To-Do List
  struct TodoItem {
    std::string title;
    std::string due;
    bool isOverdue;
    bool hasData;
  } todos[3];

  // --- UI HELPERS ---
  
  int getOpenWindowCount() {
    return (windowLiving ? 1 : 0) + (windowBath ? 1 : 0) + (windowWork ? 1 : 0);
  }

  int getLivingRoomActiveCount() {
    return (lightStehlampe.state ? 1 : 0) + 
           (lightWohnzimmer.state ? 1 : 0) + 
           (lightKleineLampe.state ? 1 : 0) + 
           (lightWLED.state ? 1 : 0) + 
           (lightStehlampeOben.state ? 1 : 0) + 
           (lightKamera.state ? 1 : 0);
  }
  
  int getOfficeActiveCount() {
    return (lightOffice.state ? 1 : 0) + (lightGrosseLED.state ? 1 : 0);
  }
};

// Global instance
inline DisplayState gState;

// State update helpers
void nextPage() {
  if (gState.currentView == VIEW_MAIN_DASHBOARD) {
    gState.mainPageIndex = (gState.mainPageIndex + 1) % gState.totalMainPages;
  }
  gState.lastTouchTime = millis();
}

void prevPage() {
  if (gState.currentView == VIEW_MAIN_DASHBOARD) {
    gState.mainPageIndex = (gState.mainPageIndex - 1 + gState.totalMainPages) % gState.totalMainPages;
  }
  gState.lastTouchTime = millis();
}

void setPage(int page) {
  if (page >= 0 && page < gState.totalMainPages) {
    gState.currentView = VIEW_MAIN_DASHBOARD;
    gState.mainPageIndex = page;
    gState.lastTouchTime = millis();
  }
}

// Navigation Helpers
void openView(ViewState view) {
  gState.currentView = view;
  gState.scrollY = 0;
  gState.lastTouchTime = millis();
}

void goBack() {
  gState.currentView = VIEW_MAIN_DASHBOARD;
  gState.lastTouchTime = millis();
}
