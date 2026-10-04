#pragma once
#include "esphome.h"
#include "ui_runtime_state.h"
#include "ui_widgets.h"

// Desktop-only showcase of the production widget classes, including widgets
// that are not yet supported by the binary manifest compiler.
class UiApp {
 public:
  void init() {
    if (initialized_) return;
    initialized_ = true;
    build();
  }
  void touch_activity() { last_interaction_time = millis(); }
  void on_touch_event(const TouchEvent &event) {
    init();
    if (g_confirmation_popup.handle_touch(event, millis())) return;
    if (event.type == TouchType::Tap && event.y >= 432 && event.x >= 330) {
      page_ = (page_ + 1) % 9;
      build();
      ESP_LOGI("simulator", "Screen changed: %u", page_);
      return;
    }
    if (event.type == TouchType::Tap && page_ == 0 && event.y >= 225 && event.y < 325 && event.x < 230) {
      light_ = !light_;
      for (auto &widget : widgets_) widget->mark_dirty();
      return;
    }
    if (event.type == TouchType::Tap && page_ == 3 && event.y >= 390 && event.y < 425) {
      light_ = !light_;
      UiInvalidation::request_rect({20,285,440,100});
      return;
    }
    for (auto &widget : widgets_) if (widget->handle_touch(event, millis())) break;
  }
  void update(uint32_t now) { init(); for (auto &widget : widgets_) widget->update(now); }
  void draw(display::Display &it, uint32_t) {
    init();
    if (UiInvalidation::is_full_dirty()) ui_fast_filled_rectangle(it, 0, 0, 480, 480, RetroColors::VOID);
    for (auto &widget : widgets_) { auto r = widget->bounds(); if (widget->is_visible(state_) && UiInvalidation::needs_redraw_in(r.x,r.y,r.w,r.h)) widget->draw_clipped(it, state_); }
    if (page_ == 5) {
      loading_.draw_clipped(it, state_);
#ifndef VESPUI_REGRESSION
      UiInvalidation::request_continue({0,0,480,480});
#endif
    }
    g_confirmation_popup.draw(it);
  }
  UiState &state() { return state_; }
  uint32_t last_interaction_time = 0;
 private:
  template<class T, class... Args> T *add(Args&&... args) {
    auto widget = std::make_unique<T>(std::forward<Args>(args)...);
    auto *ptr = widget.get(); widgets_.push_back(std::move(widget)); return ptr;
  }
  void build() {
    widgets_.clear();
    state_.home_total_pages = 9; state_.home_page_index = page_;
    const char *titles[] = {"BASICS", "LISTS", "CLIMATE + WEATHER", "TABS + CONDITIONAL", "NOTIFICATION", "LOADING", "IMAGE + HEADERS", "WEATHER TODAY", "PAGE HEADER"};
    add<LabelWidget>(UiRect{20,12,440,35}, titles[page_], g_theme.header);
    if (page_ == 0) {
      add<RectWidget>(UiRect{20,65,440,60}, Color(25,55,70));
      add<LabelWidget>(UiRect{30,78,420,30}, "Text on a rectangle", g_theme.label)->set_bg_color(Color(25,55,70));
      auto *button = add<ButtonWidget>(UiRect{20,145,210,60}, "Button", []{}, g_theme.primary);
      button->set_allow_offline_action(true);
      button->set_confirm_before_action(true);
      add<IconWidget>(UiRect{260,145,100,60}, "\xF3\xB0\x8C\xB5", g_theme.icon);
      add<ImageToggleWidget>(UiRect{20,225,210,100}, "Light ON", &light_, "\xF3\xB0\x8C\xB5", []{});
      add<DigitalClockWidget>(UiRect{245,225,215,120});
    } else if (page_ == 1) {
      add<TodoPreviewWidget>(UiRect{20,65,440,145}, &todo_, 4, 32, true, true);
      add<CalendarListWidget>(UiRect{20,230,440,175}, &calendar_, "Calendar", "", 3, 46);
    } else if (page_ == 2) {
      add<HvacWidget>(UiRect{20,65,440,145}, "Living room", &mode_, &temperature_, &target_, &action_, "climate.demo", "@minus@", "@plus@", "@power@");
      WeatherDayPointers day{&condition_, &temperature_, &humidity_, &wind_, &rain_};
      add<WeatherWidget>(UiRect{20,220,440,90}, "Today", "weather.demo", WeatherMode::TodayMini, day);
      add<WeatherWidget>(UiRect{20,320,440,100}, "Forecast", "weather.demo", WeatherMode::Forecast, day, day, day);
    } else if (page_ == 3) {
      auto *tabs = add<TabContainerWidget>(UiRect{20,65,440,200}, RetroColors::VOID, g_theme.primary, true);
      int first = tabs->add_tab("First"), second = tabs->add_tab("Second");
      tabs->emplace_child<LabelWidget>(first, UiRect{40,135,380,40}, "First tab content", g_theme.label);
      tabs->emplace_child<LabelWidget>(second, UiRect{40,135,380,40}, "Second tab content", g_theme.label);
      add<RectWidget>(UiRect{20,285,440,100}, Color(20,65,40));
      add<LabelWidget>(UiRect{35,310,410,45}, "Conditional area: ON variant", g_theme.label)->set_visibility_condition([this]() { return light_; });
      add<LabelWidget>(UiRect{35,310,410,45}, "Conditional area: OFF variant", g_theme.label)->set_visibility_condition([this]() { return !light_; });
      add<ButtonWidget>(UiRect{20,390,200,35}, "Toggle variant", []{}, g_theme.primary)->set_allow_offline_action(true);
    } else if (page_ == 4) {
      add<NotificationOverlayWidget>(&notice_title_, &notice_body_, &severity_, &dismissed_)->set_dismiss_callback([this]() { dismissed_ = notice_body_; });
    } else if (page_ == 6) {
      add<ImageWidget>(UiRect{160,150,160,80}, gallery_image);
      add<LabelWidget>(UiRect{20,250,440,40}, "Static RGB565 image", g_theme.label);
      add<DetailHeaderWidget>(g_theme.header.font, g_theme.primary.font, "Detail header", []{});
    } else if (page_ == 7) {
      WeatherDayPointers day{&condition_, &temperature_, &humidity_, &wind_, &rain_};
      add<WeatherWidget>(UiRect{20,70,440,330}, "Outdoor", "weather.demo", WeatherMode::Today, day);
    } else if (page_ == 8) {
      add<HeaderWidget>(g_theme.header.font, g_theme.label.font, nullptr, nullptr);
      add<LabelWidget>(UiRect{20,90,440,50}, "Dashboard page header", g_theme.label);
    }
    add<PageIndicatorWidget>(415,20);
    add<ButtonWidget>(UiRect{330,432,130,36}, "Next", []{}, g_theme.primary)->set_allow_offline_action(true);
    UiInvalidation::request_full("gallery page");
  }
  bool initialized_ = false, light_ = true;
  unsigned page_ = 0;
  UiState state_;
  LoadingWidget loading_;
  std::vector<std::unique_ptr<Widget>> widgets_;
  std::string todo_ = "Buy groceries\nWater plants\nReview display layout\nClean kitchen\nWalk dog\nRead book\nCall Sam";
  std::string calendar_ = "09:00|Design review\n12:30|Lunch with Sam\n18:00|Evening walk";
  std::string mode_ = "heat", action_ = "heating", condition_ = "sunny";
  float temperature_ = 21.5f, target_ = 22.0f, humidity_ = 48, wind_ = 12, rain_ = 0;
  std::string notice_title_ = "Test notification", notice_body_ = "All widgets use the production C++ renderer.", severity_ = "info", dismissed_;
};
inline UiApp g_ui_app;
