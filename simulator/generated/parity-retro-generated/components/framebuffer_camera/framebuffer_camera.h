#pragma once

#include <atomic>
#include <memory>
#include <vector>

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>

#include "esphome/components/camera/camera.h"
#include "esphome/components/camera/encoder.h"
#include "esphome/components/display/display.h"
#include "esphome/components/st7701s/st7701s.h"
#include "esphome/core/component.h"

namespace esphome::framebuffer_camera {

class FramebufferCameraImage final : public camera::CameraImage {
 public:
  FramebufferCameraImage(camera::EncoderBuffer *buffer, uint8_t requesters)
      : buffer_(buffer), requesters_(requesters) {}

  uint8_t *get_data_buffer() override { return this->buffer_->get_data(); }
  size_t get_data_length() override { return this->buffer_->get_size(); }
  bool was_requested_by(camera::CameraRequester requester) const override {
    return (this->requesters_ & (1U << requester)) != 0;
  }

 protected:
  camera::EncoderBuffer *buffer_;
  uint8_t requesters_;
};

class FramebufferCameraImageReader final : public camera::CameraImageReader {
 public:
  void set_image(std::shared_ptr<camera::CameraImage> image) override {
    this->image_ = std::move(image);
    this->offset_ = 0;
  }
  size_t available() const override {
    return this->image_ == nullptr ? 0 : this->image_->get_data_length() - this->offset_;
  }
  uint8_t *peek_data_buffer() override { return this->image_->get_data_buffer() + this->offset_; }
  void consume_data(size_t consumed) override { this->offset_ += consumed; }
  void return_image() override { this->image_.reset(); }

 protected:
  std::shared_ptr<camera::CameraImage> image_;
  size_t offset_{0};
};

class FramebufferCamera final : public camera::Camera {
 public:
  void set_display(display::Display *display) { this->display_ = display; }
  void set_encoder(camera::Encoder *encoder) { this->encoder_ = encoder; }

  void setup() override;
  void loop() override;
  void dump_config() override;

  void add_listener(camera::CameraListener *listener) override { this->listeners_.push_back(listener); }
  camera::CameraImageReader *create_image_reader() override { return new FramebufferCameraImageReader; }
  void request_image(camera::CameraRequester requester) override;
  void start_stream(camera::CameraRequester requester) override;
  void stop_stream(camera::CameraRequester requester) override;

 protected:
  class PixelBuffer final : public camera::Buffer {
   public:
    void set(uint8_t *data, size_t length) {
      this->data_ = data;
      this->length_ = length;
    }
    uint8_t *get_data_buffer() override { return this->data_; }
    size_t get_data_length() override { return this->length_; }

   protected:
    uint8_t *data_{nullptr};
    size_t length_{0};
  };

  static constexpr uint16_t WIDTH = 480;
  static constexpr uint16_t HEIGHT = 480;
  static constexpr size_t FRAMEBUFFER_BYTES = WIDTH * HEIGHT * 2;
  static constexpr uint32_t STREAM_INTERVAL_MS = 1000;

  static void capture_task(void *arg);
  bool queue_capture_();
  void capture_();

  display::Display *display_{nullptr};
  camera::Encoder *encoder_{nullptr};
  uint8_t *snapshot_{nullptr};
  PixelBuffer pixels_;
  camera::CameraImageSpec image_spec_{WIDTH, HEIGHT, camera::PIXEL_FORMAT_RGB565};
  QueueHandle_t capture_queue_{nullptr};
  TaskHandle_t capture_task_handle_{nullptr};
  std::atomic<uint8_t> single_requesters_{0};
  std::atomic<uint8_t> stream_requesters_{0};
  std::atomic<bool> capture_running_{false};
  std::atomic<bool> capture_ready_{false};
  std::atomic<bool> capture_failed_{false};
  uint8_t completed_requesters_{0};
  uint32_t last_capture_ms_{0};
  std::shared_ptr<FramebufferCameraImage> current_image_;
  std::vector<camera::CameraListener *> listeners_;
};

}  // namespace esphome::framebuffer_camera
