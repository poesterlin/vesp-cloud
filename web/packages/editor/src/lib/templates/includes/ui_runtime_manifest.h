#pragma once

// Generic VESPUI v1 reader. This header intentionally has no ESPHome
// dependencies, so malformed-manifest behavior is host-testable.
#include <array>
#include <cstddef>
#include <cstdint>
#include <string>
#include <vector>

namespace vespui {

static constexpr size_t kMaxManifestBytes = 32 * 1024;
static constexpr size_t kMaxScreens = 4;
static constexpr size_t kMaxWidgets = 32;
static constexpr size_t kMaxBindings = 16;
static constexpr size_t kMaxActions = 16;
static constexpr size_t kMaxConditions = 16;
static constexpr uint8_t kNone8 = 0xff;
static constexpr uint16_t kNone16 = 0xffff;

enum class WidgetKind : uint8_t { Text = 1, Rectangle = 2, Button = 3, Icon = 4 };
enum class ActionKind : uint8_t { Service = 1, Navigate = 2, Back = 3, Next = 4, Previous = 5 };

struct Binding {
  uint16_t entity;
  uint16_t attribute;
  uint8_t value_type;
  // Stable storage: subscriptions update the string in-place and widgets poll it.
  std::string value;
};
struct Screen { uint16_t id; uint16_t name; std::array<uint8_t, 3> background; };
struct Action { ActionKind kind; uint16_t first; uint16_t second; };
struct Condition { uint8_t binding; uint8_t operation; uint16_t expected; };
struct Widget {
  uint16_t id;
  uint8_t screen;
  WidgetKind kind;
  uint8_t flags;
  int16_t x, y, w, h;
  uint8_t condition;
  uint16_t content;
  std::array<uint8_t, 3> background;
  std::array<uint8_t, 3> foreground;
  uint8_t binding;
  uint8_t action;
};

struct Manifest {
  std::vector<std::string> strings;
  std::vector<Binding> bindings;
  std::vector<Screen> screens;
  std::vector<Action> actions;
  std::vector<Condition> conditions;
  std::vector<Widget> widgets;

  bool condition_matches(uint8_t index) const {
    if (index == kNone8) return true;
    if (index >= conditions.size()) return false;
    const auto &condition = conditions[index];
    if (condition.binding >= bindings.size() || condition.expected >= strings.size()) return false;
    // v1 operation 1 is equality. visibleWhen is encoded as state == "on".
    return condition.operation == 1 && bindings[condition.binding].value == strings[condition.expected];
  }
};

class Reader {
 public:
  static bool parse(const uint8_t *data, size_t size, Manifest &output, std::string *error = nullptr) {
    // Parse into a temporary model: failure never exposes a partially built UI.
    Manifest parsed;
    Reader reader(data, size);
    if (size > kMaxManifestBytes) return fail(error, "manifest exceeds fixed byte limit");
    if (size < 16 || !reader.magic() || reader.u16() != 1) return fail(error, "bad magic or version");
    const uint32_t payload_size = reader.u32();
    (void) reader.u32();  // reserved
    if (!reader.ok_ || payload_size != size - 16) return fail(error, "invalid payload length");
    while (reader.remaining() != 0) {
      if (reader.remaining() < 3) return fail(error, "truncated record header");
      const uint8_t type = reader.u8();
      const uint16_t length = reader.u16();
      if (!reader.ok_ || length > reader.remaining()) return fail(error, "truncated record");
      Reader record(reader.cursor_, length);
      if (!parse_record(type, record, parsed, error)) return false;
      if (!record.ok_ || record.remaining() != 0) return fail(error, "invalid record length");
      reader.skip(length);
    }
    if (!validate(parsed, error)) return false;
    output = std::move(parsed);
    return true;
  }

 private:
  Reader(const uint8_t *data, size_t size) : cursor_(data), end_(data + size) {}
  size_t remaining() const { return static_cast<size_t>(end_ - cursor_); }
  uint8_t u8() { if (remaining() < 1) { ok_ = false; return 0; } return *cursor_++; }
  uint16_t u16() { const uint16_t a = u8(), b = u8(); return a | (b << 8); }
  int16_t i16() { return static_cast<int16_t>(u16()); }
  uint32_t u32() { const uint32_t a = u16(), b = u16(); return a | (b << 16); }
  void skip(size_t count) { cursor_ += count; }
  bool magic() {
    static constexpr uint8_t expected[] = {'V', 'E', 'S', 'P', 'U', 'I'};
    if (remaining() < sizeof(expected)) return false;
    for (uint8_t value : expected) if (u8() != value) return false;
    return true;
  }
  std::array<uint8_t, 3> color() { return {u8(), u8(), u8()}; }

  static bool parse_record(uint8_t type, Reader &r, Manifest &m, std::string *error) {
    switch (type) {
      case 1: {
        const uint16_t length = r.u16();
        if (!r.ok_ || length != r.remaining()) return fail(error, "invalid string length");
        m.strings.emplace_back(reinterpret_cast<const char *>(r.cursor_), length);
        r.skip(length);
        return true;
      }
      case 2:
        if (m.bindings.size() >= kMaxBindings) return fail(error, "binding limit exceeded");
        m.bindings.push_back({r.u16(), r.u16(), r.u8(), ""});
        return true;
      case 3:
        if (m.screens.size() >= kMaxScreens) return fail(error, "screen limit exceeded");
        m.screens.push_back({r.u16(), r.u16(), r.color()});
        return true;
      case 4:
        if (m.actions.size() >= kMaxActions) return fail(error, "action limit exceeded");
        m.actions.push_back({static_cast<ActionKind>(r.u8()), r.u16(), r.u16()});
        return true;
      case 5:
        if (m.conditions.size() >= kMaxConditions) return fail(error, "condition limit exceeded");
        m.conditions.push_back({r.u8(), r.u8(), r.u16()});
        return true;
      case 6:
        if (m.widgets.size() >= kMaxWidgets) return fail(error, "widget limit exceeded");
        m.widgets.push_back({
          r.u16(), r.u8(), static_cast<WidgetKind>(r.u8()), r.u8(),
          r.i16(), r.i16(), r.i16(), r.i16(), r.u8(), r.u16(),
          r.color(), r.color(), r.u8(), r.u8()
        });
        return true;
      default:
        return fail(error, "unknown required record type");
    }
  }

  static bool validate(const Manifest &m, std::string *error) {
    if (m.screens.empty()) return fail(error, "manifest has no screens");
    auto string_ok = [&](uint16_t value) { return value == kNone16 || value < m.strings.size(); };
    for (const auto &b : m.bindings)
      if (!string_ok(b.entity) || !string_ok(b.attribute) || b.entity == kNone16) return fail(error, "bad binding string index");
    for (const auto &s : m.screens)
      if (!string_ok(s.id) || !string_ok(s.name) || s.id == kNone16 || s.name == kNone16) return fail(error, "bad screen string index");
    for (const auto &a : m.actions) {
      const auto kind = static_cast<uint8_t>(a.kind);
      if (kind < 1 || kind > 5) return fail(error, "unknown action type");
      if (a.kind == ActionKind::Service && (!string_ok(a.first) || !string_ok(a.second) || a.first == kNone16))
        return fail(error, "bad service action index");
      if (a.kind == ActionKind::Navigate && a.first >= m.screens.size()) return fail(error, "bad navigation screen index");
    }
    for (const auto &c : m.conditions)
      if (c.binding >= m.bindings.size() || c.operation != 1 || !string_ok(c.expected) || c.expected == kNone16)
        return fail(error, "bad condition index or operation");
    for (const auto &w : m.widgets) {
      const auto kind = static_cast<uint8_t>(w.kind);
      if (w.screen >= m.screens.size() || kind < 1 || kind > 4 || w.w <= 0 || w.h <= 0)
        return fail(error, "bad widget type, screen, or geometry");
      if (!string_ok(w.id) || w.id == kNone16) return fail(error, "bad widget string index");
      if ((w.kind == WidgetKind::Text || w.kind == WidgetKind::Button || w.kind == WidgetKind::Icon) &&
          (w.content == kNone16 || !string_ok(w.content)))
        return fail(error, "missing widget content");
      if (w.binding != kNone8 && w.binding >= m.bindings.size()) return fail(error, "bad widget binding index");
      if (w.action != kNone8 && w.action >= m.actions.size()) return fail(error, "bad widget action index");
      if (w.condition != kNone8 && w.condition >= m.conditions.size()) return fail(error, "bad widget condition index");
    }
    return true;
  }

  static bool fail(std::string *error, const char *message) {
    if (error != nullptr) *error = message;
    return false;
  }

  const uint8_t *cursor_;
  const uint8_t *end_;
  bool ok_ = true;
};

}  // namespace vespui
