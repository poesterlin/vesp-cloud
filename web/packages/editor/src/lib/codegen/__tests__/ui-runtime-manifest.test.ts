import { expect, test } from "bun:test";
import type { Project } from "@vesp-cloud/schema";
import { compileUiManifest } from "../ui-manifest";

const project: Project = {
  name: "Host parser",
  display: { width: 480, height: 480 },
  dashboardPages: [{
    id: "home", name: "Home", components: [
      { id: "label", type: "text", position: { x: 4, y: 8 }, size: { width: 80, height: 20 }, text: "Ready", visibleWhen: { entityId: "binary_sensor.ready" } },
      { id: "bg", type: "rectangle", position: { x: 0, y: 0 }, size: { width: 100, height: 40 }, backgroundColor: { r: 1, g: 2, b: 3 } },
      { id: "go", type: "button", position: { x: 5, y: 45 }, size: { width: 80, height: 30 }, label: "Go", onTap: { type: "OPEN_DETAIL", targetId: "detail" } },
    ],
  }],
  detailViews: [{ id: "detail", title: "Detail", height: 480, components: [] }],
};

test("generic C++ reader validates and materializes the compiler output", () => {
  const result = compileUiManifest(project);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  const bytes = [...result.bytes].join(",");
  const source = `
#include "ui_runtime_manifest.h"
#include <cassert>
#include <string>
int main() {
  const unsigned char bytes[] = {${bytes}};
  vespui::Manifest model;
  std::string error;
  assert(vespui::Reader::parse(bytes, sizeof(bytes), model, &error));
  assert(model.screens.size() == 2);
  assert(model.widgets.size() == 3);
  assert(model.widgets[0].kind == vespui::WidgetKind::Rectangle); // paint order
  assert(model.widgets[1].kind == vespui::WidgetKind::Text);
  assert(model.actions[0].kind == vespui::ActionKind::Navigate);
  assert(model.actions[0].first == 1);
  model.bindings[0].value = "off";
  assert(!model.condition_matches(0));
  model.bindings[0].value = "on";
  assert(model.condition_matches(0));

  auto bad = std::vector<unsigned char>(bytes, bytes + sizeof(bytes));
  bad.pop_back();
  vespui::Manifest untouched;
  untouched.screens.push_back({0, 0, {0, 0, 0}});
  assert(!vespui::Reader::parse(bad.data(), bad.size(), untouched, &error));
  assert(untouched.screens.size() == 1); // atomic failure

  bad.assign(bytes, bytes + sizeof(bytes));
  bad[16] = 99; // unknown required record
  assert(!vespui::Reader::parse(bad.data(), bad.size(), model, &error));

  bad.assign(bytes, bytes + sizeof(bytes));
  size_t offset = 16;
  while (offset + 3 <= bad.size()) {
    const unsigned type = bad[offset];
    const unsigned length = bad[offset + 1] | (bad[offset + 2] << 8);
    if (type == 6) {
      bad[offset + 3 + 2] = 99; // widget.screen
      break;
    }
    offset += 3 + length;
  }
  assert(!vespui::Reader::parse(bad.data(), bad.size(), model, &error));

  bad.assign(bytes, bytes + sizeof(bytes));
  offset = 16;
  while (offset + 3 <= bad.size()) {
    const unsigned type = bad[offset];
    const unsigned length = bad[offset + 1] | (bad[offset + 2] << 8);
    if (type == 6 && bad[offset + 3 + 3] == 1) {
      bad[offset + 3 + 14] = 0xff; // text content
      bad[offset + 3 + 15] = 0xff;
      break;
    }
    offset += 3 + length;
  }
  assert(!vespui::Reader::parse(bad.data(), bad.size(), model, &error));
  return 0;
}`;
  const temp = `${process.env.TMPDIR ?? "/tmp"}/vespui-host-${process.pid}`;
  const write = Bun.write(`${temp}.cpp`, source);
  return write.then(() => {
    const compile = Bun.spawnSync([
      "c++", "-std=c++17",
      `-I${process.cwd()}/src/lib/templates/includes`,
      `${temp}.cpp`, "-o", temp,
    ]);
    expect(compile.exitCode, compile.stderr.toString()).toBe(0);
    const run = Bun.spawnSync([temp]);
    expect(run.exitCode, run.stderr.toString()).toBe(0);
  });
});
