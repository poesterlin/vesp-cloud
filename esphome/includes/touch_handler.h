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
        gState.scrollY += dy;
        
        // Clamp Scroll
        if (gState.scrollY > 0) gState.scrollY = 0; // Don't scroll past top
        if (gState.scrollY < -gState.maxScrollY) gState.scrollY = -gState.maxScrollY;
        
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
      
      // Page 3: Devices Page -> Open Details
      if (gState.mainPageIndex == 3) {
        // Vacuum Card Hit Test (approx coords)
        if (y > 80 && y < 130) {
          openView(VIEW_DETAIL_VACUUM);
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
    }
  }
};