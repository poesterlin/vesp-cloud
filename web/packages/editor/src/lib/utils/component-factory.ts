import type { Component } from "@vesp-cloud/schema";

export function createComponent(type: string, x: number, y: number): Component {
  const id = `${type}-${Date.now()}`;

  const base = {
    id,
    position: { x, y },
    size: { width: 100, height: 40 },
  };

  switch (type) {
    case "text":
      return {
        ...base,
        type: "text",
        text: "Text",
        fontSize: "medium",
        align: "left",
      } as Component;

    case "digital_clock":
      return {
        ...base,
        type: "digital_clock",
        size: { width: 260, height: 110 },
        color: { r: 0, g: 255, b: 255 },
      } as Component;

    case "button":
      return {
        ...base,
        type: "button",
        label: "Button",
        confirmBeforeAction: false,
        size: { width: 80, height: 44 },
      } as Component;

    case "icon":
      return {
        ...base,
        type: "icon",
        icon: "home",
        size: { width: 32, height: 32 },
        scale: 1,
      } as Component;

    case "rectangle":
      return {
        ...base,
        type: "rectangle",
        size: { width: 100, height: 60 },
        backgroundColor: { r: 64, g: 64, b: 64 },
      } as Component;

    case "image":
      return {
        ...base,
        type: "image",
        imageSource: "ha",
        file: "images/image.png",
        image_type: "RGB565",
        onlineFormat: "png",
        size: { width: 100, height: 100 },
      } as Component;

    case "todo_list":
      return {
        ...base,
        type: "todo_list",
        size: { width: 220, height: 140 },
        maxItems: 4,
        rowHeight: 30,
        scrollable: false,
        checkable: false,
      } as Component;

    case "light_state":
      return {
        ...base,
        type: "light_state",
        label: "Light",
        icon: "lightbulb",
        onText: "ON",
        offText: "OFF",
        showIcon: true,
        showBrightnessControl: false,
        size: { width: 120, height: 44 },
      } as Component;

    case "hvac":
      return {
        ...base,
        type: "hvac",
        label: "Climate",
        tempStep: 0.5,
        minTemp: 10,
        maxTemp: 30,
        onMode: "heat",
        size: { width: 225, height: 158 },
      } as Component;

    case "weather":
      return {
        ...base,
        type: "weather",
        label: "Weather",
        mode: "today",
        size: { width: 225, height: 200 },
      } as Component;

    case "calendar":
      return {
        ...base,
        type: "calendar",
        label: "Calendar",
        size: { width: 225, height: 180 },
        maxItems: 4,
        scrollable: false,
        durationDays: 125,
      } as Component;

    case "conditional_area":
      return {
        ...base,
        type: "conditional_area",
        size: { width: 120, height: 80 },
        variants: [
          {
            id: `variant-${Date.now()}`,
            name: "Default",
            components: [],
            priority: 0,
          }
        ],
        evaluationMode: "first_match",
        clipContent: true,
      } as Component;

    case "tab_container":
      return {
        ...base,
        type: "tab_container",
        size: { width: 150, height: 100 },
        tabs: [
          {
            id: `tab-${Date.now()}`,
            name: "Tab 1",
            components: [],
          }
        ],
        clipContent: true,
      } as Component;

    default:
      return {
        ...base,
        type: "text",
        text: type,
      } as Component;
  }
}
