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
    }
    // Touch Move
    else if (touched && wasTouched) {
      gState.lastTouchTime = millis();
      
      // Handle Scrolling in Detail Views
      if (gState.currentView != VIEW_MAIN_DASHBOARD) {
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
        else if (abs(dx) < 20 && abs(dy) < 20) {
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
    if (gState.currentView == VIEW_MAIN_DASHBOARD) {
      
      // Page 0: Status Page
      if (gState.mainPageIndex == 0) {
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
        // Washing Machine
        else if (y > 160 && y < 200) {
          // openView(VIEW_DETAIL_WASHER); // Future
        }
      }
      
    } else {
      // In Detail View -> Check for Back Button
      if (gState.backBtn.processTap(x, y, gState.backLoading, gState.backLoadingStartTime, gState.backActionRequested)) {
        goBack();
        return;
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
    }
  }
};
