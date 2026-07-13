import type { Component, EntityBinding } from "@vesp-cloud/schema";
import type { Entity } from "@vesp-cloud/schema/homeassistant";
import {
  mdiAccountOutline, mdiCalendarMonth, mdiCameraOutline, mdiChartBoxOutline,
  mdiCubeOutline, mdiFan, mdiFormatListBulleted, mdiGestureTapButton,
  mdiImageOutline, mdiLightbulbOutline, mdiLockOutline, mdiMovieOpenOutline,
  mdiNumeric, mdiPowerPlug, mdiRobot, mdiRobotVacuum, mdiScriptTextOutline,
  mdiSpeaker, mdiThermometer, mdiToggleSwitchOffOutline, mdiUpdate,
  mdiWeatherPartlyCloudy, mdiWhiteBalanceSunny, mdiWindowShutter,
} from "@mdi/js";

export type PickerComponent = Component | {
  type?: string;
  textBinding?: EntityBinding;
  valueBinding?: EntityBinding;
  stateBinding?: EntityBinding;
  entityBinding?: EntityBinding;
  itemsBinding?: EntityBinding;
  imageBinding?: EntityBinding;
  targetDevice?: { deviceId?: string; deviceName?: string };
};

export function getComponentBinding(component: PickerComponent): EntityBinding | undefined {
  switch (component.type) {
    case "text": return component.textBinding;
    case "procedural_icon": case "light_state": case "hvac": case "weather":
      return component.stateBinding;
    case "calendar": return component.entityBinding;
    case "todo_list": return component.itemsBinding;
    case "image": return component.imageBinding;
    case "slider": case "gauge": case "range_slider": return component.valueBinding;
    default: return undefined;
  }
}

const domainLabels: Record<string, string> = {
  sensor: "Sensors", binary_sensor: "Binary Sensors", switch: "Switches", light: "Lights",
  climate: "Climate", cover: "Covers & Blinds", media_player: "Media Players", camera: "Cameras",
  image: "Images", vacuum: "Vacuums", fan: "Fans", lock: "Locks", input_boolean: "Toggles",
  input_number: "Numbers", input_select: "Selections", person: "People", weather: "Weather",
  calendar: "Calendar", sun: "Sun", automation: "Automations", script: "Scripts", scene: "Scenes",
  button: "Buttons", update: "Updates", number: "Numbers", select: "Selects",
};

const domainIcons: Record<string, string> = {
  sensor: mdiChartBoxOutline, binary_sensor: mdiToggleSwitchOffOutline, switch: mdiPowerPlug,
  light: mdiLightbulbOutline, climate: mdiThermometer, cover: mdiWindowShutter,
  media_player: mdiSpeaker, camera: mdiCameraOutline, image: mdiImageOutline,
  vacuum: mdiRobotVacuum, fan: mdiFan, lock: mdiLockOutline, input_boolean: mdiToggleSwitchOffOutline,
  input_number: mdiNumeric, input_select: mdiFormatListBulleted, person: mdiAccountOutline,
  weather: mdiWeatherPartlyCloudy, calendar: mdiCalendarMonth, sun: mdiWhiteBalanceSunny,
  automation: mdiRobot, script: mdiScriptTextOutline, scene: mdiMovieOpenOutline,
  button: mdiGestureTapButton, update: mdiUpdate, number: mdiNumeric, select: mdiFormatListBulleted,
};

export function getDomainLabel(domain: string): string {
  return domainLabels[domain] ?? domain.charAt(0).toUpperCase() + domain.slice(1).replace(/_/g, " ");
}
export function getDomainIcon(domain: string): string { return domainIcons[domain] ?? mdiCubeOutline; }
export function getDisplayName(entity: Entity): string {
  if (entity.name && !isIsoDate(entity.name)) return entity.name;
  return entity.entity_id.split(".")[1]?.replace(/_/g, " ") ?? entity.entity_id;
}
export function getStateDisplay(entity: Entity): string {
  if (entity.numeric_state !== undefined && entity.unit) return `${entity.numeric_state}${entity.unit}`;
  const state = entity.state.trim().toLowerCase();
  return isIsoDate(entity.state) || ["unknown", "unavailable", "unavaliable"].includes(state) ? "" : entity.state;
}
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}
function isIsoDate(value: string): boolean { return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value); }

const commonAttributes: Record<string, string[]> = {
  sensor: ["state", "unit_of_measurement", "device_class"],
  climate: ["temperature", "current_temperature", "hvac_action", "humidity"],
  media_player: ["media_title", "media_artist", "volume_level", "source"],
  weather: ["temperature", "dew_point", "humidity", "cloud_coverage", "uv_index", "pressure", "wind_bearing", "wind_speed", "forecast"],
  light: ["brightness", "color_temp", "rgb_color"], cover: ["current_position", "current_tilt_position"],
};
export function getEntityAttributes(entity: Entity): string[] {
  return [...new Set([...(entity.attributes ?? []), ...(commonAttributes[entity.domain] ?? [])])].sort();
}
