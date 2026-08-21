import type { Project } from "@vesp-cloud/schema";

/**
 * Device profile registry.
 *
 * Single source of truth for target-board facts (see
 * docs/wayfinder/circular-display-support/tickets/03 and 07):
 *  - The typed header (everything except `hardwareYaml`) is consumed by
 *    the editor (canvas mask, device picker, chrome gating) AND by the
 *    codegen (touch/encoder emission, capability gating).
 *  - `hardwareYaml` is the raw ESPHome fragment emitted verbatim as
 *    `hardware.yaml` into the firmware bundle. It owns every
 *    device-flavored top-level key (i2c/spi/output/light/display, plus
 *    per-board `ota:` automation hooks and build overrides) so that
 *    `base.yaml` stays device-neutral and no key is ever defined by two
 *    packages unless list-merging is already proven (esphome.on_boot).
 *
 * Id contract: every profile's display entity MUST be `main_display`;
 * a touch I2C bus (when present) MUST be `touch_i2c`.
 */

export type DeviceShape = "rect" | "circle";

export type TouchPlatform = "gt911" | "chsc5816" | "cst816";

export interface DeviceTouchConfig {
  platform: TouchPlatform;
  /** I2C bus id defined in this profile's hardwareYaml. */
  i2cId: string;
  updateIntervalMs?: number;
  resetPin?: number;
  interruptPin?: number;
  /** I2C register address (omit when the platform auto-detects). */
  address?: number;
}

export interface DeviceEncoderConfig {
  pinA: number;
  pinB: number;
  push: number;
}

export interface DeviceProfile {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
  shape: DeviceShape;
  hasEncoder: boolean;
  encoder?: DeviceEncoderConfig;
  touch: DeviceTouchConfig;
  /** Screenshot support requires a framebuffer-patchable display driver. */
  supportsScreenshot: boolean;
  /**
   * Whether the profile defines a `display_backlight` light entity that
   * generated automations (e.g. OTA hooks) may reference.
   */
  hasBacklightLight: boolean;
  /**
   * Raw ESPHome YAML fragment written to the bundle as hardware.yaml.
   * Must define `main_display`; must not rely on keys owned by base.yaml.
   */
  hardwareYaml: string;
}

export const DEFAULT_DEVICE_ID = "guition-esp32-s3-4848s040";

const guitionHardwareYaml = /* yaml */ `# Hardware configuration for Guition ESP32-S3-4848S040
# 4.0" 480x480 ST7701S RGB display + GT911 touch (no LVGL)

i2c:
  id: touch_i2c
  frequency: 400kHz
  sda: GPIO19
  scl:
    number: GPIO45
    ignore_strapping_warning: true

spi:
  id: lcd_spi
  clk_pin: GPIO48
  mosi_pin: GPIO47

output:
  - platform: ledc
    pin: GPIO38
    frequency: 150Hz
    id: backlight_pwm
    min_power: 0.01
    zero_means_zero: true

light:
  - platform: monochromatic
    output: backlight_pwm
    name: "Display Backlight"
    id: display_backlight
    restore_mode: ALWAYS_ON
    default_transition_length: 1s
    initial_state:
      brightness: 100%

display:
  - platform: st7701s
    id: main_display
    dimensions:
      width: 480
      height: 480
    spi_mode: MODE3
    data_rate: 10MHz
    color_order: RGB
    invert_colors: false
    cs_pin: 39
    de_pin: 18
    hsync_pin: 16
    vsync_pin: 17
    pclk_pin: 21
    # PSRAM bus is over-subscribed at higher pclks on this board: the
    # RGB DMA streams the framebuffer from PSRAM continuously while the
    # CPU also reads PSRAM (font glyphs, fill buffer) and writes to it
    # (framebuffer updates). When bandwidth saturates, the LCD bounce
    # buffer underruns -- visible as flickering pixels in fixed regions
    # and, more rarely, as cache-disable panics. Lower pclk = more
    # per-scanline slack. 6 MHz (~25 Hz refresh) was the lowest setting
    # we found necessary on the Guition ESP32-S3-4848S040; higher
    # values produced visible artifacts even on a near-empty UI.
    pclk_frequency: 6MHz
    pclk_inverted: false
    hsync_pulse_width: 8
    hsync_front_porch: 10
    hsync_back_porch: 20
    vsync_pulse_width: 8
    vsync_front_porch: 10
    vsync_back_porch: 10
    update_interval: never
    auto_clear_enabled: false
    init_sequence:
      # Software reset. Without this, OTA reboots leave the panel's internal
      # scan counter running from before the reboot; the re-init lands at an
      # arbitrary line offset and the top ~10 rows wrap to the bottom.
      # Power-cycling (cable flash) hides this because the panel loses power
      # and its counter starts at 0.
      - [0x01]
      - delay 120ms
      - [0xFF, 0x77, 0x01, 0x00, 0x00, 0x10]
      - [0xC0, 0x3B, 0x00]
      - [0xC1, 0x0D, 0x02]
      - [0xC2, 0x31, 0x05]
      - [0xCD, 0x00]
      - [0xB0, 0x00, 0x11, 0x18, 0x0E, 0x11, 0x06, 0x07, 0x08, 0x07, 0x22, 0x04, 0x12, 0x0F, 0xAA, 0x31, 0x18]
      - [0xB1, 0x00, 0x11, 0x19, 0x0E, 0x12, 0x07, 0x08, 0x08, 0x08, 0x22, 0x04, 0x11, 0x11, 0xA9, 0x32, 0x18]
      - [0xFF, 0x77, 0x01, 0x00, 0x00, 0x11]
      - [0xB0, 0x60]
      - [0xB1, 0x32]
      - [0xB2, 0x07]
      - [0xB3, 0x80]
      - [0xB5, 0x49]
      - [0xB7, 0x85]
      - [0xB8, 0x21]
      - [0xC1, 0x78]
      - [0xC2, 0x78]
      - [0xE0, 0x00, 0x1B, 0x02]
      - [0xE1, 0x08, 0xA0, 0x00, 0x00, 0x07, 0xA0, 0x00, 0x00, 0x00, 0x44, 0x44]
      - [0xE2, 0x11, 0x11, 0x44, 0x44, 0xED, 0xA0, 0x00, 0x00, 0xEC, 0xA0, 0x00, 0x00]
      - [0xE3, 0x00, 0x00, 0x11, 0x11]
      - [0xE4, 0x44, 0x44]
      - [0xE5, 0x0A, 0xE9, 0xD8, 0xA0, 0x0C, 0xEB, 0xD8, 0xA0, 0x0E, 0xED, 0xD8, 0xA0, 0x10, 0xEF, 0xD8, 0xA0]
      - [0xE6, 0x00, 0x00, 0x11, 0x11]
      - [0xE7, 0x44, 0x44]
      - [0xE8, 0x09, 0xE8, 0xD8, 0xA0, 0x0B, 0xEA, 0xD8, 0xA0, 0x0D, 0xEC, 0xD8, 0xA0, 0x0F, 0xEE, 0xD8, 0xA0]
      - [0xEB, 0x02, 0x00, 0xE4, 0xE4, 0x88, 0x00, 0x40]
      - [0xEC, 0x3C, 0x00]
      - [0xED, 0xAB, 0x89, 0x76, 0x54, 0x02, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0x20, 0x45, 0x67, 0x98, 0xBA]
      - [0xFF, 0x77, 0x01, 0x00, 0x00, 0x13]
      - [0xE5, 0xE4]
      - [0xFF, 0x77, 0x01, 0x00, 0x00, 0x00]
      - [0x3A, 0x60]
      - delay 10ms
      - [0x11]
      - delay 120ms
      - [0x29]
    data_pins:
      red: [11, 12, 13, 14, 0]
      green: [8, 20, 3, 46, 9, 10]
      blue: [4, 5, 6, 7, 15]
    lambda: |-
      render_basic_ui(it);

ota:
  - platform: esphome
    on_begin:
      then:
        - light.turn_off: display_backlight
    on_error:
      then:
        - light.turn_on:
            id: display_backlight
            brightness: 100%

esphome:
  on_boot:
    - priority: 800
      then:
        - light.turn_on:
            id: display_backlight
            brightness: 100%
`;

const tEncoderProHardwareYaml = /* yaml */ `# Hardware configuration for LILYGO T-Encoder-Pro
# 2.04" 390x390 round QSPI AMOLED (SH8601 panel revision) + CHSC5816 touch
# + rotary encoder. No PWM backlight: AMOLED brightness is driven through
# the panel's brightness register (0x51 in the init sequence below).
# NOTE: the mipi_spi brightness option is newer than the ESPHome version
# pinned in the compile worker, so the init-sequence register is the only
# brightness path we rely on.
#
# Build requirements (board boot-loops without these):
#   flash_mode: dio + memory_type: qio_opi + octal PSRAM (set in base.yaml)
#
# Reference: https://github.com/Xinyuan-LilyGO/T-Encoder-Pro (pin table),
# community-proven config at https://community.home-assistant.io/t/
# lilygo-t-encoder-pro-config-for-esp-home/811727

i2c:
  id: touch_i2c
  frequency: 400kHz
  sda: GPIO5
  scl: GPIO6

spi:
  id: display_qspi
  type: quad
  clk_pin: GPIO12
  data_pins: [GPIO11, GPIO13, GPIO7, GPIO14]

esphome:
  platformio_options:
    board_build.flash_mode: dio
    board_build.esp-idf.memory_type: qio_opi

esp32:
  flash_size: 16MB

display:
  - platform: mipi_spi
    model: CUSTOM
    id: main_display
    bus_mode: quad
    data_rate: 80MHz
    dimensions:
      width: 390
      height: 390
    cs_pin: GPIO10
    reset_pin: GPIO4
    # VCI EN (panel rail). IO3 is a strapping pin; driving it as an
    # explicit enable output is how the board ships.
    enable_pin:
      number: GPIO3
      ignore_strapping_warning: true
    color_order: rgb
    invert_colors: false
    # SH8601 is not a built-in model: CUSTOM + full init sequence.
    # Software rotation only -- do not let the driver guess MADCTL.
    transform: disabled
    # Full-framebuffer buffer so render_basic_ui() sees whole frames
    # (sub-100% buffers chunk the drawing lambda per band).
    buffer_size: 100%
    update_interval: never
    auto_clear_enabled: false
    init_sequence:
      - [0x01]
      - delay 200ms
      - [0x11]
      - delay 120ms
      - [0x13]
      - [0x20]
      # NOTE: no PIXFMT (0x3A) here -- the mipi_spi driver sets pixel
      # format itself and rejects it in custom init sequences.
      - [0x29]
      - [0x53, 0x28]
      - [0x51, 0xD0]
      - [0x58, 0x00]
      - delay 10ms
    lambda: |-
      render_basic_ui(it);

ota:
  - platform: esphome
`;

export const DEVICE_PROFILES: DeviceProfile[] = [
  {
    id: DEFAULT_DEVICE_ID,
    label: "Guition ESP32-S3-4848S040",
    description: "4\" 480 × 480 square RGB (ST7701S + GT911 touch)",
    width: 480,
    height: 480,
    shape: "rect",
    hasEncoder: false,
    touch: {
      platform: "gt911",
      i2cId: "touch_i2c",
      updateIntervalMs: 16,
    },
    supportsScreenshot: true,
    hasBacklightLight: true,
    hardwareYaml: guitionHardwareYaml,
  },
  {
    id: "lilygo-t-encoder-pro",
    label: "LILYGO T-Encoder-Pro",
    description: "2.04\" 390 × 390 round AMOLED + rotary encoder",
    width: 390,
    height: 390,
    shape: "circle",
    hasEncoder: true,
    encoder: { pinA: 1, pinB: 2, push: 0 },
    touch: {
      platform: "chsc5816",
      i2cId: "touch_i2c",
      resetPin: 8,
      interruptPin: 9,
      address: 0x2e,
    },
    supportsScreenshot: false,
    hasBacklightLight: false,
    hardwareYaml: tEncoderProHardwareYaml,
  },
];

const profileById = new Map(DEVICE_PROFILES.map((p) => [p.id, p]));

export function getDeviceProfile(id: string | undefined | null): DeviceProfile {
  if (id) {
    const found = profileById.get(id);
    if (found) return found;
  }
  return profileById.get(DEFAULT_DEVICE_ID)!;
}

export function tryGetDeviceProfile(
  id: string | undefined | null,
): DeviceProfile | undefined {
  return id ? profileById.get(id) : undefined;
}

/** Resolve the profile a project targets, defaulting when absent. */
export function resolveProjectDeviceProfile(project: Project): DeviceProfile {
  return getDeviceProfile(project.device);
}

/**
 * The raw ESPHome fragment for the project's device, emitted into the
 * firmware bundle as `hardware.yaml`.
 */
export function generateHardwareYAML(project: Project): string {
  const profile = resolveProjectDeviceProfile(project);
  return `${profile.hardwareYaml.trimEnd()}\n`;
}

/**
 * Generated screen-dimension constants consumed by the C++ template
 * headers (ui_config.h). Replaces the historical hardcoded 480x480 so
 * template layout code follows the active device profile.
 */
export function generateUIConfigHeader(project: Project): string {
  const profile = resolveProjectDeviceProfile(project);
  return `#pragma once

// AUTO-GENERATED by the vESP.cloud codegen -- do not edit.
// Screen geometry for device profile "${profile.id}" (${profile.label}).

#define UI_SCREEN_WIDTH ${profile.width}
#define UI_SCREEN_HEIGHT ${profile.height}

constexpr int kUiScreenWidth = UI_SCREEN_WIDTH;
constexpr int kUiScreenHeight = UI_SCREEN_HEIGHT;
`;
}
