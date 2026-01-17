import type { Project, Color } from "@esphome-designer/schema";

export function generateRenderHelpers(project: Project): string {
   const lines: string[] = [];
   const theme = project.theme!;

   lines.push(`#pragma once`);
   lines.push(`#include "esphome.h"`);
   lines.push(`#include "state_manager.h"`);
   lines.push(``);
   
   lines.push(`// Forward declarations for ESPHome-generated fonts and time`);
   lines.push(`extern esphome::font::Font *font_tiny;`);
   lines.push(`extern esphome::font::Font *font_small;`);
   lines.push(`extern esphome::font::Font *font_medium;`);
   lines.push(`extern esphome::font::Font *font_large;`);
   lines.push(``);

   // drawThemedBox helper
   lines.push(`void drawThemedBox(display::Display& it, int x, int y, int w, int h, const char* label = nullptr) {`);
   lines.push(`  // Background`);
   lines.push(`  it.filled_rectangle(x, y, w, h, Theme::BACKGROUND_SECONDARY);`);
   lines.push(``);
   if (theme.style.containerCorners) {
     const cs = theme.values.cornerSize ?? 10;
     lines.push(`  // Retro Corners`);
     lines.push(`  it.line(x, y, x + ${cs}, y, Theme::ACCENT);`);
     lines.push(`  it.line(x, y, x, y + ${cs}, Theme::ACCENT);`);
     lines.push(`  it.line(x + 3, y + 3, x + ${cs}, y + 3, Theme::ACCENT);`);
     lines.push(`  it.line(x + 3, y + 3, x + 3, y + ${cs}, Theme::ACCENT);`);
     lines.push(``);
     lines.push(`  it.line(x + w - ${cs}, y, x + w, y, Theme::ACCENT);`);
     lines.push(`  it.line(x + w, y, x + w, y + ${cs}, Theme::ACCENT);`);
     lines.push(`  it.line(x + w - ${cs}, y + 3, x + w - 3, y + 3, Theme::ACCENT);`);
     lines.push(`  it.line(x + w - 3, y + 3, x + w - 3, y + ${cs}, Theme::ACCENT);`);
     lines.push(``);
     lines.push(`  it.line(x, y + h - ${cs}, x, y + h, Theme::ACCENT);`);
     lines.push(`  it.line(x, y + h, x + ${cs}, y + h, Theme::ACCENT);`);
     lines.push(`  it.line(x + 3, y + h - ${cs}, x + 3, y + h - 3, Theme::ACCENT);`);
     lines.push(`  it.line(x + 3, y + h - 3, x + ${cs}, y + h - 3, Theme::ACCENT);`);
     lines.push(``);
     lines.push(`  it.line(x + w - ${cs}, y + h, x + w, y + h, Theme::ACCENT);`);
     lines.push(`  it.line(x + w, y + h, x + w, y + h - ${cs}, Theme::ACCENT);`);
     lines.push(`  it.line(x + w - ${cs}, y + h - 3, x + w - 3, y + h - 3, Theme::ACCENT);`);
     lines.push(`  it.line(x + w - 3, y + h - 3, x + w - 3, y + h - ${cs}, Theme::ACCENT);`);
   }
   lines.push(`  if (label) {`);
   lines.push(`    it.printf(x + 10, y + 15, font_small, Theme::ACCENT, TextAlign::TOP_LEFT, "%s", label);`);
   lines.push(`  }`);
   lines.push(`}`);
   lines.push(``);

   // drawCommonHeader helper
   lines.push(`void drawCommonHeader(display::Display& it) {`);
   lines.push(`  it.line(0, 40, 240, 40, Theme::ACCENT);`);
   lines.push(`  auto time = id(sntp_time).now();`);
   lines.push(`  if (time.is_valid()) {`);
   lines.push(`    it.strftime(10, 20, font_medium, Theme::FOREGROUND, TextAlign::CENTER_LEFT, "%H:%M", time);`);
   lines.push(`    it.strftime(230, 20, font_small, Theme::FOREGROUND_MUTED, TextAlign::CENTER_RIGHT, "%d.%m.%y", time);`);
   lines.push(`  }`);
   lines.push(`}`);
   lines.push(``);

   // drawPageIndicator helper
   lines.push(`void drawPageIndicator(display::Display& it, int activePage, int totalPages) {`);
   lines.push(`  int startX = (240 - (totalPages * 15)) / 2;`);
   lines.push(`  for (int i = 0; i < totalPages; i++) {`);
   lines.push(`    Color c = (i == activePage) ? Theme::ACCENT : Theme::FOREGROUND_MUTED;`);
   lines.push(`    it.filled_circle(startX + (i * 15), 310, 3, c);`);
   lines.push(`  }`);
   lines.push(`}`);
   lines.push(``);

   // drawDetailHeader helper
   lines.push(`void drawDetailHeader(display::Display& it, const char* title) {`);
   lines.push(`  it.filled_rectangle(0, 0, 240, 40, Theme::BACKGROUND);`);
   lines.push(`  it.line(0, 40, 240, 40, Theme::ACCENT);`);
   lines.push(`  `);
   lines.push(`  // Back button`);
   lines.push(`  it.rectangle(5, 5, 60, 30, Theme::ACCENT);`);
   lines.push(`  it.print(35, 20, font_small, Theme::FOREGROUND, TextAlign::CENTER, "< BACK");`);
   lines.push(`  `);
   lines.push(`  // Title`);
   lines.push(`  it.printf(150, 20, font_medium, Theme::FOREGROUND, TextAlign::CENTER, "%s", title);`);
   lines.push(`}`);

   return lines.join("\n");
 }
