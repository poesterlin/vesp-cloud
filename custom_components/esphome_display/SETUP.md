# Quick Start Guide

## Installation Steps

### Option 1: HACS (Recommended)
```
1. Open Home Assistant
2. Settings → Devices & Services → Custom Integrations
3. Click "Create Automation" button
4. Search for "ESPHome Display Notifications"
5. Click Install
6. Restart Home Assistant
7. Go to Settings → Devices & Services → Integrations
8. Click "Create Integration" → ESPHome Display Notifications
```

### Option 2: Manual Installation
```bash
# In your Home Assistant config directory
mkdir -p custom_components/esphome_display
cp -r custom_components/esphome_display/* ~/.homeassistant/custom_components/esphome_display/
# Restart Home Assistant
```

## ESPHome Configuration

Add this to your ESPHome YAML file:

```yaml
# esphome/my-display.yaml
api:
  services:
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

    - service: clear_notification
      then:
        - lambda: |-
            gState.notificationTitle = "";
            gState.notificationBody = "";
            gState.notificationSeverity = "info";
            gState.notificationLoading = false;
```

## Home Assistant Configuration

### Basic Setup (Notifications Only)

Add to `configuration.yaml`:

```yaml
esphome_display:
  devices:
    - name: kitchen_display
      esphome_device: kitchen_screen
      default_severity: info
```

### Full Setup (With To-Do Bridge)

To also enable the To-Do bridge sensor (recommended):

```yaml
esphome_display:
  devices:
    - name: kitchen_display
      esphome_device: kitchen_screen
      default_severity: info
      todo_entity: todo.shopping_list  # Optional: Home Assistant to-do list entity
```

Then restart Home Assistant.

## Test the Integration

### Via Developer Tools (Service)
1. Developer Tools → Services
2. Service: `esphome_display.notify`
3. Enter this JSON:
```json
{
  "device": "kitchen_display",
  "title": "Test Notification",
  "message": "This is a test message",
  "severity": "info"
}
```
4. Click "Call Service"

### Via Automation
```yaml
automation:
  - alias: "Test Display"
    trigger:
      platform: time
      at: "10:00:00"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Good Morning"
          message: "It's 10 AM"
```

## Configuration Parameters

### Device Configuration (configuration.yaml)

| Parameter | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `name` | string | Yes | - | Display name (use in service calls) |
| `esphome_device` | string | Yes | - | ESPHome device name (from my-display.yaml) |
| `default_severity` | string | No | `info` | Default severity: info, warn, alert, question |
| `todo_entity` | string | No | - | Home Assistant to-do entity ID (optional) |

### Notification Service Parameters

| Parameter | Type | Required | Default | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `device` | string | Yes | - | Must match `name:` from config |
| `message` | string | Yes | - | Main notification text |
| `title` | string | No | "" | Optional bold header |
| `severity` | string | No | config default | Level: info, warn, alert, question |
| `timeout` | integer | No | - | Seconds until auto-dismiss (0 = manual) |

## To-Do Bridge Sensor

If you configure `todo_entity`, the integration automatically creates a sensor that formats to-do items as **pipe-separated values (PSV)** for display on the ESP32.

### Created Sensor

**Entity ID:** `sensor.<device_name>_to_do_items`

**State:** Number of pending items

**Attributes:**
- `all_items` - PSV-formatted to-do list (for parsing on ESP32)
- `count` - Pending item count
- `entity_id` - Source to-do entity
- `last_update` - Timestamp of last update

### PSV Format

```
TaskName|DueDate|Status
Milk|2024-01-20|ok
Eggs|2024-01-19|overdue
Bread|no-date|ok
```

- **TaskName:** Task summary (pipes escaped as dashes)
- **DueDate:** Due date in YYYY-MM-DD or "no-date"
- **Status:** "ok" or "overdue"

### Using in ESPHome

```yaml
# In my-display.yaml
sensor:
  - platform: homeassistant
    id: todo_sensor
    entity_id: sensor.kitchen_display_to_do_items
    internal: true
    on_value:
      lambda: |-
        // Access the formatted items via the entity's attribute
        auto state_obj = id(todo_sensor);
        if (state_obj && state_obj->has_state()) {
          auto attr = state_obj->get_attribute("all_items");
          if (attr) {
            gState.todoListRaw = attr;  // Use in display rendering
          }
        }
```

Then parse the PSV in your detail view renderer (see ARCHITECTURE.md).

## Troubleshooting

**Integration won't load:**
- Check Home Assistant logs (Settings → System → Logs)
- Verify YAML syntax in configuration.yaml
- Ensure Home Assistant 2024.1.0+

**Notifications not appearing:**
- Verify ESPHome device is online
- Check ESPHome device has the services configured
- Verify device name in service call matches configuration

**Service not found:**
- Restart Home Assistant after installation
- Check Settings → Devices & Services → Integrations

## What's Included

| File | Purpose |
| :--- | :--- |
| `__init__.py` | Main integration logic and service handler |
| `manifest.json` | Integration metadata for HACS |
| `services.yaml` | Service definitions and parameter schema |
| `py.typed` | Type checking marker for mypy |
| `README.md` | Full documentation |
| `CONTRIBUTING.md` | Developer guide |
| `SETUP.md` | This quick start |

## Next Steps

1. **Configure your device** in `configuration.yaml`
2. **Add services to ESPHome** YAML config
3. **Test with Developer Tools**
4. **Create automations** to send notifications

See `README.md` for detailed usage and examples.
