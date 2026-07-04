#pragma once

#include "esphome.h"
#include "ui_state.h"
#include "ui_types.h"
#include "ui_widgets.h"
#include "ui_screen_base.h"
#include "ui_invalidation.h"
#include "ui_redraw.h"
#include "ui_scrollable_detail.h"
#include "ui_retro.h"
#include <memory>
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
    for (int i = 0; i <= static_cast<int>(UiScreenId::Scenes); i++) {
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

  void update(uint32_t now) { current_->update(now); }

  bool handle_touch(const TouchEvent &event, uint32_t now, const UiState &state) {
    (void)state;
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

  void draw(display::Display &it, const UiState &state) { current_->draw(it, state); }

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
                           std::function<void(const std::string&, const std::string&)> on_action) {
  auto make_ha_callback = [on_action](const char* entity, const char* service) {
    return [on_action, entity, service]() {
      if (on_action) on_action(entity, service);
    };
  };

  // ===================== HOME SCREEN =====================
  {
    auto *home = screens.get_screen(UiScreenId::Home);

    home->emplace_widget<HeaderWidget>(g_theme.header.font, g_theme.label.font,
                                       nullptr, nullptr);

    // ===== PAGE 0: Main Dashboard =====
    {
      auto p0 = [&state]() { return state.home_page_index == 0; };

      auto *btn_lamp = home->emplace_widget<ButtonWidget>(
          UiRect{20, 65, 440, 70}, "SWITCH LAMP",
          make_ha_callback("switch.led_stehlampe_switch", "switch.toggle"),
          g_theme.primary);
      btn_lamp->set_visibility_condition(p0);

      auto *led_label = home->emplace_widget<LabelWidget>(
          UiRect{20, 148, 440, 20}, "", g_theme.label);
      led_label->bind(state.led_switch.ptr(), "LAMP: ON", "LAMP: OFF");
      led_label->set_visibility_condition(p0);

      auto *tabs = home->emplace_widget<TabContainerWidget>(
          UiRect{20, 178, 440, 270},
          RetroColors::DIM, g_theme.primary);
      tabs->set_visibility_condition(p0);
      const Color tab_bg = RetroColors::DIM;

      int t0 = tabs->add_tab("STATUS");
      {
        auto *l = tabs->emplace_child<LabelWidget>(t0, UiRect{30, 234, 420, 20},
            "Lamp Status", g_theme.header);
        l->set_bg_color(tab_bg);
        auto *v = tabs->emplace_child<LabelWidget>(t0, UiRect{30, 264, 420, 20},
            "", g_theme.label);
        v->set_bg_color(tab_bg);
        v->bind(state.led_switch.ptr(), "ON", "OFF");
      }
      {
        auto *l = tabs->emplace_child<LabelWidget>(t0, UiRect{30, 290, 420, 20},
            "", g_theme.label);
        l->set_bg_color(tab_bg);
        l->bind(state.todo_pending_count.ptr(), "PENDING: %d");
      }
      {
        tabs->emplace_child<TodoPreviewWidget>(
            t0, UiRect{30, 316, 420, 86}, state.todo_items_formatted.ptr());
      }
      {
        tabs->emplace_child<ButtonWidget>(
            t0, UiRect{50, 408, 340, 34}, "OPEN TO-DO",
            [&screens]() { screens.navigate_to(UiScreenId::Todo); }, g_theme.accent);
      }

      int t1 = tabs->add_tab("CONTROLS");
      tabs->emplace_child<ButtonWidget>(t1, UiRect{50, 234, 340, 55},
          "BTN A", [&state]() { state.button_a_on = !state.button_a_on; },
          g_theme.accent);
      tabs->emplace_child<ButtonWidget>(t1, UiRect{50, 305, 340, 55},
          "BTN B", [&state]() { state.button_b_on = !state.button_b_on; },
          g_theme.accent);
      {
        auto *l = tabs->emplace_child<LabelWidget>(t1, UiRect{30, 378, 420, 20},
            "Tap buttons above", g_theme.label);
        l->set_bg_color(tab_bg);
      }

      int t2 = tabs->add_tab("INFO");
      {
        auto *l = tabs->emplace_child<LabelWidget>(t2, UiRect{30, 234, 420, 20},
            "vESP.cloud v2.0", g_theme.header);
        l->set_bg_color(tab_bg);
      }
      {
        auto *l = tabs->emplace_child<LabelWidget>(t2, UiRect{30, 264, 420, 20},
            "HW: ESP32-S3 + ST7701S + GT911", g_theme.label);
        l->set_bg_color(tab_bg);
      }
      {
        auto *l = tabs->emplace_child<LabelWidget>(t2, UiRect{30, 294, 420, 20},
            "SW: ESPHome + custom UI", g_theme.label);
        l->set_bg_color(tab_bg);
      }
      {
        auto *l = tabs->emplace_child<LabelWidget>(t2, UiRect{30, 324, 420, 20},
            "Built for wall-mount 480x480", g_theme.label);
        l->set_bg_color(tab_bg);
      }
    }

    // ===== PAGE 1: Quick Controls =====
    {
      auto p1 = [&state]() { return state.home_page_index == 1; };

      home->emplace_widget<LabelWidget>(
          UiRect{20, 70, 440, 30}, "Quick Controls", g_theme.header)
          ->set_visibility_condition(p1);

      home->emplace_widget<ButtonWidget>(
          UiRect{20, 115, 440, 80}, "SCENES",
          [&screens]() { screens.navigate_to(UiScreenId::Scenes); },
          g_theme.primary)->set_visibility_condition(p1);

      home->emplace_widget<RectWidget>(
          UiRect{20, 220, 440, 1}, RetroColors::CYAN_DIM)
          ->set_visibility_condition(p1);

      home->emplace_widget<ButtonWidget>(
          UiRect{20, 240, 210, 70}, "BTN A",
          [&state]() { state.button_a_on = !state.button_a_on; },
          g_theme.accent)->set_visibility_condition(p1);

      home->emplace_widget<ButtonWidget>(
          UiRect{250, 240, 210, 70}, "BTN B",
          [&state]() { state.button_b_on = !state.button_b_on; },
          g_theme.success)->set_visibility_condition(p1);
    }

    // ===== PAGE 2: Status =====
    {
      auto p2 = [&state]() { return state.home_page_index == 2; };

      home->emplace_widget<LabelWidget>(
          UiRect{20, 70, 440, 30}, "Status Page", g_theme.header)
          ->set_visibility_condition(p2);

      home->emplace_widget<RectWidget>(
          UiRect{20, 115, 440, 1}, RetroColors::CYAN_DIM)
          ->set_visibility_condition(p2);

      {
        auto *l = home->emplace_widget<LabelWidget>(
            UiRect{20, 135, 440, 20}, "", g_theme.label);
        l->bind(state.led_switch.ptr(), "Lamp: ON", "Lamp: OFF");
        l->set_visibility_condition(p2);
      }
      {
        auto *l = home->emplace_widget<LabelWidget>(
            UiRect{20, 170, 440, 20}, "", g_theme.label);
        l->bind(state.button_a_on.ptr(), "Button A: ON", "Button A: OFF");
        l->set_visibility_condition(p2);
      }
      {
        auto *l = home->emplace_widget<LabelWidget>(
            UiRect{20, 205, 440, 20}, "", g_theme.label);
        l->bind(state.button_b_on.ptr(), "Button B: ON", "Button B: OFF");
        l->set_visibility_condition(p2);
      }
    }

    // ===== PAGE 3: Actions =====
    {
      auto p3 = [&state]() { return state.home_page_index == 3; };

      home->emplace_widget<LabelWidget>(
          UiRect{20, 70, 440, 30}, "Actions Page", g_theme.header)
          ->set_visibility_condition(p3);

      home->emplace_widget<ButtonWidget>(
          UiRect{20, 120, 440, 80}, "TOGGLE LAMP",
          make_ha_callback("switch.led_stehlampe_switch", "switch.toggle"),
          g_theme.primary)->set_visibility_condition(p3);

      home->emplace_widget<ButtonWidget>(
          UiRect{20, 220, 210, 70}, "BTN A",
          [&state]() { state.button_a_on = !state.button_a_on; },
          g_theme.accent)->set_visibility_condition(p3);

      home->emplace_widget<ButtonWidget>(
          UiRect{250, 220, 210, 70}, "BTN B",
          [&state]() { state.button_b_on = !state.button_b_on; },
          g_theme.success)->set_visibility_condition(p3);
    }

    home->emplace_widget<PageIndicatorWidget>(460);

    home->emplace_widget<LoadingWidget>();
  }

  // ===================== ACTIONS SCREEN =====================
  {
    auto *actions = screens.get_screen(UiScreenId::Actions);

    actions->emplace_widget<DetailHeaderWidget>(
        g_theme.header.font, g_theme.label.font, "ACTIONS",
        [&screens]() { screens.navigate_to(UiScreenId::Home); });

    actions->emplace_widget<RectWidget>(UiRect{10, 70, 460, 20}, RetroColors::VOID);

    {
      auto *info = actions->emplace_widget<LabelWidget>(UiRect{10, 70, 460, 20}, "", g_theme.label);
      info->bind(state.button_b_on.ptr(), "Button B: ON", "Button B: OFF");
    }

    actions->emplace_widget<ButtonWidget>(UiRect{40, 120, 400, 80}, "TOGGLE B",
        [&state]() { state.button_b_on = !state.button_b_on; }, g_theme.success);

    actions->emplace_widget<ButtonWidget>(UiRect{40, 230, 400, 80}, "LED SWITCH",
        make_ha_callback("switch.led_stehlampe_switch", "switch.toggle"), g_theme.primary);
  }

  // ===================== DETAIL SCREENS =====================
  {
    auto *s = screens.get_screen(UiScreenId::Climate);
    s->emplace_widget<DetailHeaderWidget>(g_theme.header.font, g_theme.label.font, "CLIMATE",
        [&screens]() { screens.navigate_to(UiScreenId::Home); });
  }
  {
    auto *s = screens.get_screen(UiScreenId::Lights);
    s->emplace_widget<DetailHeaderWidget>(g_theme.header.font, g_theme.label.font, "LIGHTS",
        [&screens]() { screens.navigate_to(UiScreenId::Home); });
  }
  {
    auto *s = screens.get_screen(UiScreenId::Todo);
    s->emplace_widget<DetailHeaderWidget>(g_theme.header.font, g_theme.label.font, "TO-DO",
        [&screens]() { screens.navigate_to(UiScreenId::Home); });
    {
      auto *l = s->emplace_widget<LabelWidget>(UiRect{20, 70, 440, 24}, "", g_theme.label);
      l->bind(state.todo_pending_count.ptr(), "PENDING: %d");
    }
    s->emplace_widget<TodoPreviewWidget>(
        UiRect{20, 100, 440, 110}, state.todo_items_formatted.ptr());
  }
  {
    auto *s = screens.get_screen(UiScreenId::Vacuum);
    s->emplace_widget<DetailHeaderWidget>(g_theme.header.font, g_theme.label.font, "VACUUM",
        [&screens]() { screens.navigate_to(UiScreenId::Home); });
  }
  {
    auto *s = screens.get_screen(UiScreenId::Music);
    s->emplace_widget<DetailHeaderWidget>(g_theme.header.font, g_theme.label.font, "MUSIC",
        [&screens]() { screens.navigate_to(UiScreenId::Home); });
  }
  {
    auto *s = screens.get_screen(UiScreenId::Timer);
    s->emplace_widget<DetailHeaderWidget>(g_theme.header.font, g_theme.label.font, "TIMER",
        [&screens]() { screens.navigate_to(UiScreenId::Home); });
  }
  {
    static ScrollableDetailScreen scenes_detail("SCENES",
        g_theme.header.font, g_theme.label.font, g_theme.label.font,
        [&screens]() { screens.navigate_to(UiScreenId::Home); });

    screens.register_screen(UiScreenId::Scenes, &scenes_detail);

    scenes_detail.add_entry("ALL OFF", RetroColors::RED,
        make_ha_callback("switch.led_stehlampe_switch", "switch.toggle"));

    scenes_detail.add_entry("COZY", RetroColors::AMBER, []() {});

    scenes_detail.add_entry("COZY BEAMER", RetroColors::BLUE, []() {});

    scenes_detail.add_entry("DAYLIGHT", RetroColors::WHITE, []() {});

    scenes_detail.add_entry("NIGHT MODE", RetroColors::MAGENTA, []() {});

    scenes_detail.add_entry("AWAY", RetroColors::GREEN, []() {});

    scenes_detail.add_entry("READING", RetroColors::CYAN, []() {});

    scenes_detail.add_entry("DINNER", RetroColors::AMBER, []() {});

    scenes_detail.add_entry("MOVIE TIME", RetroColors::BLUE, []() {});

    scenes_detail.add_entry("SLEEP MODE", RetroColors::MAGENTA, []() {});

    scenes_detail.add_entry("GOOD MORNING", RetroColors::WHITE, []() {});

    scenes_detail.add_entry("ENERGY SAVE", RetroColors::GREEN, []() {});
  }
}
