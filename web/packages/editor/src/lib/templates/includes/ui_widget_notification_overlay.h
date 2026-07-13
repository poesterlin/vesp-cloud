#pragma once

#include "ui_widget_base.h"

class NotificationOverlayWidget : public Widget {
 public:
  const char *widget_label() const override { return "NotifyOverlay"; }
  NotificationOverlayWidget(const std::string *title, const std::string *body,
                            const std::string *severity,
                            const std::string *dismissed,
                            int display_w = 480, int display_h = 480)
      : title_(title), body_(body), severity_(severity),
        dismissed_(dismissed), display_w_(display_w), display_h_(display_h) {}

  void set_dismiss_callback(std::function<void()> cb) {
    dismiss_callback_ = std::move(cb);
  }

  UiRect bounds() const override { return UiRect{0, 0, display_w_, display_h_}; }

  bool is_visible(const UiState &state) const override {
    (void)state;
    if (body_ == nullptr || body_->empty()) return false;
    if (dismissed_ != nullptr && !dismissed_->empty() && *dismissed_ == *body_) return false;
    return true;
  }

  void update(uint32_t now) override {
    Widget::update(now);
    if (body_ == nullptr) return;
    const bool visible_now = is_visible_state();
    if (!baseline_set_) {
      last_body_ = *body_;
      if (dismissed_ != nullptr) last_dismissed_ = *dismissed_;
      was_visible_ = visible_now;
      baseline_set_ = true;
      if (visible_now) mark_dirty();
      return;
    }
    bool changed = false;
    if (*body_ != last_body_) { last_body_ = *body_; changed = true; }
    if (dismissed_ != nullptr && *dismissed_ != last_dismissed_) {
      last_dismissed_ = *dismissed_;
      changed = true;
    }
    if (was_visible_ != visible_now) {
      UiInvalidation::request_full(visible_now ? "NotifyOverlay appeared" : "NotifyOverlay dismissed");
      was_visible_ = visible_now;
    } else if (changed && visible_now) {
      mark_dirty();
    }
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (event.type != TouchType::Tap) return false;
    // Dismiss button hit test (bottom-center region of the panel).
    if (!is_visible_state()) return false;
    const NotificationLayout nl = compute_layout_();
    if (ui_hit_test_with_slop(nl.dismiss_btn, event.x, event.y)) {
      if (dismiss_callback_) dismiss_callback_();
      mark_dirty();
      return true;
    }
    // Consume all taps while visible so they don't fall through to
    // the underlying screen.
    return true;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    if (!is_visible_state()) return;

    ui_fast_filled_rectangle(it, 0, 0, display_w_, display_h_, Color(0, 0, 0));

    const NotificationLayout nl = compute_layout_();

    const Color accent = severity_color();
    const Color accent_dim = severity_dim_color();
    const Color panel_bg(16, 18, 22);
    const Color header_bg(24, 28, 34);
    const Color text_primary(245, 248, 255);
    const Color text_secondary(180, 188, 202);

    // Shadow and card shell. Outer padding (xl) frames the panel, inner
    // padding (md) separates the header band from the panel border.
    ui_fast_filled_rectangle(it, nl.panel.x + 6, nl.panel.y + 7,
                             nl.panel.w, nl.panel.h, Color(3, 4, 6));
    ui_fast_filled_rectangle(it, nl.panel.x, nl.panel.y, nl.panel.w, nl.panel.h, panel_bg);
    it.rectangle(nl.panel.x, nl.panel.y, nl.panel.w, nl.panel.h, accent);
    it.rectangle(nl.panel.x + 1, nl.panel.y + 1, nl.panel.w - 2, nl.panel.h - 2, accent_dim);
    {
      const UiRect header_band = nl.panel.inset(2);
      ui_fast_filled_rectangle(it, header_band.x, header_band.y,
                               header_band.w, nl.header_h, header_bg);
    }
    ui_fast_filled_rectangle(it, nl.panel.x + 2,
                             nl.panel.y + 2 + nl.header_h,
                             nl.panel.w - 4, 3, accent);

    // Severity icon sits inside the header band, vertically centered on it.
    it.filled_circle(nl.icon_cx, nl.icon_cy, 18, accent_dim);
    it.circle(nl.icon_cx, nl.icon_cy, 18, accent);
    const char *icon = severity_icon();
    if (g_theme.icon.font != nullptr) {
      it.printf(nl.icon_cx, nl.icon_cy + 1, g_theme.icon.font, accent,
                TextAlign::CENTER, "%s", icon);
    } else if (g_theme.header.font != nullptr) {
      it.printf(nl.icon_cx, nl.icon_cy, g_theme.header.font, accent,
                TextAlign::CENTER, "!");
    }

    const std::string display_title =
        (title_ != nullptr && !title_->empty()) ? *title_ : std::string("Notification");
    if (g_theme.header.font != nullptr) {
      ui_print_truncated(it, nl.title_x, nl.title_y, g_theme.header.font,
                         text_primary, TextAlign::TOP_LEFT, display_title, nl.panel.w - 86);
    }
    if (g_theme.label.font != nullptr) {
      it.printf(nl.title_x, nl.severity_y, g_theme.label.font, text_secondary,
                TextAlign::TOP_LEFT, "%s", severity_label());
    }

    if (g_theme.label.font != nullptr && body_ != nullptr) {
      const int body_x = nl.body.x;
      const int body_y = nl.body.y;
      const int body_w = nl.body.w;
      const int body_h = nl.body.h;
      const int max_body_h = body_h > 0 ? body_h : 0;
      int tx, ty, tw, th;
      const std::string &body_text = *body_;
      it.get_text_bounds(body_x, body_y, body_text.c_str(),
                         g_theme.label.font, TextAlign::TOP_LEFT, &tx, &ty, &tw, &th);
      if (tw <= body_w) {
        ui_print_truncated(it, body_x, body_y, g_theme.label.font,
                           text_primary, TextAlign::TOP_LEFT, body_text, body_w);
      } else {
        int line_y = body_y;
        int remaining = body_text.size();
        int offset = 0;
        const int line_height = 22;
        while (remaining > 0 && line_y + line_height <= body_y + max_body_h) {
          int best_w = 0;
          int best_len = 0;
          for (int len = 1; len <= remaining; len++) {
            std::string sub = body_text.substr(offset, len);
            it.get_text_bounds(body_x, line_y, sub.c_str(),
                               g_theme.label.font, TextAlign::TOP_LEFT, &tx, &ty, &tw, &th);
            if (tw > body_w) break;
            if (tw > best_w) { best_w = tw; best_len = len; }
          }
          if (best_len == 0) best_len = 1;
          std::string line = body_text.substr(offset, best_len);
          const bool is_last = offset + best_len >= remaining;
          if (is_last) {
            ui_print_truncated(it, body_x, line_y, g_theme.label.font,
                               text_primary, TextAlign::TOP_LEFT, body_text.substr(offset), body_w);
          } else {
            it.printf(body_x, line_y, g_theme.label.font,
                      text_primary, TextAlign::TOP_LEFT, "%s", line.c_str());
          }
          offset += best_len;
          remaining -= best_len;
          line_y += line_height;
        }
      }
    }

    ui_fast_filled_rectangle(it, nl.dismiss_btn.x, nl.dismiss_btn.y,
                             nl.dismiss_btn.w, nl.dismiss_btn.h, accent_dim);
    it.rectangle(nl.dismiss_btn.x, nl.dismiss_btn.y,
                 nl.dismiss_btn.w, nl.dismiss_btn.h, accent);
    if (g_theme.label.font != nullptr) {
      it.printf(nl.dismiss_btn.x + nl.dismiss_btn.w / 2,
                nl.dismiss_btn.y + nl.dismiss_btn.h / 2,
                g_theme.label.font, text_primary, TextAlign::CENTER, "Dismiss");
    }

    last_body_ = body_ != nullptr ? *body_ : std::string();
    if (dismissed_ != nullptr) last_dismissed_ = *dismissed_;
  }

 private:
  // ---- Pre-computed layout geometry for the overlay panel ----
  // One struct drives both the draw and the touch hit-test, so the
  // painted visuals and the touch targets can never disagree. Magic
  // numbers from the previous version now come from ui_spacing and
  // a small set of named constants.
  struct NotificationLayout {
    UiRect panel;          // outer card rect (incl. shadow/border)
    UiRect body;           // body text box
    UiRect dismiss_btn;    // dismiss button rect
    int header_h;          // height of the dark header band
    int icon_cx, icon_cy;  // severity icon center
    int title_x, title_y;  // top-left of the title text
    int severity_y;        // top y of the severity label
  };
  NotificationLayout compute_layout_() const {
    NotificationLayout nl;
    const int panel_w = (display_w_ * 5) / 6;
    const int panel_h = (display_h_ * 3) / 5;
    const int panel_x = (display_w_ - panel_w) / 2;
    const int panel_y = (display_h_ - panel_h) / 2;
    nl.panel = UiRect{panel_x, panel_y, panel_w, panel_h};

    nl.header_h = 58;
    const int body_x = panel_x + ui_spacing::xl;
    const int body_w = panel_w - 2 * ui_spacing::xl;
    const int body_y = panel_y + nl.header_h + ui_spacing::md;
    const int btn_h = 40;
    const int btn_w = panel_w - 2 * (2 * ui_spacing::xl);
    const int btn_x = panel_x + (panel_w - btn_w) / 2;
    const int btn_y = panel_y + panel_h - btn_h - (2 * ui_spacing::xl);
    const int body_h = btn_y - body_y - ui_spacing::md;
    nl.body = UiRect{body_x, body_y, body_w, body_h > 0 ? body_h : 0};
    nl.dismiss_btn = UiRect{btn_x, btn_y, btn_w, btn_h};

    nl.icon_cx = panel_x + 36;
    nl.icon_cy = panel_y + 30;
    nl.title_x = panel_x + 66;
    nl.title_y = panel_y + 13;
    nl.severity_y = panel_y + 38;
    return nl;
  }

  bool is_visible_state() const {
    if (body_ == nullptr || body_->empty()) return false;
    if (dismissed_ != nullptr && !dismissed_->empty() && *dismissed_ == *body_) return false;
    return true;
  }

  Color severity_color() const {
    if (severity_ == nullptr || severity_->empty()) return Color(0, 200, 255);
    const std::string s = *severity_;
    if (s == "error" || s == "alert") return Color(255, 60, 60);
    if (s == "warning" || s == "warn") return Color(255, 180, 0);
    if (s == "info") return Color(80, 200, 255);
    if (s == "question") return Color(160, 80, 255);
    return Color(0, 200, 255);
  }

  Color severity_dim_color() const {
    if (severity_ == nullptr || severity_->empty()) return Color(0, 44, 56);
    const std::string s = *severity_;
    if (s == "error" || s == "alert") return Color(72, 18, 22);
    if (s == "warning" || s == "warn") return Color(72, 48, 6);
    if (s == "info") return Color(12, 52, 72);
    if (s == "question") return Color(42, 24, 72);
    return Color(0, 44, 56);
  }

  const char *severity_icon() const {
    if (severity_ == nullptr || severity_->empty()) return "\xF3\xB0\x8B\xBC";
    const std::string s = *severity_;
    if (s == "error" || s == "alert") return "\xF3\xB0\x80\xA8";
    if (s == "warning" || s == "warn") return "\xF3\xB0\x80\xA6";
    if (s == "question") return "\xF3\xB0\x8B\x97";
    return "\xF3\xB0\x8B\xBC";
  }

  const char *severity_label() const {
    if (severity_ == nullptr || severity_->empty()) return "INFO";
    const std::string s = *severity_;
    if (s == "error") return "ERROR";
    if (s == "alert") return "ALERT";
    if (s == "warning" || s == "warn") return "WARNING";
    if (s == "question") return "QUESTION";
    if (s == "info") return "INFO";
    return "NOTIFICATION";
  }

  const std::string *title_;
  const std::string *body_;
  const std::string *severity_;
  const std::string *dismissed_;
  std::function<void()> dismiss_callback_;
  int display_w_;
  int display_h_;
  std::string last_body_;
  std::string last_dismissed_;
  bool baseline_set_ = false;
  bool was_visible_ = false;
};

// ---------------------------------------------------------------------------
// RangeSliderWidget
// Single-value slider with two full visual themes: Modern and Retro.
// Theme is determined at compile-time via UI_THEME_RETRO.
//
// Modern  — soft rounded track, pill fill, circular thumb with ring.
// Retro   — clipped-corner shell, cyan/amber CRT palette, scanlines,
//           squared thumb with corner ticks.
//
// Usage:
//   auto *slider = new RangeSliderWidget(
//       UiRect{20, 200, 440, 88}, "BRIGHTNESS",
//       /*min=*/0.f, /*max=*/100.f, /*step=*/5.f,
//       /*value=*/50.f, "%", /*decimals=*/0);
//   slider->on_change([](float v) { /* live drag */ });
//   slider->on_release([](float v) { /* commit to HA */ });
//   slider->bind(&my_value);
// ---------------------------------------------------------------------------
