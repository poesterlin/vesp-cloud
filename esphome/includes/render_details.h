#pragma once
#include "esphome.h"
#include "state_manager.h"
#include "render_detail_vacuum.h"
#include "render_detail_lights.h"
#include "render_detail_todo.h"
#include "render_detail_climate.h"
#include "render_detail_music.h"
#include "render_detail_timer.h"
#include "render_detail_scenes.h"

void renderDetailViews(display::Display& it, ViewState view) {
  switch (view) {
    case VIEW_DETAIL_VACUUM: renderDetail_Vacuum(it); break;
    case VIEW_DETAIL_LIGHTS: renderDetail_Lights(it); break;
    case VIEW_DETAIL_TODO:   renderDetail_Todo(it); break;
    case VIEW_DETAIL_CLIMATE: renderDetail_Climate(it); break;
    case VIEW_DETAIL_MUSIC:   renderDetail_Music(it); break;
    case VIEW_DETAIL_TIMER:   renderDetail_Timer(it); break;
    case VIEW_DETAIL_SCENES:  renderDetail_Scenes(it); break;
    default: break;
  }
}