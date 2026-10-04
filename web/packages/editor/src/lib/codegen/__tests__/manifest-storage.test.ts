import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { compileUiManifest } from '../ui-manifest';

test('manifest cache validates writes, avoids flash wear, preserves committed data and scopes projects', async () => {
  const result = compileUiManifest({ name: 'Cache', display: { width: 480, height: 480 },
    dashboardPages: [{ id: 'home', name: 'Home', components: [] }], detailViews: [] });
  if (!result.ok) throw new Error('fixture rejected');
  const dir = await mkdtemp(join(process.env.TMPDIR ?? '/tmp/opencode', 'manifest-cache-'));
  try {
    await Bun.write(join(dir, 'nvs.h'), `
#pragma once
#include <map>
#include <vector>
#include <string>
#include <cstring>
using esp_err_t = int;
using nvs_handle_t = int;
constexpr int ESP_OK = 0, NVS_READONLY = 0, NVS_READWRITE = 1;
inline std::map<std::string, std::vector<uint8_t>> committed;
inline std::string current_namespace;
inline std::vector<uint8_t> pending;
inline int writes = 0;
inline bool fail_write = false, fail_commit = false;
inline int nvs_open(const char *name, int mode, int *handle) {
  current_namespace = name; *handle = 1;
  return mode == NVS_READONLY && !committed.count(name) ? 1 : 0;
}
inline int nvs_get_blob(int, const char *, void *out, size_t *size) {
  const auto &data = committed[current_namespace];
  if (out && *size < data.size()) return 1;
  if (out) std::memcpy(out, data.data(), data.size());
  *size = data.size(); return 0;
}
inline int nvs_set_blob(int, const char *, const void *data, size_t size) {
  ++writes;
  if (fail_write) return 1;
  pending.assign(static_cast<const uint8_t *>(data), static_cast<const uint8_t *>(data) + size);
  return 0;
}
inline int nvs_commit(int) {
  if (fail_commit) return 1;
  committed[current_namespace] = pending; return 0;
}
inline void nvs_close(int) { pending.clear(); }
`);
    await Bun.write(join(dir, 'test.cpp'), `
#include "ui_manifest_storage.h"
#include <cassert>
int main() {
  const uint8_t bytes[] = {${[...result.bytes]}};
  std::vector<uint8_t> cached;
  std::string error;
  vespui::set_manifest_cache_scope("project-a/url");
  assert(!vespui::read_cached_manifest(cached, error));
  assert(vespui::write_cached_manifest(bytes, sizeof(bytes), error));
  assert(writes == 1 && vespui::read_cached_manifest(cached, error));
  assert(cached == std::vector<uint8_t>(bytes, bytes + sizeof(bytes)));
  assert(vespui::write_cached_manifest(bytes, sizeof(bytes), error) && writes == 1);
  uint8_t invalid[] = {1,2,3};
  assert(!vespui::write_cached_manifest(invalid, sizeof(invalid), error) && writes == 1);
  // Change one string character while preserving all record lengths/references.
  auto changed = cached;
  vespui::Manifest checked;
  changed[21] = 'H';
  assert(vespui::Reader::parse(changed.data(), changed.size(), checked, &error));
  fail_write = true;
  assert(!vespui::write_cached_manifest(changed.data(), changed.size(), error));
  fail_write = false; fail_commit = true;
  assert(!vespui::write_cached_manifest(changed.data(), changed.size(), error));
  fail_commit = false;
  assert(vespui::read_cached_manifest(cached, error));
  assert(cached == std::vector<uint8_t>(bytes, bytes + sizeof(bytes)));
  vespui::set_manifest_cache_scope("project-b/url");
  assert(!vespui::read_cached_manifest(cached, error));
  vespui::set_manifest_cache_scope("project-a/url");
  committed[vespui::manifest_cache_namespace()].resize(vespui::kMaxManifestBytes + 9);
  assert(!vespui::read_cached_manifest(cached, error));
}
`);
    const compile = Bun.spawnSync(['c++', '-std=c++17', `-I${dir}`, `-I${process.cwd()}/src/lib/templates/includes`, join(dir, 'test.cpp'), '-o', join(dir, 'test')]);
    expect(compile.exitCode, compile.stderr.toString()).toBe(0);
    const run = Bun.spawnSync([join(dir, 'test')]);
    expect(run.exitCode, run.stderr.toString()).toBe(0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
