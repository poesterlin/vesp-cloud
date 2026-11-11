#pragma once

#include "esphome.h"
#include "ui_state.h"
#include "ui_types.h"
#include "ui_widgets.h"
#include "ui_screen_base.h"
#include "ui_invalidation.h"
#include "ui_redraw.h"
#include "ui_scrollable_detail.h"
#include <memory>
#include <string>
#include <vector>
#include <map>

namespace esphome {
namespace font {
class Font;
}
}  // namespace esphome

class ScreenController {
 public:
  ScreenController() {
    // Pre-create all screen slots
    for (int i = 0; i <= static_cast<int>(UiScreenId::Home); i++) {
      auto id = static_cast<UiScreenId>(i);
      auto screen = std::make_unique<GenericScreen>();
      screens_[id] = screen.get();
      owned_screens_.push_back(std::move(screen));
    }
    current_ = screens_.at(UiScreenId::Home);
  }

  GenericScreen* get_screen(UiScreenId id) {
    auto it = screens_.find(id);
    if (it != screens_.end()) {
      return static_cast<GenericScreen*>(it->second);
    }
    return nullptr;
  }

  GenericScreen* create_screen(UiScreenId id) {
    auto screen = std::make_unique<GenericScreen>();
    auto *ptr = screen.get();
    screens_[id] = ptr;
    owned_screens_.push_back(std::move(screen));
    return ptr;
  }

  void register_screen(UiScreenId id, Screen *screen) {
    screens_[id] = screen;
  }

  void set_current(UiScreenId id) {
    current_->exit();
    current_id_ = id;
    current_ = screens_.at(id);
    current_->enter();
    current_->layout();
    UiRedraw::request_full();
  }

  void navigate_to(UiScreenId id) {
    set_current(id);
  }

  UiScreenId current_id() const { return current_id_; }

  void update(uint32_t now, const UiState &state) {
    current_->update(now, state);
  }

  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) {
    (void)state;
    if (g_confirmation_popup.visible()) {
      return g_confirmation_popup.handle_touch(event, now);
    }
    if (current_id_ == UiScreenId::Home &&
        event.type == TouchType::Up &&
        abs(event.dx) > 60 && abs(event.dx) > abs(event.dy)) {
      UiState& s = const_cast<UiState&>(state);
      if (event.dx < 0) {
        s.home_page_index = (s.home_page_index + 1) % s.home_total_pages;
      } else {
        s.home_page_index = (s.home_page_index - 1 + s.home_total_pages) % s.home_total_pages;
      }
      UiInvalidation::request_full();
      return true;
    }

    return current_->handle_touch(event, now, state);
  }

  void draw(display::Display &it, const UiState &state) {
    current_->draw(it, state);
    if (g_confirmation_popup.visible()) g_confirmation_popup.draw(it);
  }

  Screen* current() { return current_; }


 private:
  UiScreenId current_id_ = UiScreenId::Home;
  Screen *current_ = nullptr;
  std::map<UiScreenId, Screen*> screens_;
  std::vector<std::unique_ptr<GenericScreen>> owned_screens_;
};

struct EntityAction {
  const char *entity_id;
  const char *service;
};

inline void setup_ui_screens(ScreenController &screens, UiState &state,
                           std::function<void(const std::string&, const std::string&)> on_action,
                           std::function<void()> dismiss_notification = nullptr) {
  auto make_ha_callback = [on_action](const char* entity, const char* service) {
    return [on_action, entity, service]() {
      if (on_action) on_action(entity, service);
    };
  };

  auto *home = screens.get_screen(UiScreenId::Home);
  {
    auto p0 = [&state]() { return state.home_page_index == 0; };
    // Page: Shared fixture
    auto *background = home->emplace_widget<RectWidget>(UiRect{0, 0, 480, 480}, Color(0, 0, 0));
    background->set_visibility_condition(p0);

    auto *title = home->emplace_widget<LabelWidget>(UiRect{20, 20, 440, 45}, "MIGRATION PARITY", g_theme.label_large);
    title->set_visibility_condition(p0);
    title->set_bg_color(Color(0, 0, 0));
    title->set_color(Color(0, 240, 255));

    auto *medium = home->emplace_widget<LabelWidget>(UiRect{20, 80, 440, 40}, "Same project, two renderers", g_theme.header);
    medium->set_visibility_condition(p0);
    medium->set_bg_color(Color(0, 0, 0));
    medium->set_color(Color(255, 255, 255));

    auto *bound = home->emplace_widget<LabelWidget>(UiRect{20, 145, 440, 35}, "", g_theme.label);
    bound->set_visibility_condition(p0);
    bound->set_bg_color(Color(0, 0, 0));
    bound->set_color(Color(255, 255, 255));
    bound->bind_text_fn([&state]() {
      std::string out;
      out.reserve(23);
      out.append("State: ");
      out.append(*state.txt_sensor_demo.ptr());
      return out;
    });

    auto *center = home->emplace_widget<LabelWidget>(UiRect{20, 205, 440, 35}, "Centered label", g_theme.label);
    center->set_visibility_condition(p0);
    center->set_bg_color(Color(0, 0, 0));
    center->set_align(TextAlign::TOP_CENTER);
    center->set_color(Color(255, 255, 255));

    auto *icon = home->emplace_widget<IconWidget>(UiRect{210, 280, 60, 60}, "\xF3\xB0\x8C\xB5", g_theme.icon);
    icon->set_color(Color(255, 255, 255));
    icon->set_visibility_condition(p0);

    auto *next = home->emplace_widget<ButtonWidget>(UiRect{330, 432, 130, 36}, "Next", [](){}, g_theme.primary);
    next->set_visibility_condition(p0);
    next->set_background_color(Color(26, 26, 26));

  }

  home->emplace_widget<PageIndicatorWidget>(460);
  home->emplace_widget<LoadingWidget>();

}
