#include "png_decoder.h"
#ifdef USE_RUNTIME_IMAGE_PNG

#include "esphome/components/display/display_buffer.h"
#include "esphome/core/application.h"
#include "esphome/core/hal.h"
#include "esphome/core/helpers.h"
#include "esphome/core/log.h"

#include <algorithm>
#include <cinttypes>
#include <cstring>

static const char *const TAG = "image_decoder.png";

namespace esphome::runtime_image {

static void init_callback(pngle_t *pngle, uint32_t width, uint32_t height) {
  auto *decoder = static_cast<PngDecoder *>(pngle_get_user_data(pngle));
  decoder->initialize_output(width, height);
}

static void draw_callback(pngle_t *pngle, uint32_t x, uint32_t y,
                          uint32_t width, uint32_t height,
                          const uint8_t rgba[4]) {
  auto *decoder = static_cast<PngDecoder *>(pngle_get_user_data(pngle));
  decoder->draw_decoded_rectangle(x, y, width, height, rgba);

  const uint32_t pixels = width * height;
  decoder->increment_pixels_decoded(pixels);
  if ((decoder->get_pixels_decoded() % 1024) < pixels) {
    App.feed_wdt();
  }
}

PngDecoder::PngDecoder(RuntimeImage *image) : ImageDecoder(image) {
  RAMAllocator<pngle_t> allocator;
  this->pngle_ = allocator.allocate(1, PNGLE_T_SIZE);
  if (this->pngle_ == nullptr) {
    ESP_LOGE(TAG, "Failed to allocate memory for PNGLE engine!");
    return;
  }
  std::memset(this->pngle_, 0, PNGLE_T_SIZE);
  pngle_reset(this->pngle_);
}

PngDecoder::~PngDecoder() {
  if (this->pngle_ != nullptr) {
    pngle_reset(this->pngle_);
    RAMAllocator<pngle_t> allocator;
    allocator.deallocate(this->pngle_, PNGLE_T_SIZE);
  }
}

int PngDecoder::prepare(size_t expected_size) {
  ImageDecoder::prepare(expected_size);
  if (this->pngle_ == nullptr) {
    ESP_LOGE(TAG, "PNG decoder engine not initialized!");
    return DECODE_ERROR_OUT_OF_MEMORY;
  }

  this->pixels_decoded_ = 0;
  this->decode_us_ = 0;
  this->allocation_us_ = 0;
  this->performance_logged_ = false;
  this->fast_path_ready_ = false;
  this->fast_rgb565_ = this->image_->get_type() == image::IMAGE_TYPE_RGB565 &&
                       !this->image_->has_transparency();
  pngle_set_user_data(this->pngle_, this);
  pngle_set_init_callback(this->pngle_, init_callback);
  pngle_set_draw_callback(this->pngle_, draw_callback);
  return 0;
}

void PngDecoder::initialize_output(uint32_t width, uint32_t height) {
  this->source_width_ = width;
  this->source_height_ = height;
  const uint32_t started_us = micros();
  const bool resized = this->set_size(width, height);
  this->allocation_us_ = micros() - started_us;
  if (!resized || !this->fast_rgb565_) {
    return;
  }

  this->output_ = this->image_->get_decode_buffer();
  this->output_big_endian_ = this->image_->get_decode_buffer_big_endian();
  this->target_width_ = this->image_->get_buffer_width();
  this->target_height_ = this->image_->get_buffer_height();
  if (this->output_ == nullptr || this->target_width_ == 0 ||
      this->target_height_ == 0) {
    return;
  }

  if (width != this->target_width_) {
    std::vector<uint16_t> source_for_target(this->target_width_);
    for (uint32_t x = 0; x < this->target_width_; x++) {
      const uint64_t centered = static_cast<uint64_t>(2 * x + 1) * width;
      source_for_target[x] = std::min<uint32_t>(
          width - 1, centered / (2 * this->target_width_));
    }
    this->target_x_for_source_boundary_.resize(width + 1);
    uint32_t target_x = 0;
    for (uint32_t source_x = 0; source_x <= width; source_x++) {
      while (target_x < this->target_width_ &&
             source_for_target[target_x] < source_x) {
        target_x++;
      }
      this->target_x_for_source_boundary_[source_x] = target_x;
    }
  }
  if (height != this->target_height_) {
    std::vector<uint16_t> source_for_target(this->target_height_);
    for (uint32_t y = 0; y < this->target_height_; y++) {
      const uint64_t centered = static_cast<uint64_t>(2 * y + 1) * height;
      source_for_target[y] = std::min<uint32_t>(
          height - 1, centered / (2 * this->target_height_));
    }
    this->target_y_for_source_boundary_.resize(height + 1);
    uint32_t target_y = 0;
    for (uint32_t source_y = 0; source_y <= height; source_y++) {
      while (target_y < this->target_height_ &&
             source_for_target[target_y] < source_y) {
        target_y++;
      }
      this->target_y_for_source_boundary_[source_y] = target_y;
    }
  }
  this->fast_path_ready_ = true;
}

void PngDecoder::draw_decoded_rectangle(uint32_t x, uint32_t y,
                                        uint32_t width, uint32_t height,
                                        const uint8_t rgba[4]) {
  if (!this->fast_path_ready_) {
    this->draw(x, y, width, height, Color(rgba[0], rgba[1], rgba[2], rgba[3]));
    return;
  }

  uint32_t target_x_begin;
  uint32_t target_x_end;
  uint32_t target_y_begin;
  uint32_t target_y_end;
  if (this->target_x_for_source_boundary_.empty()) {
    target_x_begin = std::min(x, this->target_width_);
    target_x_end = std::min(x + width, this->target_width_);
  } else {
    target_x_begin = this->target_x_for_source_boundary_[x];
    target_x_end = this->target_x_for_source_boundary_[x + width];
  }
  if (this->target_y_for_source_boundary_.empty()) {
    target_y_begin = std::min(y, this->target_height_);
    target_y_end = std::min(y + height, this->target_height_);
  } else {
    target_y_begin = this->target_y_for_source_boundary_[y];
    target_y_end = this->target_y_for_source_boundary_[y + height];
  }
  if (target_x_begin == target_x_end || target_y_begin == target_y_end) {
    return;
  }

  const uint16_t color = (static_cast<uint16_t>(rgba[0] & 0xF8) << 8) |
                         (static_cast<uint16_t>(rgba[1] & 0xFC) << 3) |
                         (rgba[2] >> 3);
  const uint8_t first = this->output_big_endian_ ? color >> 8 : color & 0xFF;
  const uint8_t second = this->output_big_endian_ ? color & 0xFF : color >> 8;

  for (uint32_t target_y = target_y_begin; target_y < target_y_end; target_y++) {
    uint8_t *pixel = this->output_ +
                     (static_cast<size_t>(target_y) * this->target_width_ +
                      target_x_begin) * 2;
    for (uint32_t target_x = target_x_begin; target_x < target_x_end; target_x++) {
      *pixel++ = first;
      *pixel++ = second;
    }
  }
}

int HOT PngDecoder::decode(uint8_t *buffer, size_t size) {
  if (this->pngle_ == nullptr) {
    ESP_LOGE(TAG, "PNG decoder engine not initialized!");
    return DECODE_ERROR_OUT_OF_MEMORY;
  }
  if (size < 256 && this->expected_size_ > 0 &&
      size < this->expected_size_ - this->decoded_bytes_) {
    ESP_LOGD(TAG, "Waiting for more data");
    return 0;
  }

  const uint32_t started_us = micros();
  const int fed = pngle_feed(this->pngle_, buffer, size);
  this->decode_us_ += micros() - started_us;
  if (fed < 0) {
    ESP_LOGE(TAG, "Error decoding image: %s", pngle_error(this->pngle_));
    return fed;
  }

  this->decoded_bytes_ += fed;
  if (!this->performance_logged_ && this->fast_path_ready_ &&
      this->expected_size_ > 0 && this->decoded_bytes_ >= this->expected_size_) {
    this->performance_logged_ = true;
    ESP_LOGI(TAG,
             "Fast RGB565: source=%" PRIu32 "x%" PRIu32 " target=%" PRIu32
             "x%" PRIu32 " alloc=%" PRIu32 "us decode=%" PRIu32 "us",
             this->source_width_, this->source_height_, this->target_width_,
             this->target_height_, this->allocation_us_, this->decode_us_);
  }
  return fed;
}

}  // namespace esphome::runtime_image

#endif  // USE_RUNTIME_IMAGE_PNG
