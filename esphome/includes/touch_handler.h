#pragma once
#include "esphome.h"
#include "state_manager.h"

class TouchHandler {
public:
  static void handleTouch(int x, int y, bool touched) {
    static bool wasTouched = false;
    static int startX = 0;
    static int startY = 0;
    static int lastY = 0; // For drag scrolling
    
    // Touch Start
    if (touched && !wasTouched) {
      startX = x;
      startY = y;
      lastY = y;
      gState.lastTouchTime = millis();

      // Detect start of timer drag (only when timer is not running)
      if (gState.currentView == VIEW_DETAIL_TIMER && !gState.timerActive) {
        if (x >= 10 && x <= 230 && y >= 150 && y <= 210) {
          gState.timerDragging = true;
        }
      }
      
      // Detect start of music volume drag
      if (gState.currentView == VIEW_DETAIL_MUSIC) {
        // Slider box starts at logical Y = 135 in the new condensed layout
        int sy = 135 + gState.scrollY;
        if (x >= 10 && x <= 230 && y >= sy && y <= sy + 70) {
          gState.volumeDragging = true;
        }
      }
    }
    // Touch Move
    else if (touched && wasTouched) {
      gState.lastTouchTime = millis();
      
      if (gState.timerDragging) {
        int sliderX = 25;
        int sliderW = 190;
        float progress = (float)(x - sliderX) / (float)sliderW;
        if (progress < 0) progress = 0; if (progress > 1) progress = 1;
        
        // Round to nearest minute
        int minutes = (int)(progress * 60.0f + 0.5f);
        gState.timerRemaining = minutes * 60;
        gState.timerDuration = gState.timerRemaining;
      }
      else if (gState.volumeDragging) {
        int sliderX = 25;
        int sliderW = 190;
        float progress = (float)(x - sliderX) / (float)sliderW;
        if (progress < 0) progress = 0; if (progress > 1) progress = 1;
        
        gState.musicVolumeSetPoint = progress;
        gState.musicVolumeActionRequested = true; // Trigger update
        // Local update for immediate feedback
        if (gState.musicViewTab == 0) gState.mediaVolume = progress;
        else gState.mediaVolumeBose = progress;
      }
      // Handle Scrolling in Detail Views
      else if (gState.currentView != VIEW_MAIN_DASHBOARD) {
        int dy = y - lastY;
        
        // Ignore jitter and massive jumps (likely sensor noise)
        if (abs(dy) > 0 && abs(dy) < 100) {
          gState.scrollY += dy;
          
          // Clamp Scroll
          if (gState.scrollY > 0) gState.scrollY = 0; 
          if (gState.scrollY < -gState.maxScrollY) gState.scrollY = -gState.maxScrollY;
        }
        
        lastY = y;
      }
    }
    // Touch Release
    else if (!touched && wasTouched) {
      gState.timerDragging = false;
      gState.volumeDragging = false;
      int dx = x - startX;
      int dy = y - startY;
      
      // Detect Swipe (Horizontal) - Only in Dashboard
      if (gState.currentView == VIEW_MAIN_DASHBOARD) {
        // Swipe detection - prioritize horizontal movement
        if (abs(dx) > 30) {
          // Swipe Right on screen (dx > 0) = Previous Page
          if (dx > 30) {
            prevPage(); 
          } 
          // Swipe Left on screen (dx < 0) = Next Page
          else if (dx < -30) {
            nextPage(); 
          }
        }
        // Tap (Minimal movement in both directions)
        // Reduced horizontal tolerance to prevent swipe starts from triggering clicks
        else if (abs(dx) < 10 && abs(dy) < 20) {
          handleTap(startX, startY);
        }
      } 
      // Detail View Tap
      else {
        if (abs(dx) < 20 && abs(dy) < 20) {
           handleTap(startX, startY);
        }
      }
    }
    
    wasTouched = touched;
  }

private:
  static void handleTap(int x, int y) {
    // 0. Notification Interception
    if (!gState.notificationBody.empty()) {
      ESP_LOGI("touch", "Notification active, checking dismiss button at %d,%d", x, y);
      if (gState.notificationDismissBtn.processTap(x, y, gState.notificationLoading, gState.notificationLoadingStartTime, gState.notificationActionRequested)) {
        ESP_LOGI("touch", "Notification DISMISS pressed!");
        return;
      }
      ESP_LOGI("touch", "Notification active, but missed dismiss button");
      // If notification is showing, we block other taps
      return;
    }

    if (gState.currentView == VIEW_MAIN_DASHBOARD) {
      
      // Page 0: Status Page
      if (gState.mainPageIndex == 0) {
        // Climate Detail (Environment Bar)
        if (gState.climateDetailBtn.processTap(x, y, gState.climateDetailLoading, gState.climateDetailLoadingStartTime, gState.climateDetailActionRequested)) {
           openView(VIEW_DETAIL_CLIMATE);
           return;
        }

        // Timer Link Overlay
        if (gState.timerLinkBtn.processTap(x, y, gState.timerLinkLoading, gState.timerLinkLoadingStartTime, gState.timerLinkActionRequested)) {
           openView(VIEW_DETAIL_TIMER);
           return;
        }

        // Windows Alert Badge
        if (gState.getOpenWindowCount() > 0) {
          if (gState.windowsAlertBtn.processTap(x, y, gState.windowsAlertLoading, gState.windowsAlertLoadingStartTime, gState.windowsAlertActionRequested)) {
             setPage(2); // Go to House Status page
             return;
          }
        }
        
        // Active Vacuum Badge
        if (gState.vacuumCleaning) {
          if (gState.vacuumBadgeBtn.processTap(x, y, gState.vacuumBadgeLoading, gState.vacuumBadgeLoadingStartTime, gState.vacuumBadgeActionRequested)) {
             openView(VIEW_DETAIL_VACUUM);
             return;
          }
        }
        
        // Logistics Card (To-Do)
        if (gState.todoDetailBtn.processTap(x, y, gState.todoDetailLoading, gState.todoDetailLoadingStartTime, gState.todoDetailActionRequested)) {
           openView(VIEW_DETAIL_TODO);
           return;
        }
      }
      // Page 1: Music
      else if (gState.mainPageIndex == 1) {
        // Tabs
        bool dummyLoading = false;
        unsigned long dummyTime = 0;
        bool dummyAction = false;
        
        if (gState.musicMainTabBtn.processTap(x, y, dummyLoading, dummyTime, dummyAction)) {
           gState.musicViewTab = 0;
           gPendingTapSound = true;
           return;
        }
        if (gState.musicBoseTabBtn.processTap(x, y, dummyLoading, dummyTime, dummyAction)) {
           gState.musicViewTab = 1;
           gPendingTapSound = true;
           return;
        }

        if (gState.musicDetailBtn.processTap(x, y, gState.musicDetailLoading, gState.musicDetailLoadingStartTime, gState.musicDetailActionRequested)) {
          openView(VIEW_DETAIL_MUSIC);
          return;
        }
        
        // Only allow controls if Main Player (Tab 0) is active
        if (gState.musicViewTab == 0) {
            if (gState.musicPlayBtn.processTap(x, y, gState.musicPlayLoading, gState.musicPlayLoadingStartTime, gState.musicPlayActionRequested)) return;
            if (gState.musicLikeBtn.processTap(x, y, gState.musicLikeLoading, gState.musicLikeLoadingStartTime, gState.musicLikeActionRequested)) return;
            if (gState.musicSkipBtn.processTap(x, y, gState.musicSkipLoading, gState.musicSkipLoadingStartTime, gState.musicSkipActionRequested)) return;
        }
      }
      // Page 2: House Status -> Open Light Details
      else if (gState.mainPageIndex == 2) {
        if (gState.lightsDetailBtn.processTap(x, y, gState.lightsDetailLoading, gState.lightsDetailLoadingStartTime, gState.lightsDetailActionRequested)) {
          openView(VIEW_DETAIL_LIGHTS);
          return;
        }
      }
      // Page 3: Devices Page -> Open Details
      else if (gState.mainPageIndex == 3) {
        // Vacuum Card Button
        if (gState.vacuumCardBtn.processTap(x, y, gState.vacuumCardLoading, gState.vacuumCardLoadingStartTime, gState.vacuumCardActionRequested)) {
          openView(VIEW_DETAIL_VACUUM);
          return;
        }
      }
      
    } else {
      // In Detail View -> Check for Back Button
      if (gState.backBtn.processTap(x, y, gState.backLoading, gState.backLoadingStartTime, gState.backActionRequested)) {
        goBack();
        return;
      }

      // Music Detail View Buttons
      if (gState.currentView == VIEW_DETAIL_MUSIC) {
        if (gState.musicTransferOfficeBtn.processTap(x, y, gState.musicTransferOfficeLoading, gState.musicTransferOfficeStartTime, gState.musicTransferOfficeRequested, gState.scrollY)) {
          gState.lastTouchTime = millis();
          ESP_LOGI("touch", "Music Transfer Office button processed");
        }
        if (gState.musicTransferLivingBtn.processTap(x, y, gState.musicTransferLivingLoading, gState.musicTransferLivingStartTime, gState.musicTransferLivingRequested, gState.scrollY)) {
          gState.lastTouchTime = millis();
          ESP_LOGI("touch", "Music Transfer Living Room button processed");
        }
        if (gState.musicPrevBtn.processTap(x, y, gState.musicPrevLoading, gState.musicPrevStartTime, gState.musicPrevRequested, gState.scrollY)) {
           return;
        }
        if (gState.musicNextBtn.processTap(x, y, gState.musicNextLoading, gState.musicNextStartTime, gState.musicNextRequested, gState.scrollY)) {
           return;
        }
      }

      // Timer Detail View Buttons
      if (gState.currentView == VIEW_DETAIL_TIMER) {
        bool dummyLoading = false;
        unsigned long dummyTime = 0;
        bool dummyAction = false;
        if (gState.timerStartBtn.processTap(x, y, dummyLoading, dummyTime, dummyAction, gState.scrollY)) {
          gState.timerActive = !gState.timerActive;
          gPendingTapSound = true;
          return;
        }
        if (gState.timerResetBtn.processTap(x, y, dummyLoading, dummyTime, dummyAction, gState.scrollY)) {
          gState.timerActive = false;
          gState.timerRemaining = gState.timerDuration;
          gPendingTapSound = true;
          return;
        }
        if (!gState.timerActive) {
          if (gState.timerPlusBtn.processTap(x, y, dummyLoading, dummyTime, dummyAction, gState.scrollY)) {
            gState.timerRemaining += 60;
            if (gState.timerRemaining > 3600) gState.timerRemaining = 3600;
            gState.timerDuration = gState.timerRemaining;
            gPendingTapSound = true;
            return;
          }
          if (gState.timerMinusBtn.processTap(x, y, dummyLoading, dummyTime, dummyAction, gState.scrollY)) {
            gState.timerRemaining -= 60;
            if (gState.timerRemaining < 0) gState.timerRemaining = 0;
            gState.timerDuration = gState.timerRemaining;
            gPendingTapSound = true;
            return;
          }
        }
      }

      // Vacuum Detail View Buttons
      if (gState.currentView == VIEW_DETAIL_VACUUM) {
        if (gState.vacuumBtn.processTap(x, y, gState.vacuumLoading, gState.vacuumLoadingStartTime, gState.vacuumActionRequested, gState.scrollY)) {
          gState.lastTouchTime = millis();
          ESP_LOGI("touch", "Vacuum button processed");
        }
      }
      
      // Lights Detail View Buttons
      if (gState.currentView == VIEW_DETAIL_LIGHTS) {
        if (gState.lightStehlampe.btn.processTap(x, y, gState.lightStehlampe.loading, gState.lightStehlampe.loadingStartTime, gState.lightStehlampe.actionRequested, gState.scrollY)) return;
        if (gState.lightWohnzimmer.btn.processTap(x, y, gState.lightWohnzimmer.loading, gState.lightWohnzimmer.loadingStartTime, gState.lightWohnzimmer.actionRequested, gState.scrollY)) return;
        if (gState.lightKleineLampe.btn.processTap(x, y, gState.lightKleineLampe.loading, gState.lightKleineLampe.loadingStartTime, gState.lightKleineLampe.actionRequested, gState.scrollY)) return;
        if (gState.lightWLED.btn.processTap(x, y, gState.lightWLED.loading, gState.lightWLED.loadingStartTime, gState.lightWLED.actionRequested, gState.scrollY)) return;
        if (gState.lightStehlampeOben.btn.processTap(x, y, gState.lightStehlampeOben.loading, gState.lightStehlampeOben.loadingStartTime, gState.lightStehlampeOben.actionRequested, gState.scrollY)) return;
        if (gState.lightKamera.btn.processTap(x, y, gState.lightKamera.loading, gState.lightKamera.loadingStartTime, gState.lightKamera.actionRequested, gState.scrollY)) return;
        if (gState.lightOffice.btn.processTap(x, y, gState.lightOffice.loading, gState.lightOffice.loadingStartTime, gState.lightOffice.actionRequested, gState.scrollY)) return;
        if (gState.lightGrosseLED.btn.processTap(x, y, gState.lightGrosseLED.loading, gState.lightGrosseLED.loadingStartTime, gState.lightGrosseLED.actionRequested, gState.scrollY)) return;
      }

      // To-Do Detail View Tabs
      if (gState.currentView == VIEW_DETAIL_TODO) {
        bool dummyLoading = false;
        unsigned long dummyTime = 0;
        bool dummyAction = false;
        if (gState.shoppingTabBtn.processTap(x, y, dummyLoading, dummyTime, dummyAction)) {
          gState.todoViewTab = 0;
          gState.scrollY = 0;
          return;
        }
        if (gState.todoTabBtn.processTap(x, y, dummyLoading, dummyTime, dummyAction)) {
          gState.todoViewTab = 1;
          gState.scrollY = 0;
          return;
        }

        // List Item Taps
        int itemLy = 95 + gState.scrollY;
        std::string listStr = (gState.todoViewTab == 0) ? gState.shoppingListFormatted : gState.todoListFormatted;
        size_t pos = 0;
        while ((pos = listStr.find("\n")) != std::string::npos || !listStr.empty()) {
          std::string line;
          if (pos != std::string::npos) { line = listStr.substr(0, pos); listStr.erase(0, pos + 1); }
          else { line = listStr; listStr.clear(); }
          if (line.empty() || line == "LIST EMPTY") continue;

          if (x >= 10 && x <= 50 && y >= itemLy && y <= itemLy + 40) {
            size_t p1 = line.find("|");
            std::string summary = (p1 != std::string::npos) ? line.substr(0, p1) : line;
            
            // Trim summary
            summary.erase(0, summary.find_first_not_of(" \t\r\n"));
            summary.erase(summary.find_last_not_of(" \t\r\n") + 1);

            gState.todoActionRequested = true;
            gState.todoActionSummary = summary;
            gPendingTapSound = true;
            return;
          }
          itemLy += 50;
        }
      }
    }
  }
};
