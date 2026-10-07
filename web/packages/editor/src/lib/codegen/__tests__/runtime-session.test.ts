import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { compileUiManifest } from '../ui-manifest';
import type { Project } from '@vesp-cloud/schema';

test('renderer-neutral session mounts before subscribing and falls back on mount failure', async () => {
  const project: Project = { name: 'Session', display: { width: 480, height: 480 }, dashboardPages: [
    { id: 'home', name: 'Home', components: [
      { id: 'text', type: 'text', text: 'State: {{light.demo}}', position: { x: 0, y: 0 } },
      { id: 'open', type: 'button', label: 'Open', position: { x: 0, y: 50 }, onTap: { type: 'OPEN_DETAIL', targetId: 'detail' } },
      { id: 'toggle', type: 'button', label: 'Toggle', position: { x: 0, y: 100 },
        onTap: { type: 'SERVICE_CALL', service: 'light.toggle', target: { entityId: 'light.demo' } } },
    ] },
  ], detailViews: [{ id: 'detail', title: 'Detail', height: 480, components: [
    { id: 'back', type: 'button', label: 'Back', position: { x: 0, y: 0 }, onTap: { type: 'GO_BACK' } },
  ] }] };
  const embedded = compileUiManifest(project);
  const external = compileUiManifest({ ...project, name: 'External', dashboardPages: [
    { ...project.dashboardPages[0], name: 'External' },
  ] });
  if (!embedded.ok || !external.ok) throw new Error('fixture rejected');
  const dir = await mkdtemp(join('/tmp/opencode', 'runtime-session-'));
  try {
    await Bun.write(join(dir, 'test.cpp'), `
#include "ui_runtime_session.h"
#include <cassert>
int main() {
  const uint8_t embedded[] = {${[...embedded.bytes]}};
  const std::vector<uint8_t> external = {${[...external.bytes]}};
  vespui::RuntimeSession session;
  int reads = 0, mounts = 0, subscriptions = 0, changes = 0, calls = 0;
  size_t active = 99;
  vespui::RuntimeContext::StateSink sink;
  vespui::RuntimeContext context;
  context.boot_manifest_source = [&](auto &bytes, auto &) { ++reads; bytes = external; return true; };
  context.subscribe_state = [&](const auto &entity, const auto &attribute, auto callback) {
    assert(mounts == 2 && active == 0 && session.loaded());
    assert(entity == "light.demo" && attribute.empty());
    ++subscriptions; sink = callback;
  };
  context.call_service = [&](const auto &service, const auto &entity) {
    assert(service == "light.toggle" && entity == "light.demo"); ++calls;
  };
  std::string error;
  assert(session.load(embedded, sizeof(embedded), context,
    [&](const auto &model, auto *why) {
      ++mounts;
      if (mounts == 1) { assert(model.strings[model.screens[0].name] == "External"); *why = "injected allocation failure"; return false; }
      assert(model.strings[model.screens[0].name] == "Home"); return true;
    }, [&](size_t target) { active = target; }, [&]() { ++changes; }, &error));
  assert(error.empty() && reads == 1 && subscriptions == 1);
  assert(!session.uses_external_manifest() && session.boot_source_error() == "injected allocation failure");
  assert(session.fingerprint() == vespui::manifest_fingerprint(embedded, sizeof(embedded)));
  sink("on"); sink("on"); assert(changes == 1);
  assert(session.manifest().text_value(session.manifest().widgets[0]) == "State: on");
  session.dispatch(0); assert(active == 1);
  session.dispatch(2); assert(active == 0);
  session.dispatch(1); assert(calls == 1);
  session.dispatch(255); assert(calls == 1);
  assert(!session.load(embedded, sizeof(embedded), context, {}, {}, {}, &error));
  assert(reads == 1 && subscriptions == 1 && mounts == 2);
  vespui::RuntimeSession failed;
  assert(!failed.load(embedded, sizeof(embedded), {}, [](const auto &, auto *) { return false; },
    [](size_t) { assert(false); }, {}, &error));
  assert(!failed.loaded());
}
`);
    const compile = Bun.spawnSync(['c++', '-std=c++17', `-I${process.cwd()}/src/lib/templates/includes`,
      join(dir, 'test.cpp'), '-o', join(dir, 'test')]);
    expect(compile.exitCode, compile.stderr.toString()).toBe(0);
    const run = Bun.spawnSync([join(dir, 'test')]);
    expect(run.exitCode, run.stderr.toString()).toBe(0);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
