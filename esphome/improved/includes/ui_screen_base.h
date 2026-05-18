#pragma once

#include "esphome.h"
#include "ui_types.h"
#include "ui_widgets.h"
#include <memory>
#include <vector>

struct UiState;

class Screen {
 public:
  virtual ~Screen() = default;
  virtual void enter() {}
  virtual void exit() {}
  virtual void layout() {}
  virtual void update(uint32_t now) = 0;
  virtual bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) = 0;
  virtual void draw(display::Display &it, const UiState &state) = 0;
};

class GenericScreen : public Screen {
 public:
  GenericScreen() = default;

  void add_widget(std::unique_ptr<Widget> widget) {
    widgets_.push_back(std::move(widget));
  }

  template<typename T, typename... Args>
  T* emplace_widget(Args&&... args) {
    auto widget = std::make_unique<T>(std::forward<Args>(args)...);
    T* ptr = widget.get();
    widgets_.push_back(std::move(widget));
    return ptr;
  }

  void enter() override {
    for (auto &w : widgets_) w->enter();
  }

  void exit() override {
    for (auto &w : widgets_) w->exit();
  }

  void layout() override {
    for (auto &w : widgets_) w->layout();
  }

  void update(uint32_t now) override {
    for (auto &w : widgets_) w->update(now);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) override {
    for (auto &w : widgets_) {
      if (w->is_visible(state) && w->handle_touch(event, now)) return true;
    }
    return false;
  }

  void draw(display::Display &it, const UiState &state) override {
    for (auto &w : widgets_) {
      if (w->is_visible(state)) w->draw(it, state);
    }
  }

 private:
  std::vector<std::unique_ptr<Widget>> widgets_;
};
