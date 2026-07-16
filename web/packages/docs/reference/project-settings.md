# Project Settings

Every project-level setting available in the editor's **Project Settings**
dialog, organized by section.

Open Project Settings from the toolbar gear icon while editing a project.

## General

### Project Name

A human-readable name for the project, shown in your project list. This name
appears in Home Assistant as the device name for your display.

## Display Hardware

Read-only information about the target display:

> Guition ESP32-S3-4848S040 — 480 × 480 RGB (ST7701S + GT911 Touch)

Only one display model is currently supported.

## Theme

Choose between **Retro** and **Modern**. See the [Themes](/concepts/themes)
page for full color and style details.

## Project Color

The **Chrome Accent** color controls:

- The digital clock color
- The page indicator active dot
- The detail view header title

Use the color picker to choose from 39 presets or enter a custom hex value with
HSLA sliders. The default matches your selected theme.

## Home Assistant

### Home Assistant Base URL

An optional URL used to resolve relative image paths from Home Assistant
entities. For example, if a `camera` entity exposes an image at
`/api/image_proxy/camera.front_door`, the base URL is prepended to form the
full URL.

Enter the full URL including protocol and port when needed:

```
http://homeassistant.local:8123
```

Trailing slashes are trimmed automatically. Leave this empty if you do not
use HA entity images.

## Notification Overlay

Configure the global notification overlay. See the
[Notification Overlay reference](/reference/notification-overlay) for full
details.

| Setting | Default | Description |
|---------|---------|-------------|
| **Enable** | Off | Toggle the notification overlay on or off |
| **Title Entity** | `input_text.notification_title` | HA entity holding the notification title |
| **Body Entity** | `input_text.notification_body` | HA entity holding the notification message |
| **Severity Entity** | `input_select.notification_severity` | HA entity controlling the visual style |

## Timezone

The IANA timezone used for clock displays, date formatting, and time-based
conditions. Detected from your browser by default but can be overridden.

Click **Edit**, then choose from the full IANA timezone list. Use the search
field to filter, or click **Use browser timezone** to reset.

## Danger Zone

### Delete Project

Permanently deletes the project and all its data. This action cannot be undone.

Confirm by clicking **Delete Project** and confirming in the dialog.
