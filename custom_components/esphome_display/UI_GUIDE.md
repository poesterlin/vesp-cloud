# ESPHome Display - Web UI Setup Guide

**Welcome!** You can now set up and use ESPHome Display without touching any YAML files. Everything is done through the Home Assistant web interface.

---

## Part 1: Initial Setup (No YAML Required)

### Step 1: Add the Integration

1. Open **Home Assistant** and go to **Settings → Devices & Services → Integrations**
2. Click **+ Create Integration** button (bottom right)
3. Search for **"ESPHome Display Notifications & Data Bridge"**
4. Click **Install**
5. Restart Home Assistant (takes about 2 minutes)

### Step 2: Configure Your First Display Device

After restart, Home Assistant will show a notification: **"New devices discovered"** or you can manually start setup:

1. Go back to **Integrations**
2. Click **+ Create Integration** again
3. Search for **"ESPHome Display"**
4. You'll see the **Welcome** screen

**Fill in the form:**

| Field | What to Enter | Example |
|-------|---------------|---------|
| **Display Name** | Friendly name for your display | "Kitchen Display" |
| **ESPHome Device Name** | Name from your ESPHome YAML `esphome:` → `name:` section | "kitchen_screen" |
| **Default Severity** | Default alert level (color) when not specified | "info" (blue) |
| **To-Do List (Optional)** | Any Home Assistant to-do list to display tasks | "todo.shopping_list" |

**Example values:**
- Display Name: `Kitchen Display`
- ESPHome Device: `kitchen_screen`
- Default Severity: `info`
- To-Do List: Leave blank for now (optional)

### Step 3: Add More Devices (Optional)

After configuring the first device, you'll see:

**"Would you like to add another display?"**

- Click **Yes** to add another display device
- Click **No** to finish setup

**That's it!** No YAML editing needed.

---

## Part 2: Sending Notifications (Dashboard Card Method)

### Method 1: Quick Send via Developer Tools

**Fastest way to test:**

1. Go to **Developer Tools → Services**
2. Service: `esphome_display: Send Notification to ESPHome Display`
3. Fill in the form:
   - **Display Device**: Select your kitchen display
   - **Message**: "This is a test message"
   - **Title**: "Test"
   - **Severity**: Select "ℹ️ Info (Blue)"
   - **Auto-Dismiss**: 10 seconds

4. Click **Call Service**

The notification should appear on your display!

### Method 2: Create an Automation (Easiest for Real Use)

**For example: Notify when washing machine is done**

1. Go to **Automations & Scenes → Automations**
2. Click **Create Automation**
3. Name: `Washing Machine Notification`
4. Click **Create**

**Set up the trigger:**
- Trigger: State
- Entity: `sensor.washing_machine_status`
- To: `complete`

**Set up the action:**
- Action: Service
- Service: `esphome_display: Send Notification to ESPHome Display`
- Fill in:
  - **Display Device**: Select your display
  - **Title**: "Laundry Done"
  - **Message**: "The washing machine has finished its cycle"
  - **Severity**: "alert" (red) to grab attention
  - **Auto-Dismiss**: 60 seconds

Click **Save**.

**Done!** Your display will now get notifications automatically.

---

## Part 3: Dashboard Card (Optional - Show on Dashboard)

You can add a quick-send notification card to your Home Assistant dashboard.

### Add Notification Card to Dashboard

1. Go to **Dashboard**
2. Click **Edit Dashboard** (pencil icon, top right)
3. Click **+ Add Card**
4. Search for **"Services"** or **"Script"** card
5. Configure it to call `esphome_display.notify`

**Or use a template card:**

```yaml
type: button
title: "Send Test Alert"
tap_action:
  action: call-service
  service: esphome_display.notify
  service_data:
    device: kitchen_display
    title: "Quick Alert"
    message: "This is a quick notification"
    severity: alert
```

---

## Part 4: Common Automations (Copy & Paste)

### Notification 1: Motion Detection Alert

**Automation: Motion Detected**

- **Trigger**: Motion Detected
  - Entity: `binary_sensor.hallway_motion`
  - To: `on`

- **Action**: Call service
  - Service: `esphome_display.notify`
  - Device: Your display
  - Title: "Motion Detected!"
  - Message: "Motion detected in the hallway"
  - Severity: "warn"
  - Timeout: 30 seconds

### Notification 2: Temperature Too High

**Automation: High Temperature Alert**

- **Trigger**: Numeric State
  - Entity: `sensor.bedroom_temperature`
  - Above: `26` (degrees)

- **Action**: Call service
  - Service: `esphome_display.notify`
  - Device: Bedroom Display
  - Title: "Too Warm!"
  - Message: "Bedroom temperature is {{ state_attr('sensor.bedroom_temperature', 'value') }}°C"
  - Severity: "alert"

### Notification 3: Door Opened

**Automation: Door Opened Alert**

- **Trigger**: State
  - Entity: `binary_sensor.front_door`
  - To: `on`

- **Action**: Call service
  - Service: `esphome_display.notify`
  - Device: Hallway Display
  - Title: "Door Alert"
  - Message: "Front door opened"
  - Severity: "question"

---

## Part 5: To-Do List Integration (Optional)

If you configured a to-do entity, a sensor is automatically created.

**Sensor Name:** `sensor.<display_name>_to_do_items`

### What It Shows

- **State**: Number of pending tasks
- **Attributes**:
  - `all_items`: Full task list (formatted as PSV)
  - `count`: Number of items
  - `last_update`: When it was last updated

### Use in Automations

**Automation: Alert when to-do list grows**

```yaml
automation:
  - alias: "To-Do List Alert"
    trigger:
      platform: numeric_state
      entity_id: sensor.kitchen_display_to_do_items
      above: 5
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Backlog Alert"
          message: "You have {{ state_attr('sensor.kitchen_display_to_do_items', 'count') }} pending tasks"
          severity: "warn"
```

---

## Part 6: Service Parameters Reference

### Send Notification Service

**Service:** `esphome_display.notify`

| Parameter | Required | Options | Notes |
|-----------|----------|---------|-------|
| **device** | ✅ Yes | Display name | Must match configured display name |
| **message** | ✅ Yes | Any text | Main notification text |
| **title** | ❌ No | Any text | Bold header (defaults to severity name) |
| **severity** | ❌ No | `info`, `warn`, `alert`, `question` | Affects icon and color |
| **timeout** | ❌ No | 0-3600 seconds | Auto-dismiss time (0 = manual) |

### Severity Levels

| Level | Icon | Color | Use Case |
|-------|------|-------|----------|
| **info** | ℹ️ | Blue | General information |
| **warn** | ⚠️ | Amber | Warning that needs attention |
| **alert** | 🚨 | Red | Urgent alert, immediate action needed |
| **question** | ❓ | Green | Request for input/confirmation |

---

## Part 7: Troubleshooting

### "Device not found" Error

**Problem:** You see "Device 'kitchen_display' not found"

**Solution:**
1. Go back to **Integrations**
2. Click on **ESPHome Display**
3. Verify the device name matches exactly what you configured
4. Check that ESPHome device name in your YAML matches

### Notifications Not Appearing

**Problem:** Service runs but nothing shows on display

**Solution:**
1. Make sure ESPHome device is online (check **Devices & Services → Devices**)
2. Verify in **Developer Tools → Services** that the service is registered
3. Check ESPHome device has the notification services configured (see ARCHITECTURE.md)
4. Try manually calling the service in Developer Tools to test

### Can't Find the Integration

**Problem:** "ESPHome Display" doesn't appear in integration search

**Solution:**
1. Restart Home Assistant: **Settings → System → Restart Home Assistant**
2. Clear browser cache (Ctrl+Shift+Delete)
3. Try again

### Settings Look Wrong

**Problem:** Integration settings show old values after update

**Solution:**
1. Go to **Settings → Devices & Services → Integrations**
2. Find **ESPHome Display**
3. Click **Options** (top right)
4. Update settings
5. Click **Save**

---

## Part 8: Advanced: Create Reusable Scripts

You can create Home Assistant **Scripts** to quickly send preset messages.

### Example: "All Clear" Script

**Go to:** Settings → Automations & Scenes → Scripts

**Create Script:**
```yaml
esphome_display_all_clear:
  alias: "Display - All Clear"
  icon: mdi:check-circle
  sequence:
    - service: esphome_display.notify
      data:
        device: kitchen_display
        title: "All Clear"
        message: "All systems operating normally"
        severity: info
        timeout: 10
```

**Use in automations:** Just call `script.esphome_display_all_clear`

---

## Summary: No YAML Needed

✅ **Setup**: All through config flow (web UI)  
✅ **Configure**: No YAML edits required  
✅ **Send Notifications**: Use Developer Tools or automations  
✅ **Manage Devices**: Change settings through options UI  
✅ **Create Automations**: Visual editor (no YAML)  

**Everything is point-and-click in the web interface!**

---

## Next Steps

1. ✅ Complete [Part 1: Initial Setup](#part-1-initial-setup-no-yaml-required)
2. ✅ Test sending notifications ([Part 2](#part-2-sending-notifications-dashboard-card-method))
3. ✅ Set up your first automation ([Part 4](#part-4-common-automations-copy--paste))
4. ✅ (Optional) Add to-do list integration ([Part 5](#part-5-to-do-list-integration-optional))

**Questions?** See the full documentation at [ARCHITECTURE.md](ARCHITECTURE.md) or [EXAMPLES.md](EXAMPLES.md).
