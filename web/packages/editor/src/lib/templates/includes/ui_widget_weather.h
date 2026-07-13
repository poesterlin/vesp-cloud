#pragma once

#include "ui_widget_base.h"

struct WeatherDayPointers {
  const std::string *condition = nullptr;
  const float *temperature = nullptr;
  const float *humidity = nullptr;
  const float *wind_speed = nullptr;
  const float *precipitation = nullptr;
};

class WeatherWidget : public Widget {
 public:
  const char *widget_label() const override { return "Weather"; }
  using Callback = std::function<void()>;
  WeatherWidget(UiRect rect, const char *label,
                const char *entity_id,
                bool forecast_mode = false,
                WeatherDayPointers day1 = WeatherDayPointers{},
                WeatherDayPointers day2 = WeatherDayPointers{},
                WeatherDayPointers day3 = WeatherDayPointers{},
                Callback on_tap = nullptr,
                Color text_color = Color(255, 255, 255),
                Color dim_color  = Color(80, 80, 80))
      : rect_(rect), label_(label),
        entity_id_(entity_id),
        forecast_mode_(forecast_mode),
        on_tap_(std::move(on_tap)),
        text_color_(text_color), dim_color_(dim_color) {
    days_[0] = day1;
    days_[1] = day2;
    days_[2] = day3;
  }

  UiRect bounds() const override { return screen_rect(rect_); }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (event.type != TouchType::Tap) return false;
    const UiRect r = screen_rect(rect_);
    if (event.x < r.x || event.y < r.y || event.x >= r.x + r.w || event.y >= r.y + r.h) return false;
    if (on_tap_) on_tap_();
    return on_tap_ != nullptr;
  }

  void update(uint32_t now) override {
    (void)now;
    bool changed = false;
    const int n = forecast_mode_ ? 3 : 1;
    for (int d = 0; d < n; d++) {
      const auto &dp = days_[d];
      if (dp.condition && *dp.condition != last_condition_[d]) { changed = true; }
      if (changed_value(dp.temperature, last_temperature_[d])) { changed = true; }
      if (changed_value(dp.humidity, last_humidity_[d])) { changed = true; }
      if (changed_value(dp.wind_speed, last_wind_speed_[d])) { changed = true; }
      if (changed_value(dp.precipitation, last_precipitation_[d])) { changed = true; }
    }
    if (changed) mark_dirty();
    Widget::update(now);
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    const UiRect r = screen_rect(rect_);
    const int w = r.w;
    const int h = r.h;

    if (forecast_mode_) {
      draw_forecast(it, r);
    } else {
      draw_compact(it, r);
    }

    const int n = forecast_mode_ ? 3 : 1;
    for (int d = 0; d < n; d++) {
      if (days_[d].condition) last_condition_[d] = *days_[d].condition;
      copy_value(days_[d].temperature, last_temperature_[d]);
      copy_value(days_[d].humidity, last_humidity_[d]);
      copy_value(days_[d].wind_speed, last_wind_speed_[d]);
      copy_value(days_[d].precipitation, last_precipitation_[d]);
    }
  }

 private:
  // ---- Shared layout geometry for both compact + forecast modes ----
  // Both views share the same outer padding, header offset, and the
  // "content top" baseline (top of body, below the header). Only the
  // content_bottom and per-element offsets differ; those are configured
  // per-call below.
  struct WeatherLayout {
    int pad;            // outer widget padding (left/right/top)
    int top_y;          // y of header label (r.y + pad + 3)
    int header_row_h;   // height reserved for the header label band
    int content_top;    // y where body content starts (top_y + header_row_h)
    int content_bottom; // y where body content ends (mode-specific)
    int icon_y_offset;  // y of icon relative to content_top
    int temp_y_offset;  // y of temperature relative to content_top
  };
  WeatherLayout make_weather_layout_(const UiRect &r, bool with_pill_row) const {
    WeatherLayout l;
    l.pad = ui_spacing::lg;
    l.top_y = r.y + l.pad + 8;
    l.header_row_h = 20;
    l.content_top = l.top_y + l.header_row_h;
    if (with_pill_row) {
      // Compact: leave room for the bottom 3-pill row (48px from bottom).
      l.content_bottom = r.y + r.h - l.pad - 46;
      l.icon_y_offset = 14;
      l.temp_y_offset = 10;
    } else {
      // Forecast: bottom margin is small, stack is centered in the rest.
      l.content_bottom = r.y + r.h - l.pad - 10;
      l.icon_y_offset = 0;
      l.temp_y_offset = 0;
    }
    return l;
  }

  // ---- Today layout ----
  void draw_compact(display::Display &it, const UiRect &r) {
    const int w = r.w;
    const int h = r.h;
    const WeatherLayout l = make_weather_layout_(r, /*with_pill_row=*/true);
    const auto &dp = days_[0];
    const Color accent = condition_color(dp.condition ? dp.condition->c_str() : "");

#if UI_THEME_RETRO
    const Color bg = RetroColors::VOID;
    draw_clipped_box(it, r.x, r.y, w, h, ui_corner_radius_for_height(h), accent, bg, true);
    draw_clipped_border(it, r.x + 2, r.y + 2, w - 4, h - 4,
                        7, 7, 7, 7,
                        RetroColors::DIMMER);
    draw_scanline_overlay(it, r.x + 1, r.y + 1, w - 2, h - 2, 4,
                          RetroColors::SCANLINE);
    draw_corner_accent_tl(it, r.x + 4, r.y + 4, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_tr(it, r.x + w - 5, r.y + 4, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_bl(it, r.x + 4, r.y + h - 5, 5, RetroColors::CYAN_DIM);
    draw_corner_accent_br(it, r.x + w - 5, r.y + h - 5, 5,
                          RetroColors::CYAN_DIM);
#else
    const Color bg(10, 14, 22);
    draw_clipped_box(it, r.x, r.y, w, h, ui_corner_radius_for_height(h), accent, bg, false);
#endif

    if (label_ && label_[0] && g_theme.label.font != nullptr) {
      const int max_label_w = w - ui_spacing::md * 2;
      ui_print_truncated(it, r.x + ui_spacing::md, r.y + 6,
                         g_theme.label.font, dim_color_,
                         TextAlign::TOP_LEFT, label_, max_label_w);
    }

    {
      const int cy = (l.content_top + l.content_bottom) / 2;

      if (dp.condition && !dp.condition->empty() && g_theme.icon.font != nullptr) {
        const char *glyph = condition_icon(dp.condition->c_str());
        draw_weather_icon(it, r.x + w / 2, l.content_top + l.icon_y_offset,
                          accent, glyph);
      }

      const int temp_y = cy + l.temp_y_offset;
      if (valid_value(dp.temperature)) {
        char buf[16];
        snprintf(buf, sizeof(buf), "%.1f°", *dp.temperature);
        it.printf(r.x + w / 2, temp_y, g_theme.header.font, text_color_,
                  TextAlign::TOP_CENTER, "%s", buf);
      } else {
        it.printf(r.x + w / 2, temp_y, g_theme.header.font, dim_color_,
                  TextAlign::TOP_CENTER, "—°");
      }
    }

    {
      const int pill_top = r.y + h - 48;
      const int pill_h = 40;
      const int pill_pad = 5;
      const int pill_w = (w - l.pad * 2 - pill_pad * 2) / 3;

      ui_draw_data_pill(it, r.x + l.pad, pill_top, pill_w, pill_h, "HUM",
                        dp.humidity, "%", dim_color_, text_color_);
      ui_draw_data_pill(it, r.x + l.pad + pill_w + pill_pad, pill_top,
                        pill_w, pill_h, "RAIN", dp.precipitation, " mm",
                        dim_color_, text_color_);
      ui_draw_data_pill(it, r.x + l.pad + (pill_w + pill_pad) * 2, pill_top,
                        pill_w, pill_h, "WIND", dp.wind_speed, " m/s",
                        dim_color_, text_color_);
    }
  }

  // ---- Forecast layout ----
  void draw_forecast(display::Display &it, const UiRect &r) {
    const int w = r.w;
    const int h = r.h;
    const WeatherLayout l = make_weather_layout_(r, /*with_pill_row=*/false);

    const Color accent = condition_color(days_[0].condition ? days_[0].condition->c_str() : "");
    const Color bg(10, 14, 22);
    draw_clipped_box(it, r.x, r.y, w, h, ui_corner_radius_for_height(h), accent, bg, false);

    if (label_ && label_[0] && g_theme.label.font != nullptr) {
      const int max_label_w = w - ui_spacing::md * 2;
      ui_print_truncated(it, r.x + ui_spacing::md, r.y + 6,
                         g_theme.label.font, dim_color_,
                         TextAlign::TOP_LEFT, label_, max_label_w);
    }

    const int col_gap = ui_spacing::sm;
    const int col_count = 3;
    const int col_w = (w - l.pad * 2 - col_gap * 2) / col_count;
    const int content_h = l.content_bottom - l.content_top;
    const int day_to_icon_gap = 24;
    const int icon_to_temp_gap = 54;
    const int temp_to_rain_gap = 30;
    const int rain_to_value_gap = 18;
    const int value_h = 16;
    const int stack_h = day_to_icon_gap + icon_to_temp_gap + temp_to_rain_gap + rain_to_value_gap + value_h;
    const int centered_top = l.content_top + (content_h - stack_h) / 2 + 2;

    const char *day_labels[3] = {"---", "---", "---"};
    {
      const char *weekday_short[] = {"SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"};
      auto now = sntp_time->now();
      if (now.is_valid()) {
        int dow = now.day_of_week - 1; // 0=Sunday
        for (int i = 0; i < 3; i++) {
          day_labels[i] = weekday_short[(dow + i) % 7];
        }
      }
    }

    for (int d = 0; d < col_count; d++) {
      const int cx = r.x + l.pad + d * (col_w + col_gap);
      const int mid = cx + col_w / 2;
      const auto &dp = days_[d];
      const Color col_accent = condition_color(dp.condition ? dp.condition->c_str() : "");

      int cy = centered_top;

      // Day label
      if (g_theme.label.font != nullptr) {
        it.printf(mid, cy, g_theme.label.font, dim_color_,
                  TextAlign::TOP_CENTER, "%s", day_labels[d]);
      }
      cy += day_to_icon_gap;

      // Icon
      if (dp.condition && !dp.condition->empty() && g_theme.icon.font != nullptr) {
        const char *glyph = condition_icon(dp.condition->c_str());
        draw_weather_icon(it, mid, cy, col_accent, glyph);
      }
      cy += icon_to_temp_gap;

      // Temperature
      if (g_theme.label.font != nullptr) {
        if (valid_value(dp.temperature)) {
          char buf[16];
          snprintf(buf, sizeof(buf), "%.1f°", *dp.temperature);
          it.printf(mid, cy, g_theme.label.font, text_color_,
                    TextAlign::TOP_CENTER, "%s", buf);
        } else {
          it.printf(mid, cy, g_theme.label.font, dim_color_,
                    TextAlign::TOP_CENTER, "—°");
        }
      }
      cy += temp_to_rain_gap;

      // Rain detail
      if (g_theme.label.font != nullptr) {
        it.printf(mid, cy, g_theme.label.font, dim_color_,
                  TextAlign::TOP_CENTER, "RAIN");
        cy += rain_to_value_gap;
        if (valid_value(dp.precipitation)) {
          char buf[24];
          snprintf(buf, sizeof(buf), "%.1f mm", *dp.precipitation);
          it.printf(mid, cy, g_theme.label.font, text_color_,
                    TextAlign::TOP_CENTER, "%s", buf);
        } else {
          it.printf(mid, cy, g_theme.label.font, dim_color_,
                    TextAlign::TOP_CENTER, "\xE2\x80\x94");
        }
      }
    }
  }

  static bool valid_value(const float *p) {
    return p != nullptr && !std::isnan(*p) && !std::isinf(*p);
  }

  static bool changed_value(const float *p, float last) {
    if (p == nullptr) return false;
    return ui_value_changed_quantized(*p, last);
  }

  static void copy_value(const float *p, float &dest) {
    if (p != nullptr) dest = *p;
  }

  struct ConditionMeta {
    Color color;
    const char *icon;
  };

  static const std::map<std::string, ConditionMeta> kWeatherConditions;

  static const ConditionMeta* find_condition(const char *cond) {
    if (cond == nullptr) return nullptr;
    auto it = kWeatherConditions.find(cond);
    return it != kWeatherConditions.end() ? &it->second : nullptr;
  }

  static Color condition_color(const char *cond) {
    const ConditionMeta *m = find_condition(cond);
    return m ? m->color : Color(180, 190, 210);
  }

  static const char *condition_icon(const char *cond) {
    const ConditionMeta *m = find_condition(cond);
    return m ? m->icon : icon_weather_partly_cloudy;
  }

  // ---- MDI weather icon glyphs (UTF-8 C escapes) ----
  static const char icon_weather_cloudy[];
  static const char icon_weather_fog[];
  static const char icon_weather_hail[];
  static const char icon_weather_lightning[];
  static const char icon_weather_lightning_rainy[];
  static const char icon_weather_night[];
  static const char icon_weather_partly_cloudy[];
  static const char icon_weather_pouring[];
  static const char icon_weather_rainy[];
  static const char icon_weather_snowy[];
  static const char icon_weather_snowy_rainy[];
  static const char icon_weather_sunny[];
  static const char icon_weather_tornado[];
  static const char icon_weather_windy[];
  static const char icon_weather_windy_variant[];

  void draw_weather_icon(display::Display &it, int x, int y, Color color, const char *glyph) {
    auto *icon_font = g_theme.weather_icon.font ? g_theme.weather_icon.font : g_theme.icon.font;
    if (icon_font == nullptr || glyph == nullptr || glyph[0] == '\0') return;
    // When using the dedicated large weather font the glyph is already the
    // right size. Apply only a 1px stamp for weight/anti-aliasing. When
    // falling back to the small icon font (24px), use a wider stamp to
    // compensate for the smaller glyph.
    const bool using_large_font = g_theme.weather_icon.font != nullptr;
    const int spread = using_large_font ? 1 : 4;
    for (int dy = -spread; dy <= spread; dy++) {
      for (int dx = -spread; dx <= spread; dx++) {
        if (dx * dx + dy * dy > spread * spread) continue;
        it.printf(x + dx, y + dy, icon_font, color, TextAlign::TOP_CENTER, "%s", glyph);
      }
    }
  }

  UiRect rect_;
  const char *label_;
  std::string entity_id_;
  bool forecast_mode_ = false;
  Callback on_tap_;
  WeatherDayPointers days_[3];
  Color text_color_;
  Color dim_color_;
  std::string last_condition_[3];
  float last_temperature_[3] = {0.0f};
  float last_humidity_[3] = {0.0f};
  float last_wind_speed_[3] = {0.0f};
  float last_precipitation_[3] = {0.0f};
};

// ---- WeatherWidget static icon glyph definitions ----

const char WeatherWidget::icon_weather_cloudy[]           = "\xF3\xB0\x96\x90";
const char WeatherWidget::icon_weather_fog[]              = "\xF3\xB0\x96\x91";
const char WeatherWidget::icon_weather_hail[]             = "\xF3\xB0\x96\x92";
const char WeatherWidget::icon_weather_lightning[]        = "\xF3\xB0\x96\x93";
const char WeatherWidget::icon_weather_lightning_rainy[]  = "\xF3\xB0\x99\xBE";
const char WeatherWidget::icon_weather_night[]            = "\xF3\xB0\x96\x94";
const char WeatherWidget::icon_weather_partly_cloudy[]    = "\xF3\xB0\x96\x95";
const char WeatherWidget::icon_weather_pouring[]          = "\xF3\xB0\x96\x96";
const char WeatherWidget::icon_weather_rainy[]            = "\xF3\xB0\x96\x97";
const char WeatherWidget::icon_weather_snowy[]            = "\xF3\xB0\x96\x98";
const char WeatherWidget::icon_weather_snowy_rainy[]      = "\xF3\xB0\x99\xBF";
const char WeatherWidget::icon_weather_sunny[]            = "\xF3\xB0\x96\x99";
const char WeatherWidget::icon_weather_tornado[]          = "\xF3\xB0\xBC\xB8";
const char WeatherWidget::icon_weather_windy[]            = "\xF3\xB0\x96\x9D";
const char WeatherWidget::icon_weather_windy_variant[]    = "\xF3\xB0\x96\x9E";

// Single source of truth for weather-condition colour + icon. Both
// condition_color() and condition_icon() look up from this table so
// adding a new condition only requires one line.
const std::map<std::string, WeatherWidget::ConditionMeta> WeatherWidget::kWeatherConditions = {
  {"sunny",           {Color(255, 200, 50), WeatherWidget::icon_weather_sunny}},
  {"clear-night",     {Color(70, 90, 160),  WeatherWidget::icon_weather_night}},
  {"cloudy",          {Color(160, 170, 185),WeatherWidget::icon_weather_cloudy}},
  {"partlycloudy",    {Color(180, 190, 210),WeatherWidget::icon_weather_partly_cloudy}},
  {"partly_cloudy",   {Color(180, 190, 210),WeatherWidget::icon_weather_partly_cloudy}},
  {"rainy",           {Color(70, 130, 200), WeatherWidget::icon_weather_rainy}},
  {"pouring",         {Color(40, 90, 170),  WeatherWidget::icon_weather_pouring}},
  {"snowy",           {Color(215, 235, 250),WeatherWidget::icon_weather_snowy}},
  {"snowy-rainy",     {Color(150, 195, 220),WeatherWidget::icon_weather_snowy_rainy}},
  {"snowing",         {Color(210, 230, 245),WeatherWidget::icon_weather_snowy}},
  {"snow",            {Color(210, 230, 245),WeatherWidget::icon_weather_snowy}},
  {"fog",             {Color(150, 160, 175),WeatherWidget::icon_weather_fog}},
  {"hail",            {Color(170, 200, 220),WeatherWidget::icon_weather_hail}},
  {"lightning",       {Color(200, 180, 80), WeatherWidget::icon_weather_lightning}},
  {"lightning_rainy", {Color(200, 180, 80), WeatherWidget::icon_weather_lightning_rainy}},
  {"lightning-rainy", {Color(200, 180, 80), WeatherWidget::icon_weather_lightning_rainy}},
  {"windy",           {Color(130, 200, 180),WeatherWidget::icon_weather_windy}},
  {"windy-variant",   {Color(140, 180, 185),WeatherWidget::icon_weather_windy_variant}},
  {"exceptional",     {Color(200, 100, 100),WeatherWidget::icon_weather_tornado}},
};
