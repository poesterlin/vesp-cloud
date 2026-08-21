---
id: 01-research-tencoder-hardware
map: circular-display-support
title: Research — T-Encoder-Pro hardware facts
type: research
status: closed
assignee: ox-alpha (session of 2026-08-21)
blocked-by: []
blocks:
  - 03-grilling-device-profile-architecture
  - 07-grilling-firmware-assembly-refactor
---

## Question

What are the authoritative hardware facts for the LILYGO T-Encoder-Pro that a
device profile must capture?

## Resolution

All facts below verified against the official LilyGO repo README (pin table)
and cross-checked with the LilyGO product wiki and a working community
ESPHome config.

### MCU / memory

- ESP32-S3-**R8**: dual-core LX7 @240MHz, **16 MB flash**, **8 MB Octal-SPI PSRAM**
- ESPHome build requirements (community-proven; omitting these causes boot
  loops `rst:0x7 TG0WDT_SYS_RST`):
  - `esp32: board: esp32-s3-devkitc-1`, `flash_size: 16MB`, esp-idf framework
  - `esphome.platformio_options: board_build.flash_mode: dio`,
    `board_build.esp-idf.memory_type: qio_opi`
  - `psram: mode: octal, speed: 80MHz`

### Panel — TWO variants exist (important for device profiles)

| | Original | Latest revision |
|---|---|---|
| Panel model | DXQ120MYB2416A | TFD12MASBCTB4_V0_07 |
| Size/type | 2.04" round AMOLED | 2.04" round AMOLED |
| Display driver IC | **SH8601** | **CO5300** |
| Touch IC | **CHSC5816** | **CST816** |

Both: 390 × 390, QSPI display bus + I2C touch bus. A device profile likely
needs a `panel_variant` dimension or auto-detection; LilyGO ships different
factory firmware per variant.

### Pin map (from official README)

Screen (QSPI): SDIO0=IO11, SDIO1=IO13, SDIO2=IO7, SDIO3=IO14,
SCLK=IO12, CS=IO10, RST=IO4, **VCI EN (panel power enable)=IO3**

Touch (I2C): SDA=IO5, SCL=IO6, RST=IO8, INT=IO9

Rotary encoder: DATA A=IO1, DATA B=IO2, **KEY (push)=IO0**

Buzzer: IO17. Also on board: vibration motor, 2× QWIIC, USB-C.

### Strapping-pin notes

- Encoder push (**IO0**) is a boot-strapping pin: holding the knob during
  reset enters download mode (same pattern as a BOOT button).
- Panel power enable (**IO3**) is also a strapping pin (JTAG select);
  driving it as output at boot is standard practice but worth flagging.
- Flash-mode strapping interacts with the `dio` requirement above.

### Backlight / power path

AMOLED — there is no PWM backlight LED. Brightness is controlled via
driver commands (e.g. `0x51` brightness register, see init sequence) and
panel rail via VCI EN (IO3, `enable_pin`). The Guition profile's
LEDC-backlight `light:` block does NOT transfer; brightness handling differs
fundamentally.

### ESPHome support status (summary; deep dive lives in ticket 02)

- Display: community config uses `platform: qspi_dbi, model: CUSTOM` +
  explicit `init_sequence` (SH8601), works incl. `update_interval: never`
  + manual update (our dirty-rect pattern). No built-in SH8601/CO5300
  model. Note: `qspi_dbi` docs (2026.8.0) mark the component **deprecated
  in favor of `mipi_spi`**.
- Touch CHSC5816: not in stock ESPHome under that name; community external
  component `github://mvonweis/esphome-chsc5816` (tested vs ESPHome 2025.6,
  addr 0x2E, interrupt-driven). Stock `chsc6x` platform may cover it —
  unverified. Stock `cst816` platform covers the latest variant's touch.
- Rotary encoder: stock `sensor: rotary_encoder` (pin_a IO1, pin_b IO2)
  with `on_clockwise`/`on_anticlockwise`; push = plain `binary_sensor gpio`
  on IO0. Community-proven.

### Reference implementations

- Community full config (display+encoder+button):
  https://community.home-assistant.io/t/lilygo-t-encoder-pro-config-for-esp-home/811727
- CHSC5816 component + sample YAML:
  https://github.com/mvonweis/esphome-chsc5816
- Official repo (pin table, schematics PDFs, datasheets):
  https://github.com/Xinyuan-LilyGO/T-Encoder-Pro
- Product wiki (specs table):
  https://wiki.lilygo.cc/products/t-encoder-series/t-encoder-pro/
- esphome-docs PR discussing board + flash_mode gotcha:
  https://github.com/esphome/esphome-docs/pull/4082

### Unverified

- Whether stock `chsc6x` touchscreen platform drives the CHSC5816 (vs only
  CHSC63xx/65xx siblings) — needs a doc check in ticket 02.
- CO5300 init sequence for the latest panel variant (LilyGO Arduino_GFX
  sources would have it; no ready ESPHome YAML found).
- Detent count / pulse-per-detent of the encoder (resolution config may be
  needed on the `rotary_encoder` sensor).
