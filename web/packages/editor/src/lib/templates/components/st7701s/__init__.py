# Patched st7701s component.
#
# The upstream ESPHome st7701s component keeps the esp_lcd panel handle
# `handle_` protected, which makes it impossible for user code to obtain
# a framebuffer pointer. The screenshot debug feature needs that pointer
# to memcpy the current frame and upload it to the editor.
#
# We don't change the Python side of the platform; we just add a C++
# header (`st7701s_framebuffer.h`) that subclasses `ST7701S` and exposes
# a single `get_frame_buffer(void**)` method. Including the header in
# `ui_screenshot.h` (under the `SCREENSHOT_DEBUG_ENABLED` define) makes
# the new method available; the runtime `static_cast` there assumes
# `id(main_display)` is backed by the patched subclass, which is the
# case when this external component is loaded.
