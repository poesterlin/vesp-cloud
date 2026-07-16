#pragma once

#include "ui_widget_base.h"
#include "ui_confirmation_popup.h"

class ButtonWidget : public Widget {
 public:
  const char *widget_label() const override { return "Button"; }
  using Callback = std::function<void()>;

  ButtonWidget(UiRect rect, const char *label, Callback callback, const Theme::ButtonStyle &style)
      : rect_(rect), label_(label), callback_(callback), style_(&style) {}

  UiRect bounds() const override { return screen_rect(rect_); }

  void set_confirm_before_action(bool enabled) { confirm_before_action_ = enabled; }

  // Configure an optional icon glyph drawn above the label using the
  // provided text style (typically `g_theme.icon` so the MDI font is used).
  void set_icon(const char *glyph, const Theme::TextStyle *icon_style) {
    icon_glyph_ = glyph;
    icon_style_ = icon_style;
    mark_dirty();
  }

  void set_border_color(Color c) {
    border_color_override_ = c;
    has_border_color_override_ = true;
    mark_dirty();
  }

  void update(uint32_t now) override {
    if (loading_timeout_ms_ > 0 && loading_ && (now - loading_start_ms_ > loading_timeout_ms_)) {
      loading_ = false;
      mark_dirty();
    }
    Widget::update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (event.type != TouchType::Tap) return false;
    if (loading_) return false;
    
    // Safety: Don't trigger if API is not connected to avoid crashes
    if (esphome::api::global_api_server == nullptr || !esphome::api::global_api_server->is_connected()) {
      return false;
    }

    if (!hit_test(event.x, event.y)) return false;
    if (confirm_before_action_) {
      g_confirmation_popup.show(label_, [this]() { this->execute_action_(millis()); });
      return true;
    }
    execute_action_(now);
    return true;
  }

  void execute_action_(uint32_t now) {
    loading_ = true;
    loading_start_ms_ = now;
    mark_dirty();
    if (callback_) callback_();

    // Schedule a delayed reset to end the loading state and trigger redraw
    char name_buf[24];
    snprintf(name_buf, sizeof(name_buf), "btn_%p", this);
    esphome::App.scheduler.set_timeout(nullptr, name_buf, loading_timeout_ms_,
        [this]() {
          loading_ = false;
          mark_dirty();
          UiRedraw::trigger_display_update();
        });
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    if (style_ == nullptr || style_->font == nullptr) return;

    auto *f = style_->font;
    auto bc = has_border_color_override_ ? border_color_override_ : style_->border_color;
    auto tc = style_->text_color;

    const UiRect r = screen_rect(rect_);
    const int c = ui_corner_radius_for_height(r.h);
    draw_clipped_box(it, r.x, r.y, r.w, r.h,
                     c, bc, RetroColors::DIM, true);

#if UI_THEME_RETRO
    // Small instrument-panel details make even plain text buttons feel like
    // physical controls without expanding their paint or touch bounds.
    if (r.w >= 56 && r.h >= 30) {
      const Color rail(bc.red / 2, bc.green / 2, bc.blue / 2);
      it.line(r.x + c + 5, r.y + 3, r.x + r.w - c - 12, r.y + 3, rail);
      ui_fast_filled_rectangle(it, r.x + r.w - c - 8, r.y + 2, 3, 3, bc);
      for (int i = 0; i < 3; i++) {
        const int sw = (i == 0) ? 8 : 3;
        ui_fast_filled_rectangle(it, r.x + c + 5 + i * 6, r.y + r.h - 4,
                                 sw, 1, i == 0 ? bc : rail);
      }
    }
#else
    // Modern buttons use a quiet layered-card treatment: a soft top highlight
    // and a short accent underline provide depth without visual noise.
    if (r.w >= 44 && r.h >= 28) {
      const Color highlight(
          static_cast<uint8_t>(std::min(255, static_cast<int>(bc.red) / 3 + 28)),
          static_cast<uint8_t>(std::min(255, static_cast<int>(bc.green) / 3 + 28)),
          static_cast<uint8_t>(std::min(255, static_cast<int>(bc.blue) / 3 + 28)));
      it.horizontal_line(r.x + c + 3, r.y + 2,
                         std::max(1, r.w - 2 * c - 6), highlight);
      ui_fast_filled_rectangle(it, r.x + r.w / 2 - 9, r.y + r.h - 3,
                               18, 2, bc);
    }
#endif

    if (loading_) {
      it.printf(r.x + r.w / 2, r.y + r.h / 2, f, tc, TextAlign::CENTER, "...");
      return;
    }

    const bool has_icon = icon_glyph_ != nullptr && icon_glyph_[0] != '\0'
                         && icon_style_ != nullptr && icon_style_->font != nullptr;
    const bool has_label = label_ != nullptr && label_[0] != '\0';
    const int cx = r.x + r.w / 2;
    const int cy = r.y + r.h / 2;

    if (has_icon && has_label) {
      // Try horizontal first (icon left of label). Falls back to the
      // stacked layout when either the label can't be reasonably
      // truncated next to the icon (e.g. very narrow button) or the
      // button is tall enough that stacking reads better anyway.
      int ix, iy, iw, ih;
      it.get_text_bounds(0, 0, icon_glyph_, icon_style_->font, TextAlign::TOP_LEFT, &ix, &iy, &iw, &ih);
      const int gap = ui_spacing::sm;
      const int side_pad = ui_spacing::md;
      const int horiz_budget = r.w - 2 * side_pad - iw - gap;
      // Minimum label budget to bother going horizontal: room for at
      // least ~3 chars + ellipsis. Below that, vertical is more legible.
      int eps_x, eps_y, eps_w, eps_h;
      it.get_text_bounds(0, 0, "W...", f, TextAlign::TOP_LEFT, &eps_x, &eps_y, &eps_w, &eps_h);
      const bool horiz_fits = horiz_budget >= eps_w;
      // Stack only when the button is clearly tall enough for two
      // legible lines; otherwise prefer the horizontal layout even on
      // small buttons because the alternative is a clipped stack.
      const bool tall_enough_for_stack = r.h >= 56;

      if (horiz_fits && !tall_enough_for_stack) {
        bool truncated = false;
        std::string disp = ui_truncate_to_width(it, f, label_, horiz_budget, &truncated);
        int lx, ly, lw, lh;
        it.get_text_bounds(0, 0, disp.c_str(), f, TextAlign::TOP_LEFT, &lx, &ly, &lw, &lh);
        // Reserve the indicator's width in the group total so the icon+label
        // pair stays visually centered even when truncated.
        const int extra = truncated ? (UI_TRUNC_DOTS_W + 2) : 0;
        const int total_w = iw + gap + lw + extra;
        const int start_x = r.x + (r.w - total_w) / 2;
        it.printf(start_x + iw / 2, cy, icon_style_->font, tc, TextAlign::CENTER, "%s", icon_glyph_);
        const int label_x = start_x + iw + gap;
        it.printf(label_x, cy, f, tc, TextAlign::CENTER_LEFT, "%s", disp.c_str());
        if (truncated && !disp.empty()) {
          int tx, ty, tw, th;
          it.get_text_bounds(label_x, cy, disp.c_str(), f, TextAlign::CENTER_LEFT, &tx, &ty, &tw, &th);
          int baseline_y = ui_get_baseline(it, label_x, cy, f, TextAlign::CENTER_LEFT);
          ui_draw_truncation_dots(it, tx + tw, baseline_y, tc);
        }
      } else {
        // Stacked: icon over label, centered as a unit on `cy`. The
        // VStack owns the centering math; previously this was a pair
        // of `cy - 13` / `cy + 13` magic numbers, which silently
        // assumed the same 26px split for any icon/label pair.
        const int stack_gap = ui_spacing::xs;
        const int label_h = 16;  // label font cap height
        VStack stack(cy, {ih, stack_gap, label_h});
        it.printf(cx, stack.next(ih), icon_style_->font, tc, TextAlign::TOP_CENTER, "%s", icon_glyph_);
        stack.skip(stack_gap);
        ui_print_truncated(it, cx, stack.next(label_h), f, tc, TextAlign::TOP_CENTER, label_, r.w - 12);
      }
    } else if (has_icon) {
      it.printf(cx, cy, icon_style_->font, tc, TextAlign::CENTER, "%s", icon_glyph_);
    } else if (has_label) {
      ui_print_truncated(it, cx, cy, f, tc, TextAlign::CENTER, label_, r.w - 12);
    }
  }

 private:
  bool hit_test(int tx, int ty) const {
    return ui_hit_test_with_slop(touch_bounds(), tx, ty);
  }

  UiRect rect_;
  const char *label_;
  Callback callback_;
  const Theme::ButtonStyle *style_ = nullptr;
  const char *icon_glyph_ = nullptr;
  const Theme::TextStyle *icon_style_ = nullptr;
  Color border_color_override_{0, 0, 0};
  bool has_border_color_override_ = false;
  bool confirm_before_action_ = false;
  bool loading_ = false;
  uint32_t loading_start_ms_ = 0;
  uint32_t loading_timeout_ms_ = 350;
};
