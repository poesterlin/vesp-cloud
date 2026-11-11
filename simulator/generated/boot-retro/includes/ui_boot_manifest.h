#pragma once

#include "ui_runtime_manifest.h"
#include <functional>

namespace vespui {

// Invoked once before constructing widgets or registering HA subscriptions.
// The adapter reads at most kMaxManifestBytes from its storage/download source.
using BootManifestSource = std::function<bool(std::vector<uint8_t> &, std::string &)>;

inline bool read_boot_manifest(const uint8_t *embedded, size_t size,
                               const BootManifestSource &source, Manifest &model,
                               bool &external, std::string &source_error,
                               std::string *error = nullptr) {
  external = false;
  source_error.clear();
  if (source) {
    std::vector<uint8_t> bytes;
    if (source(bytes, source_error)) {
      if (Reader::parse(bytes.data(), bytes.size(), model, &source_error)) {
        external = true;
        if (error) error->clear();
        return true;
      }
    } else if (source_error.empty()) {
      source_error = "boot manifest source unavailable";
    }
  }
  // Parsing completes before any UI/state/subscription mutation. The embedded
  // manifest remains usable even when the external file is absent or corrupt.
  return Reader::parse(embedded, size, model, error);
}

}  // namespace vespui
