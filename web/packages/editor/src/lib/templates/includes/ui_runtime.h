#pragma once

#include "ui_runtime_manifest.h"
#include "ui_runtime_session.h"
#include "ui_screen_base.h"
#include "ui_widget_rect.h"
#include "ui_widget_label.h"
#include "ui_widget_icon.h"
#include "ui_widget_button.h"
#include <functional>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace vespui {

class RuntimeUi {
 public:
  bool load(const uint8_t *bytes, size_t size, RuntimeContext context, std::string *error = nullptr) {
    return session_.load(bytes, size, std::move(context),
        [this](const Manifest &, std::string *) {
          screens_.clear();
          screens_.reserve(manifest_.screens.size());
          for (const auto &record : manifest_.screens) {
            auto screen = std::make_unique<GenericScreen>();
            const auto &background = record.background;
            screen->emplace_widget<RectWidget>(UiRect{0, 0, 480, 480},
                Color(background[0], background[1], background[2]));
            screens_.push_back(std::move(screen));
          }
          for (const auto &record : manifest_.widgets) create_widget(record);
          return true;
        }, [this](size_t target) {
          if (entered_) screens_[current_]->exit();
          current_ = target;
          screens_[current_]->enter();
          screens_[current_]->layout();
          entered_ = true;
          UiInvalidation::request_full("vespui:activate");
        }, [] { UiRedraw::trigger_display_update(); }, error);
  }

  void update(uint32_t now, const UiState &state) { current_screen()->update(now, state); }
  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) {
    return current_screen()->handle_touch(event, now, state);
  }
  void draw(display::Display &display, const UiState &state) { current_screen()->draw(display, state); }
  ::Screen *current_screen() { return screens_[current_].get(); }
  const Manifest &manifest() const { return manifest_; }
  size_t current_screen_id() const { return current_; }
  bool uses_external_manifest() const { return session_.uses_external_manifest(); }
  const std::string &boot_source_error() const { return session_.boot_source_error(); }
  uint64_t manifest_fingerprint() const { return session_.fingerprint(); }

 private:
  const char *string_or_empty(uint16_t index) const {
    return index == kNone16 ? "" : manifest_.strings[index].c_str();
  }

  void install_visibility(::Widget *widget, const vespui::Widget &record) {
    widget->set_visibility_condition([this, flags = record.flags, condition = record.condition]() {
      return (flags & 1) != 0 && manifest_.condition_matches(condition);
    });
  }

  void create_widget(const vespui::Widget &record) {
    auto *screen = screens_[record.screen].get();
    const UiRect rect{record.x, record.y, record.w, record.h};
    const Color bg(record.background[0], record.background[1], record.background[2]);
    const Color fg(record.foreground[0], record.foreground[1], record.foreground[2]);
    ::Widget *base = nullptr;
    switch (record.kind) {
      case WidgetKind::Rectangle:
        base = screen->emplace_widget<RectWidget>(rect, bg);
        break;
      case WidgetKind::Text: {
        const auto &style = record.font_size == 2 ? g_theme.label_large :
                            record.font_size == 1 ? g_theme.header : g_theme.label;
        auto *label = screen->emplace_widget<LabelWidget>(rect, string_or_empty(record.content), style);
        label->set_color(fg);
        label->set_bg_color(bg);
        label->set_align(record.align == 2 ? TextAlign::TOP_RIGHT :
                         record.align == 1 ? TextAlign::TOP_CENTER : TextAlign::TOP_LEFT);
        if (record.binding != kNone8 || !record.text_parts.empty()) {
          label->bind_text_fn([this, text_record = &record]() {
            return manifest_.text_value(*text_record);
          });
        }
        base = label;
        break;
      }
      case WidgetKind::Button: {
        auto *button = screen->emplace_widget<ButtonWidget>(
            rect, string_or_empty(record.content),
            [this, action = record.action]() { dispatch(action); }, g_theme.primary);
        button->set_background_color(bg);
        button->set_foreground_color(fg);
#ifdef VESPUI_SIMULATOR
        // Simulator actions use an isolated mock service adapter.
        button->set_allow_offline_action(true);
#endif
        if (record.action != kNone8 &&
            record.action < manifest_.actions.size() &&
            manifest_.actions[record.action].kind != ActionKind::Service) {
          button->set_allow_offline_action(true);
        }
        base = button;
        break;
      }
      case WidgetKind::Icon: {
        auto *icon = screen->emplace_widget<IconWidget>(
            rect, string_or_empty(record.content), g_theme.icon);
        icon->set_color(fg);
        base = icon;
        break;
      }
    }
    if (base != nullptr) install_visibility(base, record);
  }

  void dispatch(uint8_t index) { session_.dispatch(index); }

  RuntimeSession session_;
  const Manifest &manifest_ = session_.manifest();
  std::vector<std::unique_ptr<GenericScreen>> screens_;
  size_t current_ = 0;
  bool entered_ = false;
};

}  // namespace vespui
