# Display Application Architecture

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
