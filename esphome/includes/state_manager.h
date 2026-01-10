#pragma once
#include "esphome.h"

// Audio Feedback Flags (Global to avoid circular dependencies)
inline volatile bool gPendingSwipeSound = false;
inline volatile bool gPendingTapSound = false;
inline volatile bool gPendingNotificationSound = false;

#include "light_element.h"

// --- NAVIGATION STATE ---
enum ViewState {
  VIEW_MAIN_DASHBOARD,
  VIEW_DETAIL_VACUUM,
  VIEW_DETAIL_LIGHTS,
  VIEW_DETAIL_TODO,
  VIEW_DETAIL_CLIMATE,
  VIEW_DETAIL_MUSIC,
  VIEW_DETAIL_TIMER
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

  // Timer Link (Page 0)
  volatile bool timerLinkLoading = false;
  unsigned long timerLinkLoadingStartTime = 0;
  volatile bool timerLinkActionRequested = false; // Dummy
  Button timerLinkBtn = Button(75, 40, 100, 30);
  
  // Climate Detail Navigation
  volatile bool climateDetailLoading = false;
  unsigned long climateDetailLoadingStartTime = 0;
  volatile bool climateDetailActionRequested = false;
  Button climateDetailBtn = Button(10, 40, 220, 30);



  // Windows Alert Button
  volatile bool windowsAlertLoading = false;
  unsigned long windowsAlertLoadingStartTime = 0;
  volatile bool windowsAlertActionRequested = false;
  Button windowsAlertBtn = Button(20, 70, 200, 20);

  // Music Buttons (Page 1)
  int musicViewTab = 0; // 0 = Living Room, 1 = Bose
  Button musicMainTabBtn = Button(10, 40, 105, 30);
  Button musicBoseTabBtn = Button(125, 40, 105, 30);

  volatile bool musicPlayLoading = false;
  unsigned long musicPlayLoadingStartTime = 0;
  volatile bool musicPlayActionRequested = false;
  Button musicPlayBtn = Button(10, 180, 220, 45);

  volatile bool musicLikeLoading = false;
  unsigned long musicLikeLoadingStartTime = 0;
  volatile bool musicLikeActionRequested = false;
  Button musicLikeBtn = Button(10, 235, 105, 45);

  volatile bool musicSkipLoading = false;
  unsigned long musicSkipLoadingStartTime = 0;
  volatile bool musicSkipActionRequested = false;
  Button musicSkipBtn = Button(125, 235, 105, 45);

  volatile bool musicDetailLoading = false;
  unsigned long musicDetailLoadingStartTime = 0;
  volatile bool musicDetailActionRequested = false; // Dummy
  Button musicDetailBtn = Button(10, 75, 220, 100); // Overlay for Page 1 NOW_PLAYING section

  // Music Detail Actions
  volatile bool musicTransferOfficeLoading = false;
  unsigned long musicTransferOfficeStartTime = 0;
  volatile bool musicTransferOfficeRequested = false;
  Button musicTransferOfficeBtn = Button(10, 75, 105, 45);

  volatile bool musicTransferLivingLoading = false;
  unsigned long musicTransferLivingStartTime = 0;
  volatile bool musicTransferLivingRequested = false;
  Button musicTransferLivingBtn = Button(125, 75, 105, 45);

  // Media Detail Actions (Volume & Track)
  float mediaVolume = 0; // 0.0 to 1.0
  float mediaVolumeBose = 0; // 0.0 to 1.0
  bool volumeDragging = false;
  
  volatile bool musicNextLoading = false;
  unsigned long musicNextStartTime = 0;
  volatile bool musicNextRequested = false;
  Button musicNextBtn = Button(130, 200, 100, 50); 

  volatile bool musicPrevLoading = false;
  unsigned long musicPrevStartTime = 0;
  volatile bool musicPrevRequested = false;
  Button musicPrevBtn = Button(10, 200, 100, 50); 
  
  volatile bool musicVolumeActionRequested = false; // Flag to trigger volume update in HA
  float musicVolumeSetPoint = 0; // Target volume to set


  // Vacuum Badge Button (Page 0)
  volatile bool vacuumBadgeLoading = false;
  unsigned long vacuumBadgeLoadingStartTime = 0;
  volatile bool vacuumBadgeActionRequested = false;
  Button vacuumBadgeBtn = Button(0, 0, 60, 20);

  // Lights Detail Navigation
  volatile bool lightsDetailLoading = false;
  unsigned long lightsDetailLoadingStartTime = 0;
  volatile bool lightsDetailActionRequested = false; // Dummy
  Button lightsDetailBtn = Button(10, 140, 220, 75); // Overlay for Page 2 lights section

  // To-Do Detail Navigation
  volatile bool todoDetailLoading = false;
  unsigned long todoDetailLoadingStartTime = 0;
  volatile bool todoDetailActionRequested = false; // Dummy
  Button todoDetailBtn = Button(10, 90, 220, 90); // Overlay for Page 0 logistics section

  // --- SENSORS ---
  
  // Climate
  float outsideTemp = 0;
  float outsideHumidity = 0;
  float indoorTemp = 0;
  float indoorHumidity = 0;
  float avgTemp = 0;
  float avgHumidity = 0;
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
  
  // Media Player
  std::string mediaTitle = "Nothing playing";
  std::string mediaArtist = "";
  std::string mediaStatus = "idle";

  std::string mediaTitleBose = "Nothing playing";
  std::string mediaArtistBose = "";
  std::string mediaStatusBose = "idle";

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
  
  // To-Do Lists
  std::string todoListFormatted = "LIST EMPTY";
  std::string shoppingListFormatted = "LIST EMPTY";
  int todoListCount = 0;
  int shoppingListCount = 0;
  int todoViewTab = 0; // 0 = Shopping, 1 = To-Do
  Button shoppingTabBtn = Button(10, 45, 105, 35);
  Button todoTabBtn = Button(125, 45, 105, 35);

  // Actions
  volatile bool todoActionRequested = false;
  std::string todoActionSummary = "";
  volatile bool todoActionLoading = false;
  unsigned long todoActionStartTime = 0;

  // --- NOTIFICATIONS ---
  std::string notificationTitle = "";
  std::string notificationBody = "";
  std::string notificationSeverity = "info"; // info, warn, alert, question
  volatile bool notificationLoading = false;
  unsigned long notificationLoadingStartTime = 0;
  volatile bool notificationActionRequested = false;
  Button notificationDismissBtn = Button(20, 240, 200, 50);

  // Timer Detail State
  int timerRemaining = 0;   // In seconds
  int timerDuration = 300;  // Initial 5 min
  bool timerActive = false;
  bool timerDragging = false;
  Button timerStartBtn = Button(10, 240, 105, 45);
  Button timerResetBtn = Button(125, 240, 105, 45);
  Button timerPlusBtn = Button(180, 80, 45, 45);
  Button timerMinusBtn = Button(15, 80, 45, 45);
  // Slider area: 10, 150, 220, 40

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
    gPendingSwipeSound = true;
  }
  gState.lastTouchTime = millis();
}

void prevPage() {
  if (gState.currentView == VIEW_MAIN_DASHBOARD) {
    gState.mainPageIndex = (gState.mainPageIndex - 1 + gState.totalMainPages) % gState.totalMainPages;
    gPendingSwipeSound = true;
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
