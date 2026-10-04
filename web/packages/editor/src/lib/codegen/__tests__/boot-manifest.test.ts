import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { compileUiManifest } from '../ui-manifest';
import { manifestFingerprint } from '../ui-capabilities';

test('boot source validates external bytes and falls back before constructing UI', async () => {
  const fixture = (text: string) => compileUiManifest({ name: 'Boot', display: { width: 480, height: 480 },
    dashboardPages: [{ id: 'home', name: 'Home', components: [
      { id: 'label', type: 'text', text, position: { x: 20, y: 20 }, size: { width: 200, height: 40 } },
    ] }], detailViews: [] });
  const embedded = fixture('Embedded'), external = fixture('External');
  if (!embedded.ok || !external.ok) throw new Error('fixture rejected');
  const dir = await mkdtemp(join(process.env.TMPDIR ?? '/tmp/opencode', 'boot-manifest-'));
  try {
    await Bun.write(join(dir, 'test.cpp'), `
#include "ui_boot_manifest.h"
#include <cassert>
int main() {
  const uint8_t embedded[] = {${[...embedded.bytes]}};
  const std::vector<uint8_t> candidate = {${[...external.bytes]}};
  assert(vespui::manifest_fingerprint(embedded, sizeof(embedded)) == UINT64_C(0x${manifestFingerprint(embedded.bytes)}));
  assert(vespui::manifest_fingerprint(candidate.data(), candidate.size()) == UINT64_C(0x${manifestFingerprint(external.bytes)}));
  vespui::Manifest model;
  bool external = true;
  std::string reason, error;
  auto load = [&](vespui::BootManifestSource source) {
    return vespui::read_boot_manifest(embedded, sizeof(embedded), source, model, external, reason, &error);
  };
  auto text = [&]() { return model.text_value(model.widgets[0]); };
  assert(load({}) && !external && text() == "Embedded" && reason.empty());
  int reads = 0;
  assert(load([&](auto &bytes, auto &) { ++reads; bytes = candidate; return true; }));
  assert(reads == 1 && external && text() == "External");
  // Source buffers can be released/modified after parsing; the model owns data.
  assert(text() == "External");
  assert(load([](auto &, auto &why) { why = "offline"; return false; }));
  assert(!external && reason == "offline" && text() == "Embedded");
  assert(load([](auto &bytes, auto &) { bytes = {1,2,3}; return true; }));
  assert(!external && !reason.empty() && text() == "Embedded");
  assert(load([](auto &bytes, auto &) { bytes.resize(vespui::kMaxManifestBytes + 1); return true; }));
  assert(!external && !reason.empty() && text() == "Embedded");
  const uint8_t invalid[] = {1};
  assert(!vespui::read_boot_manifest(invalid, sizeof(invalid), {}, model, external, reason, &error));
  assert(!error.empty());
  // A valid external manifest can boot even when the embedded one is invalid.
  assert(vespui::read_boot_manifest(invalid, sizeof(invalid), [&](auto &bytes, auto &) {
    bytes = candidate; return true;
  }, model, external, reason, &error));
  assert(external && error.empty() && text() == "External");
}
`);
    const compile = Bun.spawnSync(['c++', '-std=c++17', `-I${process.cwd()}/src/lib/templates/includes`, join(dir, 'test.cpp'), '-o', join(dir, 'test')]);
    expect(compile.exitCode, compile.stderr.toString()).toBe(0);
    const run = Bun.spawnSync([join(dir, 'test')]);
    expect(run.exitCode, run.stderr.toString()).toBe(0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
