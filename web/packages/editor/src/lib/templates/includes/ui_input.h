#pragma once

#include "ui_app.h"
#include "ui_invalidation.h"
#include "ui_types.h"

// Central input dispatcher (wayfinder ticket 04). Every hardware input
// source -- touch on all devices, the rotary encoder on encoder-equipped
// devices -- is funneled through UiInput so navigation semantics live in
// exactly one place. The class compiles on every device; profiles without
// an encoder simply never call the encoder entry points (the YAML blocks
// that would drive them are not emitted).
class UiInput {
 public:
  // Touch path. Called by BasicTouchHandler once a raw touch stream has
  // been synthesized into gesture events (Down/Move/Up/Tap).
  static void dispatch_touch(const TouchEvent &event) {
    g_ui_app.touch_activity();
    g_ui_app.on_touch_event(event);
  }

  // Rotary encoder: one detent, +1 clockwise / -1 anticlockwise.
  // Navigation semantics: scrolls an open scrollable surface (clamped at
  // both ends), otherwise rotates dashboard pages when the Home screen is
  // active. Marks invalidation only -- the caller pumps the display.
  static void encoder_step(int delta) {
    g_ui_app.touch_activity();
    g_ui_app.on_encoder_step(delta);
  }

  // Rotary encoder push. Wired end-to-end but intentionally a no-op:
  // activation semantics (a focus/cursor model) are explicitly deferred.
  // It still counts as user activity so it resets idle timers.
  static void encoder_push() { g_ui_app.touch_activity(); }
};
