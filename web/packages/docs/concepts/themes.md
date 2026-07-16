# Themes

VESP Cloud offers two display themes. Choose one from **Project Settings** to
change the look of your entire display.

## Retro theme

The default theme. Inspired by classic computer terminals:

| Color role | Value |
|-----------|-------|
| Background | Black `(0, 0, 0)` |
| Foreground | White `(255, 255, 255)` |
| Accent | Cyan `(0, 255, 255)` |
| Secondary accent | Magenta `(255, 0, 255)` |
| Chrome accent | Cyan `(0, 240, 255)` |

**Style:** Sharp corners, header borders enabled, 3px shadow offset, 10px corner
decorations.

## Modern theme

A cleaner, softer look:

| Color role | Value |
|-----------|-------|
| Background | Dark grey `(18, 18, 18)` |
| Foreground | Off-white `(245, 245, 245)` |
| Accent | Blue `(74, 158, 254)` |
| Secondary accent | Purple `(156, 39, 176)` |
| Chrome accent | Green `(0, 230, 118)` |

**Style:** 8px border radius, no header borders, no shadows or corner accents.

## Chrome accent color

Regardless of which theme you choose, you can set a custom **chrome accent
color** in Project Settings. This color is used for:

- The digital clock display
- The page indicator active dot
- The detail view header title

Open **Project Settings** and use the color picker under **Project Color** to
change it. The default matches your chosen theme.

## How themes affect generated firmware

The selected theme is compiled into your firmware as:

- A `#define UI_THEME_RETRO` flag (set to `1` for Retro, `0` for Modern)
- A `CHROME_ACCENT_COLOR` constant with the selected accent color
- Color constants for widget labels, headers, info backgrounds, primary
  elements, and icons
- Style flags for button shadows, corner accents, container corners, and header
  borders

These values are used at runtime by the C++ rendering code on the display.
