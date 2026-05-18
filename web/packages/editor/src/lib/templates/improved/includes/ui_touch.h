#pragma once

#include "ui_app.h"
#include "ui_types.h"

class BasicTouchHandler {
 public:
  static void handle_raw_touch(int x, int y, bool touched) {
    static bool was_touched = false;
    static int start_x = 0;
    static int start_y = 0;

    if (touched && !was_touched) {
      start_x = x;
      start_y = y;
      send(TouchType::Down, x, y, start_x, start_y);
    } else if (touched && was_touched) {
      send(TouchType::Move, x, y, start_x, start_y);
    } else if (!touched && was_touched) {
      const int dx = x - start_x;
      const int dy = y - start_y;
      send(TouchType::Up, x, y, start_x, start_y);
      if (abs(dx) < 20 && abs(dy) < 20) {
        send(TouchType::Tap, start_x, start_y, start_x, start_y);
      }
    }

    was_touched = touched;
  }

 private:
  static void send(TouchType type, int x, int y, int start_x, int start_y) {
    TouchEvent event{
        .type = type,
        .x = x,
        .y = y,
        .start_x = start_x,
        .start_y = start_y,
        .dx = x - start_x,
        .dy = y - start_y,
    };
    g_ui_app.on_touch_event(event);
  }
};
