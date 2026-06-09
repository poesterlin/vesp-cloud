/**
 * Home Assistant service presets with suggested parameters
 */

export interface SuggestedParam {
  key: string;
  type: "string" | "number" | "boolean";
  label: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface ServicePreset {
  label: string;
  domain: string;
  suggestedParams: SuggestedParam[];
}

export const SERVICE_PRESETS: Record<string, ServicePreset> = {
  "light.turn_on": {
    label: "Light: Turn On",
    domain: "light",
    suggestedParams: [
      { key: "brightness", type: "number", label: "Brightness", min: 0, max: 255 },
      { key: "color_temp", type: "number", label: "Color Temp", min: 153, max: 500 },
      { key: "transition", type: "number", label: "Transition (sec)" },
    ],
  },
  "light.turn_off": {
    label: "Light: Turn Off",
    domain: "light",
    suggestedParams: [
      { key: "transition", type: "number", label: "Transition (sec)" },
    ],
  },
  "light.toggle": {
    label: "Light: Toggle",
    domain: "light",
    suggestedParams: [],
  },
  "switch.turn_on": {
    label: "Switch: Turn On",
    domain: "switch",
    suggestedParams: [],
  },
  "switch.turn_off": {
    label: "Switch: Turn Off",
    domain: "switch",
    suggestedParams: [],
  },
  "switch.toggle": {
    label: "Switch: Toggle",
    domain: "switch",
    suggestedParams: [],
  },
  "climate.set_temperature": {
    label: "Climate: Set Temperature",
    domain: "climate",
    suggestedParams: [
      { key: "temperature", type: "number", label: "Temperature" },
      { key: "target_temp_high", type: "number", label: "High Temp" },
      { key: "target_temp_low", type: "number", label: "Low Temp" },
    ],
  },
  "climate.set_hvac_mode": {
    label: "Climate: Set Mode",
    domain: "climate",
    suggestedParams: [
      { key: "hvac_mode", type: "string", label: "HVAC Mode" },
    ],
  },
  "cover.open_cover": {
    label: "Cover: Open",
    domain: "cover",
    suggestedParams: [],
  },
  "cover.close_cover": {
    label: "Cover: Close",
    domain: "cover",
    suggestedParams: [],
  },
  "cover.stop_cover": {
    label: "Cover: Stop",
    domain: "cover",
    suggestedParams: [],
  },
  "cover.set_cover_position": {
    label: "Cover: Set Position",
    domain: "cover",
    suggestedParams: [
      { key: "position", type: "number", label: "Position", min: 0, max: 100 },
    ],
  },
  "media_player.volume_set": {
    label: "Media: Set Volume",
    domain: "media_player",
    suggestedParams: [
      { key: "volume_level", type: "number", label: "Volume", min: 0, max: 1, step: 0.1 },
    ],
  },
  "media_player.media_play_pause": {
    label: "Media: Play/Pause",
    domain: "media_player",
    suggestedParams: [],
  },
  "media_player.media_next_track": {
    label: "Media: Next Track",
    domain: "media_player",
    suggestedParams: [],
  },
  "media_player.media_previous_track": {
    label: "Media: Previous Track",
    domain: "media_player",
    suggestedParams: [],
  },
  "fan.turn_on": {
    label: "Fan: Turn On",
    domain: "fan",
    suggestedParams: [
      { key: "percentage", type: "number", label: "Speed %", min: 0, max: 100 },
    ],
  },
  "fan.turn_off": {
    label: "Fan: Turn Off",
    domain: "fan",
    suggestedParams: [],
  },
  "fan.toggle": {
    label: "Fan: Toggle",
    domain: "fan",
    suggestedParams: [],
  },
  "script.turn_on": {
    label: "Script: Run",
    domain: "script",
    suggestedParams: [],
  },
  "automation.trigger": {
    label: "Automation: Trigger",
    domain: "automation",
    suggestedParams: [],
  },
  "scene.turn_on": {
    label: "Scene: Activate",
    domain: "scene",
    suggestedParams: [],
  },
  "input_boolean.turn_on": {
    label: "Input Boolean: On",
    domain: "input_boolean",
    suggestedParams: [],
  },
  "input_boolean.turn_off": {
    label: "Input Boolean: Off",
    domain: "input_boolean",
    suggestedParams: [],
  },
  "input_boolean.toggle": {
    label: "Input Boolean: Toggle",
    domain: "input_boolean",
    suggestedParams: [],
  },
  "input_number.set_value": {
    label: "Input Number: Set",
    domain: "input_number",
    suggestedParams: [
      { key: "value", type: "number", label: "Value" },
    ],
  },
  "lock.lock": {
    label: "Lock: Lock",
    domain: "lock",
    suggestedParams: [],
  },
  "lock.unlock": {
    label: "Lock: Unlock",
    domain: "lock",
    suggestedParams: [],
  },
};

/**
 * Get grouped services by domain for dropdown display
 */
export function getServicesByDomain(): Map<string, Array<{ service: string; preset: ServicePreset }>> {
  const grouped = new Map<string, Array<{ service: string; preset: ServicePreset }>>();

  for (const [service, preset] of Object.entries(SERVICE_PRESETS)) {
    const domain = preset.domain;
    if (!grouped.has(domain)) {
      grouped.set(domain, []);
    }
    grouped.get(domain)!.push({ service, preset });
  }

  return grouped;
}

/**
 * Domain display names for UI
 */
export const DOMAIN_LABELS: Record<string, string> = {
  light: "Lights",
  switch: "Switches",
  climate: "Climate",
  cover: "Covers",
  media_player: "Media Players",
  fan: "Fans",
  script: "Scripts",
  automation: "Automations",
  scene: "Scenes",
  input_boolean: "Input Booleans",
  input_number: "Input Numbers",
  lock: "Locks",
};

/**
 * Format a raw domain key into a consistent display label.
 * Uses DOMAIN_LABELS for known domains, otherwise converts snake_case to Title Case.
 */
export function getDomainLabel(domain: string): string {
  if (DOMAIN_LABELS[domain]) return DOMAIN_LABELS[domain];
  return domain
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
