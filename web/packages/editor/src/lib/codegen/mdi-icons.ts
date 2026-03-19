/**
 * Material Design Icons (MDI) codepoint mapping
 * 
 * Maps icon names (without mdi: prefix) to their Unicode codepoints.
 * Codepoints from: https://pictogrammers.com/library/mdi/
 * 
 * To use in LVGL YAML: prefix codepoint with \U000
 * e.g., F0335 → \U000F0335
 */

export const MDI_ICONS: Record<string, string> = {
  // Lighting
  "lightbulb": "F0335",
  "lightbulb-outline": "F0336",
  "lightbulb-off": "F0E4F",
  "lightbulb-off-outline": "F0E50",
  "lightbulb-group": "F1253",
  "lamp": "F06B5",
  "ceiling-light": "F0769",
  "floor-lamp": "F08DD",
  "desk-lamp": "F095F",
  "led-strip": "F07D6",
  "led-strip-variant": "F1051",
  "string-lights": "F12BA",
  
  // Power & Switches
  "power": "F0425",
  "power-off": "F0901",
  "power-on": "F0902",
  "power-plug": "F06A5",
  "power-plug-off": "F06A6",
  "power-socket": "F07E4",
  "toggle-switch": "F0521",
  "toggle-switch-off": "F0522",
  
  // Climate & Temperature
  "thermometer": "F050F",
  "thermometer-high": "F10C2",
  "thermometer-low": "F10C3",
  "thermometer-lines": "F0510",
  "temperature-celsius": "F0504",
  "temperature-fahrenheit": "F0505",
  "snowflake": "F0717",
  "fire": "F0238",
  "fan": "F0210",
  "fan-off": "F081D",
  "air-conditioner": "F0011",
  "hvac": "F1352",
  "heating-coil": "F1AAF",
  "heat-wave": "F1533",
  
  // Sensors
  "motion-sensor": "F0D91",
  "motion-sensor-off": "F1435",
  "door-open": "F081F",
  "door-closed": "F081C",
  "door": "F081E",
  "window-open": "F0824",
  "window-closed": "F0823",
  "window-shutter": "F111C",
  "window-shutter-open": "F111E",
  "garage": "F06D9",
  "garage-open": "F06DB",
  "water": "F058C",
  "water-alert": "F1502",
  "water-off": "F058E",
  "smoke-detector": "F0392",
  "smoke-detector-alert": "F192E",
  "leak": "F0DD7",
  
  // Media
  "play": "F040A",
  "play-circle": "F040B",
  "play-circle-outline": "F040C",
  "play-pause": "F040E",
  "pause": "F03E4",
  "pause-circle": "F03E5",
  "pause-circle-outline": "F03E6",
  "stop": "F04DB",
  "stop-circle": "F0666",
  "stop-circle-outline": "F0667",
  "skip-next": "F04AD",
  "skip-next-circle": "F0661",
  "skip-previous": "F04AE",
  "skip-previous-circle": "F0663",
  "fast-forward": "F0211",
  "rewind": "F045F",
  "shuffle": "F049D",
  "shuffle-disabled": "F049E",
  "repeat": "F0456",
  "repeat-off": "F0457",
  "repeat-once": "F0458",
  "volume-high": "F057E",
  "volume-low": "F057F",
  "volume-medium": "F0580",
  "volume-off": "F0581",
  "volume-mute": "F075F",
  "volume-plus": "F075D",
  "volume-minus": "F075E",
  "speaker": "F04C3",
  "speaker-off": "F04C4",
  "television": "F0502",
  "television-off": "F083F",
  "cast": "F00EC",
  "cast-off": "F078A",
  "cast-connected": "F00ED",
  "music": "F075A",
  "music-note": "F0387",
  "playlist-music": "F0CB8",
  "playlist-play": "F0412",
  
  // Security
  "lock": "F033E",
  "lock-open": "F033F",
  "lock-outline": "F0341",
  "lock-open-outline": "F0340",
  "shield": "F0498",
  "shield-home": "F068A",
  "shield-lock": "F099D",
  "shield-off": "F099E",
  "alarm-light": "F078E",
  "bell": "F009A",
  "bell-off": "F009C",
  "bell-ring": "F009D",
  "cctv": "F07AE",
  "video": "F0567",
  "video-off": "F0568",
  
  // Weather
  "weather-sunny": "F0599",
  "weather-cloudy": "F0590",
  "weather-partly-cloudy": "F0595",
  "weather-rainy": "F0597",
  "weather-snowy": "F0598",
  "weather-windy": "F059D",
  "weather-fog": "F0591",
  "weather-night": "F0594",
  "umbrella": "F0576",
  
  // Home
  "home": "F02DC",
  "home-outline": "F06A1",
  "home-assistant": "F07D0",
  "sofa": "F04B9",
  "bed": "F02E3",
  "bed-outline": "F0099",
  "shower": "F09A1",
  "toilet": "F09AB",
  "washing-machine": "F072A",
  "dishwasher": "F01D4",
  "fridge": "F0290",
  "stove": "F04DF",
  "microwave": "F0C99",
  "coffee-maker": "F109F",
  "vacuum": "F19A1",
  "robot-vacuum": "F070D",
  
  // Navigation
  "arrow-left": "F004D",
  "arrow-right": "F0054",
  "arrow-up": "F005D",
  "arrow-down": "F0045",
  "chevron-left": "F0141",
  "chevron-right": "F0142",
  "chevron-up": "F0143",
  "chevron-down": "F0140",
  "menu": "F035C",
  "close": "F0156",
  "check": "F012C",
  "plus": "F0415",
  "minus": "F0374",
  "refresh": "F0450",
  "cog": "F0493",
  "dots-vertical": "F01D9",
  "dots-horizontal": "F01D8",
  
  // Battery
  "battery": "F007A",
  "battery-outline": "F007C",
  "battery-10": "F007B",
  "battery-20": "F007D",
  "battery-30": "F007E",
  "battery-40": "F007F",
  "battery-50": "F0080",
  "battery-60": "F0081",
  "battery-70": "F0082",
  "battery-80": "F0083",
  "battery-90": "F0084",
  "battery-charging": "F0085",
  "battery-alert": "F0079",
  
  // Connectivity
  "wifi": "F05A9",
  "wifi-off": "F05AA",
  "wifi-strength-1": "F091F",
  "wifi-strength-2": "F0922",
  "wifi-strength-3": "F0925",
  "wifi-strength-4": "F0928",
  "bluetooth": "F00AF",
  "bluetooth-off": "F00B2",
  "ethernet": "F0200",
  "access-point": "F0003",
  "signal": "F0496",
  "signal-off": "F0782",
  
  // Time
  "clock": "F0954",
  "clock-outline": "F0150",
  "timer": "F13AB",
  "timer-outline": "F051B",
  "alarm": "F0020",
  "calendar": "F00ED",
  "calendar-today": "F0F42",
  
  // Misc
  "information": "F02FC",
  "information-outline": "F02FD",
  "alert": "F0026",
  "alert-circle": "F0027",
  "alert-outline": "F0CE3",
  "help-circle": "F02D7",
  "help-circle-outline": "F0625",
  "eye": "F0208",
  "eye-off": "F0209",
  "brightness-5": "F00DA",
  "brightness-6": "F00DB",
  "brightness-7": "F00DC",
  "white-balance-sunny": "F05A8",
  "flash": "F0241",
  "flash-off": "F0242",
  "energy": "F1904",
  "chart-line": "F0128",
  "gauge": "F029A",
  "speedometer": "F04C5",
  "counter": "F0199",
};

/**
 * Get the LVGL-compatible Unicode escape sequence for an MDI icon
 * @param iconName - Icon name with or without 'mdi:' prefix
 * @returns Unicode escape string like '\U000F0335' or null if not found
 */
export function getMdiCodepoint(iconName: string): string | null {
  // Remove mdi: prefix if present
  const name = iconName.replace(/^mdi:/, "");
  const codepoint = MDI_ICONS[name];
  
  if (!codepoint) {
    return null;
  }
  
  return `\\U000${codepoint}`;
}

/**
 * Get all icons used in a project with their codepoints
 * @param iconNames - Set of icon names used in the project
 * @returns Map of icon names to their codepoints (only found icons)
 */
export function getIconGlyphs(iconNames: Set<string>): Map<string, string> {
  const glyphs = new Map<string, string>();
  
  for (const iconName of iconNames) {
    const name = iconName.replace(/^mdi:/, "");
    const codepoint = MDI_ICONS[name];
    if (codepoint) {
      glyphs.set(name, `\\U000${codepoint}`);
    }
  }
  
  return glyphs;
}

/**
 * Generate YAML font configuration for icons
 * @param iconNames - Set of icon names used in the project  
 * @param fontSize - Size for the icon font (default 24)
 * @returns YAML lines for font configuration
 */
export function generateIconFontYAML(iconNames: Set<string>, fontSize: number = 24): string[] {
  const lines: string[] = [];
  const glyphs = getIconGlyphs(iconNames);
  
  if (glyphs.size === 0) {
    return lines;
  }
  
  lines.push(`  - file: "https://github.com/Templarian/MaterialDesign-Webfont/raw/master/fonts/materialdesignicons-webfont.ttf"`);
  lines.push(`    id: mdi_icons_${fontSize}`);
  lines.push(`    size: ${fontSize}`);
  lines.push(`    glyphs:`);
  
  for (const [name, codepoint] of glyphs) {
    lines.push(`      - "${codepoint}"  # ${name}`);
  }
  
  return lines;
}
