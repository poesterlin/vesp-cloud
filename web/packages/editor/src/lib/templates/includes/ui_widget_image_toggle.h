#pragma once

#include "ui_widget_base.h"
#include "ui_confirmation_popup.h"

enum class ConfirmAction : uint8_t { None = 0, On = 1, Off = 2, Both = 3 };

class ImageToggleWidget : public Widget {
 public:
  const char *widget_label() const override { return "ImgToggle"; }
  using Callback = std::function<void()>;

  ImageToggleWidget(UiRect rect, const char *label, const bool *on_state,
                    const char *icon_glyph, Callback callback,
                    Color on_color = Color(255, 180, 0),
                    Color off_color = Color(80, 80, 80))
      : rect_(rect), label_(label), on_state_(on_state),
        icon_glyph_(icon_glyph), callback_(std::move(callback)), on_color_(on_color),
        off_color_(off_color) {}

  void bind(const bool *on_state) { on_state_ = on_state; mark_dirty(); }

  UiRect bounds() const override { return screen_rect(rect_); }

  void update(uint32_t now) override {
    if (loading_timeout_ms_ > 0 && loading_ &&
        (now - loading_start_ms_ > loading_timeout_ms_)) {
      loading_ = false;
      mark_dirty();
    }
    if (on_state_ != nullptr) {
      bool current = *on_state_;
      if (current != last_on_state_) {
        mark_dirty();
      }
    }
    Widget::update(now);
  }

  void set_confirm_action(ConfirmAction action) { confirm_action_ = action; }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (event.type != TouchType::Tap) return false;
    if (loading_) return false;

    if (esphome::api::global_api_server == nullptr ||
        !esphome::api::global_api_server->is_connected()) {
      return false;
    }

    if (!hit_test(event.x, event.y)) return false;
    if (should_confirm_()) {
      g_confirmation_popup.show(label_, [this]() { this->execute_action_(millis()); });
      return true;
    }
    execute_action_(now);
    return true;
  }

  bool should_confirm_() const {
    if (confirm_action_ == ConfirmAction::None) return false;
    if (confirm_action_ == ConfirmAction::Both) return true;
    bool is_on = on_state_ != nullptr ? *on_state_ : false;
    return (confirm_action_ == ConfirmAction::On && !is_on) ||
           (confirm_action_ == ConfirmAction::Off && is_on);
  }

  void execute_action_(uint32_t now) {
    loading_ = true;
    loading_start_ms_ = now;
    mark_dirty();
    if (callback_) callback_();

    char name_buf[24];
    snprintf(name_buf, sizeof(name_buf), "itg_%p", this);
    esphome::App.scheduler.set_timeout(
        nullptr, name_buf, loading_timeout_ms_, [this]() {
          loading_ = false;
          mark_dirty();
          UiRedraw::trigger_display_update();
        });
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    bool is_on = on_state_ != nullptr ? *on_state_ : false;

    Color icon_color = is_on ? on_color_ : off_color_;

    const UiRect r = screen_rect(rect_);
    const int c = ui_corner_radius_for_height(r.h);
    draw_clipped_box(it, r.x, r.y, r.w, r.h,
                     c, icon_color, RetroColors::DIM, true);

    // Single source of truth for icon/label geometry. The icon sits on
    // the left at kIconCenterOffset, the label starts at kLabelStartOffset,
    // and the label is allowed to consume everything from there to the
    // right edge minus a small right padding.
    const int kIconCenterOffset = 28;
    const int kLabelStartOffset = 52;
    const int icon_x = r.x + kIconCenterOffset;
    const int icon_y = r.y + r.h / 2;
    const int label_x = r.x + kLabelStartOffset;
    const int label_max_w = r.w - kLabelStartOffset - ui_spacing::sm;

    if (loading_) {
      float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
      const int radius = 10;
      it.line(icon_x, icon_y, icon_x + (int)(cosf(angle) * radius),
              icon_y + (int)(sinf(angle) * radius), icon_color);
      if (label_ != nullptr && g_theme.label.font != nullptr) {
        ui_print_truncated(it, label_x, icon_y,
                           g_theme.label.font, icon_color,
                           TextAlign::CENTER_LEFT, label_, label_max_w);
      }
      return;
    }

    const bool has_mdi_icon =
        icon_glyph_ != nullptr && icon_glyph_[0] != '\0' &&
        g_theme.icon.font != nullptr;

    if (has_mdi_icon) {
      it.printf(icon_x, icon_y, g_theme.icon.font, icon_color, TextAlign::CENTER,
                "%s", icon_glyph_);
    } else {
      it.circle(icon_x, icon_y, 9, icon_color);
      if (is_on) {
        it.filled_circle(icon_x, icon_y, 6, icon_color);
        for (int i = 0; i < 8; i++) {
          float a = i * 3.14159265f / 4.0f;
          it.line(icon_x + (int)(cosf(a) * 11), icon_y + (int)(sinf(a) * 11),
                  icon_x + (int)(cosf(a) * 15), icon_y + (int)(sinf(a) * 15), icon_color);
        }
      }
    }

    if (label_ != nullptr && g_theme.label.font != nullptr) {
      ui_print_truncated(it, label_x, icon_y,
                         g_theme.label.font, Color(255, 255, 255),
                         TextAlign::CENTER_LEFT, label_, label_max_w);
    }

    last_on_state_ = is_on;
  }

 private:
  bool hit_test(int tx, int ty) const {
    return ui_hit_test_with_slop(touch_bounds(), tx, ty);
  }

  UiRect rect_;
  const char *label_;
  const bool *on_state_ = nullptr;
  const char *icon_glyph_ = nullptr;
  Callback callback_;
  Color on_color_;
  Color off_color_;
  bool loading_ = false;
  uint32_t loading_start_ms_ = 0;
  uint32_t loading_timeout_ms_ = 350;
  bool last_on_state_ = false;
  ConfirmAction confirm_action_ = ConfirmAction::None;
};
