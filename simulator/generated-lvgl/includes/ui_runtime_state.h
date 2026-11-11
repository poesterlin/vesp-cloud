#pragma once

#include "esphome.h"

// Project-independent state required by the shared rendering infrastructure.
// Manifest bindings live in vespui::Manifest instead of generated fields.
struct UiState {
  bool ha_connected = false;
  int home_page_index = 0;
  int home_total_pages = 1;
  int images_rendered_this_frame = 0;
  static constexpr int MAX_IMAGES_PER_FRAME = 2;
  bool should_show_loading() const { return false; }
};
