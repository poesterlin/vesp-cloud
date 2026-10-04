#pragma once

#include "ui_runtime_manifest.h"
#include <functional>

namespace vespui {

// Invoked once before constructing widgets or registering HA subscriptions.
// The adapter reads at most kMaxManifestBytes from its storage/download source.
using BootManifestSource = std::function<bool(std::vector<uint8_t> &, std::string &)>;

inline uint64_t manifest_fingerprint(const uint8_t *bytes, size_t size) {
  uint64_t hash = UINT64_C(0xcbf29ce484222325);
  for (size_t i = 0; i < size; ++i) hash = (hash ^ bytes[i]) * UINT64_C(0x100000001b3);
  return hash;
}

inline bool read_boot_manifest(const uint8_t *embedded, size_t size,
                               const BootManifestSource &source, Manifest &model,
                               bool &external, std::string &source_error,
                               std::string *error = nullptr, uint64_t *fingerprint = nullptr) {
  external = false;
  source_error.clear();
  if (source) {
    std::vector<uint8_t> bytes;
    if (source(bytes, source_error)) {
      if (Reader::parse(bytes.data(), bytes.size(), model, &source_error)) {
        external = true;
        if (fingerprint) *fingerprint = manifest_fingerprint(bytes.data(), bytes.size());
        if (error) error->clear();
        return true;
      }
    } else if (source_error.empty()) {
      source_error = "boot manifest source unavailable";
    }
  }
  // Parsing completes before any UI/state/subscription mutation. The embedded
  // manifest remains usable even when the external file is absent or corrupt.
  if (!Reader::parse(embedded, size, model, error)) return false;
  if (fingerprint) *fingerprint = manifest_fingerprint(embedded, size);
  return true;
}

}  // namespace vespui
