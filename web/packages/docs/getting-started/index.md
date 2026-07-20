# Getting Started

:::: warning A supported ESP32 display is required
The editor creates firmware for a physical display, so you must purchase the
supported **Guition ESP32-S3-4848S040** before you can deploy and use a project.
Other ESP32 display boards are not supported.

[Search for the supported display →](https://www.aliexpress.com/wholesale?SearchText=Guition+ESP32-S3+480x480)
::::

Import your Home Assistant entities, create a project, install it on your
display, and connect the display to Wi-Fi.

## 1. Import your Home Assistant entities

Install the recommended HA Metadata Exporter integration. It produces a
privacy-safe JSON file that gives the editor searchable entities, friendly
names, devices, areas, attributes, and realistic preview values.

[Install the Home Assistant integration →](./home-assistant)

## 2. Create a project

Create a project in the editor, choose its timezone and notification behavior,
then drag widgets onto the display and bind them to the imported entities.

[Create your first project →](./create-project)

## 3. Build and install your project

Build the project in the editor, connect the display over USB, and follow the
browser prompts to install it.

[Build and install your project →](./build)

## 4. Configure the display's Wi-Fi

After installation, connect to the temporary Wi-Fi network created by the
display and select your home network.

[Connect the display to Wi-Fi →](./captive-portal)

## Having trouble?

### Widgets or actions not working?

Home Assistant blocks actions from newly added ESPHome devices by default. If
buttons, switches, or other interactive widgets don't work:

1. Go to **Settings** &rarr; **Devices & services** &rarr; **ESPHome** in Home
   Assistant (or open
   [ESPHome integrations](https://my.home-assistant.io/redirect/integration/?domain=esphome)
   directly).
2. Select your display device and open its **Options**.
3. Enable **Allow the device to perform Home Assistant actions** and submit.

See the full [Troubleshooting](./troubleshooting) page for more common issues
and solutions.

[Troubleshooting →](./troubleshooting)
