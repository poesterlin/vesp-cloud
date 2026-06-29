#pragma once

#include "esphome.h"
#include "ui_theme.h"

// Forward reference to the fast fill helper defined in ui_renderer.h
void ui_fast_filled_rectangle(display::Display &it, int x, int y, int w, int h, Color color);
void ui_fast_fill(display::Display &it, Color color);

// ============================================================================
//  Cyberpunk / Retro UI colour palette
// ============================================================================
namespace RetroColors {
  const Color BLACK(0, 0, 0);
#if UI_THEME_RETRO
  const Color VOID(2, 3, 5);
  const Color DARK(8, 12, 18);
  const Color DIM(25, 30, 40);
  const Color DIMMER(50, 60, 75);
  const Color STEEL(90, 100, 115);
  const Color CYAN(0, 240, 255);          // #00F0FF - main accent
  const Color CYAN_GLOW(0, 60, 80);       // glow halo
  const Color CYAN_DIM(0, 120, 150);      // muted
  const Color AMBER(255, 180, 0);
  const Color AMBER_GLOW(80, 50, 0);
  const Color AMBER_DIM(160, 110, 0);
  const Color GREEN(0, 255, 100);
  const Color GREEN_GLOW(0, 60, 25);
  const Color GREEN_DIM(0, 140, 55);
#else
  const Color VOID(13, 17, 23);           // #0D1117 - Sleek dark charcoal background
  const Color DARK(22, 27, 34);           // #161B22 - Clean dark gray for borders/separators
  const Color DIM(30, 36, 45);            // #1E242D - Medium dark gray for card backgrounds
  const Color DIMMER(48, 54, 61);         // #30363D - Gray for inactive elements
  const Color STEEL(139, 148, 158);       // #8B949E - Muted steel text/accent
  const Color CYAN(0, 230, 118);          // #00E676 - Main neon green accent (matching Spotify green)
  const Color CYAN_GLOW(0, 50, 25);       // glow halo
  const Color CYAN_DIM(0, 150, 75);       // muted green
  const Color AMBER(255, 75, 58);         // #FF4B3A - Secondary neon coral/orange accent
  const Color AMBER_GLOW(80, 20, 15);
  const Color AMBER_DIM(180, 50, 40);
  const Color GREEN(0, 230, 118);
  const Color GREEN_GLOW(0, 50, 25);
  const Color GREEN_DIM(0, 150, 75);
#endif
  const Color RED(255, 55, 55);
  const Color RED_GLOW(80, 10, 10);
  const Color RED_DIM(150, 30, 30);
  const Color MAGENTA(255, 0, 200);
  const Color MAGENTA_GLOW(80, 0, 60);
  const Color MAGENTA_DIM(150, 0, 120);
  const Color BLUE(80, 180, 255);
  const Color BLUE_GLOW(20, 50, 80);
  const Color BLUE_DIM(40, 100, 150);
#if UI_THEME_RETRO
  const Color WHITE(230, 240, 250);
  const Color LIGHT(170, 185, 200);
  const Color GRAY(120, 130, 145);
  const Color DARK_GRAY(60, 68, 80);
#else
  const Color WHITE(240, 246, 252);       // #F0F6FC - Premium high-contrast white
  const Color LIGHT(201, 209, 217);       // #C9D1D9 - Soft light gray for general text
  const Color GRAY(139, 148, 158);        // #8B949E - Medium gray
  const Color DARK_GRAY(72, 79, 88);      // #484F58 - Darker gray
#endif

  // Scanline & grid overlay colours (barely visible on RGB565)
  const Color SCANLINE(2, 2, 3);
  const Color GRID_LINE(6, 9, 14);
}

#if !UI_THEME_RETRO
// ============================================================================
//  Rounded Corner Drawing Helpers (using Bresenham/Sqrt logic for accuracy)
// ============================================================================
inline void draw_corner_arc(display::Display &it, int cx, int cy, int r, int corner, Color color) {
  if (r <= 0) return;
  int x = 0;
  int y = r;
  int d = 3 - 2 * r;
  while (x <= y) {
    switch (corner) {
      case 0: // Top-Left
        it.draw_pixel_at(cx - x, cy - y, color);
        it.draw_pixel_at(cx - y, cy - x, color);
        break;
      case 1: // Top-Right
        it.draw_pixel_at(cx + x, cy - y, color);
        it.draw_pixel_at(cx + y, cy - x, color);
        break;
      case 2: // Bottom-Right
        it.draw_pixel_at(cx + x, cy + y, color);
        it.draw_pixel_at(cx + y, cy + x, color);
        break;
      case 3: // Bottom-Left
        it.draw_pixel_at(cx - x, cy + y, color);
        it.draw_pixel_at(cx - y, cy + x, color);
        break;
    }
    if (d < 0) {
      d += 4 * x + 6;
    } else {
      d += 4 * (x - y) + 10;
      y--;
    }
    x++;
  }
}

inline void fill_corner_arc(display::Display &it, int cx, int cy, int r, int corner, Color color) {
  if (r <= 0) return;
  for (int dy = 0; dy <= r; dy++) {
    int dx = std::round(std::sqrt(r * r - dy * dy));
    switch (corner) {
      case 0: // Top-Left
        it.line(cx - dx, cy - dy, cx, cy - dy, color);
        break;
      case 1: // Top-Right
        it.line(cx, cy - dy, cx + dx, cy - dy, color);
        break;
      case 2: // Bottom-Right
        it.line(cx, cy + dy, cx + dx, cy + dy, color);
        break;
      case 3: // Bottom-Left
        it.line(cx - dx, cy + dy, cx, cy + dy, color);
        break;
    }
  }
}
#endif

// ============================================================================
//  Rounded border and filled box functions
// ============================================================================
inline void draw_clipped_border(display::Display &it, int x, int y, int w, int h,
                                int c_tl = 6, int c_tr = 6, int c_br = 6, int c_bl = 6,
                                Color color = RetroColors::CYAN) {
#if UI_THEME_RETRO
  if (w <= 0 || h <= 0) return;

  int max_c = ((w < h ? w : h) / 2) - 1;
  if (max_c < 0) max_c = 0;
  auto clamp = [max_c](int &c) {
    if (c > max_c) c = max_c;
    if (c < 0) c = 0;
  };
  clamp(c_tl); clamp(c_tr); clamp(c_br); clamp(c_bl);

  int x1 = x, x2 = x + w, y1 = y, y2 = y + h;

  // Top edge
  if ((c_tl > 0 || c_tr > 0) && (x2 - c_tr) > (x1 + c_tl))
    it.line(x1 + c_tl, y1, x2 - c_tr, y1, color);
  // Top-right clip
  if (c_tr > 0)
    it.line(x2 - c_tr, y1, x2, y1 + c_tr, color);
  // Right edge
  if ((c_tr > 0 || c_br > 0) && (y2 - c_br) > (y1 + c_tr))
    it.line(x2, y1 + c_tr, x2, y2 - c_br, color);
  // Bottom-right clip
  if (c_br > 0)
    it.line(x2, y2 - c_br, x2 - c_br, y2, color);
  // Bottom edge
  if ((c_br > 0 || c_bl > 0) && (x2 - c_br) > (x1 + c_bl))
    it.line(x2 - c_br, y2, x1 + c_bl, y2, color);
  // Bottom-left clip
  if (c_bl > 0)
    it.line(x1 + c_bl, y2, x1, y2 - c_bl, color);
  // Left edge
  if ((c_bl > 0 || c_tl > 0) && (y2 - c_bl) > (y1 + c_tl))
    it.line(x1, y2 - c_bl, x1, y1 + c_tl, color);
  // Top-left clip
  if (c_tl > 0)
    it.line(x1, y1 + c_tl, x1 + c_tl, y1, color);
#else
  int r = c_tl;
  if (w <= 0 || h <= 0) return;
  int max_r = ((w < h ? w : h) / 2) - 1;
  if (r > max_r) r = max_r;
  if (r < 0) r = 0;

  if (r == 0) {
    it.rectangle(x, y, w, h, color);
    return;
  }

  // Draw 4 straight edge segments
  it.line(x + r, y, x + w - r - 1, y, color);
  it.line(x + r, y + h - 1, x + w - r - 1, y + h - 1, color);
  it.line(x, y + r, x, y + h - r - 1, color);
  it.line(x + w - 1, y + r, x + w - 1, y + h - r - 1, color);

  // Draw 4 corner arcs
  draw_corner_arc(it, x + r, y + r, r, 0, color);                 // Top-Left
  draw_corner_arc(it, x + w - 1 - r, y + r, r, 1, color);         // Top-Right
  draw_corner_arc(it, x + w - 1 - r, y + h - 1 - r, r, 2, color); // Bottom-Right
  draw_corner_arc(it, x + r, y + h - 1 - r, r, 3, color);         // Bottom-Left
#endif
}

inline void draw_clipped_box(display::Display &it, int x, int y, int w, int h,
                             int c_tl = 6, int c_tr = 6, int c_br = 6, int c_bl = 6,
                             Color border = RetroColors::CYAN,
                             Color fill = RetroColors::DIM,
                             bool glow = true) {
#if UI_THEME_RETRO
  if (glow) {
    // Thick dim halo behind the border
    draw_clipped_border(it, x - 2, y - 2, w + 4, h + 4,
                        c_tl + 2, c_tr + 2, c_br + 2, c_bl + 2,
                        (border.red / 4 > 0) ? Color(border.red / 4, border.green / 4, border.blue / 4)
                                             : border);
  }
  // Fill interior (corners will be covered by border lines visually)
  ui_fast_filled_rectangle(it, x + 1, y + 1, w - 2, h - 2, fill);
  // Bright border on top
  draw_clipped_border(it, x, y, w, h, c_tl, c_tr, c_br, c_bl, border);
#else
  int r = c_tl;
  if (w <= 0 || h <= 0) return;
  int max_r = ((w < h ? w : h) / 2) - 1;
  if (r > max_r) r = max_r;
  if (r < 0) r = 0;

  if (glow) {
    // Subtle glow border offset by 1px
    draw_clipped_border(it, x - 1, y - 1, w + 2, h + 2, r + 1, r + 1, r + 1, r + 1,
                        Color(border.red / 4, border.green / 4, border.blue / 4));
  }

  if (r == 0) {
    ui_fast_filled_rectangle(it, x, y, w, h, fill);
    it.rectangle(x, y, w, h, border);
    return;
  }

  // Fill interior using fast filled rectangles (cross pattern)
  ui_fast_filled_rectangle(it, x + r, y, w - 2 * r, h, fill);
  ui_fast_filled_rectangle(it, x, y + r, r, h - 2 * r, fill);
  ui_fast_filled_rectangle(it, x + w - r, y + r, r, h - 2 * r, fill);

  // Fill the 4 corners
  fill_corner_arc(it, x + r, y + r, r, 0, fill);                 // Top-Left
  fill_corner_arc(it, x + w - 1 - r, y + r, r, 1, fill);         // Top-Right
  fill_corner_arc(it, x + w - 1 - r, y + h - 1 - r, r, 2, fill); // Bottom-Right
  fill_corner_arc(it, x + r, y + h - 1 - r, r, 3, fill);         // Bottom-Left

  // Draw the border outline on top
  draw_clipped_border(it, x, y, w, h, r, r, r, r, border);
#endif
}

// Convenience wrapper for symmetric corners
inline void draw_clipped_box(display::Display &it, int x, int y, int w, int h,
                             int c, Color border, Color fill, bool glow = true) {
  draw_clipped_box(it, x, y, w, h, c, c, c, c, border, fill, glow);
}

// ============================================================================
//  Double-line rounded border (outer + inner offset = clean modern card look)
// ============================================================================
inline void draw_double_clipped_border(display::Display &it, int x, int y, int w, int h,
                                       int c = 6, int margin = 3,
                                       Color outer = RetroColors::CYAN,
                                       Color inner = RetroColors::CYAN_DIM) {
  draw_clipped_border(it, x, y, w, h, c, c, c, c, outer);
  if (margin > 0)
    draw_clipped_border(it, x + margin, y + margin, w - 2 * margin, h - 2 * margin,
                        c - margin, c - margin, c - margin, c - margin, inner);
}

// Dashed horizontal line with configurable dash/space length
inline void draw_dashed_hline(display::Display &it, int x1, int x2, int y,
                              Color color, int dash_len = 3, int space_len = 3) {
  int x = x1;
  bool draw = true;
  while (x < x2) {
    int seg_end = x + (draw ? dash_len : space_len);
    if (seg_end > x2) seg_end = x2;
    if (draw) {
      it.line(x, y, seg_end, y, color);
    }
    x = seg_end;
    draw = !draw;
  }
}

#if UI_THEME_RETRO
// ============================================================================
//  CRT scanline overlay - dark horizontal lines every N pixels
// ============================================================================
inline void draw_scanline_overlay(display::Display &it, int x, int y, int w, int h,
                                  int spacing = 4, Color color = RetroColors::SCANLINE) {
  for (int line_y = y + 1; line_y < y + h; line_y += spacing) {
    ui_fast_filled_rectangle(it, x, line_y, w, 1, color);
  }
}

// ============================================================================
//  Grid background pattern - subtle graph-paper lines
// ============================================================================
inline void draw_grid_background(display::Display &it, int x, int y, int w, int h,
                                 int spacing = 20, Color color = RetroColors::GRID_LINE) {
  for (int gx = x + spacing; gx < x + w; gx += spacing)
    it.line(gx, y, gx, y + h, color);
  for (int gy = y + spacing; gy < y + h; gy += spacing)
    it.line(x, gy, x + w, gy, color);
}
#endif

//  Clean modern background: flat void fill
// ============================================================================
inline void draw_retro_background(display::Display &it) {
#if UI_THEME_RETRO
  const int W = 480, H = 480;

  ui_fast_fill(it, RetroColors::VOID);
  draw_grid_background(it, 0, 0, W, H, 20, RetroColors::GRID_LINE);
  draw_scanline_overlay(it, 0, 0, W, H, 4, RetroColors::SCANLINE);

  // Frame border - left & right edges (above header space)
  it.line(0, 0, 0, H, RetroColors::DARK);
  it.line(W - 1, 0, W - 1, H, RetroColors::DARK);

  // Corner accents (small L-shapes inside each corner)
  const int arm = 7;
  const Color ac = RetroColors::CYAN_DIM;
  // Top-left
  it.line(2, 3, 2 + arm, 3, ac);
  it.line(2, 3, 2, 3 + arm, ac);
  // Top-right
  it.line(W - 3, 3, W - 3 - arm, 3, ac);
  it.line(W - 3, 3, W - 3, 3 + arm, ac);
  // Bottom-left
  it.line(2, H - 3, 2 + arm, H - 3, ac);
  it.line(2, H - 3, 2, H - 3 - arm, ac);
  // Bottom-right
  it.line(W - 3, H - 3, W - 3 - arm, H - 3, ac);
  it.line(W - 3, H - 3, W - 3, H - 3 - arm, ac);

  // Greeble ticks at bottom centre (micro-UI detail)
  const int gx = W / 2;
  const int gy = H - 4;
  const Color gc(0, 30, 45);
  for (int i = -7; i <= 7; i++) {
    int tx = gx + i * 3;
    int th = (i % 3 == 0) ? 4 : 2;
    ui_fast_filled_rectangle(it, tx, gy - th, 1, th, gc);
  }
#else
  ui_fast_fill(it, RetroColors::VOID);
#endif
}

// ============================================================================
//  Diagonal hatch pattern (for headers / section dividers)
// ============================================================================
inline void draw_hatch_pattern(display::Display &it, int x_start, int y_top, int y_bottom,
                               int n = 5, int spacing = 8, Color color = RetroColors::CYAN_DIM) {
  int slant = y_bottom - y_top;
  for (int i = 0; i < n; i++) {
    int xs = x_start + i * spacing;
    it.line(xs, y_top, xs - slant, y_bottom, color);
  }
}

// ============================================================================
//  Segmented progress / status bar
// ============================================================================
inline void draw_segmented_bar(display::Display &it, int x, int y, int w, int h,
                               int segments, int filled, int gap = 2,
                               Color fill_on = RetroColors::CYAN,
                               Color fill_off = RetroColors::DIMMER) {
  int block_w = (w - gap * (segments - 1)) / segments;
  for (int i = 0; i < segments; i++) {
    int bx = x + i * (block_w + gap);
    if (i < filled)
      ui_fast_filled_rectangle(it, bx, y, block_w, h, fill_on);
    else
      ui_fast_filled_rectangle(it, bx, y, block_w, h, fill_off);
  }
}

// ============================================================================
//  Corner accent - decorative L-shape
// ============================================================================
inline void draw_corner_accent_tl(display::Display &it, int x, int y, int arm, Color color) {
  it.line(x, y, x + arm, y, color);
  it.line(x, y, x, y + arm, color);
}

inline void draw_corner_accent_tr(display::Display &it, int x, int y, int arm, Color color) {
  it.line(x, y, x - arm, y, color);
  it.line(x, y, x, y + arm, color);
}

inline void draw_corner_accent_bl(display::Display &it, int x, int y, int arm, Color color) {
  it.line(x, y, x + arm, y, color);
  it.line(x, y, x, y - arm, color);
}

inline void draw_corner_accent_br(display::Display &it, int x, int y, int arm, Color color) {
  it.line(x, y, x - arm, y, color);
  it.line(x, y, x, y - arm, color);
}
