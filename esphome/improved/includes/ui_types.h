#pragma once

enum class TouchType {
  Down,
  Move,
  Up,
  Tap
};

struct TouchEvent {
  TouchType type;
  int x;
  int y;
  int start_x;
  int start_y;
  int dx;
  int dy;
};

enum class UiScreenId {
  Home,
  Actions,
  Climate,
  Lights,
  Todo,
  Vacuum,
  Music,
  Timer,
  Scenes
};
