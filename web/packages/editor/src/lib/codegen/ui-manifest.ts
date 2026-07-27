import type {
  ButtonComponent,
  Component,
  EntityBinding,
  IconComponent,
  Project,
  RectangleComponent,
  ServiceAction,
  TextComponent,
} from "@vesp-cloud/schema";
import { getMdiCodepoint } from "./mdi-icons";

export interface ManifestDiagnostic {
  code: string;
  message: string;
  path?: string;
}

export interface UiManifestMetadata {
  formatVersion: 1;
  byteLength: number;
  stringCount: number;
  stateBindingCount: number;
  screenCount: number;
  widgetCount: number;
  actionCount: number;
  conditionCount: number;
}

export type CompileUiManifestResult =
  | { ok: true; bytes: Uint8Array; metadata: UiManifestMetadata; warnings: ManifestDiagnostic[] }
  | { ok: false; errors: ManifestDiagnostic[] };

/** True when the legacy generator is an intentional compatibility fallback. */
export function canFallbackToGeneratedUi(
  result: CompileUiManifestResult,
): boolean {
  return !result.ok
    && result.errors.length > 0
    && result.errors.every((error) => error.code.startsWith("UNSUPPORTED_"));
}

const LIMITS = { bytes: 32 * 1024, screens: 4, widgets: 32, bindings: 16, actions: 16, conditions: 16 };
const NONE8 = 0xff;
const NONE16 = 0xffff;

enum RecordType { String = 1, Binding, Screen, Action, Condition, Widget }
enum WidgetKind { Text = 1, Rectangle, Button, Icon }
enum ActionKind { Service = 1, Navigate, Back, Next, Previous }

class Writer {
  bytes: number[] = [];
  u8(value: number) { this.bytes.push(value & 0xff); }
  u16(value: number) { this.u8(value); this.u8(value >>> 8); }
  i16(value: number) { this.u16(value < 0 ? 0x10000 + value : value); }
  u32(value: number) { this.u16(value); this.u16(value >>> 16); }
  raw(value: Uint8Array | readonly number[]) { this.bytes.push(...value); }
  record(type: RecordType, body: Writer) {
    this.u8(type);
    this.u16(body.bytes.length);
    this.raw(body.bytes);
  }
  finish() { return Uint8Array.from(this.bytes); }
}

function rgb(
  color: { r: number; g: number; b: number } | undefined,
  fallback: readonly [number, number, number],
): readonly [number, number, number] {
  return color ? [color.r, color.g, color.b] as const : fallback;
}

/** Compile the deliberately small VESPUI v1 proof-of-concept subset. */
export function compileUiManifest(project: Project): CompileUiManifestResult {
  const errors: ManifestDiagnostic[] = [];
  const warnings: ManifestDiagnostic[] = [];
  if (project.pageHeader?.components.length) {
    errors.push({ code: "UNSUPPORTED_PAGE_HEADER", message: "Page headers are outside the proof-of-concept subset", path: "pageHeader" });
  }
  if (project.notificationOverlay && project.notificationOverlay.enabled !== false) {
    errors.push({ code: "UNSUPPORTED_NOTIFICATION_OVERLAY", message: "Notification overlays are outside the proof-of-concept subset", path: "notificationOverlay" });
  }
  const strings: string[] = [];
  const stringIds = new Map<string, number>();
  const intern = (value: string | undefined | null) => {
    if (value == null) return NONE16;
    let id = stringIds.get(value);
    if (id == null) {
      id = strings.length;
      strings.push(value);
      stringIds.set(value, id);
    }
    return id;
  };

  type Binding = { entity: number; attribute: number };
  const bindings: Binding[] = [];
  const bindingIds = new Map<string, number>();
  const binding = (value: EntityBinding | undefined, path: string) => {
    if (!value) return NONE8;
    const key = `${value.entityId}\0${value.attribute ?? ""}`;
    let id = bindingIds.get(key);
    if (id == null) {
      id = bindings.length;
      if (id >= LIMITS.bindings) {
        errors.push({ code: "LIMIT_BINDINGS", message: `Manifest supports at most ${LIMITS.bindings} bindings`, path });
        return NONE8;
      }
      bindings.push({ entity: intern(value.entityId), attribute: value.attribute ? intern(value.attribute) : NONE16 });
      bindingIds.set(key, id);
    }
    return id;
  };

  const screens = [
    ...project.dashboardPages.map((screen) => ({ id: screen.id, name: screen.name, color: screen.backgroundColor, components: screen.components })),
    ...project.detailViews.map((screen) => ({ id: screen.id, name: screen.title, color: undefined, components: screen.components })),
  ];
  if (!screens.length) errors.push({ code: "NO_SCREENS", message: "The manifest needs at least one screen" });
  if (screens.length > LIMITS.screens) errors.push({ code: "LIMIT_SCREENS", message: `Manifest supports at most ${LIMITS.screens} screens` });
  const screenIds = new Map(screens.map((screen, index) => [screen.id, index]));

  type Action = { kind: ActionKind; first: number; second: number };
  const actions: Action[] = [];
  const addAction = (value: Component["onTap"], path: string) => {
    if (!value) return NONE8;
    if (actions.length >= LIMITS.actions) {
      errors.push({ code: "LIMIT_ACTIONS", message: `Manifest supports at most ${LIMITS.actions} actions`, path });
      return NONE8;
    }
    let action: Action;
    if (value.type === "SERVICE_CALL") {
      const service = value as ServiceAction;
      if (service.target?.deviceId) {
        errors.push({ code: "UNSUPPORTED_ACTION_TARGET", message: "The proof of concept supports entity targets only", path });
      }
      action = { kind: ActionKind.Service, first: intern(service.service), second: intern(service.target?.entityId) };
    } else if (value.type === "OPEN_DETAIL") {
      const target = value.targetId == null ? undefined : screenIds.get(value.targetId);
      if (target == null) errors.push({ code: "BAD_SCREEN_TARGET", message: `Unknown screen '${value.targetId ?? ""}'`, path });
      action = { kind: ActionKind.Navigate, first: target ?? NONE16, second: NONE16 };
    } else {
      const kind = value.type === "GO_BACK" ? ActionKind.Back : value.type === "NEXT_PAGE" ? ActionKind.Next : ActionKind.Previous;
      action = { kind, first: NONE16, second: NONE16 };
    }
    actions.push(action);
    return actions.length - 1;
  };

  type Condition = { binding: number; expected: number };
  const conditions: Condition[] = [];
  const addCondition = (value: EntityBinding | undefined, path: string) => {
    if (!value) return NONE8;
    if (conditions.length >= LIMITS.conditions) {
      errors.push({ code: "LIMIT_CONDITIONS", message: `Manifest supports at most ${LIMITS.conditions} conditions`, path });
      return NONE8;
    }
    conditions.push({ binding: binding(value, path), expected: intern("on") });
    return conditions.length - 1;
  };

  type Widget = {
    id: number; screen: number; kind: WidgetKind; flags: number;
    x: number; y: number; w: number; h: number; condition: number;
    content: number; bg: readonly [number, number, number]; fg: readonly [number, number, number];
    binding: number; action: number;
  };
  const widgets: Widget[] = [];
  screens.forEach((screen, screenIndex) => {
    const ordered = [...screen.components].sort((a, b) =>
      Number(b.type === "rectangle") - Number(a.type === "rectangle"));
    ordered.forEach((component, index) => {
      const path = `screens[${screenIndex}].components[${index}]`;
      if (!["text", "rectangle", "button", "icon"].includes(component.type)) {
        errors.push({ code: "UNSUPPORTED_WIDGET", message: `Widget '${component.type}' is outside the proof-of-concept subset`, path });
        return;
      }
      if (component.onTap && component.type !== "button") {
        errors.push({ code: "UNSUPPORTED_WIDGET_ACTION", message: "The proof of concept dispatches actions from buttons only", path });
      }
      if (widgets.length >= LIMITS.widgets) {
        errors.push({ code: "LIMIT_WIDGETS", message: `Manifest supports at most ${LIMITS.widgets} widgets`, path });
        return;
      }
      const size = component.size ?? { width: 100, height: 40 };
      for (const [name, value] of Object.entries({ x: component.position.x, y: component.position.y, width: size.width, height: size.height })) {
        if (!Number.isInteger(value) || value < -32768 || value > 32767 || ((name === "width" || name === "height") && value <= 0)) {
          errors.push({ code: "BAD_GEOMETRY", message: `Invalid ${name}: ${value}`, path });
        }
      }
      let kind: WidgetKind;
      let content = NONE16;
      let bg: readonly [number, number, number] = [0, 0, 0];
      let fg: readonly [number, number, number] = [255, 255, 255];
      let stateBinding = NONE8;
      switch (component.type) {
        case "text": {
          const text = component as TextComponent;
          if ((text.text ?? "").includes("{{")) {
            errors.push({ code: "UNSUPPORTED_TEXT_TEMPLATE", message: "Runtime text templates are outside the proof-of-concept subset; use textBinding", path });
          }
          kind = WidgetKind.Text; content = intern(text.text ?? "");
          fg = rgb(text.color, fg); stateBinding = binding(text.textBinding, `${path}.textBinding`);
          break;
        }
        case "rectangle": {
          const rectangle = component as RectangleComponent;
          kind = WidgetKind.Rectangle; bg = rgb(rectangle.backgroundColor, bg);
          break;
        }
        case "button": {
          const button = component as ButtonComponent;
          kind = WidgetKind.Button; content = intern(button.label ?? "");
          bg = rgb(button.backgroundColor, [30, 30, 30]); fg = rgb(button.foregroundColor, fg);
          break;
        }
        case "icon": {
          const icon = component as IconComponent;
          const codepoint = getMdiCodepoint(icon.icon);
          if (!codepoint) {
            errors.push({ code: "UNKNOWN_ICON", message: `Unknown icon '${icon.icon}'`, path });
          }
          kind = WidgetKind.Icon;
          content = intern(codepoint ? String.fromCodePoint(Number.parseInt(codepoint.slice(2), 16)) : "");
          fg = rgb(icon.color, fg);
          break;
        }
        default:
          // The supported-type guard above has already diagnosed this record.
          return;
      }
      widgets.push({
        id: intern(component.id), screen: screenIndex, kind, flags: component.visible === false ? 0 : 1,
        x: component.position.x, y: component.position.y, w: size.width, h: size.height,
        condition: addCondition(component.visibleWhen, `${path}.visibleWhen`), content, bg, fg,
        binding: stateBinding,
        action: addAction(
          component.type === "button" ? component.pressAction ?? component.onTap : component.onTap,
          `${path}.onTap`,
        ),
      });
      if (component.onHold || component.onDragStart || component.onDragEnd ||
          (component.type === "button" && component.holdAction)) {
        errors.push({ code: "UNSUPPORTED_GESTURE", message: "Only button tap actions are supported by the proof of concept", path });
      }
    });
  });

  if (errors.length) return { ok: false, errors };

  // Intern screen strings before emitting the string table.
  const encodedScreens = screens.map((screen) => ({
    id: intern(screen.id), name: intern(screen.name),
    color: rgb(screen.color, rgb(project.theme?.colors.background, [0, 0, 0])),
  }));
  const payload = new Writer();
  const encoder = new TextEncoder();
  strings.forEach((value) => {
    const utf8 = encoder.encode(value);
    const body = new Writer(); body.u16(utf8.length); body.raw(utf8);
    payload.record(RecordType.String, body);
  });
  bindings.forEach((value) => { const b = new Writer(); b.u16(value.entity); b.u16(value.attribute); b.u8(1); payload.record(RecordType.Binding, b); });
  encodedScreens.forEach((value) => { const b = new Writer(); b.u16(value.id); b.u16(value.name); b.raw(value.color); payload.record(RecordType.Screen, b); });
  actions.forEach((value) => { const b = new Writer(); b.u8(value.kind); b.u16(value.first); b.u16(value.second); payload.record(RecordType.Action, b); });
  conditions.forEach((value) => { const b = new Writer(); b.u8(value.binding); b.u8(1); b.u16(value.expected); payload.record(RecordType.Condition, b); });
  widgets.forEach((value) => {
    const b = new Writer();
    b.u16(value.id); b.u8(value.screen); b.u8(value.kind); b.u8(value.flags);
    b.i16(value.x); b.i16(value.y); b.i16(value.w); b.i16(value.h);
    b.u8(value.condition); b.u16(value.content); b.raw(value.bg); b.raw(value.fg); b.u8(value.binding); b.u8(value.action);
    payload.record(RecordType.Widget, b);
  });
  const body = payload.finish();
  const output = new Writer();
  output.raw(new TextEncoder().encode("VESPUI"));
  output.u16(1);
  output.u32(body.length);
  output.u32(0); // reserved
  output.raw(body);
  const bytes = output.finish();
  if (bytes.length > LIMITS.bytes) return { ok: false, errors: [{ code: "LIMIT_BYTES", message: `Manifest exceeds ${LIMITS.bytes} bytes` }] };
  return {
    ok: true, bytes, warnings,
    metadata: {
      formatVersion: 1, byteLength: bytes.length, stringCount: strings.length,
      stateBindingCount: bindings.length, screenCount: screens.length, widgetCount: widgets.length,
      actionCount: actions.length, conditionCount: conditions.length,
    },
  };
}

export function generateEmbeddedUiManifestHeader(bytes: Uint8Array): string {
  const rows: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 16) {
    rows.push(`  ${Array.from(bytes.slice(offset, offset + 16), (value) =>
      `0x${value.toString(16).padStart(2, "0")}`).join(", ")}`);
  }
  return `#pragma once

#include <cstddef>
#include <cstdint>

inline constexpr uint8_t vespui_embedded_manifest[] = {
${rows.join(",\n")}
};
inline constexpr size_t vespui_embedded_manifest_size =
    sizeof(vespui_embedded_manifest);
`;
}
