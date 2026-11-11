#pragma once

#include "ui_widget_base.h"

class HvacWidget : public Widget {
 public:
  const char *widget_label() const override { return "Hvac"; }
  using Callback = std::function<void()>;

  HvacWidget(UiRect rect, const char *label,
             const std::string *hvac_mode, const float *current_temp,
             const float *target_temp, const std::string *action,
             const char *entity_id,
             const char *icon_down = "\uF0374", const char *icon_up = "\uF0415",
             const char *icon_power = "\uF040E",
             float temp_step = 0.5f, float min_temp = 10.0f, float max_temp = 30.0f,
             const char *on_mode = "heat",
             Color on_color = Color(255, 180, 0),
             Color off_color = Color(80, 80, 80))
      : rect_(rect), label_(label),
        hvac_mode_ptr_(hvac_mode), current_temp_ptr_(current_temp),
        target_temp_ptr_(target_temp), action_ptr_(action),
        entity_id_(entity_id),
        icon_down_(icon_down), icon_up_(icon_up), icon_power_(icon_power),
        temp_step_(temp_step), min_temp_(min_temp), max_temp_(max_temp),
        on_mode_(on_mode),
        on_color_(on_color), off_color_(off_color) {}

  UiRect bounds() const override { return screen_rect(rect_); }

  void update(uint32_t now) override {
    if (loading_timeout_ms_ > 0 && loading_ &&
        (now - loading_start_ms_ > loading_timeout_ms_)) {
      loading_ = false;
      mark_dirty();
    }
    bool changed = false;
    if (hvac_mode_ptr_ && *hvac_mode_ptr_ != last_hvac_mode_) { changed = true; }
    if (current_temp_ptr_ &&
        ui_value_changed_quantized(*current_temp_ptr_, last_current_temp_)) {
      changed = true;
    }
    if (target_temp_ptr_ &&
        ui_value_changed_quantized(*target_temp_ptr_, last_target_temp_)) {
      changed = true;
    }
    if (action_ptr_ && *action_ptr_ != last_action_) { changed = true; }
    if (changed) mark_dirty();
    Widget::update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (event.type != TouchType::Tap) return false;
    if (loading_) return false;
    if (esphome::api::global_api_server == nullptr ||
        !esphome::api::global_api_server->is_connected()) {
      return false;
    }

    const HvacButtonLayout bl = compute_button_layout_(screen_rect(rect_));
    if (bl.contains(BtnTempDown, event.x, event.y)) {
      temp_down(now);
      return true;
    }
    if (bl.contains(BtnTempUp, event.x, event.y)) {
      temp_up(now);
      return true;
    }
    if (bl.contains(BtnPower, event.x, event.y)) {
      toggle_power(now);
      return true;
    }
    return false;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    const UiRect r = screen_rect(rect_);
    const int w = r.w;
    const int h = r.h;

    const bool is_on = hvac_mode_ptr_ && *hvac_mode_ptr_ != "off";
    const Color accent = is_on ? on_color_ : off_color_;
    const Color dim = RetroColors::STEEL;
    const Color text = RetroColors::WHITE;
    const int pad = ui_spacing::lg;
    const int top_y = r.y + pad + 3;
    const int top_row_h = 22;  // header font cap height

#if UI_THEME_RETRO
    // ---- Retro: clipped-corner container with glow halo, inner double-line
    // border, CRT scanline overlay and decorative corner ticks. The accent
    // colour mirrors the modern path: amber when on, dim grey when off.
    const Color bg = RetroColors::VOID;
    draw_clipped_box(it, r.x, r.y, w, h, ui_corner_radius_for_height(h), accent, bg, true);
    draw_clipped_border(it, r.x + 2, r.y + 2, w - 4, h - 4,
                        7, 7, 7, 7,
                        is_on ? RetroColors::AMBER_DIM : RetroColors::DIMMER);
    // Tiny corner accents (L-shapes) in cyan dim to echo the screen frame
    draw_corner_accent_tl(it, r.x + 4, r.y + 4, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_tr(it, r.x + w - 5, r.y + 4, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_bl(it, r.x + 4, r.y + h - 5, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_br(it, r.x + w - 5, r.y + h - 5, 5,
                          RetroColors::CYAN_DIM);
#else
    const Color bg(10, 14, 22);
    draw_clipped_box(it, r.x, r.y, w, h, ui_corner_radius_for_height(h), accent, bg, false);
#endif

    // ---- Top row: label (left) + mode (right) ----
    {
      if (label_ && label_[0] && g_theme.header.font != nullptr) {
        const int max_label_w = w - pad * 2 - 70;
        ui_print_truncated(it, r.x + pad, top_y,
                           g_theme.header.font, dim,
                           TextAlign::TOP_LEFT, label_, max_label_w);
      }

      if (hvac_mode_ptr_ && !hvac_mode_ptr_->empty() && g_theme.header.font != nullptr) {
        Color mode_color = is_on ? accent : dim;
        it.printf(r.x + w - pad, top_y, g_theme.header.font, mode_color,
                  TextAlign::TOP_RIGHT, "%s", hvac_mode_ptr_->c_str());
      }
    }

#if UI_THEME_RETRO
    // Dashed divider between the header and the temperature readout
    {
      const int div_y = top_y + top_row_h + 2;
      draw_dashed_hline(it, r.x + pad, r.x + w - pad, div_y,
                        RetroColors::DIMMER, 3, 3);
    }
#endif

    // ---- Shared button-row layout ----
    // Computed once and reused by both the center stack (to find the
    // content's bottom edge) and the button draw block below. Keeping
    // this in a single value means touch hit-test (in handle_touch) and
    // the painted visuals can never disagree.
    const HvacButtonLayout bl = compute_button_layout_(r);

    // ---- Center: current temp (optional) + target temp + "Target" label ----
    // Stack drawn with TOP_CENTER so y tracks the top of each line; the
    // whole stack is centered in the content area between the top row and
    // the button row.
    {
      const int content_top = top_y + top_row_h + 6;
      const int content_bottom = bl.btns_y - bl.pad;
      const int center_y = content_top + (content_bottom - content_top) / 2;

      const int target_h = 22;   // header font cap height
      const int label_h = 16;    // label font cap height
      const int gap = 5;
      const bool has_current =
          current_temp_ptr_ != nullptr && g_theme.label.font != nullptr &&
          *current_temp_ptr_ > 0.0f &&
          !std::isnan(*current_temp_ptr_) && !std::isinf(*current_temp_ptr_);

      // The VStack owns the "center on this y" math. The total height
      // depends on whether the optional current-temp line is present;
      // pass that precomputed total directly into the int overload.
      int total_h = target_h + gap + label_h;
      if (has_current) total_h += label_h + gap;
      VStack stack(center_y, total_h);

      if (has_current) {
        const int y = stack.next(label_h);
        char buf[16];
        snprintf(buf, sizeof(buf), "%.1f°", *current_temp_ptr_);
        it.printf(r.x + w / 2, y, g_theme.label.font, dim,
                  TextAlign::TOP_CENTER, "%s", buf);
        stack.skip(gap);
      }

      if (target_temp_ptr_ && g_theme.header.font != nullptr) {
        const int y = stack.next(target_h);
        char buf[16];
        snprintf(buf, sizeof(buf), "%.1f°", *target_temp_ptr_);
        const int ttx = r.x + w / 2;
        it.printf(ttx, y, g_theme.header.font, text,
                  TextAlign::TOP_CENTER, "%s", buf);
        stack.skip(gap);
#if UI_THEME_RETRO
        // Bracket the target readout with small L-shaped ticks to make it
        // read as the primary gauge rather than ordinary text.
        int tx, ty, tw, th;
        it.get_text_bounds(ttx, y, buf,
                           g_theme.header.font, TextAlign::TOP_CENTER,
                           &tx, &ty, &tw, &th);
        const int arm = 4;
        const int offX = 7;
        const int offY = 3;
        const Color bc = is_on ? accent : RetroColors::CYAN_DIM;
        draw_corner_accent_tl(it, tx - offX, ty - offY, arm, bc);
        draw_corner_accent_tr(it, tx + tw + offX, ty - offY, arm, bc);
        draw_corner_accent_bl(it, tx - offX, ty + th + offY, arm, bc);
        draw_corner_accent_br(it, tx + tw + offX, ty + th + offY, arm, bc);
#endif
      }

      if (g_theme.label.font != nullptr) {
        const int y = stack.next(label_h);
        it.printf(r.x + w / 2, y, g_theme.label.font, dim,
                  TextAlign::TOP_CENTER, "Target");
      }
    }

    // ---- Bottom buttons ----
    // One layout struct drives both the hit-test in handle_touch() and the
    // draws below; keeping both paths in sync prevents touch targets from
    // drifting away from the painted buttons.
    {
      auto draw_icon_btn = [&](int bx, int bw, int bh, const char *glyph,
                                Color bc, Color tc) {
        const int mc = 5;
        draw_clipped_box(it, bx, bl.btns_y, bw, bh, mc, bc, RetroColors::DIM, true);
        if (glyph && glyph[0] && g_theme.icon.font != nullptr) {
          it.printf(bx + bw / 2, bl.btns_y + bh / 2 - 1, g_theme.icon.font, tc,
                    TextAlign::CENTER, "%s", glyph);
        } else if (g_theme.label.font != nullptr) {
          it.printf(bx + bw / 2, bl.btns_y + bh / 2 - 1, g_theme.label.font, tc,
                    TextAlign::CENTER, "%s", glyph && glyph[0] ? glyph : "?");
        }
      };

      const bool temp_down_active = loading_ && pending_action_ == 1;
      const bool temp_up_active = loading_ && pending_action_ == 2;
      const bool power_active = loading_ && pending_action_ == 3;

#if UI_THEME_RETRO
      // Retro: temp buttons adopt the cyber palette — cyan when idle, amber
      // flash when pressed — so they harmonise with the container accent.
      const Color temp_dim = RetroColors::DIMMER;
      const Color temp_accent = RetroColors::AMBER;
#else
      const Color temp_dim(60, 60, 80);
      const Color temp_accent(255, 180, 0);
#endif

      struct Spec {
        HvacButtonId id;
        const char *glyph;
        bool active;
        Color idle_color;
        Color active_color;
      };
      const Spec specs[3] = {
          {BtnTempDown, icon_down_,  temp_down_active, temp_dim,   temp_accent},
          {BtnTempUp,   icon_up_,    temp_up_active,   temp_dim,   temp_accent},
          {BtnPower,    icon_power_, power_active,     off_color_, on_color_  },
      };
      for (const Spec &s : specs) {
        const HvacButtonRect br = bl.rect(s.id);
        const Color bc = s.active ? s.active_color : s.idle_color;
        draw_icon_btn(br.x, br.w, bl.btn_h, s.glyph, bc, text);
      }
    }

    // Save last values
    if (hvac_mode_ptr_) last_hvac_mode_ = *hvac_mode_ptr_;
    if (current_temp_ptr_) last_current_temp_ = *current_temp_ptr_;
    if (target_temp_ptr_) last_target_temp_ = *target_temp_ptr_;
    if (action_ptr_) last_action_ = *action_ptr_;
  }

 private:
  // ---- Shared button-row layout for HVAC bottom controls ----
  // The temp +/- and power buttons all sit on a single row at the bottom
  // of the card. Computing this once per draw/touch means touch hit-test
  // and painted visuals can never drift apart.
  enum HvacButtonId { BtnTempDown = 0, BtnTempUp = 1, BtnPower = 2 };
  struct HvacButtonRect {
    int x, w;  // absolute screen x / width
  };
  struct HvacButtonLayout {
    int btn_h;
    int btns_y;       // absolute screen y of button row
    int left_x;       // absolute screen x of the first button's left edge
    int temp_btn_w;
    int power_btn_w;
    int btn_gap;
    int pad;
    HvacButtonRect rect(HvacButtonId id) const {
      const int slot = (int)id;
      HvacButtonRect r;
      r.x = left_x + slot * (temp_btn_w + btn_gap);
      r.w = (id == BtnPower) ? power_btn_w : temp_btn_w;
      return r;
    }
    bool contains(HvacButtonId id, int tx, int ty) const {
      const HvacButtonRect r = rect(id);
      return tx >= r.x && tx <= r.x + r.w &&
             ty >= btns_y && ty <= btns_y + btn_h;
    }
  };
  HvacButtonLayout compute_button_layout_(const UiRect &r) const {
    HvacButtonLayout bl;
    bl.pad = ui_spacing::lg;
    bl.btn_h = 39;
    bl.btns_y = r.y + r.h - bl.btn_h - bl.pad;
    bl.left_x = r.x + bl.pad;
    bl.btn_gap = ui_spacing::sm;
    const int total_w = r.w - bl.pad * 2 - bl.btn_gap * 2;
    bl.temp_btn_w = total_w / 5;
    bl.power_btn_w = total_w - bl.temp_btn_w * 2;
    return bl;
  }

  void send_ha_service(const std::string &service,
                       const std::vector<std::pair<std::string, std::string>> &data) {
    auto *api = esphome::api::global_api_server;
    if (api == nullptr || !api->is_connected()) return;
    esphome::api::HomeAssistantServiceCallAction<> call(api, false);
    call.set_service(service);
    call.init_data(data.size() + 1);
    call.add_data("entity_id", entity_id_);
    for (const auto &kv : data) {
      call.add_data(kv.first.c_str(), kv.second);
    }
    call.play();
  }

  void toggle_power(uint32_t now) {
    if (hvac_mode_ptr_ == nullptr) return;
    loading_ = true;
    pending_action_ = 3;
    loading_start_ms_ = now;
    mark_dirty();

    if (*hvac_mode_ptr_ == "off") {
      send_ha_service("climate.set_hvac_mode", {{"hvac_mode", on_mode_}});
    } else {
      send_ha_service("climate.set_hvac_mode", {{"hvac_mode", "off"}});
    }

    char name_buf[24];
    snprintf(name_buf, sizeof(name_buf), "hvacpw_%p", this);
    esphome::App.scheduler.set_timeout(nullptr, name_buf, loading_timeout_ms_,
        [this]() {
          loading_ = false;
          pending_action_ = 0;
          mark_dirty();
          UiRedraw::trigger_display_update();
        });
  }

  void temp_up(uint32_t now) {
    if (target_temp_ptr_ == nullptr || hvac_mode_ptr_ == nullptr) return;
    float new_temp = *target_temp_ptr_ + temp_step_;
    if (new_temp > max_temp_) new_temp = max_temp_;
    set_temperature(new_temp, now);
    pending_action_ = 2;
  }

  void temp_down(uint32_t now) {
    if (target_temp_ptr_ == nullptr || hvac_mode_ptr_ == nullptr) return;
    float new_temp = *target_temp_ptr_ - temp_step_;
    if (new_temp < min_temp_) new_temp = min_temp_;
    set_temperature(new_temp, now);
    pending_action_ = 1;
  }

  void set_temperature(float temperature, uint32_t now) {
    loading_ = true;
    loading_start_ms_ = now;
    mark_dirty();

    char temp_buf[16];
    snprintf(temp_buf, sizeof(temp_buf), "%.1f", temperature);
    send_ha_service("climate.set_temperature", {{"temperature", temp_buf}});

    char name_buf[24];
    snprintf(name_buf, sizeof(name_buf), "hvactm_%p", this);
    esphome::App.scheduler.set_timeout(nullptr, name_buf, loading_timeout_ms_,
        [this]() {
          loading_ = false;
          pending_action_ = 0;
          mark_dirty();
          UiRedraw::trigger_display_update();
        });
  }

  UiRect rect_;
  const char *label_;
  const std::string *hvac_mode_ptr_ = nullptr;
  const float *current_temp_ptr_ = nullptr;
  const float *target_temp_ptr_ = nullptr;
  const std::string *action_ptr_ = nullptr;
  std::string entity_id_;
  const char *icon_down_;
  const char *icon_up_;
  const char *icon_power_;
  float temp_step_;
  float min_temp_;
  float max_temp_;
  std::string on_mode_;
  Color on_color_;
  Color off_color_;
  bool loading_ = false;
  uint32_t loading_start_ms_ = 0;
  uint32_t loading_timeout_ms_ = 350;
  int pending_action_ = 0;
  std::string last_hvac_mode_;
  float last_current_temp_ = 0.0f;
  float last_target_temp_ = 0.0f;
  std::string last_action_;
};
