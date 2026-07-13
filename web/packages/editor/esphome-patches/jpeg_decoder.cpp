#include "jpeg_decoder.h"
#ifdef USE_RUNTIME_IMAGE_JPEG

#include "esphome/components/display/display_buffer.h"
#include "esphome/core/application.h"
#include "esphome/core/defines.h"
#include "esphome/core/hal.h"
#include "esphome/core/helpers.h"
#include "esphome/core/log.h"

#include <algorithm>
#include <cinttypes>
#include <cstdint>
#include <cstring>
#include <vector>

#ifdef USE_ESP_IDF
#include "esp_task_wdt.h"
#endif

static const char *const TAG = "image_decoder.jpeg";

namespace esphome::runtime_image {

static void feed_decode_watchdog() {
#ifdef USE_ESP_IDF
  if (esp_task_wdt_status(nullptr) != ESP_OK) {
    return;
  }
#endif
  App.feed_wdt();
}

/** ESPHome's compatibility path for non-RGB565 or transparent images. */
static int draw_callback(JPEGDRAW *jpeg) {
  feed_decode_watchdog();

  auto *decoder = static_cast<ImageDecoder *>(jpeg->pUser);
  if (decoder == nullptr) {
    ESP_LOGE(TAG, "Decoder pointer is null!");
    return 0;
  }

  size_t position = 0;
  const size_t height = static_cast<size_t>(jpeg->iHeight);
  const size_t width = static_cast<size_t>(jpeg->iWidth);
  for (size_t y = 0; y < height; y++) {
    for (size_t x = 0; x < width; x++) {
      auto rg = decode_value(jpeg->pPixels[position++]);
      auto ba = decode_value(jpeg->pPixels[position++]);
      decoder->draw(jpeg->x + x, jpeg->y + y, 1, 1,
                    Color(rg[1], rg[0], ba[1], ba[0]));
    }
  }
  return 1;
}

struct FastRgb565Context {
  uint8_t *output{nullptr};
  int target_width{0};
  int target_height{0};
  int decoded_width{0};
  int decoded_height{0};
  std::vector<uint16_t> source_x_for_target;
  std::vector<uint16_t> source_y_for_target;
};

/**
 * Copy JPEGDEC's native RGB565 MCU blocks into RuntimeImage's PSRAM buffer.
 *
 * The callback honors iWidthUsed, so odd/non-MCU-aligned source sizes cannot
 * overwrite the following row. When JPEGDEC's 1/2, 1/4, or 1/8 native scale
 * is not the exact target size, destination-driven maps touch each output
 * pixel once and avoid ESPHome's floating-point work for every source pixel.
 */
static int fast_rgb565_callback(JPEGDRAW *jpeg) {
  feed_decode_watchdog();

  auto *ctx = static_cast<FastRgb565Context *>(jpeg->pUser);
  if (ctx == nullptr || ctx->output == nullptr) {
    ESP_LOGE(TAG, "Fast RGB565 decode context is null!");
    return 0;
  }

  const auto *source_bytes = reinterpret_cast<const uint8_t *>(jpeg->pPixels);

  if (ctx->decoded_width == ctx->target_width &&
      ctx->decoded_height == ctx->target_height) {
    const int copy_width =
        std::min(jpeg->iWidthUsed, ctx->target_width - jpeg->x);
    const int copy_height =
        std::min(jpeg->iHeight, ctx->target_height - jpeg->y);
    if (copy_width <= 0 || copy_height <= 0 || jpeg->x < 0 || jpeg->y < 0) {
      return 1;
    }
    for (int y = 0; y < copy_height; y++) {
      const size_t source_offset = static_cast<size_t>(y) * jpeg->iWidth * 2;
      const size_t target_offset =
          (static_cast<size_t>(jpeg->y + y) * ctx->target_width + jpeg->x) * 2;
      std::memcpy(ctx->output + target_offset, source_bytes + source_offset,
                  static_cast<size_t>(copy_width) * 2);
    }
    return 1;
  }

  const int source_x_end = jpeg->x + jpeg->iWidthUsed;
  const int source_y_end = jpeg->y + jpeg->iHeight;
  const auto x_begin =
      std::lower_bound(ctx->source_x_for_target.begin(),
                       ctx->source_x_for_target.end(), jpeg->x);
  const auto x_end =
      std::lower_bound(x_begin, ctx->source_x_for_target.end(), source_x_end);
  const auto y_begin =
      std::lower_bound(ctx->source_y_for_target.begin(),
                       ctx->source_y_for_target.end(), jpeg->y);
  const auto y_end =
      std::lower_bound(y_begin, ctx->source_y_for_target.end(), source_y_end);

  for (auto y_it = y_begin; y_it != y_end; ++y_it) {
    const int target_y =
        static_cast<int>(y_it - ctx->source_y_for_target.begin());
    const int source_y = *y_it - jpeg->y;
    for (auto x_it = x_begin; x_it != x_end; ++x_it) {
      const int target_x =
          static_cast<int>(x_it - ctx->source_x_for_target.begin());
      const int source_x = *x_it - jpeg->x;
      const size_t source_offset =
          (static_cast<size_t>(source_y) * jpeg->iWidth + source_x) * 2;
      const size_t target_offset =
          (static_cast<size_t>(target_y) * ctx->target_width + target_x) * 2;
      ctx->output[target_offset] = source_bytes[source_offset];
      ctx->output[target_offset + 1] = source_bytes[source_offset + 1];
    }
  }
  return 1;
}

static int select_native_scale(int source_width, int source_height,
                               int target_width, int target_height,
                               int *scale_divisor) {
  struct ScaleChoice {
    int divisor;
    int option;
  };
  static constexpr ScaleChoice CHOICES[] = {
      {8, JPEG_SCALE_EIGHTH},
      {4, JPEG_SCALE_QUARTER},
      {2, JPEG_SCALE_HALF},
  };

  for (const auto &choice : CHOICES) {
    const int scaled_width =
        (source_width + choice.divisor - 1) / choice.divisor;
    const int scaled_height =
        (source_height + choice.divisor - 1) / choice.divisor;
    if (scaled_width >= target_width && scaled_height >= target_height) {
      *scale_divisor = choice.divisor;
      return choice.option;
    }
  }

  *scale_divisor = 1;
  return 0;
}

int JpegDecoder::prepare(size_t expected_size) {
  ImageDecoder::prepare(expected_size);
  // JPEGDEC needs the complete compressed file before it can decode.
  return 0;
}

int HOT JpegDecoder::decode(uint8_t *buffer, size_t size) {
  if (this->expected_size_ > 0 && size < this->expected_size_) {
    ESP_LOGV(TAG, "Download not complete. Size: %zu/%zu", size,
             this->expected_size_);
    return 0;
  }

  const bool use_fast_rgb565 =
      this->image_->get_type() == image::IMAGE_TYPE_RGB565 &&
      !this->image_->has_transparency();
  const uint32_t total_started_us = micros();

  if (!this->jpeg_.openRAM(buffer, size,
                           use_fast_rgb565 ? fast_rgb565_callback
                                           : draw_callback)) {
    ESP_LOGE(TAG, "Could not open image for decoding: %d",
             this->jpeg_.getLastError());
    return DECODE_ERROR_INVALID_TYPE;
  }

  const auto jpeg_type = this->jpeg_.getJPEGType();
  if (jpeg_type == JPEG_MODE_INVALID) {
    ESP_LOGE(TAG, "Unsupported JPEG image");
    this->jpeg_.close();
    return DECODE_ERROR_INVALID_TYPE;
  }
  if (jpeg_type == JPEG_MODE_PROGRESSIVE) {
    ESP_LOGE(TAG, "Progressive JPEG images not supported");
    this->jpeg_.close();
    return DECODE_ERROR_INVALID_TYPE;
  }

  const int source_width = this->jpeg_.getWidth();
  const int source_height = this->jpeg_.getHeight();
  ESP_LOGD(TAG, "Image size: %d x %d, bpp: %d", source_width, source_height,
           this->jpeg_.getBpp());

  const uint32_t allocation_started_us = micros();
  if (!this->set_size(source_width, source_height)) {
    this->jpeg_.close();
    return DECODE_ERROR_OUT_OF_MEMORY;
  }
  const uint32_t allocation_us = micros() - allocation_started_us;

  bool decoded = false;
  uint32_t decode_us = 0;
  if (use_fast_rgb565) {
    FastRgb565Context context;
    context.output = this->image_->get_decode_buffer();
    context.target_width = this->image_->get_buffer_width();
    context.target_height = this->image_->get_buffer_height();

    int scale_divisor = 1;
    const int scale_option =
        select_native_scale(source_width, source_height, context.target_width,
                            context.target_height, &scale_divisor);
    context.decoded_width = (source_width + scale_divisor - 1) / scale_divisor;
    context.decoded_height =
        (source_height + scale_divisor - 1) / scale_divisor;

    context.source_x_for_target.resize(context.target_width);
    context.source_y_for_target.resize(context.target_height);
    for (int x = 0; x < context.target_width; x++) {
      const uint64_t centered_x =
          static_cast<uint64_t>(2 * x + 1) * context.decoded_width;
      context.source_x_for_target[x] =
          std::min(context.decoded_width - 1,
                   static_cast<int>(centered_x / (2 * context.target_width)));
    }
    for (int y = 0; y < context.target_height; y++) {
      const uint64_t centered_y =
          static_cast<uint64_t>(2 * y + 1) * context.decoded_height;
      context.source_y_for_target[y] =
          std::min(context.decoded_height - 1,
                   static_cast<int>(centered_y / (2 * context.target_height)));
    }

    this->jpeg_.setUserPointer(&context);
    this->jpeg_.setPixelType(this->image_->get_decode_buffer_big_endian()
                                 ? RGB565_BIG_ENDIAN
                                 : RGB565_LITTLE_ENDIAN);
    const uint32_t decode_started_us = micros();
    decoded = this->jpeg_.decode(0, 0, scale_option);
    decode_us = micros() - decode_started_us;

    ESP_LOGI(TAG,
             "Fast RGB565: source=%dx%d native=%dx%d target=%dx%d scale=1/%d "
             "alloc=%" PRIu32 "us decode=%" PRIu32 "us total=%" PRIu32 "us",
             source_width, source_height, context.decoded_width,
             context.decoded_height, context.target_width,
             context.target_height, scale_divisor, allocation_us, decode_us,
             micros() - total_started_us);
  } else {
    this->jpeg_.setUserPointer(this);
    this->jpeg_.setPixelType(RGB8888);
    const uint32_t decode_started_us = micros();
    decoded = this->jpeg_.decode(0, 0, 0);
    decode_us = micros() - decode_started_us;
  }

  if (!decoded) {
    ESP_LOGE(TAG, "Error while decoding (fast_rgb565=%d, decode=%" PRIu32 "us)",
             use_fast_rgb565, decode_us);
    this->jpeg_.close();
    return DECODE_ERROR_UNSUPPORTED_FORMAT;
  }

  this->decoded_bytes_ = size;
  this->jpeg_.close();
  return size;
}

} // namespace esphome::runtime_image

#endif // USE_RUNTIME_IMAGE_JPEG
