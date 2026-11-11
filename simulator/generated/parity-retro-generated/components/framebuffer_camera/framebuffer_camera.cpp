#include "framebuffer_camera.h"

#include <cstring>
#include <esp_err.h>
#include <esp_heap_caps.h>
#include <esp_lcd_panel_rgb.h>

#include "esphome/core/application.h"
#include "esphome/core/hal.h"
#include "esphome/core/log.h"

namespace esphome::framebuffer_camera {

static const char *const TAG = "framebuffer_camera";

void FramebufferCamera::setup() {
  if (this->display_ == nullptr || this->encoder_ == nullptr) {
    ESP_LOGE(TAG, "Display or JPEG encoder is not configured");
    this->mark_failed();
    return;
  }

  this->snapshot_ = static_cast<uint8_t *>(
      heap_caps_malloc(FRAMEBUFFER_BYTES, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT));
  if (this->snapshot_ == nullptr) {
    ESP_LOGE(TAG, "Could not allocate %u-byte snapshot buffer", (unsigned) FRAMEBUFFER_BYTES);
    this->mark_failed();
    return;
  }
  this->pixels_.set(this->snapshot_, FRAMEBUFFER_BYTES);
  this->capture_queue_ = xQueueCreate(1, sizeof(uint8_t));
  if (this->capture_queue_ == nullptr) {
    ESP_LOGE(TAG, "Could not create capture queue");
    this->mark_failed();
    return;
  }

  BaseType_t created = xTaskCreatePinnedToCore(
      &FramebufferCamera::capture_task, "screen_camera", 8192, this, 1,
      &this->capture_task_handle_, 1);
  if (created != pdPASS) {
    ESP_LOGE(TAG, "Could not create capture task");
    this->mark_failed();
  }
}

void FramebufferCamera::dump_config() {
  ESP_LOGCONFIG(TAG,
                "Framebuffer Camera:\n"
                "  Name: %s\n"
                "  Resolution: %ux%u\n"
                "  Stream limit: %.1f fps",
                this->name_.c_str(), WIDTH, HEIGHT, 1000.0f / STREAM_INTERVAL_MS);
  if (this->encoder_ != nullptr) this->encoder_->dump_config();
}

void FramebufferCamera::request_image(camera::CameraRequester requester) {
  this->single_requesters_.fetch_or(1U << requester);
  App.wake_loop_threadsafe();
}

void FramebufferCamera::start_stream(camera::CameraRequester requester) {
  this->stream_requesters_.fetch_or(1U << requester);
  for (auto *listener : this->listeners_) listener->on_stream_start();
  App.wake_loop_threadsafe();
}

void FramebufferCamera::stop_stream(camera::CameraRequester requester) {
  this->stream_requesters_.fetch_and(~(1U << requester));
  for (auto *listener : this->listeners_) listener->on_stream_stop();
}

bool FramebufferCamera::queue_capture_() {
  if (this->capture_running_.exchange(true)) return false;
  this->completed_requesters_ = this->single_requesters_.exchange(0) | this->stream_requesters_.load();
  uint8_t notify = 1;
  if (xQueueSend(this->capture_queue_, &notify, 0) != pdTRUE) {
    this->capture_running_ = false;
    return false;
  }
  return true;
}

void FramebufferCamera::loop() {
  if (this->is_failed()) return;

  if (this->capture_ready_.exchange(false)) {
    auto *output = this->encoder_->get_output_buffer();
    this->current_image_ = std::make_shared<FramebufferCameraImage>(output, this->completed_requesters_);
    ESP_LOGD(TAG, "Captured screen JPEG: %u bytes", (unsigned) output->get_size());
    for (auto *listener : this->listeners_) listener->on_camera_image(this->current_image_);
    this->last_capture_ms_ = millis();
  }
  if (this->capture_failed_.exchange(false)) {
    ESP_LOGW(TAG, "Screen capture failed");
  }

  // The encoder owns one reusable output buffer. Do not overwrite it until all
  // native API readers have released the current image.
  if (this->current_image_ != nullptr) {
    if (this->current_image_.use_count() > 1) return;
    this->current_image_.reset();
  }

  bool single_pending = this->single_requesters_.load() != 0;
  bool stream_due = this->stream_requesters_.load() != 0 &&
                    millis() - this->last_capture_ms_ >= STREAM_INTERVAL_MS;
  if ((single_pending || stream_due) && !this->capture_running_.load()) this->queue_capture_();
}

void FramebufferCamera::capture_task(void *arg) {
  auto *camera = static_cast<FramebufferCamera *>(arg);
  uint8_t notify = 0;
  while (true) {
    if (xQueueReceive(camera->capture_queue_, &notify, portMAX_DELAY) != pdTRUE) continue;
    camera->capture_();
    camera->capture_running_ = false;
    App.wake_loop_threadsafe();
  }
}

void FramebufferCamera::capture_() {
  auto *panel = static_cast<st7701s::ST7701S *>(this->display_);
  void *framebuffer = nullptr;
  if (panel->get_framebuffer(&framebuffer) != ESP_OK || framebuffer == nullptr) {
    this->capture_failed_ = true;
    return;
  }

  // Copy first so subsequent UI redraws cannot tear the JPEG being encoded.
  std::memcpy(this->snapshot_, framebuffer, FRAMEBUFFER_BYTES);
  camera::EncoderError result;
  do {
    result = this->encoder_->encode_pixels(&this->image_spec_, &this->pixels_);
  } while (result == camera::ENCODER_ERROR_RETRY_FRAME);

  if (result == camera::ENCODER_ERROR_SUCCESS) {
    this->capture_ready_ = true;
  } else {
    ESP_LOGW(TAG, "JPEG encoder returned %s", camera::to_string(result));
    this->capture_failed_ = true;
  }
}

}  // namespace esphome::framebuffer_camera
