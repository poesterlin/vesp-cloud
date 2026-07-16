# Notification Overlay

The global notification overlay lets Home Assistant automations interrupt the
current screen with a high-priority message. This page covers setup, severity
levels, and dismissal behavior in detail.

## How it works

Three Home Assistant helpers drive the overlay:

| Helper | Type | Purpose |
|--------|------|---------|
| `input_text.notification_title` | `input_text` | The heading text |
| `input_text.notification_body` | `input_text` | The message text (also controls visibility) |
| `input_select.notification_severity` | `input_select` | Visual style (info, warning, error, question) |

The overlay appears when the body entity is non-empty. It disappears when the
body is cleared or when the user taps **Dismiss**.

## Home Assistant setup

Add these helpers to your `configuration.yaml`:

```yaml
input_text:
  notification_title:
    name: Notification Title
  notification_body:
    name: Notification Body

input_select:
  notification_severity:
    name: Notification Severity
    options:
      - info
      - warning
      - error
      - question
```

::: tip Automated setup
The [vESP.cloud HACS integration](https://github.com/vesp-cloud/ha-integration)
can create these helpers automatically.
:::

## Enabling in the editor

Enable the overlay during project creation (step 3) or later from **Project
Settings &rarr; Notification Overlay**. If your entity IDs differ from the
defaults, replace them in the three entity fields.

## Severity levels

| Severity | Color | MDI Icon | Appearance |
|----------|-------|----------|------------|
| `info` | Cyan `(80, 200, 255)` | `information` | General information |
| `warning` | Amber `(255, 180, 0)` | `alert-circle` | Warning condition |
| `error` | Red `(255, 60, 60)` | `alert` | Error or critical alert |
| `question` | Purple `(160, 80, 255)` | `help-circle` | A question or confirmation |

::: warning Severity aliases
`warn` is recognized as an alias for `warning`. `alert` is recognized as an
alias for `error`.

The string `critical` is **not** recognized by the firmware. Use `error` or
`alert` instead.
:::

Each severity level uses a color pair: an **accent** color for the border and a
dimmer **background** color for the panel backdrop.

### Visual layout

The overlay renders as a centered modal panel:

- **Backdrop:** Full-screen black overlay
- **Panel:** Centered card at approximately 5/6 screen width by 3/5 screen
  height
- **Header band:** Dark background with the severity icon in a filled circle
  and the severity label ("INFO", "WARNING", "ERROR", or "QUESTION")
- **Title:** White text below the header
- **Body:** Word-wrapped text below the title
- **Dismiss button:** At the bottom of the panel, styled with the severity's
  dim background and accent border

## Dismissal behavior

Tapping **Dismiss**:

1. Records a **fingerprint** of the current body text
2. Requests a full screen redraw (the overlay is hidden because the fingerprint
   matches)
3. Calls Home Assistant to clear both `notification_title` and `notification_body`
   by setting them to empty strings

When a **new** body value arrives (different from the dismissed fingerprint),
the overlay becomes visible again. This means:

- Setting the body to empty via an automation hides the notification
- Changing the body to a different message makes the overlay reappear

## Touch handling

While the overlay is visible, **all touch events are consumed by the overlay**.
Taps do not pass through to the screen behind it, even if the tap is outside
the Dismiss button. This prevents accidental interaction with the screen below.

## Automation examples

### Door left open

```yaml
alias: "Notify: Front door open"
trigger:
  - platform: state
    entity_id: binary_sensor.front_door
    to: "on"
    for: "00:05:00"
action:
  - service: input_text.set_value
    data:
      value: "Front Door Open"
    target:
      entity_id: input_text.notification_title
  - service: input_text.set_value
    data:
      value: "The front door has been open for 5 minutes."
    target:
      entity_id: input_text.notification_body
  - service: input_select.select_option
    data:
      option: warning
    target:
      entity_id: input_select.notification_severity
```

### Clear notification when door closes

```yaml
alias: "Clear: Front door closed"
trigger:
  - platform: state
    entity_id: binary_sensor.front_door
    to: "off"
action:
  - service: input_text.set_value
    data:
      value: ""
    target:
      entity_id: input_text.notification_body
```

## Runtime details

In the compiled firmware:

- The overlay widget is created as a `std::unique_ptr<NotificationOverlayWidget>`
  in the screen controller
- It is updated every frame via `update()`
- Touch is checked **before** any screen-level swipe or scroll handling
- The overlay is drawn **after** the current screen (topmost layer)
- State changes are detected via dirty comparison of the previous body and
  dismissed fingerprint — only changed values trigger a redraw
