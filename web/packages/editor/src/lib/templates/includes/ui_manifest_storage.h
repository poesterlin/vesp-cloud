#pragma once

#include "ui_boot_manifest.h"
#include <nvs.h>
#include <cstdio>

namespace vespui {

inline const char *manifest_cache_namespace() { return "vespui"; }

inline uint64_t &manifest_cache_scope() {
  static uint64_t scope = 0;
  return scope;
}

inline void set_manifest_cache_scope(const std::string &scope) {
  manifest_cache_scope() = manifest_fingerprint(reinterpret_cast<const uint8_t *>(scope.data()), scope.size());
}

// Use NVS blob replacement/commit rather than erasing the namespace on errors.
// Every value submitted to storage is a complete reader-valid manifest.
inline bool read_cached_manifest(std::vector<uint8_t> &bytes, std::string &error) {
  nvs_handle_t handle;
  esp_err_t status = nvs_open(manifest_cache_namespace(), NVS_READONLY, &handle);
  if (status != ESP_OK) { error = "manifest cache unavailable"; return false; }
  size_t size = 0;
  status = nvs_get_blob(handle, "manifest", nullptr, &size);
  std::vector<uint8_t> blob;
  if (status == ESP_OK && size > 8 && size <= kMaxManifestBytes + 8) {
    blob.resize(size);
    status = nvs_get_blob(handle, "manifest", blob.data(), &size);
  } else {
    nvs_close(handle);
    error = "manifest cache absent or size out of bounds";
    return false;
  }
  nvs_close(handle);
  if (status != ESP_OK) { bytes.clear(); error = "manifest cache read failed"; return false; }
  uint64_t scope = 0;
  for (size_t i = 0; i < 8; ++i) scope |= static_cast<uint64_t>(blob[i]) << (i * 8);
  if (scope != manifest_cache_scope()) { error = "manifest cache belongs to another firmware source"; return false; }
  bytes.assign(blob.begin() + 8, blob.end());
  return true;
}

inline bool write_cached_manifest(const uint8_t *bytes, size_t size, std::string &error) {
  Manifest checked;
  if (!Reader::parse(bytes, size, checked, &error)) return false;
  // Avoid flash wear for identical manifests downloaded on successive boots.
  std::vector<uint8_t> previous;
  std::string ignored;
  if (read_cached_manifest(previous, ignored) && previous.size() == size &&
      std::equal(previous.begin(), previous.end(), bytes)) return true;
  nvs_handle_t handle;
  esp_err_t status = nvs_open(manifest_cache_namespace(), NVS_READWRITE, &handle);
  if (status != ESP_OK) { error = "manifest cache open failed"; return false; }
  // Scope and bytes share one atomic blob. Replacing the single cache entry
  // avoids accumulating a new namespace for every firmware build or token.
  std::vector<uint8_t> blob(size + 8);
  for (size_t i = 0; i < 8; ++i) blob[i] = manifest_cache_scope() >> (i * 8);
  std::copy(bytes, bytes + size, blob.begin() + 8);
  status = nvs_set_blob(handle, "manifest", blob.data(), blob.size());
  if (status == ESP_OK) status = nvs_commit(handle);
  nvs_close(handle);
  if (status != ESP_OK) { error = "manifest cache write/commit failed"; return false; }
  return true;
}

}  // namespace vespui
