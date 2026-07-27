#pragma once

#include "ui_runtime_manifest.h"
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

// Adapters supplied once by generic firmware. No project-specific C++ is
// needed: the manifest supplies entity IDs, services, and screen IDs.
struct RuntimeContext {
  using StateSink = std::function<void(const std::string &)>;
  std::function<void(const std::string &, const std::string &, StateSink)> subscribe_state;
  std::function<void(const std::string &, const std::string &)> call_service;
  std::function<const char *(const std::string &)> resolve_icon;
};

class RuntimeUi {
 public:
  bool load(const uint8_t *bytes, size_t size, RuntimeContext context, std::string *error = nullptr) {
    if (loaded_) {
      if (error != nullptr) *error = "runtime manifest is already loaded";
      return false;
    }
    Manifest next;
    if (!Reader::parse(bytes, size, next, error)) return false;
    manifest_ = std::move(next);
    context_ = std::move(context);
    screens_.clear();
    screens_.reserve(manifest_.screens.size());
    for (size_t i = 0; i < manifest_.screens.size(); ++i) {
      auto screen = std::make_unique<GenericScreen>();
      const auto &background = manifest_.screens[i].background;
      screen->emplace_widget<RectWidget>(
          UiRect{0, 0, 480, 480},
          Color(background[0], background[1], background[2]));
      screens_.push_back(std::move(screen));
    }

    for (size_t index = 0; index < manifest_.widgets.size(); ++index)
      create_widget(manifest_.widgets[index]);
    current_ = 0;
    history_.clear();
    screens_[current_]->enter();
    screens_[current_]->layout();

    // The vector is complete and will no longer reallocate, so each captured
    // binding index resolves to stable std::string storage.
    for (size_t i = 0; i < manifest_.bindings.size(); ++i) {
      if (!context_.subscribe_state) break;
      const auto &record = manifest_.bindings[i];
      const std::string entity = manifest_.strings[record.entity];
      const std::string attribute = record.attribute == kNone16 ? "" : manifest_.strings[record.attribute];
      context_.subscribe_state(entity, attribute, [this, i](const std::string &value) {
        if (i >= manifest_.bindings.size() || manifest_.bindings[i].value == value) return;
        manifest_.bindings[i].value = value;
        UiRedraw::trigger_display_update();
      });
    }
    UiInvalidation::request_full("vespui:load");
    loaded_ = true;
    return true;
  }

  void update(uint32_t now, const UiState &state) { current_screen()->update(now, state); }
  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) {
    return current_screen()->handle_touch(event, now, state);
  }
  void draw(display::Display &display, const UiState &state) { current_screen()->draw(display, state); }
  ::Screen *current_screen() { return screens_[current_].get(); }
  const Manifest &manifest() const { return manifest_; }
  size_t current_screen_id() const { return current_; }

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
        auto *label = screen->emplace_widget<LabelWidget>(rect, string_or_empty(record.content), g_theme.label);
        label->set_color(fg);
        if (record.binding != kNone8) {
          label->bind_text_fn([this, binding = record.binding]() {
            return manifest_.bindings[binding].value;
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

  void navigate(size_t target, bool remember = true) {
    if (target >= screens_.size() || target == current_) return;
    screens_[current_]->exit();
    if (remember) history_.push_back(current_);
    current_ = target;
    screens_[current_]->enter();
    screens_[current_]->layout();
    UiInvalidation::request_full("vespui:navigate");
  }

  void dispatch(uint8_t index) {
    if (index == kNone8 || index >= manifest_.actions.size()) return;
    const auto &action = manifest_.actions[index];
    switch (action.kind) {
      case ActionKind::Service:
        if (context_.call_service)
          context_.call_service(manifest_.strings[action.first], string_or_empty(action.second));
        break;
      case ActionKind::Navigate:
        navigate(action.first);
        break;
      case ActionKind::Back:
        if (!history_.empty()) {
          const size_t target = history_.back();
          history_.pop_back();
          navigate(target, false);
        }
        break;
      case ActionKind::Next:
        navigate((current_ + 1) % screens_.size());
        break;
      case ActionKind::Previous:
        navigate((current_ + screens_.size() - 1) % screens_.size());
        break;
    }
  }

  Manifest manifest_;
  RuntimeContext context_;
  std::vector<std::unique_ptr<GenericScreen>> screens_;
  std::vector<size_t> history_;
  size_t current_ = 0;
  bool loaded_ = false;
};

}  // namespace vespui
