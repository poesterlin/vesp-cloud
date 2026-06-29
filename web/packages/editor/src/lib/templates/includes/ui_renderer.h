#pragma once

#include "esphome.h"
#include "ui_retro.h"
#include "ui_app.h"
#include "ui_invalidation.h"
#include "ui_redraw.h"

#include <cstring>
#include <esp_heap_caps.h>

// 480 cols x 64 rows of RGB565 = 60 KiB. Lives in internal DRAM so the LCD
// driver's PSRAM->framebuffer copy isn't competing with itself on the PSRAM bus.
// 480x480 fill becomes ceil(480 / 64) = 8 esp_lcd_panel_draw_bitmap() calls
// instead of 480 — that single change kills most of the per-call overhead.
inline void ui_fast_filled_rectangle(display::Display &it, int x, int y, int w, int h, Color color) {
  if (w <= 0 || h <= 0) {
    return;
  }

  // This path writes pixels straight to the panel via draw_pixels_at(), which
  // bypasses the display's clipping region. Higher-level callers (scroll
  // viewport) rely on start_clipping() to keep fills inside an area, so we
  // clamp manually here. Without this, button/box backgrounds drawn through
  // this function bleed past the clip rect (e.g. over a fixed header).
  if (it.is_clipping()) {
    const auto clip = it.get_clipping();
    const int clip_left = clip.x;
    const int clip_top = clip.y;
    const int clip_right = clip.x + clip.w;   // exclusive
    const int clip_bottom = clip.y + clip.h;  // exclusive

    int x0 = x > clip_left ? x : clip_left;
    int y0 = y > clip_top ? y : clip_top;
    int x1 = (x + w) < clip_right ? (x + w) : clip_right;
    int y1 = (y + h) < clip_bottom ? (y + h) : clip_bottom;

    x = x0;
    y = y0;
    w = x1 - x0;
    h = y1 - y0;
    if (w <= 0 || h <= 0) {
      return;
    }
  }

  static constexpr int FILL_BUF_COLS = 480;
  static constexpr int FILL_BUF_ROWS = 64;
  static constexpr int FILL_BUF_PIXELS = FILL_BUF_COLS * FILL_BUF_ROWS;

  static uint16_t *s_buf = nullptr;
  static uint16_t s_pixel = 0;
  static bool s_valid = false;

  if (s_buf == nullptr) {
    s_buf = static_cast<uint16_t *>(
        heap_caps_malloc(FILL_BUF_PIXELS * sizeof(uint16_t),
                         MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT));
    if (s_buf == nullptr) {
      s_buf = static_cast<uint16_t *>(
          heap_caps_malloc(FILL_BUF_PIXELS * sizeof(uint16_t),
                           MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
    }
    s_valid = false;
  }

  uint16_t pixel = display::ColorUtil::color_to_565(color);
  pixel = (pixel >> 8) | (pixel << 8);

  if (!s_valid || pixel != s_pixel) {
    if ((pixel & 0xFF) == (pixel >> 8)) {
      std::memset(s_buf, pixel & 0xFF, FILL_BUF_PIXELS * sizeof(uint16_t));
    } else {
      const uint32_t p32 = (static_cast<uint32_t>(pixel) << 16) | pixel;
      uint32_t *dst = reinterpret_cast<uint32_t *>(s_buf);
      const int n32 = FILL_BUF_PIXELS / 2;
      for (int i = 0; i < n32; i++) dst[i] = p32;
    }
    s_pixel = pixel;
    s_valid = true;
  }

  const int line_w = (w > FILL_BUF_COLS) ? FILL_BUF_COLS : w;
  const int rows_per_chunk = FILL_BUF_PIXELS / line_w;

  int remaining = h;
  int cy = y;
  while (remaining > 0) {
    const int rows = (remaining > rows_per_chunk) ? rows_per_chunk : remaining;
    it.draw_pixels_at(x, cy, line_w, rows, reinterpret_cast<const uint8_t *>(s_buf),
                      display::COLOR_ORDER_RGB, display::COLOR_BITNESS_565,
                      true, 0, 0, 0);
    cy += rows;
    remaining -= rows;
  }
}

inline void ui_fast_fill(display::Display &it, Color color) { ui_fast_filled_rectangle(it, 0, 0, it.get_width(), it.get_height(), color); }

// --- OTA splash -------------------------------------------------------------
// When an OTA update begins, the on_begin lambda sets g_ota_in_progress = true
// and calls id(main_display).update(). render_basic_ui() short-circuits to
// render_ota_splash() for as long as the flag stays set, so subsequent
// updates triggered by touch handlers / intervals keep painting the splash
// instead of the running UI. This avoids the wild flicker that happens when
// the ESP32 is erasing/writing main flash on the same cache bus the RGB-DMA
// bounce buffer lives on -- the user just sees a static "UPDATING" screen
// until the device reboots into the new firmware.
//
// Set g_ota_font from the OTA on_begin lambda (e.g. g_ota_font = id(font_medium))
// before triggering the first update; render_ota_splash() falls back to a
// plain black fill if it is null.
inline bool g_ota_in_progress = false;
inline esphome::font::Font *g_ota_font = nullptr;

inline void render_ota_splash(display::Display &it) {
  ui_fast_fill(it, RetroColors::BLACK);
  if (g_ota_font == nullptr) return;

  it.print(240, 220, g_ota_font, RetroColors::CYAN, TextAlign::CENTER, "UPDATING");
  it.print(240, 260, g_ota_font, RetroColors::DIMMER, TextAlign::CENTER, "do not power off");
}

// --- Profiling --------------------------------------------------------------
// Set UI_PROFILE 1 (e.g. via -DUI_PROFILE=1 in the YAML build flags, or just
// flip this define) to log per-frame timing. Each redraw prints:
//
//   ui_draw full=1 partial_rects=3 fill=8.4ms screens=42.1ms total=50.7ms
//
// 'fill' is the global black fill in UiApp::draw (0 if skipped).
// 'screens' is the screen draw (includes all widget painting).
// 'total' is begin_draw -> end_draw, which is essentially fill + screens.
//
// Use this to localise the ~80ms flash before changing more code.
#ifndef UI_PROFILE
#define UI_PROFILE 1
#endif

#if UI_PROFILE
inline void ui_profile_log(uint32_t total_us) {
  const bool full = UiInvalidation::is_full_dirty();
  const int partial = UiInvalidation::dirty_count();
  ESP_LOGI("ui_draw",
           "full=%d partial_rects=%d fill=%.2fms screens=%.2fms total=%.2fms",
           full ? 1 : 0, partial,
           UiProfileTimer::fill_us / 1000.0f,
           UiProfileTimer::screens_us / 1000.0f,
           total_us / 1000.0f);
  UiProfileTimer::fill_us = 0;
  UiProfileTimer::screens_us = 0;
}
#endif

inline void render_basic_ui(display::Display &it) {
  // OTA splash takes priority over the normal UI path. We do NOT call
  // g_ui_app.update() here -- during OTA the ESP32 is busy erasing/writing
  // flash and polling widgets / firing HA callbacks would just waste CPU
  // and twitch state mid-update.
  if (g_ota_in_progress) {
    render_ota_splash(it);
    return;
  }

  const uint32_t now = millis();
  g_ui_app.update(now);

  if (!UiInvalidation::needs_redraw()) {
    return;
  }

  UiRedraw::begin_draw();
#if UI_PROFILE
  const uint32_t t0 = micros();
  g_ui_app.draw(it, now);
  const uint32_t t1 = micros();
  ui_profile_log(t1 - t0);
#else
  g_ui_app.draw(it, now);
#endif
  const bool more_pending = UiInvalidation::should_continue();
  UiRedraw::end_draw();
  if (more_pending) {
    UiRedraw::trigger_display_update();
  }
}
