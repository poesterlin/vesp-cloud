# PHASE 3: Touch Handling & Sensor Binding Code Generation

**Status:** Planning & Implementation
**Scope:** Auto-generate `touch_handler.h` and `sensors.yaml` from project schema
**Deliverables:** 
1. `esphome/includes/touch_handler.h` - Hit-box detection + action dispatcher
2. `esphome/packages/sensors.yaml` - HA entity bindings

---

## Overview

Phase 3 completes the bridge between user interaction and Home Assistant integration. It generates:

1. **Touch Handler** - Maps screen coordinates → components → actions
2. **Sensor Bindings** - Maps HA entities → gState fields

These work together with Phase 2's state management to enable full interactivity.

---

## Part 1: Action Schema Extensions

### ActionBinding Types

The schema supports two types of user actions:

#### NavigationAction
```json
{
  "type": "object",
  "properties": {
    "type": { "enum": ["OPEN_DETAIL", "GO_BACK", "NEXT_PAGE", "PREV_PAGE"] },
    "targetId": {
      "type": "string",
      "description": "For OPEN_DETAIL: the detail view ID (e.g., VIEW_DETAIL_TEMPS)"
    }
  },
  "required": ["type"]
}
```

#### ServiceAction
```json
{
  "type": "object",
  "properties": {
    "type": { "const": "SERVICE_CALL" },
    "service": {
      "type": "string",
      "pattern": "^[a-z_]+\\.[a-z_0-9]+$",
      "description": "HA service (light.turn_on, vacuum.start)"
    },
    "target": { "$ref": "#/definitions/EntityBinding" },
    "data": {
      "type": "object",
      "description": "Service parameters (brightness, speed, etc.)"
    }
  },
  "required": ["type", "service"]
}
```

### BaseComponent Extensions

```json
{
  "BaseComponent": {
    "properties": {
      "onTap": { "$ref": "#/definitions/ActionBinding" },
      "onHold": { "$ref": "#/definitions/ActionBinding" },
      "onDragStart": { "$ref": "#/definitions/ActionBinding" },
      "onDragEnd": { "$ref": "#/definitions/ActionBinding" }
    }
  }
}
```

### Example Component with Actions

```json
{
  "id": "btn-vacuum",
  "type": "button",
  "position": { "x": 20, "y": 60 },
  "size": { "width": 100, "height": 50 },
  "label": "Start Vacuum",
  "onTap": {
    "type": "SERVICE_CALL",
    "service": "vacuum.start",
    "target": { "entityId": "vacuum.roborock" },
    "data": {}
  }
}
```

---

## Part 2: HitBox Generation

### Data Structure

```cpp
struct HitBox {
  int id;              // Component ID hash
  int x, y, w, h;      // Bounding box
  ActionType type;     // Navigation, Service, etc.
  // Action payload (union or tagged variant)
};
```

### Algorithm

```
1. Iterate all pages and their detail views
2. For each component with onTap, onHold, onDragStart, or onDragEnd:
   a. Calculate component bounds from position + size
   b. Account for scroll offset (detail views have -scrollY offset)
   c. Create HitBox entry
   d. Encode action payload
3. Generate HitBox array (sorted by Z-order for layering)
```

### Output Template

```cpp
#pragma once
#include "esphome.h"
#include "state_manager.h"

// Hit-box entry
struct HitBox {
  int id;
  int x, y, w, h;
  enum ActionType {
    ACTION_OPEN_DETAIL,
    ACTION_GO_BACK,
    ACTION_NEXT_PAGE,
    ACTION_PREV_PAGE,
    ACTION_SERVICE_CALL,
  } type;
  
  // Action data (union to save space)
  union {
    ViewState targetView;           // For OPEN_DETAIL
    struct {
      const char* service;          // For SERVICE_CALL
      const char* entityId;
      const char* dataJson;         // Serialized parameters
    } serviceCall;
  } action;
};

// All interactive components
const HitBox HIT_BOXES[] = {
  {
    .id = 0x12345678,  // hash("btn-temps")
    .x = 49, .y = 49, .w = 80, .h = 36,
    .type = ACTION_OPEN_DETAIL,
    .action.targetView = VIEW_DETAIL_TEMPS,
  },
  {
    .id = 0x87654321,  // hash("back-button")
    .x = 5, .y = 8, .w = 45, .h = 20,
    .type = ACTION_GO_BACK,
  },
  {
    .id = 0xabcdef01,  // hash("btn-vacuum")
    .x = 20, .y = 60, .w = 100, .h = 50,
    .type = ACTION_SERVICE_CALL,
    .action.serviceCall = {
      .service = "vacuum.start",
      .entityId = "vacuum.roborock",
      .dataJson = "{}",
    },
  },
};
const int HIT_BOX_COUNT = sizeof(HIT_BOXES) / sizeof(HIT_BOX[0]);

// Find component at (x, y)
HitBox* getComponentAtPoint(int x, int y) {
  for (int i = 0; i < HIT_BOX_COUNT; i++) {
    HitBox& box = HIT_BOXES[i];
    if (x >= box.x && x < box.x + box.w &&
        y >= box.y && y < box.y + box.h) {
      return &box;
    }
  }
  return nullptr;
}
```

### Scroll Offset Handling

For detail views, components are positioned in virtual space (0 to height). When rendering with `gState.scrollY`, the Y coordinate shifts:

```
Display Y = Component Y + scrollY
```

Touch handler must reverse this:

```cpp
HitBox* getComponentAtPointInDetail(int displayX, int displayY) {
  // Adjust for scroll offset
  int virtualY = displayY - gState.scrollY;
  
  for (int i = 0; i < HIT_BOX_COUNT; i++) {
    HitBox& box = HIT_BOXES[i];
    if (displayX >= box.x && displayX < box.x + box.w &&
        virtualY >= box.y && virtualY < box.y + box.h) {
      return &box;
    }
  }
  return nullptr;
}
```

---

## Part 3: Action Dispatcher

### Action Types

```cpp
enum ActionType {
  ACTION_OPEN_DETAIL,      // Navigate to detail view
  ACTION_GO_BACK,          // Return to dashboard
  ACTION_NEXT_PAGE,        // Swipe to next carousel page
  ACTION_PREV_PAGE,        // Swipe to prev carousel page
  ACTION_SERVICE_CALL,     // Call HA service
};
```

### Dispatcher Implementation

```cpp
#define DEBOUNCE_MS 200

static unsigned long lastActionTime = 0;

bool canDispatch() {
  unsigned long now = millis();
  if (now - lastActionTime < DEBOUNCE_MS) {
    return false;  // Action still debounced
  }
  lastActionTime = now;
  return true;
}

void dispatchAction(HitBox& box) {
  if (!canDispatch()) return;

  switch (box.type) {
    case ACTION_OPEN_DETAIL:
      gState.viewMode = DETAIL;
      gState.currentView = box.action.targetView;
      gState.scrollY = 0;
      gState.updateScrollBounds();
      break;

    case ACTION_GO_BACK:
      gState.viewMode = DASHBOARD;
      gState.scrollY = 0;
      break;

    case ACTION_NEXT_PAGE:
      gState.mainPageIndex = (gState.mainPageIndex + 1) % NUM_PAGES;
      break;

    case ACTION_PREV_PAGE:
      gState.mainPageIndex = (gState.mainPageIndex - 1 + NUM_PAGES) % NUM_PAGES;
      break;

    case ACTION_SERVICE_CALL:
      callHomeAssistantService(
        box.action.serviceCall.service,
        box.action.serviceCall.entityId,
        box.action.serviceCall.dataJson
      );
      break;
  }
}
```

### HA Service Call Adapter

Integrate with ESPHome's HA service call infrastructure:

```cpp
void callHomeAssistantService(
  const char* service,
  const char* entityId,
  const char* dataJson
) {
  // Service call through Home Assistant API
  // Example: light.turn_on → homeassistant.service_call
  
  // This is handled by ESPHome's native service call support
  // via home_assistant_api component
  // Implementation details depend on ESPHome version
}
```

---

## Part 4: Static Touch Handler Template

The generated hit-boxes and action dispatcher integrate with a **static touch handler template** that handles swipes and scrolls.

### Template: `esphome/includes/touch_handler_template.h`

```cpp
#pragma once
#include "esphome.h"
#include "state_manager.h"
#include "touch_handler.h"  // Generated hit-boxes

// Configurable thresholds
const int SWIPE_THRESHOLD_X = 40;   // Min horizontal movement for swipe
const int SWIPE_THRESHOLD_Y = 20;   // Min vertical movement for scroll
const int SWIPE_TIME_MAX = 500;     // Max duration for swipe (ms)

// Touch state machine
struct TouchState {
  bool pressed = false;
  int startX = 0, startY = 0;
  int lastX = 0, lastY = 0;
  unsigned long startTime = 0;
};

static TouchState touchState;

void handleTouchDown(int x, int y) {
  touchState.pressed = true;
  touchState.startX = x;
  touchState.startY = y;
  touchState.lastX = x;
  touchState.lastY = y;
  touchState.startTime = millis();
}

void handleTouchMove(int x, int y) {
  if (!touchState.pressed) return;

  int deltaX = x - touchState.startX;
  int deltaY = y - touchState.startY;
  unsigned long elapsed = millis() - touchState.startTime;

  // Detect swipe (only in DASHBOARD mode)
  if (gState.viewMode == DASHBOARD && elapsed < SWIPE_TIME_MAX) {
    if (abs(deltaX) > SWIPE_THRESHOLD_X && abs(deltaY) < 20) {
      // Horizontal swipe
      if (deltaX > 0) {
        dispatchAction(ACTION_PREV_PAGE);
      } else {
        dispatchAction(ACTION_NEXT_PAGE);
      }
      touchState.pressed = false;  // Consume swipe
      return;
    }
  }

  // Detect scroll (only in DETAIL mode)
  if (gState.viewMode == DETAIL && abs(deltaY) > SWIPE_THRESHOLD_Y) {
    gState.scrollY = constrain(
      gState.scrollY + (touchState.lastY - y),  // Inverted: up = negative scrollY
      -gState.maxScrollY,
      0
    );
    touchState.lastY = y;
  }
}

void handleTouchUp(int x, int y) {
  if (!touchState.pressed) return;
  touchState.pressed = false;

  int deltaX = abs(x - touchState.startX);
  int deltaY = abs(y - touchState.startY);
  unsigned long elapsed = millis() - touchState.startTime;

  // Only dispatch tap if movement was minimal and time was short
  if (deltaX < 10 && deltaY < 10 && elapsed < SWIPE_TIME_MAX) {
    HitBox* component = getComponentAtPoint(x, y);
    if (component) {
      dispatchAction(*component);
    }
  }
}

// Entry point from ESPHome touch driver
void handleTouch(int x, int y, bool touched) {
  if (touched) {
    if (!touchState.pressed) {
      handleTouchDown(x, y);
    } else {
      handleTouchMove(x, y);
    }
  } else {
    handleTouchUp(x, y);
  }
}
```

---

## Part 5: Generator Implementation (TypeScript)

### File: `packages/schema/generators/touch-handler-generator.ts`

```typescript
import type { Project, Component } from "../dist/types";
import fs from "fs/promises";

interface HitBoxDef {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  action: ActionDef;
}

interface ActionDef {
  type: "OPEN_DETAIL" | "GO_BACK" | "NEXT_PAGE" | "PREV_PAGE" | "SERVICE_CALL";
  targetView?: string;
  service?: string;
  entityId?: string;
  dataJson?: string;
}

export async function generateTouchHandler(
  project: Project
): Promise<string> {
  const hitBoxes: HitBoxDef[] = [];

  // Discover all interactive components across all pages and detail views
  for (const page of project.pages) {
    // Main page components
    for (const comp of page.components) {
      collectInteractiveComponents(comp, hitBoxes, false, 0);
    }

    // Detail view components
    if (page.details) {
      for (const detail of page.details) {
        for (const comp of detail.components) {
          collectInteractiveComponents(comp, hitBoxes, true, detail.height);
        }
      }
    }
  }

  // Generate C++ hit-box array
  const hitBoxCode = generateHitBoxArray(hitBoxes);
  const dispatcherCode = generateDispatcher();
  const lookupCode = generateLookup();

  return `#pragma once
#include "esphome.h"
#include "state_manager.h"

${hitBoxCode}

${lookupCode}

${dispatcherCode}
`;
}

function collectInteractiveComponents(
  comp: Component,
  hitBoxes: HitBoxDef[],
  isDetailView: boolean,
  detailHeight: number
) {
  const actions = [
    comp.onTap,
    comp.onHold,
    comp.onDragStart,
    comp.onDragEnd,
  ].filter(Boolean);

  if (actions.length > 0 && comp.position && comp.size) {
    const action = actions[0]; // Use first action (simplify for MVP)

    hitBoxes.push({
      id: comp.id,
      x: comp.position.x,
      y: comp.position.y,
      w: comp.size.width,
      h: comp.size.height,
      action: parseAction(action),
    });
  }
}

function parseAction(action: any): ActionDef {
  if (action.type === "SERVICE_CALL") {
    return {
      type: "SERVICE_CALL",
      service: action.service,
      entityId: action.target?.entityId ?? "",
      dataJson: JSON.stringify(action.data ?? {}),
    };
  }

  return {
    type: action.type,
    targetView: action.targetId,
  };
}

function generateHitBoxArray(hitBoxes: HitBoxDef[]): string {
  const lines: string[] = [];

  lines.push(`enum ActionType {`);
  lines.push(`  ACTION_OPEN_DETAIL,`);
  lines.push(`  ACTION_GO_BACK,`);
  lines.push(`  ACTION_NEXT_PAGE,`);
  lines.push(`  ACTION_PREV_PAGE,`);
  lines.push(`  ACTION_SERVICE_CALL,`);
  lines.push(`};`);
  lines.push(``);

  lines.push(`struct HitBox {`);
  lines.push(`  const char* id;`);
  lines.push(`  int x, y, w, h;`);
  lines.push(`  ActionType type;`);
  lines.push(`  union {`);
  lines.push(`    ViewState targetView;`);
  lines.push(`    struct {`);
  lines.push(`      const char* service;`);
  lines.push(`      const char* entityId;`);
  lines.push(`      const char* dataJson;`);
  lines.push(`    } serviceCall;`);
  lines.push(`  } action;`);
  lines.push(`};`);
  lines.push(``);

  lines.push(`const HitBox HIT_BOXES[] = {`);
  hitBoxes.forEach((box) => {
    lines.push(`  {`);
    lines.push(`    .id = "${box.id}",`);
    lines.push(`    .x = ${box.x}, .y = ${box.y}, .w = ${box.w}, .h = ${box.h},`);
    lines.push(`    .type = ${actionTypeToEnum(box.action.type)},`);

    if (box.action.type === "SERVICE_CALL") {
      lines.push(`    .action.serviceCall = {`);
      lines.push(`      .service = "${box.action.service}",`);
      lines.push(`      .entityId = "${box.action.entityId}",`);
      lines.push(`      .dataJson = "${escapeJson(box.action.dataJson!)}",`);
      lines.push(`    },`);
    } else {
      lines.push(`    .action.targetView = ${box.action.targetView},`);
    }

    lines.push(`  },`);
  });
  lines.push(`};`);
  lines.push(`const int HIT_BOX_COUNT = ${hitBoxes.length};`);

  return lines.join("\n");
}

function generateLookup(): string {
  return `
HitBox* getComponentAtPoint(int x, int y) {
  for (int i = 0; i < HIT_BOX_COUNT; i++) {
    HitBox& box = HIT_BOXES[i];
    if (x >= box.x && x < box.x + box.w &&
        y >= box.y && y < box.y + box.h) {
      return &box;
    }
  }
  return nullptr;
}

HitBox* getComponentAtPointInDetail(int x, int y) {
  int virtualY = y - gState.scrollY;
  for (int i = 0; i < HIT_BOX_COUNT; i++) {
    HitBox& box = HIT_BOXES[i];
    if (x >= box.x && x < box.x + box.w &&
        virtualY >= box.y && virtualY < box.y + box.h) {
      return &box;
    }
  }
  return nullptr;
}
`;
}

function generateDispatcher(): string {
  return `
#define DEBOUNCE_MS 200
static unsigned long lastActionTime = 0;

bool canDispatch() {
  unsigned long now = millis();
  if (now - lastActionTime < DEBOUNCE_MS) {
    return false;
  }
  lastActionTime = now;
  return true;
}

void dispatchAction(HitBox& box) {
  if (!canDispatch()) return;

  switch (box.type) {
    case ACTION_OPEN_DETAIL:
      gState.viewMode = DETAIL;
      gState.currentView = box.action.targetView;
      gState.scrollY = 0;
      gState.updateScrollBounds();
      break;

    case ACTION_GO_BACK:
      gState.viewMode = DASHBOARD;
      gState.scrollY = 0;
      break;

    case ACTION_NEXT_PAGE:
      gState.mainPageIndex = (gState.mainPageIndex + 1) % NUM_PAGES;
      break;

    case ACTION_PREV_PAGE:
      gState.mainPageIndex = (gState.mainPageIndex - 1 + NUM_PAGES) % NUM_PAGES;
      break;

    case ACTION_SERVICE_CALL:
      // Service calls handled by ESPHome API integration
      // Implementation in integration layer
      break;
  }
}
`;
}

function actionTypeToEnum(type: string): string {
  const map: Record<string, string> = {
    OPEN_DETAIL: "ACTION_OPEN_DETAIL",
    GO_BACK: "ACTION_GO_BACK",
    NEXT_PAGE: "ACTION_NEXT_PAGE",
    PREV_PAGE: "ACTION_PREV_PAGE",
    SERVICE_CALL: "ACTION_SERVICE_CALL",
  };
  return map[type] || "ACTION_OPEN_DETAIL";
}

function escapeJson(json: string): string {
  return json.replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export async function writeTouchHandlerHeader(
  project: Project,
  outputPath: string
): Promise<void> {
  const header = await generateTouchHandler(project);
  const withBanner = `// AUTO-GENERATED by ESPHome Designer
// Project: ${project.name}
// Generated: ${new Date().toISOString()}
// DO NOT EDIT - regenerate from editor

${header}`;

  await fs.writeFile(outputPath, withBanner, "utf-8");
  console.log(`✓ Generated touch_handler.h (${outputPath})`);
}
```

---

## Part 6: Sensor Binding Generation (YAML)

### Algorithm

```
1. Collect all StateField entries from project.state.fields
2. For each field:
   a. Parse haEntity (domain.entity)
   b. Determine platform type (sensor vs text_sensor)
   c. Generate YAML entry with on_value callback
3. Output complete sensors.yaml package
```

### Output Template

```yaml
# AUTO-GENERATED by ESPHome Designer
# Do not edit manually - regenerate from editor

sensor:
  - platform: homeassistant
    id: ha_sensor_outside_temp
    entity_id: sensor.outside_temperature
    internal: true
    filters:
      - lambda: "return isnan(x) ? 0 : x;"
    on_value:
      - lambda: "gState.outsideTemp = x;"

  - platform: homeassistant
    id: ha_sensor_humidity
    entity_id: sensor.humidity
    internal: true
    filters:
      - lambda: "return isnan(x) ? 0 : x;"
    on_value:
      - lambda: "gState.humidity = x;"

text_sensor:
  - platform: homeassistant
    id: ha_text_vacuum_status
    entity_id: vacuum.roborock_status
    internal: true
    on_value:
      - lambda: "gState.vacuumStatus = x;"
```

### Generator Implementation

```typescript
// packages/schema/generators/sensors-yaml-generator.ts

import type { Project, StateField } from "../dist/types";
import fs from "fs/promises";

export async function generateSensorsYAML(project: Project): Promise<string> {
  const fields = project.state?.fields ?? [];
  const sensors: StateField[] = [];
  const textSensors: StateField[] = [];

  // Partition by type
  for (const field of fields) {
    if (field.cppType === "std::string") {
      textSensors.push(field);
    } else {
      sensors.push(field);
    }
  }

  const lines: string[] = [];

  // Numeric sensors
  if (sensors.length > 0) {
    lines.push(`sensor:`);
    for (const field of sensors) {
      lines.push(`  - platform: homeassistant`);
      lines.push(`    id: ha_sensor_${field.name}`);
      lines.push(`    entity_id: ${field.haEntity}`);
      lines.push(`    internal: true`);
      lines.push(`    filters:`);
      lines.push(`      - lambda: "return isnan(x) ? 0 : x;"`);
      lines.push(`    on_value:`);
      lines.push(`      - lambda: "gState.${field.name} = x;"`);
      lines.push(``);
    }
  }

  // Text sensors
  if (textSensors.length > 0) {
    lines.push(`text_sensor:`);
    for (const field of textSensors) {
      lines.push(`  - platform: homeassistant`);
      lines.push(`    id: ha_text_${field.name}`);
      lines.push(`    entity_id: ${field.haEntity}`);
      lines.push(`    internal: true`);
      lines.push(`    on_value:`);
      lines.push(`      - lambda: "gState.${field.name} = x;"`);
      lines.push(``);
    }
  }

  return lines.join("\n");
}

export async function writeSensorsYAML(
  project: Project,
  outputPath: string
): Promise<void> {
  const yaml = await generateSensorsYAML(project);
  const withBanner = `# AUTO-GENERATED by ESPHome Designer
# Project: ${project.name}
# Generated: ${new Date().toISOString()}
# DO NOT EDIT - regenerate from editor

${yaml}`;

  await fs.writeFile(outputPath, withBanner, "utf-8");
  console.log(`✓ Generated sensors.yaml (${outputPath})`);
}
```

---

## Part 7: Integration with Main Codegen

Update the export pipeline to generate all three files:

```typescript
// packages/editor/src/lib/codegen/cpp.ts

import { writeStateManagerHeader } from "@esphome-designer/schema";
import { writeTouchHandlerHeader } from "@esphome-designer/schema";
import { writeSensorsYAML } from "@esphome-designer/schema";

export async function generateAllFiles(
  project: Project,
  outputDir: string
): Promise<void> {
  // Generate C++ headers
  await writeStateManagerHeader(project, `${outputDir}/state_manager.h`);
  await writeTouchHandlerHeader(project, `${outputDir}/touch_handler.h`);

  // Generate YAML
  await writeSensorsYAML(project, `${outputDir}/sensors.yaml`);

  // Generate rendering code
  const renderer = generateCppRenderer(project);
  await fs.writeFile(`${outputDir}/display_renderer.h`, renderer);

  console.log(`✓ Generated all headers to ${outputDir}`);
}
```

---

## Testing

### Unit Test: HitBox Generation

```typescript
test("generates hit-boxes for all interactive components", async () => {
  const project: Project = {
    pages: [
      {
        components: [
          {
            id: "btn-1",
            type: "button",
            position: { x: 10, y: 20 },
            size: { width: 50, height: 30 },
            onTap: { type: "NEXT_PAGE" },
          },
        ],
      },
    ],
  };

  const cpp = await generateTouchHandler(project);

  expect(cpp).toContain('const HitBox HIT_BOXES[]');
  expect(cpp).toContain('.id = "btn-1"');
  expect(cpp).toContain('.x = 10, .y = 20, .w = 50, .h = 30');
  expect(cpp).toContain('ACTION_NEXT_PAGE');
});
```

### Integration Test: Compile Generated Headers

```bash
esphome compile esphome/my-display.yaml
# Should compile with state_manager.h + touch_handler.h + sensors.yaml
```

---

## Validation Rules

| Rule | Error Message |
|------|---------------|
| Action targetId exists | "OPEN_DETAIL action references undefined view: VIEW_TEMPS" |
| Service format valid | "Invalid service: vacuum_start (must be domain.service)" |
| StateField references match | "State field outsideTemp references undefined entity: temp" |
| Action exists on component | "Component btn-1 has action but is not interactive" |

---

## Files Changed/Created

- ✨ `packages/schema/generators/touch-handler-generator.ts` - NEW
- ✨ `packages/schema/generators/sensors-yaml-generator.ts` - NEW
- 📝 `esphome/includes/touch_handler.h` - GENERATED
- 📝 `esphome/packages/sensors.yaml` - GENERATED
- 📝 `components.json` - ADD ActionBinding, NavigationAction, ServiceAction

---

## Next Steps

Once Phase 3 is complete:
1. Update `my-display.yaml` to include generated headers and packages
2. Test end-to-end compilation
3. Deploy to device and test touch interaction
4. Iterate on refinements

See **PHASE_4.md** (future) for live preview and advanced features.

