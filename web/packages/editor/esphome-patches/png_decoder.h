#pragma once

#include "esphome/core/defines.h"
#include "esphome/core/helpers.h"
#include "image_decoder.h"
#include "runtime_image.h"
#ifdef USE_RUNTIME_IMAGE_PNG
#include <pngle.h>

#include <cstdint>
#include <vector>

namespace esphome::runtime_image {

class PngDecoder : public ImageDecoder {
 public:
  explicit PngDecoder(RuntimeImage *image);
  ~PngDecoder() override;

  int prepare(size_t expected_size) override;
  int HOT decode(uint8_t *buffer, size_t size) override;

  void initialize_output(uint32_t width, uint32_t height);
  void draw_decoded_rectangle(uint32_t x, uint32_t y, uint32_t width,
                              uint32_t height, const uint8_t rgba[4]);
  void increment_pixels_decoded(uint32_t count) { this->pixels_decoded_ += count; }
  uint32_t get_pixels_decoded() const { return this->pixels_decoded_; }

 protected:
  pngle_t *pngle_{nullptr};
  uint32_t pixels_decoded_{0};
  bool fast_rgb565_{false};
  bool fast_path_ready_{false};
  bool performance_logged_{false};
  bool output_big_endian_{false};
  uint8_t *output_{nullptr};
  uint32_t source_width_{0};
  uint32_t source_height_{0};
  uint32_t target_width_{0};
  uint32_t target_height_{0};
  uint32_t allocation_us_{0};
  uint32_t decode_us_{0};
  // For each source boundary, stores the first destination coordinate whose
  // nearest-neighbour source coordinate is at or beyond that boundary.
  // This turns PNGLE's per-pixel scaling callback from binary search into O(1).
  std::vector<uint16_t> target_x_for_source_boundary_;
  std::vector<uint16_t> target_y_for_source_boundary_;
};

}  // namespace esphome::runtime_image

#endif  // USE_RUNTIME_IMAGE_PNG
