#pragma once

#include "esphome.h"
#include "ui_invalidation.h"
#include "ui_types.h"
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

void ui_fast_filled_rectangle(display::Display &it, int x, int y, int w, int h, Color color);

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
    Color border_color = Color(0, 200, 255);
    Color text_color = Color(255, 255, 255);
    esphome::font::Font *font = nullptr;
  };

  TextStyle header   = {nullptr, Color(255, 255, 255), TextAlign::TOP_LEFT};
  TextStyle label    = {nullptr, Color(180, 180, 180), TextAlign::TOP_LEFT};
  TextStyle icon     = {nullptr, Color(255, 255, 255), TextAlign::CENTER};
  Color     info_bg  = Color(0, 0, 0);

  ButtonStyle primary = {Color(0, 200, 255), Color(255, 255, 255), nullptr};
  ButtonStyle accent  = {Color(255, 180, 0), Color(255, 255, 255), nullptr};
  ButtonStyle neutral = {Color(170, 170, 170), Color(255, 255, 255), nullptr};
  ButtonStyle success = {Color(0, 220, 120), Color(255, 255, 255), nullptr};
};

inline Theme g_theme;

class Widget {
 public:
  virtual ~Widget() = default;
  virtual void enter() {}
  virtual void exit() {}
  virtual void layout() {}

  // Default update() polls the visibility_check_ lambda and self-marks dirty
  // when its result flips. This is what makes conditional-area variants (and
  // anything else using set_visibility_condition) repaint when the underlying
  // state changes -- the codegen sets a visibility lambda on each variant
  // child, and this poll detects the flip from active->inactive / vice versa.
  //
  // Subclasses that override update() MUST call Widget::update(now) at the
  // end (or beginning) or they'll lose visibility-driven dirty marking.
  virtual void update(uint32_t now) {
    (void)now;
    if (visibility_check_) {
      const bool current = visibility_check_();
      if (!visibility_baseline_set_ || current != last_visibility_) {
        mark_dirty();
        last_visibility_ = current;
        visibility_baseline_set_ = true;
      }
    }
  }

  virtual bool handle_touch(const TouchEvent &event, uint32_t now) { return false; }
  virtual void draw(display::Display &it, const UiState &state) = 0;

  // Bounding box used by the dirty-rect machinery. Widgets with a fixed
  // rectangle override this to return their rect_; widgets that paint
  // outside a single box can return a conservative superset. Default is
  // the full screen, which means "I might be anywhere -> always redraw me".
  virtual UiRect bounds() const { return UiRect{0, 0, 480, 480}; }

  // Override the rect that mark_dirty() invalidates. By default mark_dirty
  // invalidates bounds(); widgets inside a "container" like a conditional
  // area set this to the container rect so that when they (dis)appear, the
  // shared background + sibling variant widgets all repaint together. Without
  // this, a small per-widget dirty rect would cause the bg to fill the whole
  // container and erase siblings that don't intersect the dirty rect.
  void set_dirty_bounds(UiRect b) {
    dirty_bounds_ = b;
    has_custom_dirty_bounds_ = true;
  }

  // Mark this widget's bounds dirty so it (and only it) is redrawn on the
  // next render pass. Use this from state-change handlers / update() polls.
  void mark_dirty() {
    const UiRect b = has_custom_dirty_bounds_ ? dirty_bounds_ : bounds();
    UiInvalidation::request_rect(UiDirtyRect{b.x, b.y, b.w, b.h});
  }

  // Should this widget actually be drawn this frame? Combines visibility
  // and dirty-rect intersection.
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
  UiRect dirty_bounds_{0, 0, 0, 0};
  bool has_custom_dirty_bounds_ = false;
  bool last_visibility_ = false;
  bool visibility_baseline_set_ = false;
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

  // Poll bound state and mark dirty if it changed since the last draw. This is
  // what makes the "only the label that actually changed redraws" optimisation
  // work for the common bound-bool case (LED on/off, button A/B, etc.).
  void update(uint32_t now) override {
    if (bound_bool_ != nullptr) {
      const bool current = *bound_bool_;
      if (!bool_baseline_set_ || current != last_bool_) {
        mark_dirty();
      }
    }
    Widget::update(now);
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
  Color bg_color_{0, 0, 0};
  bool last_bool_ = false;
  bool bool_baseline_set_ = false;
};

class IconWidget : public Widget {
 public:
  IconWidget(UiRect rect, const char *glyph, const Theme::TextStyle &style)
      : rect_(rect), glyph_(glyph), style_(&style) {}

  UiRect bounds() const override { return rect_; }

  void set_color(Color c) {
    color_override_ = c;
    has_color_override_ = true;
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;
    if (style_ == nullptr || style_->font == nullptr) return;
    if (glyph_ == nullptr || glyph_[0] == '\0') return;

    auto *f = style_->font;
    auto color = has_color_override_ ? color_override_ : style_->color;
    const int cx = rect_.x + rect_.w / 2;
    const int cy = rect_.y + rect_.h / 2;
    it.printf(cx, cy, f, color, TextAlign::CENTER, "%s", glyph_);
  }

 private:
  UiRect rect_;
  const char *glyph_;
  const Theme::TextStyle *style_ = nullptr;
  Color color_override_{0, 0, 0};
  bool has_color_override_ = false;
};

class ButtonWidget : public Widget {
 public:
  using Callback = std::function<void()>;

  ButtonWidget(UiRect rect, const char *label, Callback callback, const Theme::ButtonStyle &style)
      : rect_(rect), label_(label), callback_(callback), style_(&style) {}

  UiRect bounds() const override { return rect_; }

  // Configure an optional icon glyph drawn above the label using the
  // provided text style (typically `g_theme.icon` so the MDI font is used).
  void set_icon(const char *glyph, const Theme::TextStyle *icon_style) {
    icon_glyph_ = glyph;
    icon_style_ = icon_style;
  }

  void update(uint32_t now) override {
    if (loading_timeout_ms_ > 0 && loading_ && (now - loading_start_ms_ > loading_timeout_ms_)) {
      loading_ = false;
      mark_dirty();
    }
    Widget::update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    if (event.type != TouchType::Tap) return false;
    if (loading_) return false;
    
    // Safety: Don't trigger if API is not connected to avoid crashes
    if (esphome::api::global_api_server == nullptr || !esphome::api::global_api_server->is_connected()) {
      return false;
    }

    if (!hit_test(event.x, event.y)) return false;
    loading_ = true;
    loading_start_ms_ = now;
    mark_dirty();
    if (callback_) callback_();

    // Schedule a delayed reset to end the loading state and trigger redraw
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

    it.rectangle(rect_.x, rect_.y, rect_.w, rect_.h, bc);
    ui_fast_filled_rectangle(it, rect_.x + 1, rect_.y + 1, rect_.w - 2, rect_.h - 2, Color(40, 40, 40));
    if (loading_) {
      it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, f, tc, TextAlign::CENTER, "...");
      return;
    }

    const bool has_icon = icon_glyph_ != nullptr && icon_glyph_[0] != '\0'
                         && icon_style_ != nullptr && icon_style_->font != nullptr;
    const bool has_label = label_ != nullptr && label_[0] != '\0';
    const int cx = rect_.x + rect_.w / 2;
    const int cy = rect_.y + rect_.h / 2;

    if (has_icon && has_label) {
      it.printf(cx, cy - 10, icon_style_->font, tc, TextAlign::CENTER, "%s", icon_glyph_);
      it.printf(cx, cy + 12, f, tc, TextAlign::CENTER, "%s", label_);
    } else if (has_icon) {
      it.printf(cx, cy, icon_style_->font, tc, TextAlign::CENTER, "%s", icon_glyph_);
    } else {
      it.printf(cx, cy, f, tc, TextAlign::CENTER, "%s", label_);
    }
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
  const char *icon_glyph_ = nullptr;
  const Theme::TextStyle *icon_style_ = nullptr;
  bool loading_ = false;
  uint32_t loading_start_ms_ = 0;
  uint32_t loading_timeout_ms_ = 350;
};

class ImageToggleWidget : public Widget {
 public:
  using Callback = std::function<void()>;

  ImageToggleWidget(UiRect rect, const char *label, const bool *on_state,
                    const char *icon_glyph, Callback callback,
                    Color on_color = Color(255, 180, 0),
                    Color off_color = Color(80, 80, 80))
      : rect_(rect), label_(label), on_state_(on_state),
        icon_glyph_(icon_glyph), callback_(std::move(callback)), on_color_(on_color),
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
    Widget::update(now);
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

    Color base = Color(40, 40, 40);
    Color icon_color = is_on ? on_color_ : off_color_;

    it.rectangle(rect_.x, rect_.y, rect_.w, rect_.h, icon_color);
    ui_fast_filled_rectangle(it, rect_.x + 1, rect_.y + 1, rect_.w - 2,
                             rect_.h - 2, base);

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

    int icon_x = rect_.x + 28;
    int icon_y = rect_.y + rect_.h / 2;
    const bool has_mdi_icon =
        icon_glyph_ != nullptr && icon_glyph_[0] != '\0' &&
        g_theme.icon.font != nullptr;

    if (has_mdi_icon) {
      it.printf(icon_x, icon_y, g_theme.icon.font, icon_color, TextAlign::CENTER,
                "%s", icon_glyph_);
    } else {
      it.circle(icon_x, icon_y, 9, icon_color);
      if (is_on) {
        it.filled_circle(icon_x, icon_y, 6, icon_color);
        for (int i = 0; i < 8; i++) {
          float a = i * 3.14159265f / 4.0f;
          it.line(icon_x + (int)(cosf(a) * 11), icon_y + (int)(sinf(a) * 11),
                  icon_x + (int)(cosf(a) * 15), icon_y + (int)(sinf(a) * 15), icon_color);
        }
      }
    }

    if (label_ != nullptr && g_theme.label.font != nullptr) {
      it.printf(rect_.x + 52, rect_.y + rect_.h / 2, g_theme.label.font,
                Color(255, 255, 255), TextAlign::CENTER_LEFT, "%s", label_);
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
  const char *icon_glyph_ = nullptr;
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
  using Callback = std::function<void()>;

  TodoPreviewWidget(UiRect rect, const std::string *items,
                    int max_items = 4, int row_height = 30,
                    bool scrollable = false, bool checkable = false,
                    Callback on_tap = nullptr,
                    const char *incomplete_icon = "",
                    const char *complete_icon = "",
                    const char *todo_entity = "")
      : rect_(rect), items_(items), scrollable_(scrollable),
        checkable_(checkable), on_tap_(std::move(on_tap)),
        incomplete_icon_(incomplete_icon),
        complete_icon_(complete_icon), todo_entity_(todo_entity) {
    if (max_items < 1) max_items_ = 1;
    else if (max_items > 10) max_items_ = 10;
    else max_items_ = max_items;

    if (row_height < 20) row_height_ = 20;
    else if (row_height > 80) row_height_ = 80;
    else row_height_ = row_height;
  }

  UiRect bounds() const override { return rect_; }

  bool handle_touch(const TouchEvent &event, uint32_t now) override {
    (void)now;
    if (!rect_.contains(event.x, event.y)) return false;

    if (event.type == TouchType::Down && scrollable_) {
      dragging_ = true;
      return true;
    }

    if (event.type == TouchType::Move && dragging_ && scrollable_) {
      const int content_h = static_cast<int>(rows_.size()) * row_height_;
      const int view_h = content_height();
      const int max_scroll = content_h > view_h ? (content_h - view_h) : 0;
      int next = scroll_offset_ - event.dy;
      if (next < 0) next = 0;
      if (next > max_scroll) next = max_scroll;
      if (next != scroll_offset_) {
        scroll_offset_ = next;
        mark_dirty();
      }
      return true;
    }

    if (event.type == TouchType::Up) {
      dragging_ = false;
      return scrollable_;
    }

    if (event.type == TouchType::Tap && checkable_) {
      const int idx = row_at(event.x, event.y);
      if (idx < 0 || idx >= static_cast<int>(rows_.size())) return true;
      rows_[idx].completed = !rows_[idx].completed;
      mark_dirty();
      if (rows_[idx].completed) {
        push_complete_to_ha(rows_[idx].summary);
      } else {
        push_needs_action_to_ha(rows_[idx].summary);
      }
      return true;
    }

    if (event.type == TouchType::Tap && !checkable_) {
      if (on_tap_) on_tap_();
      return true;
    }

    return true;
  }

  void update(uint32_t now) override {
    (void)now;
    if (items_ == nullptr) return;
    if (!baseline_set_ || *items_ != last_items_) {
      parse_rows(*items_);
      if (!scrollable_) scroll_offset_ = 0;
      mark_dirty();
    }
    Widget::update(now);
  }

  void draw(display::Display &it, const UiState &state) override {
    (void)state;

    const Color border(255, 180, 0);
    const Color bg(20, 20, 20);
    const Color text(255, 255, 255);
    const Color due_ok(255, 180, 0);
    const Color due_overdue(255, 60, 60);
    const Color dim(80, 80, 80);

    it.rectangle(rect_.x, rect_.y, rect_.w, rect_.h, border);
    ui_fast_filled_rectangle(it, rect_.x + 1, rect_.y + 1, rect_.w - 2, rect_.h - 2, bg);

    if (items_ == nullptr || items_->empty()) {
      if (g_theme.label.font != nullptr) {
        it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, g_theme.label.font,
                  dim, TextAlign::CENTER, "LIST EMPTY");
      }
      last_items_.clear();
      baseline_set_ = true;
      return;
    }

    if (!baseline_set_ || *items_ != last_items_) {
      parse_rows(*items_);
    }

    if (rows_.empty()) {
      if (g_theme.label.font != nullptr) {
        it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, g_theme.label.font,
                  dim, TextAlign::CENTER, "LIST EMPTY");
      }
      last_items_ = *items_;
      baseline_set_ = true;
      return;
    }

    const int top_padding = 8;
    const int available_h = content_height();
    const int content_h = static_cast<int>(rows_.size()) * row_height_;
    const int max_scroll = content_h > available_h ? (content_h - available_h) : 0;
    if (!scrollable_) {
      scroll_offset_ = 0;
    } else if (scroll_offset_ > max_scroll) {
      scroll_offset_ = max_scroll;
    }

    int drawn = 0;
    const int max_rows_by_height = rect_.h > top_padding
        ? (rect_.h - top_padding) / row_height_ : 0;
    const int row_limit = (max_rows_by_height < max_items_) ? max_rows_by_height : max_items_;
    const int start_index = scrollable_ ? (scroll_offset_ / row_height_) : 0;
    const int pixel_offset = scrollable_ ? (scroll_offset_ % row_height_) : 0;

    for (int i = start_index; i < static_cast<int>(rows_.size()) && drawn < row_limit; i++) {
      auto &row = rows_[i];
      const int y = rect_.y + top_padding + drawn * row_height_ - pixel_offset;
      if (y + row_height_ < rect_.y + top_padding) {
        continue;
      }
      if (y > rect_.y + rect_.h - 2) {
        break;
      }

      const bool overdue = row.overdue;
      const bool completed = row.completed;
      std::string summary = row.summary;

      if (g_theme.label.font != nullptr) {
        const Color check_color = completed ? Color(0, 220, 120) : border;
        if (g_theme.icon.font != nullptr &&
            incomplete_icon_ != nullptr && complete_icon_ != nullptr &&
            incomplete_icon_[0] != '\0' && complete_icon_[0] != '\0') {
          it.printf(rect_.x + 16, y + row_height_ / 2, g_theme.icon.font,
                    check_color, TextAlign::CENTER,
                    "%s", completed ? complete_icon_ : incomplete_icon_);
        } else {
          it.printf(rect_.x + 10, y, g_theme.label.font,
                    check_color, TextAlign::TOP_LEFT,
                    "%s", completed ? "[x]" : "[ ]");
        }
      }

      int text_x = rect_.x + 38;
      int max_chars = 28;
      if (!row.due.empty() && g_theme.label.font != nullptr) {
        it.printf(rect_.x + 38, y, g_theme.label.font, overdue ? due_overdue : due_ok,
                  TextAlign::TOP_LEFT, "%s", row.due.c_str());
        text_x = rect_.x + 134;
        max_chars = 16;
      }
      if (static_cast<int>(summary.size()) > max_chars) {
        summary = summary.substr(0, max_chars - 3) + "...";
      }
      if (g_theme.label.font != nullptr) {
        const Color summary_color = completed ? dim : text;
        it.printf(text_x, y, g_theme.label.font, summary_color, TextAlign::TOP_LEFT,
                  "%s", summary.c_str());
      }

      drawn++;
    }

    if (drawn == 0 && g_theme.label.font != nullptr) {
      it.printf(rect_.x + rect_.w / 2, rect_.y + rect_.h / 2, g_theme.label.font,
                dim, TextAlign::CENTER, "LIST EMPTY");
    }

    last_items_ = *items_;
    baseline_set_ = true;
  }

 private:
  struct TodoRow {
    std::string summary;
    std::string due;
    bool overdue = false;
    bool completed = false;
  };

  static void trim_inplace(std::string &value) {
    std::size_t f = value.find_first_not_of(" \t\r\n");
    if (f == std::string::npos) {
      value.clear();
      return;
    }
    std::size_t l = value.find_last_not_of(" \t\r\n");
    value = value.substr(f, l - f + 1);
  }

  int content_height() const {
    const int top_padding = 8;
    int h = rect_.h - top_padding - 2;
    return h > 0 ? h : 0;
  }

  int row_at(int tx, int ty) const {
    (void)tx;
    const int top = rect_.y + 8;
    const int local_y = ty - top + (scrollable_ ? scroll_offset_ : 0);
    if (local_y < 0) return -1;
    const int idx = local_y / row_height_;
    if (idx < 0 || idx >= static_cast<int>(rows_.size())) return -1;
    return idx;
  }

  void parse_rows(const std::string &src) {
    rows_.clear();
    std::size_t start = 0;
    while (start <= src.size()) {
      std::size_t end = src.find('\n', start);
      std::string line = (end == std::string::npos)
          ? src.substr(start)
          : src.substr(start, end - start);
      trim_inplace(line);
      if (!line.empty() && line != "LIST EMPTY") {
        TodoRow row;
        row.summary = line;
        std::size_t p1 = line.find('|');
        if (p1 != std::string::npos) {
          row.summary = line.substr(0, p1);
          std::string rest = line.substr(p1 + 1);
          std::size_t p2 = rest.find('|');
          std::string status;
          if (p2 != std::string::npos) {
            row.due = rest.substr(0, p2);
            status = rest.substr(p2 + 1);
          } else {
            row.due = rest;
          }
          trim_inplace(status);
          row.overdue = status.find("overdue") != std::string::npos;
          row.completed = status.find("completed") != std::string::npos;
        }
        trim_inplace(row.summary);
        trim_inplace(row.due);
        if (row.due == "none" || row.due == "no-date") {
          row.due.clear();
        }
        if (!row.summary.empty()) {
          rows_.push_back(row);
        }
      }
      if (end == std::string::npos) break;
      start = end + 1;
    }
  }

  void push_todo_status(const std::string &summary, const char *status) {
    if (todo_entity_ == nullptr || todo_entity_[0] == '\0') return;
    auto *api = esphome::api::global_api_server;
    if (api == nullptr || !api->is_connected()) return;
    esphome::api::HomeAssistantServiceCallAction<> call(api, false);
    call.set_service("todo.update_item");
    call.init_data(3);
    call.add_data("entity_id", todo_entity_);
    call.add_data("item", summary);
    call.add_data("status", status);
    call.play();
  }

  void push_complete_to_ha(const std::string &summary) {
    push_todo_status(summary, "completed");
  }

  void push_needs_action_to_ha(const std::string &summary) {
    push_todo_status(summary, "needs_action");
  }

  UiRect rect_;
  const std::string *items_ = nullptr;
  int max_items_ = 4;
  int row_height_ = 30;
  bool scrollable_ = false;
  bool checkable_ = false;
  Callback on_tap_;
  const char *incomplete_icon_ = nullptr;
  const char *complete_icon_ = nullptr;
  const char *todo_entity_ = nullptr;
  std::vector<TodoRow> rows_;
  int scroll_offset_ = 0;
  bool dragging_ = false;
  std::string last_items_;
  bool baseline_set_ = false;
};

#include "ui_tab_container.h"
#include "ui_chrome.h"
