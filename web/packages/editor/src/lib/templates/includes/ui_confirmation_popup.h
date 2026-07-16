#pragma once

#include "ui_widget_base.h"

class ConfirmationPopup {
 public:
  using Callback = std::function<void()>;

  bool visible() const { return visible_; }

  void show(const char *action_label, Callback callback) {
    action_label_ = action_label != nullptr ? action_label : "";
    callback_ = std::move(callback);
    visible_ = true;
    UiInvalidation::request_full("confirmation popup opened");
    UiRedraw::trigger_display_update();
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) {
    (void)now;
    if (!visible_) return false;
    if (event.type != TouchType::Tap) return true;

    const UiRect confirm{250, 292, 130, 52};
    const UiRect cancel{100, 292, 130, 52};
    if (ui_hit_test_with_slop(confirm, event.x, event.y)) {
      Callback callback = std::move(callback_);
      close_();
      if (callback) callback();
    } else if (ui_hit_test_with_slop(cancel, event.x, event.y)) {
      close_();
    }
    return true;
  }

  void draw(display::Display &it) const {
    if (!visible_) return;
    const UiRect panel{60, 120, 360, 240};
    draw_clipped_box(it, panel.x, panel.y, panel.w, panel.h,
                     ui_corner_radius_for_height(panel.h),
                     g_theme.primary.border_color, RetroColors::DIM, true);
    it.printf(240, 158, g_theme.header.font, g_theme.header.color,
              TextAlign::TOP_CENTER, "Confirm action?");
    if (!action_label_.empty()) {
      ui_print_truncated(it, 240, 218, g_theme.label.font, g_theme.label.color,
                         TextAlign::CENTER, action_label_.c_str(), 300);
    }
    draw_clipped_box(it, 100, 292, 130, 52, 6,
                     g_theme.neutral.border_color, RetroColors::BLACK, true);
    draw_clipped_box(it, 250, 292, 130, 52, 6,
                     g_theme.primary.border_color, RetroColors::DIM, true);
    it.printf(165, 318, g_theme.label.font, g_theme.label.color,
              TextAlign::CENTER, "Cancel");
    it.printf(315, 318, g_theme.label.font, g_theme.label.color,
              TextAlign::CENTER, "Confirm");
  }

 private:
  void close_() {
    visible_ = false;
    callback_ = nullptr;
    UiInvalidation::request_full("confirmation popup closed");
    UiRedraw::trigger_display_update();
  }

  bool visible_ = false;
  std::string action_label_;
  Callback callback_;
};

inline ConfirmationPopup g_confirmation_popup;
