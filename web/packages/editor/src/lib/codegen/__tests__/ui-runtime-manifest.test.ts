import { expect, test } from "bun:test";
import type { Project } from "@vesp-cloud/schema";
import { compileUiManifest } from "../ui-manifest";

const project: Project = {
  name: "Host parser",
  display: { width: 480, height: 480 },
  dashboardPages: [{
    id: "home", name: "Home", components: [
      { id: "label", type: "text", position: { x: 4, y: 8 }, size: { width: 80, height: 20 }, text: "Ready: {{binary_sensor.ready}} / {{sensor.room.temperature}}", fontSize: "large", align: "right", visibleWhen: { entityId: "binary_sensor.ready" } },
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
  assert(model.widgets[1].font_size == 2);
  assert(model.widgets[1].align == 2);
  assert(model.widgets[1].background[0] == 1);
  assert(model.actions[0].kind == vespui::ActionKind::Navigate);
  assert(model.actions[0].first == 1);
  model.bindings[0].value = "off";
  assert(!model.condition_matches(0));
  model.bindings[0].value = "on";
  assert(model.condition_matches(0));
  model.bindings[1].value = "21.5";
  assert(model.text_value(model.widgets[1]) == "Ready: on / 21.5");

  // V1 widgets omit the two style bytes; keep old firmware manifests readable.
  std::vector<unsigned char> legacy(bytes, bytes + 16);
  legacy[6] = 1;
  for (size_t position = 16; position < sizeof(bytes);) {
    const unsigned type = bytes[position];
    const unsigned length = bytes[position + 1] | (bytes[position + 2] << 8);
    const unsigned legacy_length = type == 6 ? 24 : length;
    legacy.push_back(type);
    legacy.push_back(legacy_length & 255);
    legacy.push_back(legacy_length >> 8);
    legacy.insert(legacy.end(), bytes + position + 3, bytes + position + 3 + legacy_length);
    position += 3 + length;
  }
  const uint32_t payload_size = legacy.size() - 16;
  for (unsigned i = 0; i < 4; ++i) legacy[8 + i] = payload_size >> (8 * i);
  vespui::Manifest legacy_model;
  assert(vespui::Reader::parse(legacy.data(), legacy.size(), legacy_model, &error));
  assert(legacy_model.widgets[1].font_size == 0);
  assert(legacy_model.widgets[1].align == 0);

  for (unsigned style_offset : {24u, 25u}) {
    auto invalid = std::vector<unsigned char>(bytes, bytes + sizeof(bytes));
    size_t position = 16;
    while (position + 3 <= invalid.size()) {
      const unsigned length = invalid[position + 1] | (invalid[position + 2] << 8);
      if (invalid[position] == 6 && invalid[position + 6] == 1) {
        invalid[position + 3 + style_offset] = 99;
        break;
      }
      position += 3 + length;
    }
    assert(!vespui::Reader::parse(invalid.data(), invalid.size(), model, &error));
  }

  for (unsigned part_offset : {26u, 27u, 28u}) {
    auto invalid = std::vector<unsigned char>(bytes, bytes + sizeof(bytes));
    size_t position = 16;
    while (position + 3 <= invalid.size()) {
      const unsigned length = invalid[position + 1] | (invalid[position + 2] << 8);
      if (invalid[position] == 6 && invalid[position + 6] == 1) {
        invalid[position + 3 + part_offset] = 255; // count, kind, or literal index
        break;
      }
      position += 3 + length;
    }
    assert(!vespui::Reader::parse(invalid.data(), invalid.size(), model, &error));
  }

  // Reject every truncated prefix, preserving the caller's model.
  for (size_t length = 0; length < sizeof(bytes); ++length) {
    vespui::Manifest previous = model;
    assert(!vespui::Reader::parse(bytes, length, previous, &error));
    assert(previous.widgets.size() == model.widgets.size());
  }
  assert(!vespui::Reader::parse(nullptr, 16, model, &error));

  auto invalid_header = std::vector<unsigned char>(bytes, bytes + sizeof(bytes));
  invalid_header[12] = 1;
  assert(!vespui::Reader::parse(invalid_header.data(), invalid_header.size(), model, &error));

  for (unsigned record_type : {2u, 6u}) {
    auto invalid = std::vector<unsigned char>(bytes, bytes + sizeof(bytes));
    size_t position = 16;
    while (position + 3 <= invalid.size()) {
      const unsigned length = invalid[position + 1] | (invalid[position + 2] << 8);
      if (invalid[position] == record_type) {
        invalid[position + 3 + 4] = 99; // binding.value_type or widget.flags
        break;
      }
      position += 3 + length;
    }
    assert(!vespui::Reader::parse(invalid.data(), invalid.size(), model, &error));
  }

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
