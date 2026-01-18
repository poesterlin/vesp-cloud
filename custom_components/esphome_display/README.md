# ESPHome Display Notifications & Data Bridge

A Home Assistant integration that simplifies sending notifications to ESPHome-powered displays and bridges Home Assistant To-Do lists. It replaces cumbersome input helpers with a streamlined service-based architecture and intelligent data translation.

## Features

- **Service-based Notifications**: Send notifications via `esphome_display.notify` service
- **No Persistent Entities**: Notifications are ephemeral—no helpers to manage
- **Multiple Devices**: Support for multiple ESPHome display devices
- **Configurable Severity Levels**: `info`, `warn`, `alert`, `question`
- **Auto-dismiss Support**: Optional auto-dismiss after a specified timeout
- **To-Do List Bridge**: Automatically bridges Home Assistant To-Do lists to ESP32 displays
- **Event-Driven Updates**: Instant updates via Home Assistant Native API
- **Type Safe**: Full type hints and Home Assistant schema validation

## 🎨 No YAML Required!

Everything is set up through the Home Assistant web interface. **No YAML editing needed!**

- **[UI_GUIDE.md](UI_GUIDE.md)** ⭐ **Start here!** - Complete web UI setup guide (no YAML)
- **[SETUP.md](SETUP.md)** - Installation and optional YAML configuration
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Full-stack blueprint for firmware and integration design
- **[EXAMPLES.md](EXAMPLES.md)** - 30+ real-world automation and configuration examples
- **[CONTRIBUTING.md](CONTRIBUTING.md)** - Developer guide and contribution guidelines

## Installation

### HACS Installation
1. Open Home Assistant → **Settings** → **Devices & Services** → **Custom Integrations**
2. Click **Create Automation** → search for **ESPHome Display Notifications**
3. Follow the installation prompts

### Manual Installation
1. Create `custom_components/esphome_display/` in your Home Assistant config directory
2. Copy all files from this directory into that folder
3. Restart Home Assistant

## Configuration

### Option 1: Web UI (Recommended - No YAML!)

See **[UI_GUIDE.md](UI_GUIDE.md)** for complete step-by-step instructions. Just:
1. Install integration
2. Go to **Settings → Devices & Services → Integrations**
3. Click **+ Create Integration** and search for "ESPHome Display"
4. Fill in the form - done!

### Option 2: YAML Configuration (Optional)

Add the following to your `configuration.yaml` if you prefer YAML:

```yaml
esphome_display:
  devices:
    - name: kitchen_display
      esphome_device: kitchen_screen
      default_severity: info
    - name: bedroom_display
      esphome_device: bedroom_screen
      default_severity: warn
```

### Configuration Parameters

| Parameter | Description | Required | Default |
| :--- | :--- | :--- | :--- |
| `name` | Friendly name for this display (used in service calls) | Yes | - |
| `esphome_device` | The device name from your ESPHome YAML config | Yes | - |
| `default_severity` | Default severity if not specified in service call | No | `info` |

## ESPHome Setup

Add these API services to your ESPHome YAML configuration:

```yaml
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

## Usage

### Basic Notification

Send a simple notification:

```yaml
service: esphome_display.notify
data:
  device: kitchen_display
  title: "Laundry Done"
  message: "The washing machine has finished its cycle."
```

### With Severity

Highlight important notifications:

```yaml
service: esphome_display.notify
data:
  device: kitchen_display
  title: "Security Alert"
  message: "Motion detected at the front door"
  severity: alert
```

### With Auto-clear

Automatically clear after a timeout:

```yaml
service: esphome_display.notify
data:
  device: kitchen_display
  title: "Update Available"
  message: "A software update is ready to install"
  severity: warn
  timeout: 120  # Clear after 2 minutes
```

### In Automations

Example automation that sends a notification when the washing machine finishes:

```yaml
automation:
  - alias: "Washing Machine Finished"
    trigger:
      entity_id: sensor.washing_machine_status
      platform: state
      to: "finished"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Laundry Done"
          message: "The washing machine has finished its cycle."
          severity: info
```

## Service Parameters

### `esphome_display.notify`

| Parameter | Type | Required | Description | Default |
| :--- | :--- | :--- | :--- | :--- |
| `device` | string | Yes | Device name from config | - |
| `title` | string | No | Bold header text | "" |
| `message` | string | Yes | Main notification text | - |
| `severity` | string | No | `info` / `warn` / `alert` / `question` | `info` |
| `timeout` | integer | No | Seconds until auto-clear (1-3600) | - |

## Dismissal Handling

When a user taps "Dismiss" on the display:

1. The ESPHome device executes its local dismissal logic
2. You can create an automation to react to the dismissal

```yaml
automation:
  - alias: "Handle Display Dismissal"
    trigger:
      platform: event
      event_type: esphome_display.notification_dismissed
      event_data:
        device_id: kitchen_screen
    action:
      - service: logbook.log
        data:
          name: "Display"
          message: "User dismissed the notification"
```

## Future Enhancements

The architecture supports planned expansions:

- **Interactive Actions**: Pass buttons to the display and receive responses
- **Notification Queuing**: Automatic queue management for multiple notifications
- **Severity-based Themes**: Dynamic colors and animations based on alert level
- **Response Events**: React to user selections in Home Assistant automations

## Troubleshooting

### "Device not found" error
- Verify the device name matches your configuration
- Ensure ESPHome device is online and connected to Home Assistant

### Notifications not appearing
- Check that the ESPHome device has the `api.services.notify` configured
- Verify `gState` is properly initialized in your ESPHome code
- Check the ESPHome logs for errors

### Integration won't load
- Verify YAML syntax in `configuration.yaml`
- Check Home Assistant logs for detailed errors
- Ensure Home Assistant version is 2024.1.0+

## Support

For issues or feature requests, please open an issue on GitHub.

## License

See LICENSE file in the project root.
