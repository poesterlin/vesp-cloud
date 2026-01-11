# AGENTS.md - Home Display ESPHome Project

This file provides essential information for agentic coding agents working on this ESPHome-based home display project.

Describes the architecture of the display application, focusing on navigation and interaction models. Always refer to this document when making changes that affect user navigation or screen rendering. Always keep this document updated with any architectural changes.

## Navigation Model

The application is split into two modes:

1.  **Main Dashboard (Carousel)**
    *   **Navigation:** Horizontal Swipes (Left/Right).
    *   **Content:** High-level status (Weather, Summary, Device Status).
    *   **Interactions:** Tapping specific widgets (e.g., "Vacuum" card) opens a Detail View.

2.  **Detail Views (Apps)**
    *   **Navigation:** Vertical Scrolling (Up/Down).
    *   **Content:** Full lists, controls, logs.
    *   **Interactions:** 
        *   **Scroll:** Drag up/down.
        *   **Exit:** "Back" button (Physical or Virtual).

## Directory Structure Changes

*   `includes/state_manager.h`: Adds `ViewMode` enum and `scrollY`.
*   `includes/touch_handler.h`: **NEW**. Centralizes touch logic (Tap detection vs. Swipe vs. Scroll).
*   `includes/display_renderer.h`: Adds rendering functions for Detail views.

## Coordinate System

*   **Main Pages:** Fixed layout.
*   **Detail Pages:** Virtual height > Screen height. Rendering is offset by `gState.scrollY`.


## Build/Test Commands

### Python Environment
```bash
# Activate virtual environment (necessary for ESPHome commands)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### ESPHome Commands
```bash
# Compile the firmware (dry run). its very noisy so redirect output to /dev/null and only show if there are errors. it will still output "INFO Successfully compiled program." if successful.
esphome compile esphome/my-display.yaml 1>/dev/null

# Upload to device. I will do this for you when needed. Never upload without confirming first.
esphome upload esphome/my-display.yaml

# Run with debug output
esphome run esphome/my-display.yaml --device /dev/ttyUSB0

# Clean build files
esphome clean esphome/my-display.yaml

# Validate configuration
esphome config esphome/my-display.yaml
```

## Project Architecture

This is an ESPHome project for a 240x320 touchscreen display running on ESP32-S3. The application follows a dual-mode navigation pattern:

### Navigation Modes
1. **Main Dashboard (Carousel)**: Horizontal swipe navigation between 4 pages
2. **Detail Views**: Vertical scrolling for detailed information

### Core Components
- `state_manager.h`: Central state management with `gState` global
- `touch_handler.h`: Touch input processing and gesture detection  
- **display_renderer.h**: Main rendering orchestrator (refactored into modular components)
- **render_helpers.h**: Shared drawing utilities (boxes, headers, icons)
- **render_pages.h**: Main dashboard carousel pages (Status, Music, House, Devices)
- **render_details.h**: Detail view dispatcher
- **render_detail_*.h**: Individual detail view implementations (vacuum, lights, todo, climate, music, timer)
- `sensors.yaml`: Home Assistant sensor integration

### Display Renderer Architecture

The display rendering system is organized into modular components to improve maintainability and enable parallel development. All rendering code lives in `esphome/includes/` as header files.

#### Module Breakdown

**`display_renderer.h` (Main Entry Point - ~25 lines)**
- Single include point for YAML configuration
- Contains `renderDisplay()` main orchestrator
- Routes to either dashboard pages or detail views
- Handles notification overlay rendering

**`render_helpers.h` (Shared Utilities - ~100 lines)**
Common drawing functions used across multiple pages:
- `drawRetroBox()` - Decorative box with pronounced corners
- `drawCommonHeader()` - Time/date display with timer override
- `drawPageIndicator()` - Carousel navigation dots
- `drawDetailHeader()` - Back button + title for detail views
- `drawWindowIcon()` - Window status indicator (open/shut)
- `drawBulbIcon()` - Light bulb status indicator (on/off)

**`render_pages.h` (Main Dashboard Pages - ~265 lines)**
All 4 main carousel pages:
- `renderPage0_Status()` - Environment metrics, todo preview, hardware badges
- `renderPage1_Music()` - Media player with visualizer and controls
- `renderPage3_House()` - Perimeter windows, illumination, biometrics
- `renderPage4_Devices()` - Vacuum, washing machine, 3D printer status

**`render_details.h` (Detail Dispatcher - ~30 lines)**
Routes to appropriate detail view based on `gState.currentView`:
- `renderDetailViews(display::Display& it, ViewState view)`
- Includes all `render_detail_*.h` files

**Detail View Modules** (Each ~50-125 lines):
- `render_detail_vacuum.h` - Robot vacuum controls, battery, consumables, history
- `render_detail_lights.h` - Light toggles for living room and office
- `render_detail_todo.h` - Shopping list and todo items with tabs
- `render_detail_climate.h` - Air quality, thermal dynamics, environment stats
- `render_detail_music.h` - Playback transfer, volume slider, track controls
- `render_detail_timer.h` - Countdown, time slider, start/stop/reset controls
- `render_detail_scenes.h` - Scene activation buttons (All Off, Cozy, Beamer, Daylight)

#### Dependency Chain
```
display_renderer.h
├── render_helpers.h
├── render_pages.h → render_helpers.h
└── render_details.h
    ├── render_detail_vacuum.h → render_helpers.h
    ├── render_detail_lights.h → render_helpers.h
    ├── render_detail_todo.h → render_helpers.h
    ├── render_detail_climate.h → render_helpers.h
    ├── render_detail_music.h → render_helpers.h
    ├── render_detail_timer.h → render_helpers.h
    └── render_detail_scenes.h → render_helpers.h
```

#### Key Design Principles
- **Single Responsibility**: Each file has one clear purpose
- **No Circular Dependencies**: Helpers → Pages → Dispatcher → Main
- **Backward Compatible**: YAML config still includes only `display_renderer.h`
- **Easy Testing**: Individual modules can be tested in isolation
- **Parallel Development**: Multiple developers can work on different views simultaneously

#### Adding New Views
1. Create new `render_detail_[feature].h` file with `renderDetail_[Feature]()`
2. Add enum to `ViewState` in `state_manager.h`
3. Include new header in `render_details.h`
4. Add case to `renderDetailViews()` switch statement
5. Update `renderDisplay()` if needed for routing
6. Add navigation logic in `touch_handler.h`

## Code Style Guidelines

### File Organization
- All custom code lives in `esphome/includes/` as `.h` files
- Configuration files use YAML in `esphome/packages/`
- Main entry point is `esphome/my-display.yaml`

### C++ Code Style

#### Header Guards
All header files must use `#pragma once` at the top:
```cpp
#pragma once
#include "esphome.h"
#include "state_manager.h"  // Include dependencies after esphome.h
```

#### Naming Conventions
- **Classes**: PascalCase (e.g., `TouchHandler`, `DisplayRenderer`)
- **Functions**: camelCase (e.g., `handleTouch`, `renderPage`)
- **Variables**: camelCase for local, snake_case for member variables
- **Constants**: UPPER_SNAKE_CASE (e.g., `C_BLACK`, `C_WHITE`)
- **Global State**: `gState` prefix (e.g., `gState.currentView`)

#### State Management
All application state must be managed through the global `gState` struct in `state_manager.h`:
```cpp
// Always access state through gState
gState.currentView = VIEW_MAIN_DASHBOARD;
gState.outsideTemp = x;  // In sensor callbacks
```

#### Touch Handling
Use the centralized `TouchHandler::handleTouch(x, y, touched)` method. Never implement touch logic directly in interval components.

#### Rendering Guidelines
- Use the provided color constants (`C_BLACK`, `C_WHITE`, `C_CYAN`, etc.)
- Follow the coordinate system: (0,0) is top-left, display is 240x320
- Use `TextAlign::CENTER`/`TOP_LEFT`/etc. for text positioning
- Detail views must handle `gState.scrollY` for vertical scrolling
- Set `gState.maxScrollY` to enable scrolling bounds

### YAML Configuration Style

#### Sensor Configuration
All Home Assistant sensors should:
- Use `internal: true` to hide from HA UI
- Update `gState` directly in `on_value` callbacks:
```yaml
- platform: homeassistant
  id: outside_temperature
  entity_id: sensor.outside_temp
  internal: true
  on_value:
    - lambda: "gState.outsideTemp = x;"
```

#### Package Structure
Keep configurations modular using packages:
- `base.yaml`: Core ESP32/WiFi/API setup
- `hardware.yaml`: Display and touch hardware
- `sensors.yaml`: All Home Assistant integrations
- `fonts.yaml`: Font definitions

### Error Handling

#### Null/Invalid Checks
Always validate sensor values:
```cpp
// In sensor filters
filters:
  - lambda: "return isnan(x) ? 0 : x;"

// In rendering
if (time_now.is_valid()) {
  // Display time
}
```

#### Bounds Checking
Clamp coordinates and values to prevent overflow:
```cpp
if (x < 0) x = 0; if (x > 239) x = 239;
if (gState.scrollY < -gState.maxScrollY) gState.scrollY = -gState.maxScrollY;
```

## Key Patterns

### Adding New Pages
1. Add new enum to `ViewState` in `state_manager.h`
2. Add rendering function to `display_renderer.h`
3. Update `renderDisplay()` switch statement
4. Add navigation logic in `TouchHandler::handleTap()`

### Adding New Sensors
1. Add sensor struct fields to `DisplayState`
2. Add sensor configuration in `sensors.yaml`
3. Update `gState` in `on_value` callback
4. Render the data in appropriate page functions

### Touch Interaction Zones
Define tap zones in `TouchHandler::handleTap()` using pixel coordinates:
```cpp
if (gState.mainPageIndex == 3) {
  if (y > 80 && y < 130) {
    openView(VIEW_DETAIL_VACUUM);
  }
}
```

## Performance Considerations
- Touch polling runs at 16ms (~60Hz)
- Avoid heavy computation in touch handlers
- Use static variables for touch state tracking
- Minimize string operations in rendering paths

## CRITICAL: NEVER TOUCH TOUCHSCREEN I2C PARSING

**DO NOT CHANGE THE TOUCHSCREEN I2C PARSING LOGIC UNDER ANY CIRCUMSTANCES**

The touchscreen I2C parsing in `sensors.yaml` (lines 226-257) is extremely sensitive and took extensive debugging to get working correctly. The hybrid decoding, calibration mappings, and coordinate clamping are all precisely tuned.

**ABSOLUTELY FORBIDDEN:**
- Modifying the I2C register reads (0x1A, 16 bytes)
- Changing the hybrid decoding logic for x_raw and y_raw
- Adjusting calibration constants (240.0f/3900.0f for X, 320.0f/5100.0f for Y)
- Altering coordinate clamping bounds
- Modifying the touch status detection (0x06, 0x10 values)

If you need to debug touch issues, add logging ONLY - do not change the parsing logic itself. This configuration is non-negotiable.

## Testing
- Use `esphome config` or `esphome compile` to validate YAML syntax