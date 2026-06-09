#pragma once

#include "esphome.h"
#include "ui_invalidation.h"
#include "ui_types.h"
#include "ui_retro.h"
#include <cmath>
#include <memory>
#include <vector>
#include <functional>
#include <string>

namespace esphome {
namespace font {
class Font;
}
}  // namespace esphome

struct UiState;

struct UiRect {
  int x;
  int y;
  int w;
  int h;

  bool contains(int tx, int ty, int slop_x = 0, int slop_y = 0) const {
    return tx >= x - slop_x && tx <= x + w + slop_x && ty >= y - slop_y && ty <= y + h + slop_y;
  }
};

struct Theme {
  struct TextStyle {
    esphome::font::Font *font = nullptr;
    Color color = Color(255, 255, 255);
    TextAlign align = TextAlign::TOP_LEFT;
  };

  struct ButtonStyle {
    Color border_color = Color(0, 240, 255);
    Color text_color = Color(230, 240, 250);
    esphome::font::Font *font = nullptr;
  };

  TextStyle header   = {nullptr, RetroColors::CYAN, TextAlign::TOP_LEFT};
  TextStyle label    = {nullptr, RetroColors::LIGHT, TextAlign::TOP_LEFT};
  Color     info_bg  = RetroColors::VOID;

  ButtonStyle primary = {RetroColors::CYAN, RetroColors::WHITE, nullptr};
  ButtonStyle accent  = {RetroColors::AMBER, RetroColors::WHITE, nullptr};
  ButtonStyle neutral = {RetroColors::GRAY, RetroColors::WHITE, nullptr};
  ButtonStyle success = {RetroColors::GREEN, RetroColors::WHITE, nullptr};
};

inline Theme g_theme;

class Widget {
 public:
  virtual ~Widget() = default;
  virtual void enter() {}
  virtual void exit() {}
  virtual void layout() {}
  virtual void update(uint32_t now) {}
  virtual bool handle_touch(const TouchEvent &event, uint32_t now) { return false; }
  virtual void draw(display::Display &it, const UiState &state) = 0;

  virtual UiRect bounds() const { return UiRect{0, 0, 480, 480}; }

  void mark_dirty() {
    const auto b = bounds();
    UiInvalidation::request_rect(UiDirtyRect{b.x, b.y, b.w, b.h});
  }

  bool needs_draw(const UiState &state) const {
    if (!is_visible(state)) return false;
    const auto b = bounds();
    return UiInvalidation::needs_redraw_in(b.x, b.y, b.w, b.h);
  }

  virtual bool is_visible(const UiState &state) const {
    (void)state;
    if (visibility_check_) return visibility_check_();
    return true;
  }

  void set_visibility_condition(std::function<bool()> check) {
    visibility_check_ = std::move(check);
  }

 protected:
  std::function<bool()> visibility_check_;
};

class RectWidget : public Widget {
 public:
  RectWidget(UiRect rect, Color color) : rect_(rect), color_(color) {}

  UiRect bounds() const override { return rect_; }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, rect_.h, color_);
  }

 private:
  UiRect rect_;
  Color color_;
};

class ImageWidget : public Widget {
 public:
  using Callback = std::function<void()>;

  ImageWidget(UiRect rect, esphome::display::BaseImage *image,
              Color color_on = display::COLOR_ON,
              Color color_off = display::COLOR_OFF)
      : rect_(rect), image_(image),
        color_on_(color_on), color_off_(color_off) {}

  ImageWidget(UiRect rect, esphome::display::BaseImage &image,
              Color color_on = display::COLOR_ON,
              Color color_off = display::COLOR_OFF)
      : ImageWidget(rect, &image, color_on, color_off) {}

  void on_tap(Callback cb) { tap_callback_ = std::move(cb); }

  void set_tint(Color on, Color off) {
    color_on_ = on;
    color_off_ = off;
  }

  void set_bg_color(Color c) { bg_color_ = c; }

  UiRect bounds() const override { return rect_; }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (!tap_callback_ || !fully_rendered_) return false;
    if (event.type != TouchType::Tap) return false;
    if (rect_.contains(event.x, event.y)) {
      tap_callback_();
      return true;
    }
    return false;
  }

  void draw(display::Display &it, const UiState &state) override {
    if (image_ == nullptr) return;

    if (!fully_rendered_ &&
        state.images_rendered_this_frame >= UiState::MAX_IMAGES_PER_FRAME) {
      draw_placeholder(it);
      if (!deferred_) {
        deferred_ = true;
        UiInvalidation::request_continue();
      }
      return;
    }

    ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, rect_.h, bg_color_);
    it.image(rect_.x, rect_.y, image_, color_on_, color_off_);
    fully_rendered_ = true;
    deferred_ = false;
    const_cast<UiState&>(state).images_rendered_this_frame++;
  }

 private:
  void draw_placeholder(display::Display &it) const {
    ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, rect_.h, bg_color_);
    draw_clipped_border(it, rect_.x + 2, rect_.y + 2, rect_.w - 4, rect_.h - 4,
                        4, 4, 4, 4, RetroColors::DIMMER);
    if (g_theme.label.font != nullptr) {
      it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2,
                g_theme.label.font, RetroColors::DIMMER,
                TextAlign::CENTER, "...");
    }
  }

  UiRect rect_;
  esphome::display::BaseImage *image_;
  Color color_on_;
  Color color_off_;
  Color bg_color_{RetroColors::VOID};
  Callback tap_callback_;
  bool fully_rendered_ = false;
  bool deferred_ = false;
};

class LabelWidget : public Widget {
 public:
  LabelWidget(UiRect rect, const char *text, const Theme::TextStyle &style)
      : rect_(rect), text_(text), style_(&style) {}

  template<typename T>
  LabelWidget(UiRect rect, const char *fmt, const T *value)
      : rect_(rect), text_(fmt), style_(&g_theme.label) {
    printer_ = [value, fmt](display::Display &it, int x, int y,
                             esphome::font::Font *f, Color c, TextAlign a) {
      it.printf(x, y, f, c, a, fmt, *value);
    };
  }

  void set_bg_color(Color c) { bg_color_ = c; }

  UiRect bounds() const override { return rect_; }

  void bind(const bool *value, const char *on_text = "ON", const char *off_text = "OFF") {
    bound_bool_ = value;
    on_text_ = on_text;
    off_text_ = off_text;
    last_bool_ = value != nullptr ? *value : false;
    bool_baseline_set_ = (value != nullptr);
  }

  template<typename T>
  void bind(const T *value, const char *fmt) {
    printer_ = [value, fmt](display::Display &it, int x, int y,
                             esphome::font::Font *f, Color c, TextAlign a) {
      it.printf(x, y, f, c, a, fmt, *value);
    };
  }

  void update(uint32_t now) override {
    (void)now;
    if (bound_bool_ != nullptr) {
      const bool current = *bound_bool_;
      if (!bool_baseline_set_ || current != last_bool_) {
        mark_dirty();
      }
    }
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    if (style_ == nullptr || style_->font == nullptr) return;

    auto *f = style_->font;
    auto cl = style_->color;
    auto a = style_->align;

    if (bound_bool_ != nullptr) {
      const char *display = *bound_bool_ ? on_text_ : off_text_;
      const char *alt = *bound_bool_ ? off_text_ : on_text_;
      int tx, ty, tw, th, ax, ay, aw, ah;
      it.get_text_bounds(rect_.x, rect_.y, display, f, a, &tx, &ty, &tw, &th);
      it.get_text_bounds(rect_.x, rect_.y, alt, f, a, &ax, &ay, &aw, &ah);
      int cw = (tw > aw) ? tw : aw;
      ui_fast_filled_rectangle(it, tx - 2, ty, cw + 4, th, bg_color_);
      it.printf(rect_.x, rect_.y, f, cl, a, "%s", display);
      last_bool_ = *bound_bool_;
      bool_baseline_set_ = true;
    } else if (printer_) {
      ui_fast_filled_rectangle(it, rect_.x, rect_.y, rect_.w, rect_.h, bg_color_);
      printer_(it, rect_.x, rect_.y, f, cl, a);
    } else {
      int tx, ty, tw, th;
      it.get_text_bounds(rect_.x, rect_.y, text_, f, a, &tx, &ty, &tw, &th);
      ui_fast_filled_rectangle(it, tx - 2, ty, tw + 4, th, bg_color_);
      it.printf(rect_.x, rect_.y, f, cl, a, "%s", text_);
    }
  }

 private:
  UiRect rect_;
  const char *text_;
  const Theme::TextStyle *style_ = nullptr;
  const bool *bound_bool_ = nullptr;
  const char *on_text_ = "ON";
  const char *off_text_ = "OFF";
  std::function<void(display::Display&, int, int, esphome::font::Font*, Color, TextAlign)> printer_;
  Color bg_color_{RetroColors::VOID};
  bool last_bool_ = false;
  bool bool_baseline_set_ = false;
};

class ButtonWidget : public Widget {
 public:
  using Callback = std::function<void()>;

  ButtonWidget(UiRect rect, const char *label, Callback callback, const Theme::ButtonStyle &style)
      : rect_(rect), label_(label), callback_(callback), style_(&style) {}

  UiRect bounds() const override { return rect_; }

  void update(uint32_t now) override {
    if (loading_timeout_ms_ > 0 && loading_ && (now - loading_start_ms_ > loading_timeout_ms_)) {
      loading_ = false;
      mark_dirty();
    }
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (event.type != TouchType::Tap) return false;
    if (loading_) return false;

    if (esphome::api::global_api_server == nullptr || !esphome::api::global_api_server->is_connected()) {
      return false;
    }

    if (!hit_test(event.x, event.y)) return false;
    loading_ = true;
    loading_start_ms_ = now;
    mark_dirty();
    if (callback_) callback_();

    char name_buf[24];
    snprintf(name_buf, sizeof(name_buf), "btn_%p", this);
    esphome::App.scheduler.set_timeout(nullptr, name_buf, loading_timeout_ms_,
        [this]() {
          loading_ = false;
          mark_dirty();
          UiRedraw::trigger_display_update();
        });
    return true;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    if (style_ == nullptr || style_->font == nullptr) return;

    auto *f = style_->font;
    auto bc = style_->border_color;
    auto tc = style_->text_color;

    int c = (rect_.h < 40) ? 4 : 6;
    draw_clipped_box(it, rect_.x, rect_.y, rect_.w, rect_.h,
                     c, bc, RetroColors::DIM, true);

    if (loading_) {
      it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, f, tc, TextAlign::CENTER, "...");
      return;
    }
    it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, f, tc, TextAlign::CENTER, "%s", label_);
  }

 private:
  bool hit_test(int tx, int ty) const {
    const int sx = rect_.w < 40 ? 15 : (rect_.w < 60 ? 10 : 0);
    const int sy = rect_.h < 40 ? 15 : (rect_.h < 60 ? 10 : 0);
    return rect_.contains(tx, ty, sx, sy);
  }

  UiRect rect_;
  const char *label_;
  Callback callback_;
  const Theme::ButtonStyle *style_ = nullptr;
  bool loading_ = false;
  uint32_t loading_start_ms_ = 0;
  uint32_t loading_timeout_ms_ = 350;
};

class ImageToggleWidget : public Widget {
 public:
  using Callback = std::function<void()>;

  ImageToggleWidget(UiRect rect, const char *label, const bool *on_state,
                    Callback callback, Color on_color = RetroColors::AMBER,
                    Color off_color = RetroColors::DIMMER)
      : rect_(rect), label_(label), on_state_(on_state),
        callback_(std::move(callback)), on_color_(on_color),
        off_color_(off_color) {}

  void bind(const bool *on_state) { on_state_ = on_state; }

  UiRect bounds() const override { return rect_; }

  void update(uint32_t now) override {
    if (loading_timeout_ms_ > 0 && loading_ &&
        (now - loading_start_ms_ > loading_timeout_ms_)) {
      loading_ = false;
      mark_dirty();
    }
    if (on_state_ != nullptr) {
      bool current = *on_state_;
      if (current != last_on_state_) {
        mark_dirty();
      }
    }
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (event.type != TouchType::Tap) return false;
    if (loading_) return false;

    if (esphome::api::global_api_server == nullptr ||
        !esphome::api::global_api_server->is_connected()) {
      return false;
    }

    if (!hit_test(event.x, event.y)) return false;
    loading_ = true;
    loading_start_ms_ = now;
    mark_dirty();
    if (callback_) callback_();

    char name_buf[24];
    snprintf(name_buf, sizeof(name_buf), "itg_%p", this);
    esphome::App.scheduler.set_timeout(
        nullptr, name_buf, loading_timeout_ms_, [this]() {
          loading_ = false;
          mark_dirty();
          UiRedraw::trigger_display_update();
        });
    return true;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    bool is_on = on_state_ != nullptr ? *on_state_ : false;

    Color icon_color = is_on ? on_color_ : off_color_;

    int c = 6;
    draw_clipped_box(it, rect_.x, rect_.y, rect_.w, rect_.h,
                     c, icon_color, RetroColors::DIM, true);

    if (loading_) {
      float angle = (millis() % 1000) * 2.0f * 3.14159265f / 1000.0f;
      int cx = rect_.x + 28;
      int cy = rect_.y + rect_.h / 2;
      int r = 10;
      it.line(cx, cy, cx + (int)(cosf(angle) * r),
              cy + (int)(sinf(angle) * r), icon_color);
      if (label_ != nullptr && g_theme.label.font != nullptr) {
        it.printf(rect_.x + 52, rect_.y + rect_.h / 2, g_theme.label.font,
                  icon_color, TextAlign::CENTER_LEFT, "%s", label_);
      }
      return;
    }

    int bx = rect_.x + 28;
    int by = rect_.y + rect_.h / 2;

    it.circle(bx, by, 9, icon_color);
    if (is_on) {
      it.filled_circle(bx, by, 6, icon_color);
      for (int i = 0; i < 8; i++) {
        float a = i * 3.14159265f / 4.0f;
        it.line(bx + (int)(cosf(a) * 11), by + (int)(sinf(a) * 11),
                bx + (int)(cosf(a) * 15), by + (int)(sinf(a) * 15), icon_color);
      }
    }

    if (label_ != nullptr && g_theme.label.font != nullptr) {
      it.printf(rect_.x + 52, rect_.y + rect_.h / 2, g_theme.label.font,
                RetroColors::WHITE, TextAlign::CENTER_LEFT, "%s", label_);
    }

    last_on_state_ = is_on;
  }

 private:
  bool hit_test(int tx, int ty) const {
    const int sx = rect_.w < 40 ? 15 : (rect_.w < 60 ? 10 : 0);
    const int sy = rect_.h < 40 ? 15 : (rect_.h < 60 ? 10 : 0);
    return rect_.contains(tx, ty, sx, sy);
  }

  UiRect rect_;
  const char *label_;
  const bool *on_state_ = nullptr;
  Callback callback_;
  Color on_color_;
  Color off_color_;
  bool loading_ = false;
  uint32_t loading_start_ms_ = 0;
  uint32_t loading_timeout_ms_ = 350;
  bool last_on_state_ = false;
};

class TodoPreviewWidget : public Widget {
 public:
  TodoPreviewWidget(UiRect rect, const std::string *items)
      : rect_(rect), items_(items) {}

  UiRect bounds() const override { return rect_; }

  void update(uint32_t now) override {
    (void)now;
    if (items_ == nullptr) return;
    if (!baseline_set_ || *items_ != last_items_) {
      mark_dirty();
    }
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    const Color border = RetroColors::AMBER;
    const Color bg(10, 12, 18);
    const Color text = RetroColors::WHITE;
    const Color due_ok = RetroColors::AMBER;
    const Color due_overdue = RetroColors::RED;
    const Color dim = RetroColors::GRAY;

    // Clipped-corner container
    draw_clipped_box(it, rect_.x, rect_.y, rect_.w, rect_.h,
                     8, border, bg, false);
    // Inner double-line
    draw_clipped_border(it, rect_.x + 2, rect_.y + 2, rect_.w - 4, rect_.h - 4,
                        6, 6, 6, 6, RetroColors::AMBER_DIM);

    if (items_ == nullptr || items_->empty()) {
      if (g_theme.label.font != nullptr) {
        it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, g_theme.label.font,
                  dim, TextAlign::CENTER, "LIST EMPTY");
      }
      last_items_.clear();
      baseline_set_ = true;
      return;
    }

    int drawn = 0;
    std::size_t start = 0;
    const std::string &src = *items_;
    const int line_h = 28;
    const int base_y = rect_.y + 10;

    while (drawn < 3 && start <= src.size()) {
      std::size_t end = src.find('\n', start);
      std::string line = (end == std::string::npos)
                             ? src.substr(start)
                             : src.substr(start, end - start);

      std::size_t first = line.find_first_not_of(" \t\r\n");
      if (first == std::string::npos) {
        if (end == std::string::npos) break;
        start = end + 1;
        continue;
      }
      std::size_t last = line.find_last_not_of(" \t\r\n");
      line = line.substr(first, last - first + 1);

      if (line.empty() || line == "LIST EMPTY") {
        if (end == std::string::npos) break;
        start = end + 1;
        continue;
      }

      std::string summary = line;
      std::string due;
      std::string status;
      std::size_t p1 = line.find('|');
      if (p1 != std::string::npos) {
        summary = line.substr(0, p1);
        std::string rest = line.substr(p1 + 1);
        std::size_t p2 = rest.find('|');
        if (p2 != std::string::npos) {
          due = rest.substr(0, p2);
          status = rest.substr(p2 + 1);
        } else {
          due = rest;
        }
      }

      auto trim_inplace = [](std::string &value) {
        std::size_t f = value.find_first_not_of(" \t\r\n");
        if (f == std::string::npos) {
          value.clear();
          return;
        }
        std::size_t l = value.find_last_not_of(" \t\r\n");
        value = value.substr(f, l - f + 1);
      };
      trim_inplace(summary);
      trim_inplace(due);
      trim_inplace(status);

      if (summary.empty()) {
        if (end == std::string::npos) break;
        start = end + 1;
        continue;
      }

      if (due == "none" || due == "no-date") {
        due.clear();
      }
      const bool overdue = status.find("overdue") != std::string::npos;

      const int y = base_y + drawn * line_h;
      if (g_theme.label.font != nullptr) {
        // Checkbox as clipped diamond
        int cbx = rect_.x + 18;
        int cby = y + 14;
        it.line(cbx, cby - 5, cbx + 5, cby, border);
        it.line(cbx + 5, cby, cbx, cby + 5, border);
        it.line(cbx, cby + 5, cbx - 5, cby, border);
        it.line(cbx - 5, cby, cbx, cby - 5, border);
      }

      int text_x = rect_.x + 42;
      int max_chars = 28;
      if (!due.empty() && g_theme.label.font != nullptr) {
        it.printf(rect_.x + 42, y, g_theme.label.font, overdue ? due_overdue : due_ok,
                  TextAlign::TOP_LEFT, "%s", due.c_str());
        text_x = rect_.x + 140;
        max_chars = 16;
      }

      if (static_cast<int>(summary.size()) > max_chars) {
        summary = summary.substr(0, max_chars - 3) + "...";
      }
      if (g_theme.label.font != nullptr) {
        it.printf(text_x, y, g_theme.label.font, text, TextAlign::TOP_LEFT, "%s", summary.c_str());
      }

      drawn++;
      if (end == std::string::npos) break;
      start = end + 1;
    }

    if (drawn == 0 && g_theme.label.font != nullptr) {
      it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, g_theme.label.font,
                dim, TextAlign::CENTER, "LIST EMPTY");
    }

    last_items_ = *items_;
    baseline_set_ = true;
  }

 private:
  UiRect rect_;
  const std::string *items_ = nullptr;
  std::string last_items_;
  bool baseline_set_ = false;
};

#include "ui_tab_container.h"
#include "ui_chrome.h"
