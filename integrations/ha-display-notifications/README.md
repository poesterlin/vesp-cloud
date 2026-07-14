# vESP.cloud Notifications

Home Assistant integration that provides a global broadcast notification for ESPHome displays.

## Features

- One global sensor with attributes:
  - `notification_id`
  - `title`
  - `message`
  - `severity`
- One send service to set all values in one call:
  - `esphome_display_notifications.send`
- One clear service to clear only by ID:
  - `esphome_display_notifications.clear`
- Optional auto-clear timeout via `duration`

All displays can subscribe to this one sensor, so broadcasts are shown on every display at once.

## Configuration

Add integration via:

**Settings -> Devices & Services -> Add Integration -> vESP.cloud Notifications**

## Sending notifications

```yaml
service: esphome_display_notifications.send
data:
  notification_id: washer_cycle
  title: Washer
  message: Laundry is done
  severity: warning
  duration: 15
```

Set `message: ""` (empty) to clear immediately, or use `duration` for timed auto-clear.

## Clear by ID

```yaml
service: esphome_display_notifications.clear
data:
  notification_id: washer_cycle
```

If another notification is active with a different ID, it is not cleared.

## Dashboard access

Read values from `sensor.esphome_display_notifications_broadcast`:

- state: `idle` or `notifying`
- attributes:
  - `notification_id`
  - `title`
  - `message`
  - `severity`

## Installation

### HACS

Add this repository as a custom integration in HACS.

### Manual

```bash
cp -r custom_components/esphome_display_notifications /config/custom_components/
```

Restart Home Assistant, then add the integration via UI.

## License

Licensed under the [Apache License 2.0](LICENSE).
