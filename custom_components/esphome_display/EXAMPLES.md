# Usage Examples

Complete real-world examples for using the ESPHome Display Notifications integration.

## Basic Examples

### Simple Notification
```yaml
automation:
  - alias: "Send Simple Notification"
    trigger:
      platform: time
      at: "09:00:00"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Good Morning"
          message: "Time to start the day!"
```

### Notification with Severity
```yaml
automation:
  - alias: "Security Alert"
    trigger:
      platform: state
      entity_id: binary_sensor.front_door
      to: "on"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Security Alert"
          message: "Front door has been opened"
          severity: alert
```

## Home Automation Examples

### Washing Machine Notification
```yaml
automation:
  - alias: "Washing Machine Finished"
    trigger:
      platform: state
      entity_id: sensor.washing_machine_status
      to: "finished"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Laundry Done"
          message: "The washing machine has finished. Please remove the clothes."
          severity: info
          timeout: 120  # Auto-clear after 2 minutes
```

### Dishwasher Notification
```yaml
automation:
  - alias: "Dishwasher Finished"
    trigger:
      platform: state
      entity_id: sensor.dishwasher_status
      to: "finished"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Dishes Done"
          message: "The dishwasher cycle is complete."
```

### Oven Timer Alert
```yaml
automation:
  - alias: "Oven Timer Complete"
    trigger:
      platform: state
      entity_id: timer.oven_timer
      to: "idle"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Oven Timer"
          message: "Your food is ready! Check the oven."
          severity: warn
```

## Weather & Environment Examples

### Weather Alert
```yaml
automation:
  - alias: "Severe Weather Warning"
    trigger:
      platform: state
      entity_id: sensor.weather_alert
      to: "warning"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Weather Alert"
          message: "Severe thunderstorm warning issued for your area"
          severity: alert
```

### High Temperature Alert
```yaml
automation:
  - alias: "High Temperature Alert"
    trigger:
      platform: numeric_state
      entity_id: sensor.inside_temperature
      above: 28  # 28°C
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Temperature Alert"
          message: "It's getting warm inside. Consider turning on AC."
          severity: warn
```

### Air Quality Alert
```yaml
automation:
  - alias: "Poor Air Quality"
    trigger:
      platform: numeric_state
      entity_id: sensor.air_quality_index
      above: 150
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Air Quality"
          message: "Air quality is poor. Consider running the air purifier."
          severity: warn
```

## Smart Home Control Examples

### Guest Arrival Notification
```yaml
automation:
  - alias: "Guest Arriving Soon"
    trigger:
      platform: state
      entity_id: binary_sensor.guest_proximity
      to: "on"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Guest Alert"
          message: "Your guest will arrive in 5 minutes"
          severity: info
```

### Package Delivered
```yaml
automation:
  - alias: "Package Delivered"
    trigger:
      platform: state
      entity_id: binary_sensor.doorbell_package
      to: "on"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Package Delivered"
          message: "A package has been delivered to your door"
          severity: info
          timeout: 180
```

### Garage Door Left Open
```yaml
automation:
  - alias: "Garage Door Alert"
    trigger:
      platform: state
      entity_id: binary_sensor.garage_door
      to: "on"
      for:
        minutes: 5
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Garage Door"
          message: "The garage door has been open for 5 minutes"
          severity: warn
```

## System & Device Examples

### Home Assistant Update
```yaml
automation:
  - alias: "Home Assistant Update Available"
    trigger:
      platform: state
      entity_id: update.home_assistant_core
      to: "on"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Update Available"
          message: "Home Assistant has a new version available"
          severity: info
```

### Battery Low Alert
```yaml
automation:
  - alias: "Low Battery Alert"
    trigger:
      platform: numeric_state
      entity_id:
        - sensor.kitchen_sensor_battery
        - sensor.bedroom_sensor_battery
      below: 10
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Battery Low"
          message: "{{ trigger.entity_id }}: Replace battery soon"
          severity: warn
```

### WiFi Disconnected
```yaml
automation:
  - alias: "WiFi Disconnected Alert"
    trigger:
      platform: state
      entity_id: binary_sensor.wifi_connected
      to: "off"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Network Alert"
          message: "WiFi connection has been lost"
          severity: alert
```

## Template Examples

### Dynamic Messages
```yaml
automation:
  - alias: "Dynamic Notification Example"
    trigger:
      platform: state
      entity_id: sensor.current_temperature
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Temperature Update"
          message: "Current temperature is {{ states('sensor.current_temperature') }}°C"
          severity: info
```

### Conditional Notifications
```yaml
automation:
  - alias: "Conditional Notification"
    trigger:
      platform: state
      entity_id: binary_sensor.motion_sensor
      to: "on"
    condition:
      - condition: numeric_state
        entity_id: sensor.outside_light
        below: 100  # Only notify if dark
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Motion Detected"
          message: "Motion detected in the hallway"
          severity: warn
```

## Script Examples

### Notification Script
```yaml
script:
  notify_all_displays:
    description: "Send notification to all displays"
    fields:
      title:
        description: "Notification title"
      message:
        description: "Notification message"
      severity:
        description: "Notification severity"
    sequence:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "{{ title }}"
          message: "{{ message }}"
          severity: "{{ severity | default('info') }}"
      - service: esphome_display.notify
        data:
          device: bedroom_display
          title: "{{ title }}"
          message: "{{ message }}"
          severity: "{{ severity | default('info') }}"

# Usage in automation:
# service: script.notify_all_displays
# data:
#   title: "Hello"
#   message: "Test message"
#   severity: "info"
```

## Multi-Device Examples

### Broadcast Notification
```yaml
automation:
  - alias: "Broadcast Notification"
    trigger:
      platform: time
      at: "18:00:00"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Dinner Time"
          message: "Dinner is ready!"
      - service: esphome_display.notify
        data:
          device: bedroom_display
          title: "Dinner Time"
          message: "Dinner is ready!"
```

### Room-Specific Notifications
```yaml
automation:
  - alias: "Room Temperature High"
    trigger:
      platform: numeric_state
      entity_id: sensor.bedroom_temperature
      above: 26
    action:
      - service: esphome_display.notify
        data:
          device: bedroom_display
          title: "Too Warm"
          message: "Bedroom temperature is too high"
          severity: warn

  - alias: "Room Motion Detected"
    trigger:
      platform: state
      entity_id: binary_sensor.office_motion
      to: "on"
    action:
      - service: esphome_display.notify
        data:
          device: office_display
          title: "Motion Detected"
          message: "Movement detected in the office"
          severity: info
```

## Testing Examples

### Developer Tools Test
Use Home Assistant's Developer Tools > Services:

**Service:** `esphome_display.notify`

**JSON Data:**
```json
{
  "device": "kitchen_display",
  "title": "Test Title",
  "message": "This is a test message",
  "severity": "info"
}
```

### Quick Automation Test
```yaml
automation:
  - alias: "Quick Test - Every Minute"
    trigger:
      platform: time_pattern
      minutes: "/1"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Test"
          message: "Notification at {{ now().strftime('%H:%M:%S') }}"
```

## Tips & Tricks

### Avoid Notification Spam
Use `for:` to debounce repeated triggers:
```yaml
trigger:
  platform: numeric_state
  entity_id: sensor.temperature
  above: 30
  for:
    minutes: 5  # Only notify if above 30°C for 5 minutes
```

### Use Templates for Dynamic Content
```yaml
message: "{{ trigger.entity_id }}: {{ trigger.to_state.state }}"
```

### Group Related Notifications
```yaml
alias: "Climate Control Alerts"
description: "Group of climate-related notifications"
triggers:
  - platform: numeric_state
    entity_id: sensor.temperature
    above: 28
  - platform: numeric_state
    entity_id: sensor.humidity
    above: 70
action:
  - service: esphome_display.notify
    data:
      device: kitchen_display
      title: "Climate Alert"
      message: "Temperature: {{ states('sensor.temperature') }}, Humidity: {{ states('sensor.humidity') }}"
      severity: warn
```

## To-Do Bridge Examples

The integration automatically creates a sensor that bridges Home Assistant To-Do lists to your display as pipe-separated values (PSV), making it easy to show task lists on your ESPHome device.

### Basic To-Do Configuration

In `configuration.yaml`:

```yaml
esphome_display:
  devices:
    - name: kitchen_display
      esphome_device: kitchen_screen
      todo_entity: todo.shopping_list  # Any Home Assistant to-do list
```

This creates a sensor: `sensor.kitchen_display_to_do_items`

### Checking To-Do Count

```yaml
automation:
  - alias: "Remind when shopping list has items"
    trigger:
      platform: numeric_state
      entity_id: sensor.kitchen_display_to_do_items
      above: 0
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Shopping List"
          message: "{{ state_attr('sensor.kitchen_display_to_do_items', 'count') }} items to buy"
          severity: info
```

### Using To-Do Data in Templates

```yaml
automation:
  - alias: "Display pending tasks"
    trigger:
      platform: state
      entity_id: sensor.kitchen_display_to_do_items
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "My Tasks"
          # PSV format: First item in the list
          message: "{{ state_attr('sensor.kitchen_display_to_do_items', 'all_items').split('\n')[0] | truncate(50) }}"
          severity: info
```

### Notification on Overdue Items

```yaml
automation:
  - alias: "Alert on overdue tasks"
    trigger:
      platform: state
      entity_id: sensor.kitchen_display_to_do_items
    condition:
      - condition: template
        value_template: "{{ 'overdue' in state_attr('sensor.kitchen_display_to_do_items', 'all_items') }}"
    action:
      - service: esphome_display.notify
        data:
          device: kitchen_display
          title: "Overdue Tasks!"
          message: "You have overdue items in your to-do list"
          severity: alert
          timeout: 0  # Manual dismiss only
```

### Multi-List Monitoring

```yaml
esphome_display:
  devices:
    - name: kitchen_display
      esphome_device: kitchen_screen
      todo_entity: todo.shopping_list
    
    - name: office_display
      esphome_device: office_screen
      todo_entity: todo.work_tasks

# Then in automations, differentiate by device:
automation:
  - alias: "Work task reminder"
    trigger:
      platform: numeric_state
      entity_id: sensor.office_display_to_do_items
      above: 5
    action:
      - service: esphome_display.notify
        data:
          device: office_display
          title: "Backlog Alert"
          message: "You have {{ state_attr('sensor.office_display_to_do_items', 'count') }} pending tasks"
          severity: warn
```

### Parsing To-Do Data in ESPHome

In your `includes/render_detail_todo.h`:

```cpp
void renderDetailTodo(display::Display& it) {
  drawDetailHeader(it, "To-Do List");
  
  int y = 55;
  std::string line;
  std::istringstream stream(gState.todoListRaw);
  
  // Parse PSV: TaskName|DueDate|Status
  while (std::getline(stream, line) && y < 300) {
    // Split by pipe delimiter
    size_t pipe1 = line.find('|');
    size_t pipe2 = line.find('|', pipe1 + 1);
    
    if (pipe1 != std::string::npos && pipe2 != std::string::npos) {
      std::string task = line.substr(0, pipe1);
      std::string due = line.substr(pipe1 + 1, pipe2 - pipe1 - 1);
      std::string status = line.substr(pipe2 + 1);
      
      // Determine color based on status
      Color color = Color(200, 200, 200);  // Default gray
      if (status == "overdue") {
        color = Color(255, 60, 60);  // Red for overdue
      } else if (status == "ok") {
        color = Color(100, 200, 100);  // Green for on-time
      }
      
      // Draw checkbox
      if (status == "completed") {
        it.filled_rectangle(15, y - 6, 12, 12, color);  // Checked
        it.print(20, y, font_small, Color(100, 100, 100), TextAlign::CENTER_LEFT, "✓");
      } else {
        it.rectangle(15, y - 6, 12, 12, color);  // Unchecked
      }
      
      // Draw task text
      it.printf(35, y, font_small, color, TextAlign::TOP_LEFT, "%s", task.c_str());
      
      // Draw due date (smaller, right-aligned)
      if (due != "no-date") {
        it.printf(220, y, font_tiny, Color(150, 150, 150), TextAlign::TOP_RIGHT, "%s", due.c_str());
      }
      
      y += 25;  // Space for next item
    }
  }
}
```

### Display To-Do Summary on Dashboard

```cpp
// In render_pages.h, on the main dashboard:
void renderPage0_Status(display::Display& it) {
  // ... existing code ...
  
  // Show to-do count if available
  if (!gState.todoListRaw.empty()) {
    int count = std::count(gState.todoListRaw.begin(), 
                          gState.todoListRaw.end(), '\n') + 1;
    it.printf(200, 250, font_small, Color(100, 200, 100), TextAlign::TOP_RIGHT,
              "%d tasks", count);
  }
}
```

For more examples and advanced usage, see the main README.md.
