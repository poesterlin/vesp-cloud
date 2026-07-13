#pragma once

#include "ui_widget_base.h"

#if UI_HAS_ESPHOME_IMAGE_COMPONENT

class ImageWidget : public Widget {
 public:
  const char *widget_label() const override { return "Image"; }
  using Callback = std::function<void()>;

  static constexpr int TILE_ROWS = 32;

  ImageWidget(UiRect rect, esphome::image::Image *image,
              esphome::image::Image *fallback_image = nullptr,
              Color color_on = display::COLOR_ON,
              Color color_off = display::COLOR_OFF)
      : rect_(rect), image_(image), fallback_image_(fallback_image),
        color_on_(color_on), color_off_(color_off) {}

  ImageWidget(UiRect rect, esphome::image::Image &image,
              Color color_on = display::COLOR_ON,
              Color color_off = display::COLOR_OFF)
      : ImageWidget(rect, &image, nullptr, color_on, color_off) {}

  ImageWidget(UiRect rect, esphome::image::Image &image,
              esphome::image::Image &fallback_image,
              Color color_on = display::COLOR_ON,
              Color color_off = display::COLOR_OFF)
      : ImageWidget(rect, &image, &fallback_image, color_on, color_off) {}

  void on_tap(Callback cb) { tap_callback_ = std::move(cb); }

  void set_tint(Color on, Color off) {
    color_on_ = on;
    color_off_ = off;
    mark_dirty();
  }

  void set_bg_color(Color c) { bg_color_ = c; mark_dirty(); }

  UiRect bounds() const override { return screen_rect(rect_); }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (!tap_callback_ || !fully_rendered_) return false;
    if (event.type != TouchType::Tap) return false;
    if (touch_bounds().contains(event.x, event.y)) {
      tap_callback_();
      return true;
    }
    return false;
  }

  void draw(display::Display &it, const UiState &state) override {
    auto *img = select_image_();
    if (img == nullptr) return;

    if (img->get_data_start() == nullptr) {
      draw_placeholder(it, true);
      return;
    }

    if (active_image_ != img) {
      active_image_ = img;
      fully_rendered_ = false;
      deferred_ = false;
      tile_row_ = 0;
    }

    if (!fully_rendered_) {
      if (state.images_rendered_this_frame >= UiState::MAX_IMAGES_PER_FRAME
          && tile_row_ == 0) {
        draw_placeholder(it, false);
        if (!deferred_) {
          deferred_ = true;
          const UiRect r = bounds();
          UiInvalidation::request_continue(
              UiDirtyRect{r.x, r.y, r.w, r.h}, "image:deferred");
        }
        return;
      }
      render_tile(it, state, img);
      return;
    }

    const UiRect r = screen_rect(rect_);
    const int iw = img->get_width();
    const int ih = img->get_height();
    const int ox = r.x + (r.w - iw) / 2;
    const int oy = r.y + (r.h - ih) / 2;
    ui_fast_filled_rectangle(it, r.x, r.y, r.w, r.h, bg_color_);
    it.image(ox, oy, img, color_on_, color_off_);
  }

 private:
  esphome::image::Image *select_image_() const {
    if (image_ != nullptr && image_->get_data_start() != nullptr) return image_;
    if (fallback_image_ != nullptr && fallback_image_->get_data_start() != nullptr) return fallback_image_;
    if (image_ != nullptr) return image_;
    return fallback_image_;
  }

  void render_tile(display::Display &it, const UiState &state, esphome::image::Image *img) {
    const int iw = img->get_width();
    const int ih = img->get_height();
    if (iw <= 0 || ih <= 0) { fully_rendered_ = true; return; }

    const UiRect r = screen_rect(rect_);
    const int ox = r.x + (r.w - iw) / 2;
    const int oy = r.y + (r.h - ih) / 2;

    if (tile_row_ == 0) {
      ui_fast_filled_rectangle(it, r.x, r.y, r.w, r.h, bg_color_);
    }

    int tile_h = TILE_ROWS;
    if (tile_row_ + tile_h > ih) tile_h = ih - tile_row_;

    const uint8_t *data = img->get_data_start();
    const uint8_t *tile_data = data + (tile_row_ * iw * 2);

    it.draw_pixels_at(ox, oy + tile_row_, iw, tile_h, tile_data,
                      display::COLOR_ORDER_RGB, display::COLOR_BITNESS_565,
                      true, 0, 0, 0);

    tile_row_ += TILE_ROWS;
    if (tile_row_ >= ih) {
      fully_rendered_ = true;
      deferred_ = false;
      return;
    }

    UiInvalidation::request_continue(
        UiDirtyRect{r.x, r.y, r.w, r.h}, "image:tile");
    const_cast<UiState&>(state).images_rendered_this_frame++;
  }

  void draw_placeholder(display::Display &it, bool downloading) const {
    const UiRect r = screen_rect(rect_);
    ui_fast_filled_rectangle(it, r.x, r.y, r.w, r.h, bg_color_);
    const UiRect inner = r.inset(2);
    draw_clipped_border(it, inner.x, inner.y, inner.w, inner.h,
                        4, 4, 4, 4, RetroColors::DIMMER);
    if (g_theme.label.font != nullptr) {
      it.printf(r.x + r.w / 2, r.y + r.h / 2,
                g_theme.label.font, RetroColors::DIMMER,
                TextAlign::CENTER, downloading ? "LOADING..." : "...");
    }
  }

  UiRect rect_;
  esphome::image::Image *image_;
  esphome::image::Image *fallback_image_ = nullptr;
  esphome::image::Image *active_image_ = nullptr;
  Color color_on_;
  Color color_off_;
  Color bg_color_{RetroColors::VOID};
  Callback tap_callback_;
  bool fully_rendered_ = false;
  bool deferred_ = false;
  int tile_row_ = 0;
};
#endif  // UI_HAS_ESPHOME_IMAGE_COMPONENT
