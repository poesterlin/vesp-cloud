#pragma once

// Optional device-side screenshot capture. Active only when the build
// is generated with SCREENSHOT_DEBUG_ENABLED (see codegen/esphome-yaml.ts
// and codegen/secrets.ts). When disabled, every public symbol compiles
// to a no-op so the include is harmless in production firmware.
//
// The capture flow:
//   1. The user calls `button.press` on `button.<device_name>_screenshot`
//      in Home Assistant.
//   2. The bound HA state subscription flips `g_screenshot_requested`
//      (atomic).
//   3. The 50 ms poll in esphome-yaml.ts calls `screenshot_task_notify()`.
//   4. A FreeRTOS task (pinned to core 1) reads the ST7701S framebuffer
//      and POSTs the raw RGB565 bytes in one chunk to
//      `screenshot_upload_url` via `esp_http_client` (IDF native).
//
// The patched st7701s component shipped at `components/st7701s` adds a
// `get_frame_buffer(void**)` method on a subclass. Without that patched
// component the include compiles but the runtime logs a warning.

#include "esphome.h"
#include "esphome/components/st7701s/st7701s.h"

#if defined(SCREENSHOT_DEBUG_ENABLED) && __has_include("st7701s_framebuffer.h")
#include "st7701s_framebuffer.h"
#define SCREENSHOT_FRAMEBUFFER_AVAILABLE 1
#else
#define SCREENSHOT_FRAMEBUFFER_AVAILABLE 0
#endif

#include <atomic>
#include <cstring>
#include <string>
#include <esp_http_client.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include <freertos/queue.h>

namespace screenshot_internal {

inline std::atomic<bool> g_requested{false};
inline std::atomic<bool> g_task_running{false};
inline TaskHandle_t g_task_handle = nullptr;
inline QueueHandle_t g_notify_queue = nullptr;

inline constexpr size_t kWidth = 480;
inline constexpr size_t kHeight = 480;
inline constexpr size_t kBytesPerPixel = 2;
inline constexpr size_t kFramebufferBytes = kWidth * kHeight * kBytesPerPixel;

inline const std::string &upload_url() {
  static const std::string url = std::string("${screenshot_upload_url}");
  return url;
}

inline bool post_screenshot(const uint8_t *data, size_t len) {
  char full_url[512];
  snprintf(full_url, sizeof(full_url), "%s",
           upload_url().c_str());

  esp_http_client_config_t config = {};
  config.url = full_url;
  config.method = HTTP_METHOD_POST;
  config.timeout_ms = 30000;

  esp_http_client_handle_t client = esp_http_client_init(&config);
  if (client == nullptr) {
    return false;
  }

  esp_http_client_set_header(client, "Content-Type", "application/octet-stream");
  esp_http_client_set_post_field(client,
      reinterpret_cast<const char *>(data), len);

  esp_err_t err = esp_http_client_perform(client);
  int code = esp_http_client_get_status_code(client);
  esp_http_client_cleanup(client);

  return err == ESP_OK && code >= 200 && code < 300;
}

inline void screenshot_task(void * /*arg*/) {
  static uint8_t *s_buffer = nullptr;
  if (s_buffer == nullptr) {
    s_buffer = static_cast<uint8_t *>(
        heap_caps_malloc(kFramebufferBytes,
                         MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  }
  if (s_buffer == nullptr) {
    s_buffer = static_cast<uint8_t *>(
        heap_caps_malloc(kFramebufferBytes,
                         MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT));
  }
  if (s_buffer == nullptr) {
    ESP_LOGE("screenshot", "no memory for %u byte framebuffer",
             (unsigned)kFramebufferBytes);
    g_task_running = false;
    vTaskDelete(nullptr);
    return;
  }

  uint32_t notify = 0;
  while (true) {
    if (xQueueReceive(g_notify_queue, &notify, portMAX_DELAY) != pdTRUE) {
      continue;
    }
    if (!g_requested.load()) continue;

    // Roughly sync to VSYNC. The framebuffer is always safe to read;
    // this is a best-effort delay, not a hard barrier.
    vTaskDelay(pdMS_TO_TICKS(33));

#if SCREENSHOT_FRAMEBUFFER_AVAILABLE
    esphome::st7701s::ST7701SWithFrameBuffer *panel = nullptr;
    panel = static_cast<esphome::st7701s::ST7701SWithFrameBuffer *>(
        static_cast<esphome::st7701s::ST7701S *>(&id(main_display)));
    void *fb = nullptr;
    if (panel == nullptr || panel->get_frame_buffer(&fb) != esphome::display::DISPLAY_OK) {
      ESP_LOGW("screenshot", "could not obtain frame buffer pointer");
      g_requested = false;
      continue;
    }
    if (fb == nullptr) {
      ESP_LOGW("screenshot", "frame buffer is null");
      g_requested = false;
      continue;
    }
    std::memcpy(s_buffer, fb, kFramebufferBytes);
#else
    ESP_LOGW("screenshot", "patched st7701s framebuffer not available; "
                           "ship components/st7701s via external_components");
    g_requested = false;
    continue;
#endif

    g_requested = false;

    ESP_LOGI("screenshot", "uploading %u bytes to %s",
             (unsigned)kFramebufferBytes, upload_url().c_str());

    if (post_screenshot(s_buffer, kFramebufferBytes)) {
      ESP_LOGI("screenshot", "upload succeeded");
    } else {
      ESP_LOGE("screenshot", "upload failed");
    }
  }
}

}  // namespace screenshot_internal

inline bool is_screenshot_debug_enabled() {
#ifdef SCREENSHOT_DEBUG_ENABLED
  return true;
#else
  return false;
#endif
}

inline void screenshot_task_notify() {
  if (!is_screenshot_debug_enabled()) return;
  if (!screenshot_internal::g_task_running.load()) return;
  uint32_t payload = 1;
  xQueueSend(screenshot_internal::g_notify_queue, &payload, 0);
}

inline void request_screenshot() {
  if (!is_screenshot_debug_enabled()) return;
  screenshot_internal::g_requested.store(true);
  ESP_LOGD("screenshot", "screenshot requested");
}

inline void screenshot_setup() {
#ifdef SCREENSHOT_DEBUG_ENABLED
  if (screenshot_internal::g_task_running.load()) return;

  if (screenshot_internal::g_notify_queue == nullptr) {
    screenshot_internal::g_notify_queue = xQueueCreate(4, sizeof(uint32_t));
  }

  xTaskCreatePinnedToCore(
      screenshot_internal::screenshot_task,
      "screenshot",
      8192,
      nullptr,
      1,
      &screenshot_internal::g_task_handle,
      1);
  screenshot_internal::g_task_running.store(true);
  ESP_LOGI("screenshot", "screenshot task started");
#endif
}
