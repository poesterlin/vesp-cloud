import type { Component } from "@esphome-designer/schema";

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

    case "button":
      return {
        ...base,
        type: "button",
        label: "Button",
        size: { width: 80, height: 36 },
      } as Component;

    case "slider":
      return {
        ...base,
        type: "slider",
        min: 0,
        max: 100,
        step: 1,
        orientation: "horizontal",
        size: { width: 120, height: 24 },
      } as Component;

    case "gauge":
      return {
        ...base,
        type: "gauge",
        min: 0,
        max: 100,
        size: { width: 80, height: 80 },
      } as Component;

    case "icon":
      return {
        ...base,
        type: "icon",
        icon: "home",
        size: { width: 32, height: 32 },
        scale: 1,
      } as Component;

    case "procedural_icon":
      return {
        ...base,
        type: "procedural_icon",
        iconType: "bulb",
        size: { width: 32, height: 32 },
      } as Component;

    case "container":
      return {
        ...base,
        type: "container",
        label: "Container",
        size: { width: 100, height: 60 },
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

    case "auto_layout_list":
      return {
        ...base,
        type: "auto_layout_list",
        size: { width: 140, height: 32 },
        direction: "horizontal",
        gap: 6,
        padding: 0,
        crossAxisAlign: "center",
        mainAxisJustify: "start",
        itemSizeMode: "content",
        items: [
          {
            id: `auto-layout-item-${Date.now()}`,
            name: "Item 1",
            icon: "home",
            scale: 1,
          },
          {
            id: `auto-layout-item-${Date.now()}-2`,
            name: "Item 2",
            icon: "flash",
            scale: 1,
          },
        ],
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
