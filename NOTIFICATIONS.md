# Notifications System

This document describes how notifications are implemented and work in the home display application.

## Overview

The notification system provides a way to display modal alerts and messages on the home display screen that temporarily overlay the current view. Notifications can originate from Home Assistant automations or be triggered locally (e.g., timer expiration).

## Architecture

### State Management (`state_manager.h:255-262`)

All notification state is stored in the global `gState` struct:

```cpp
// --- NOTIFICATIONS ---
std::string notificationTitle = "";          // Title text
std::string notificationBody = "";           // Body message (main content)
std::string notificationSeverity = "info";   // severity type: info, warn, alert, question
volatile bool notificationLoading = false;   // Button loading state during dismissal
unsigned long notificationLoadingStartTime = 0;  // For loading animation timing
volatile bool notificationActionRequested = false;  // Flag that dismiss was pressed
Button notificationDismissBtn = Button(20, 240, 200, 50);  // Dismiss button hitbox
```

### Rendering (`display_renderer.h:25-39`)

When a notification is active (non-empty body), it overlays all other content:

1. The current page (dashboard or detail view) renders normally
2. After page rendering completes, a notification check occurs
3. If `gState.notificationBody` is not empty, the full-screen notification modal renders on top
4. A dismiss button is rendered at the bottom of the notification

**Rendering Code:**
```cpp
if (!gState.notificationBody.empty()) {
  NotificationRenderer::draw(
    it, 
    gState.notificationSeverity,
    gState.notificationTitle,
    gState.notificationBody,
    font_medium, font_small
  );
  
  // Draw dismiss button
  gState.notificationDismissBtn.draw(
    it, "DISMISS", C_WHITE, 
    gState.notificationLoading, 
    gState.notificationLoadingStartTime, 
    1000, font_small
  );
}
```

### Visual Design (`notification.h`)

The `NotificationRenderer` class handles all visual aspects:

#### Theme Colors by Severity

- **`"info"`** (default): Blue (80, 140, 255) - Informational messages
- **`"warn"`**: Amber (255, 180, 0) - Warnings that require attention
- **`"alert"`**: Red (255, 60, 60) - Critical errors or urgent issues
- **`"question"`**: Green (0, 255, 100) - Questions or confirmations

#### Layout Elements

1. **Top Bar** (4px colored bar) - Visual severity indicator
2. **Icon** (centered at y=50) - Severity-specific icon:
   - Alert: Exclamation mark
   - Warn: Triangle outline with "!"
   - Question: Circle with "?"
   - Info: Circle with "i"
3. **Title** (y=100) - Custom title or severity name fallback
4. **Separator Line** (y=125) - Visual divider
5. **Body Text** (y=145-275) - Wrapped message text with automatic line breaks
6. **Dismiss Button** (y=250) - User must explicitly dismiss

#### Text Wrapping

The `drawWrappedText()` helper automatically wraps text to fit within a 200px width, with 20px line height. Text is clamped to prevent overflow beyond 130px vertical space.

## Data Flow

### From Home Assistant

Notifications are triggered via Home Assistant input helpers:

1. **Home Assistant Setup** (creates these entities):
   - `input_text.display_notification_title` - Notification title
   - `input_text.display_notification` - Notification body text
   - `input_select.display_notification_severity` - One of: info, warn, alert, question

2. **ESPHome Sensors** (`sensors.yaml:161-183`):
   ```yaml
   - platform: homeassistant
     id: ha_notification_title
     entity_id: input_text.display_notification_title
     on_value:
       - lambda: "gState.notificationTitle = x;"
   
   - platform: homeassistant
     id: ha_notification_body
     entity_id: input_text.display_notification
     on_value:
       - lambda: |
           if (x != gState.notificationBody && !x.empty()) {
             ESP_LOGI("notification", "New notification: %s", x.c_str());
           }
           gState.notificationBody = x;
   
   - platform: homeassistant
     id: ha_notification_severity
     entity_id: input_select.display_notification_severity
     on_value:
       - lambda: "gState.notificationSeverity = x;"
   ```

3. **Home Assistant Automation Example**:
   ```yaml
   automation:
     - alias: "Display Notification"
       trigger:
         platform: state
         entity_id: sensor.something
       action:
         - service: input_text.set_value
           target:
             entity_id: input_text.display_notification_title
           data:
             value: "Important Alert"
         - service: input_text.set_value
           target:
             entity_id: input_text.display_notification
           data:
             value: "Something important happened"
         - service: input_select.select_option
           target:
             entity_id: input_select.display_notification_severity
           data:
             option: "alert"
   ```

### Local Triggers

Notifications can also be triggered locally in ESPHome code:

**Timer Expiration Example** (`sensors.yaml:402-405`):
```cpp
if (gState.timerRemaining == 0) {
  gState.notificationTitle = "TIMER EXPIRED";
  gState.notificationBody = "Kitchen timer finished!";
  gState.notificationSeverity = "alert";
  gPendingNotificationSound = true;
}
```

## User Interaction

### Touch Handling (`touch_handler.h:120-131`)

The touch handler intercepts all taps when a notification is active:

1. **Notification Check** (lines 122-131):
   - If `notificationBody` is not empty, ALL other taps are blocked
   - Only the dismiss button can process taps
   - Tapping anywhere except the button area returns without doing anything
   - This prevents accidentally triggering UI actions behind the notification

2. **Dismiss Processing**:
   ```cpp
   if (gState.notificationDismissBtn.processTap(x, y, ...)) {
     // Button was pressed, sets gState.notificationActionRequested = true
     return;
   }
   ```

### Dismissal Workflow

1. **User taps "DISMISS" button**
   - Button's `processTap()` method sets `notificationActionRequested = true`
   - Button enters loading state with visual feedback

2. **Home Assistant Integration** (`sensors.yaml:472-480`):
   ```cpp
   if (gState.notificationActionRequested) {
     ESP_LOGI("notify", "Notification dismissed by user");
     gState.notificationActionRequested = false;
     
     // Clear all notification entities in Home Assistant
     gState.notificationTitle = "";
     gState.notificationBody = "";
     id(clear_notification).execute();
   }
   ```

3. **HA Automation** (`sensors.yaml:645-661`):
   - A service call resets all three input helpers to empty/default
   - This prevents stale notifications from persisting after restart

## Audio Feedback

Notification severity level controls audio volume (`sensors.yaml:387-389`):

```cpp
float vol = 1.0;  // default for "info"
if (gState.notificationSeverity == "warn") vol = 2.0;
else if (gState.notificationSeverity == "alert") vol = 4.0;
else if (gState.notificationSeverity == "question") vol = 1.5;
```

The `gPendingNotificationSound` flag triggers audio playback.

## Adding a Notification from Home Assistant

### Step 1: Define Input Helpers

In Home Assistant `configuration.yaml` or via the UI:

```yaml
input_text:
  display_notification_title:
    name: Display Notification Title
    max: 50
  display_notification:
    name: Display Notification Body
    max: 500

input_select:
  display_notification_severity:
    name: Display Notification Severity
    options:
      - "info"
      - "warn"
      - "alert"
      - "question"
```

### Step 2: Create Automation

```yaml
automation:
  - alias: "Example Notification"
    trigger:
      platform: numeric_state
      entity_id: sensor.temperature
      below: 15
    action:
      - service: input_text.set_value
        target:
          entity_id: input_text.display_notification_title
        data:
          value: "Temperature Low"
      - service: input_text.set_value
        target:
          entity_id: input_text.display_notification
        data:
          value: "Temperature has dropped below 15°C. Check heating system."
      - service: input_select.select_option
        target:
          entity_id: input_select.display_notification_severity
        data:
          option: "warn"
```

### Step 3: Dismiss Handling

No additional steps required. When the user taps "DISMISS", the display will automatically:
1. Clear the notification entities in Home Assistant
2. Trigger any Home Assistant automations that listen for notification dismissal (if configured)

## Adding a Local Notification

In any ESPHome callback or component:

```cpp
// Simple info notification
gState.notificationTitle = "Upload Complete";
gState.notificationBody = "File has been successfully uploaded.";
gState.notificationSeverity = "info";

// Alert notification
gState.notificationTitle = "ERROR";
gState.notificationBody = "Failed to connect to WiFi. Check your network settings.";
gState.notificationSeverity = "alert";
gPendingNotificationSound = true;  // Optional: play alert sound
```

## Notification Blocking

While a notification is active:
- **Allowed**: Dismiss button interaction, exit via physical back button (future feature)
- **Blocked**: Navigation, page swiping, detail view interactions, all other UI taps
- **Behind the Modal**: The underlying page continues to render but receives no input

## Performance Considerations

- Notification rendering is deferred until after the main view renders (overlay pattern)
- Touch interception is O(1) - single button hit test
- Text wrapping is computed during render (cached per notification)
- No memory leaks: strings are automatically managed by std::string

## Troubleshooting

### Notification Won't Clear
- Check that Home Assistant automation calling `clear_notification` is triggered
- Verify `input_text` entities exist and are properly synced to ESPHome
- Check logs: `grep "notification" /tmp/esphome.log`

### Notification Appears Twice
- Ensure HA automation doesn't have multiple triggers for the same condition
- Check that sensor sync timing doesn't cause duplicate state updates

### Text Wrapping Issues
- Maximum 200px width for body text (see `notification.h:58`)
- Maximum 130px vertical height with 20px line spacing
- Longer messages will be truncated; break into multiple notifications instead

## Related Files

- `notification.h` - Visual rendering implementation
- `state_manager.h:255-262` - State struct definition
- `display_renderer.h:25-39` - Overlay rendering orchestration
- `touch_handler.h:120-131` - Tap interception and button processing
- `sensors.yaml:161-183` - Home Assistant entity synchronization
- `sensors.yaml:472-480` - Dismissal workflow
- `sensors.yaml:645-661` - Clear automation

