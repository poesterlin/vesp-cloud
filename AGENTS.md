# AGENTS.md - Home Display ESPHome Project

This file provides essential information for agentic coding agents working on this ESPHome-based home display project.

## Build/Test Commands

### ESPHome Commands
```bash
# Compile the firmware (dry run)
esphome compile esphome/my-display.yaml

# Upload to device
esphome upload esphome/my-display.yaml

# Run with debug output
esphome run esphome/my-display.yaml --device /dev/ttyUSB0

# Clean build files
esphome clean esphome/my-display.yaml

# Validate configuration
esphome config esphome/my-display.yaml
```

### Python Environment
```bash
# Activate virtual environment (if needed)
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Project Architecture

This is an ESPHome project for a 240x320 touchscreen display running on ESP32-S3. The application follows a dual-mode navigation pattern:

### Navigation Modes
1. **Main Dashboard (Carousel)**: Horizontal swipe navigation between 4 pages
2. **Detail Views**: Vertical scrolling for detailed information

### Core Components
- `state_manager.h`: Central state management with `gState` global
- `touch_handler.h`: Touch input processing and gesture detection  
- `display_renderer.h`: All rendering logic for pages and components
- `sensors.yaml`: Home Assistant sensor integration

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
- Use `esphome config` to validate YAML syntax
- Test with `esphome run` before uploading to device
- Check logs via ESPHome dashboard or serial monitor
- Verify touch calibration and responsiveness