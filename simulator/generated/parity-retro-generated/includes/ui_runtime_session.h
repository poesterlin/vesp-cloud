#pragma once

#include "ui_boot_manifest.h"
#include <functional>

namespace vespui {

struct RuntimeContext {
  BootManifestSource boot_manifest_source;
  using StateSink = std::function<void(const std::string &)>;
  std::function<void(const std::string &, const std::string &, StateSink)> subscribe_state;
  std::function<void(const std::string &, const std::string &)> call_service;
  std::function<const char *(const std::string &)> resolve_icon;
};

// Owns semantic state independently of display, widget and touch implementations.
// A session and its subscription sinks live until reboot; reload is forbidden.
class RuntimeSession {
 public:
  RuntimeSession() = default;
  RuntimeSession(const RuntimeSession &) = delete;
  RuntimeSession &operator=(const RuntimeSession &) = delete;
  RuntimeSession(RuntimeSession &&) = delete;
  RuntimeSession &operator=(RuntimeSession &&) = delete;
  using Mount = std::function<bool(const Manifest &, std::string *)>;
  bool load(const uint8_t *bytes, size_t size, RuntimeContext context,
            Mount mount, std::function<void(size_t)> activate,
            std::function<void()> changed, std::string *error = nullptr) {
    if (attempted_) { if (error) *error = "runtime session boot already attempted"; return false; }
    attempted_ = true;
    if (!read_boot_manifest(bytes, size, context.boot_manifest_source, manifest_,
                            external_, source_error_, error, &fingerprint_)) return false;
    context.boot_manifest_source = {};
    // Mount must clean up partial objects before returning false. No subscriptions
    // are installed until a complete tree exists. Retry embedded on mount failure.
    if (!mount(manifest_, error)) {
      if (!external_) return false;
      source_error_ = error && !error->empty() ? *error : "external manifest mount failed";
      external_ = false;
      if (!Reader::parse(bytes, size, manifest_, error) || !mount(manifest_, error)) return false;
      fingerprint_ = manifest_fingerprint(bytes, size);
    }
    context_ = std::move(context);
    activate_ = std::move(activate);
    changed_ = std::move(changed);
    loaded_ = true;
    activate_(0);
    for (size_t i = 0; i < manifest_.bindings.size() && context_.subscribe_state; ++i) {
      const auto &binding = manifest_.bindings[i];
      context_.subscribe_state(manifest_.strings[binding.entity],
          binding.attribute == kNone16 ? "" : manifest_.strings[binding.attribute],
          [this, i](const std::string &value) {
            if (manifest_.bindings[i].value == value) return;
            manifest_.bindings[i].value = value;
            ++revision_;
            if (changed_) changed_();
          });
    }
    if (error) error->clear();
    return true;
  }

  void dispatch(uint8_t index) {
    if (!loaded_ || index == kNone8 || index >= manifest_.actions.size()) return;
    const auto &action = manifest_.actions[index];
    switch (action.kind) {
      case ActionKind::Service:
        if (context_.call_service) context_.call_service(manifest_.strings[action.first],
            action.second == kNone16 ? "" : manifest_.strings[action.second]);
        break;
      case ActionKind::Navigate: navigate(action.first); break;
      case ActionKind::Back:
        if (!history_.empty()) { const auto target = history_.back(); history_.pop_back(); navigate(target, false); }
        break;
      case ActionKind::Next: navigate((current_ + 1) % manifest_.screens.size()); break;
      case ActionKind::Previous: navigate((current_ + manifest_.screens.size() - 1) % manifest_.screens.size()); break;
    }
  }
  const Manifest &manifest() const { return manifest_; }
  size_t current_screen_id() const { return current_; }
  bool loaded() const { return loaded_; }
  bool uses_external_manifest() const { return external_; }
  const std::string &boot_source_error() const { return source_error_; }
  uint64_t fingerprint() const { return fingerprint_; }
  uint32_t revision() const { return revision_; }

 private:
  void navigate(size_t target, bool remember = true) {
    if (target >= manifest_.screens.size() || target == current_) return;
    if (remember) {
      if (history_.size() >= 16) history_.erase(history_.begin());
      history_.push_back(current_);
    }
    current_ = target;
    activate_(target);
  }
  Manifest manifest_;
  RuntimeContext context_;
  std::function<void(size_t)> activate_;
  std::function<void()> changed_;
  std::vector<size_t> history_;
  size_t current_ = 0;
  bool attempted_ = false;
  bool loaded_ = false;
  bool external_ = false;
  std::string source_error_;
  uint64_t fingerprint_ = 0;
  uint32_t revision_ = 0;
};
}  // namespace vespui
