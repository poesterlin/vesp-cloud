#pragma once
#include "esphome.h"

// --- NAVIGATION STATE ---
enum ViewState {
  VIEW_MAIN_DASHBOARD,
  VIEW_DETAIL_VACUUM,
  VIEW_DETAIL_LIGHTS,
  VIEW_DETAIL_TODO
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
  bool lightLiving = false;
  bool lightDesk = false;
  bool lightLamp = false;
  
  // Presence
  bool motionLiving = false;
  bool occupancyRadar = false;
  
  // Devices
  float vacuumBattery = 0;
  bool vacuumCleaning = false;
  bool vacuumLoading = false;
  unsigned long vacuumLoadingStartTime = 0;
  std::string vacuumStatus = "Unknown";
  
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
};

// Global instance
static DisplayState gState;

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
