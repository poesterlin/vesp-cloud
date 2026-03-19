# ESPHome base configs

`initial-flash.yaml` is the starter config for a fresh USB flash.

1. Change `device_name` and `friendly_name`.
2. Flash once with `esphome run initial-flash.yaml`.
3. After boot, connect to the device's hotspot and enter Wi-Fi details in the captive portal.
4. Set `firmware_update_url` in `secrets.yaml` to the published firmware URL from the app, or keep the generated secret if you're using the dashboard flow.
5. Keep `packages/lvgl_hardware.yaml` if you're targeting the 4.0" ESP32-S3 display.
6. After that, use the same config for OTA updates.
