# ESPHome Display Notification Integration

This integration simplifies sending notifications from Home Assistant to ESPHome-powered displays. It replaces cumbersome `input_text` and `input_select` helpers with a streamlined service-based architecture.

## Architecture

1.  **Home Assistant Service**: Provides a unified `esphome_display.notify` service.
2.  **ESPHome API**: Uses the native ESPHome API to push data directly to the device.
3.  **No Persistent Entities**: Notifications are ephemeral; no helpers need to be managed or cleared manually in the HA UI.

---

## 1. ESPHome Device Setup

Add these services to your ESPHome YAML configuration to allow Home Assistant to communicate with the display.

```yaml
# display.yaml
api:
  services:
    # Service called by HA to show a notification
    - service: notify
      variables:
        title: string
        message: string
        severity: string
      then:
        - lambda: |-
            gState.notificationTitle = title;
            gState.notificationBody = message;
            gState.notificationSeverity = severity.empty() ? "info" : severity;
            gState.notificationShownAt = millis();
            gPendingNotificationSound = true;
            ESP_LOGI("notify", "Notification received: %s", title.c_str());

    # Service called by HA to clear the current notification
    - service: clear_notification
      then:
        - lambda: |-
            gState.notificationTitle = "";
            gState.notificationBody = "";
            gState.notificationSeverity = "info";
            gState.notificationLoading = false;
```

---

## 2. Home Assistant Integration Setup

### Manual Installation
1. Create the folder `custom_components/esphome_display/` in your Home Assistant config directory.
2. Copy the integration files (`manifest.json`, `__init__.py`, `notify.py`, `services.yaml`) into that folder.
3. Restart Home Assistant.

### Configuration
Add the following to your `configuration.yaml`:

```yaml
esphome_display:
  devices:
    - name: kitchen_display
      esphome_device: kitchen_screen  # Must match the 'name:' in your ESPHome YAML
      default_severity: info
    - name: bedroom_display
      esphome_device: bedroom_screen
```

---

## 3. Usage

### Via Service Call
Use the `esphome_display.notify` service in any automation or script:

```yaml
service: esphome_display.notify
data:
  device: kitchen_display
  title: "Laundry Done"
  message: "The washing machine has finished its cycle."
  severity: "info"
  timeout: 60  # Optional: Auto-clear from HA after 60 seconds
```

### Parameters
| Field | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `device` | The name defined in your `configuration.yaml` | Yes | - |
| `title` | The bold header of the notification | No | "" |
| `message` | The main body text (supports wrapping) | Yes | - |
| `severity` | `info`, `warn`, `alert`, or `question` | No | `info` |
| `timeout` | Seconds until HA sends a clear command | No | - |

---

## 4. User Interaction & Dismissal

When the user taps **DISMISS** on the ESP32:
1. The ESPHome device executes its local dismissal logic.
2. It sends an event back to Home Assistant.
3. (Optional) You can trigger HA automations based on the dismissal event.

```yaml
automation:
  - alias: "Handle Notification Dismissal"
    trigger:
      platform: event
      event_type: esphome.device_event # Triggered by ESPHome API
      event_data:
        device_name: kitchen_screen
        type: notification_dismissed
    action:
      - service: logbook.log
        data:
          name: "Display"
          message: "User dismissed the laundry notification"
```

---

## Future Expansion: Interactive Notifications (Option 3)

The architecture is designed to scale into an **Interactive Notification System**. This allows the display to act as a remote control for Home Assistant logic.

### Planned Enhancements
*   **Action Buttons**: Pass a JSON array of actions (e.g., `[{"id": "yes", "label": "Turn Off"}, {"id": "no", "label": "Ignore"}]`) to render dynamic buttons instead of a single "Dismiss" button.
*   **Response Events**: Tapping an action button will fire a `esphome_display_response` event in Home Assistant, containing the `notification_id` and the `action_id` selected.
*   **Notification Queuing**: If a second notification arrives while one is active, the HA integration will hold it in a queue and push it as soon as the current one is dismissed.
*   **Severity-Based Themes**: Dynamic background colors and icons based on the `severity` parameter (e.g., red flashing background for `alert`).

### Example Future Usage
```yaml
# Theoretical future automation
service: esphome_display.notify
data:
  device: kitchen_display
  title: "Security"
  message: "Movement detected in Garage. Close the door?"
  severity: "alert"
  actions:
    - id: "close_door"
      label: "Close Now"
      color: "red"
    - id: "ignore"
      label: "Dismiss"
```