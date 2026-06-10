import type { EntityBinding } from "@esphome-designer/schema";
import type { Entity } from "@esphome-designer/schema/homeassistant";

export interface TextSegment {
  type: "text";
  value: string;
}

export interface BindingSegment {
  type: "binding";
  value: EntityBinding;
}

export type TemplateSegment = TextSegment | BindingSegment;

export const TEMPLATE_BINDING_REGEX = /\{\{([^}]+)\}\}/g;

/**
 * Parse a `entity.id` or `entity.id.attribute` reference (as it appears
 * inside `{{ ... }}`) into a structured EntityBinding.
 *
 * The entity id has the form `<domain>.<object_id>`, so the first two
 * dots delimit the entity id and anything after the second dot is the
 * attribute path.
 */
export function parseBindingRef(ref: string): EntityBinding {
  const trimmed = ref.trim();
  const firstDot = trimmed.indexOf(".");
  if (firstDot === -1) return { entityId: trimmed };

  const secondDot = trimmed.indexOf(".", firstDot + 1);
  if (secondDot === -1) return { entityId: trimmed };

  return {
    entityId: trimmed.slice(0, secondDot),
    attribute: trimmed.slice(secondDot + 1) || null,
  };
}

/**
 * Serialize an EntityBinding back to its `{{ ... }}` template form.
 */
export function serializeBinding(binding: EntityBinding): string {
  return `{{${binding.entityId}${binding.attribute ? "." + binding.attribute : ""}}}`;
}

/**
 * Parse a template string (e.g. `"Temp: {{sensor.foo}} now"`) into a
 * normalized list of segments.
 *
 * The returned array is always shaped like `text, (binding, text)*`:
 * it starts and ends with a text segment, and there is always a text
 * segment between adjacent bindings. The text segments may be empty
 * strings, which is useful for UIs that render an editable input slot
 * before/between/after every chip so the user can always type text in
 * any position.
 */
export function parseTemplate(text: string): TemplateSegment[] {
  const segments: TemplateSegment[] = [];
  const regex = new RegExp(TEMPLATE_BINDING_REGEX.source, "g");
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    segments.push({
      type: "text",
      value: text.slice(lastIndex, match.index),
    });
    segments.push({ type: "binding", value: parseBindingRef(match[1]) });
    lastIndex = match.index + match[0].length;
  }

  segments.push({ type: "text", value: text.slice(lastIndex) });

  return segments;
}

/**
 * Extract just the binding segments from a parsed template.
 */
export function extractBindings(segments: TemplateSegment[]): EntityBinding[] {
  return segments
    .filter((s): s is BindingSegment => s.type === "binding")
    .map((s) => s.value);
}

function isIsoDate(str: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str);
}

/**
 * Format an entity's state for display, preferring rounded numeric
 * values without units. ISO datetimes are intentionally
 * suppressed (returned as an empty string) so they don't dominate a
 * small label preview.
 */
export function getStateDisplay(entity: Entity): string {
  if (entity.numeric_state !== undefined) {
    return `${Math.round(entity.numeric_state * 10) / 10}`;
  }
  if (isIsoDate(entity.state)) return "";
  return entity.state;
}

/**
 * Resolve an attribute path against an entity, supporting dotted paths
 * like `attributes.temperature`. Returns a stringified value, or
 * `undefined` if the attribute cannot be resolved.
 */
function resolveAttribute(entity: Entity, attribute: string): string | undefined {
  const parts = attribute.split(".");
  let current: unknown = entity;
  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  if (current === undefined || current === null) return undefined;
  if (typeof current === "object") return JSON.stringify(current);
  return String(current);
}

/**
 * Render a binding to a user-facing display string. Used by both the
 * label-template editor (where it shows inside a chip) and the canvas
 * renderer (where it stands in for the live value).
 *
 * Falls back to the entity id when the entity isn't loaded in the
 * store, so previews remain readable without live data.
 */
export function getBindingDisplay(
  binding: EntityBinding,
  getEntity: (entityId: string) => Entity | undefined,
): string {
  const entity = getEntity(binding.entityId);
  if (!entity) {
    return binding.attribute
      ? `${binding.entityId}.${binding.attribute}`
      : binding.entityId;
  }
  if (binding.attribute) {
    const resolved = resolveAttribute(entity, binding.attribute);
    if (resolved !== undefined) return resolved;
    return `${getStateDisplay(entity)}.${binding.attribute.replace(/_/g, " ")}`;
  }
  return getStateDisplay(entity) || entity.entity_id;
}

export const DOMAIN_ICONS: Record<string, string> = {
  sensor: "📊",
  binary_sensor: "🔘",
  switch: "🔌",
  light: "💡",
  climate: "🌡️",
  cover: "🪟",
  media_player: "🎵",
  camera: "📷",
  vacuum: "🧹",
  fan: "🌀",
  lock: "🔒",
  input_boolean: "✅",
  input_number: "🔢",
  input_select: "📋",
  person: "👤",
  weather: "⛅",
  sun: "☀️",
  automation: "⚙️",
  script: "📜",
  scene: "🎬",
  button: "🔘",
  update: "🔄",
  number: "🔢",
  select: "📋",
};

/**
 * Lookup the emoji icon for a binding's domain. Returns a fallback
 * package emoji when the domain is unknown.
 */
export function getDomainIcon(binding: EntityBinding): string {
  const domain = binding.entityId.split(".")[0];
  return DOMAIN_ICONS[domain] ?? "📦";
}


