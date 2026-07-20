import type {
  Project,
  Component,
  ConditionalAreaComponent,
  TabContainerComponent,
  Condition,
  EntityCondition,
  StateCondition,
  TimeCondition,
  CompoundCondition,
  NotCondition,
  ComparisonOperator,
} from "@vesp-cloud/schema";
import { stateVarFromEntity, escapeCString } from "./utils";

type ConditionValue = string | number | boolean;

function emitLiteral(value: ConditionValue): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "0";
  // Treat HA boolean string values ("on"/"off") as C++ bool, matching
  // bind_ha_bool which converts them to Observable<bool>.
  const lower = String(value).toLowerCase();
  if (lower === "on") return "true";
  if (lower === "off") return "false";
  return `std::string("${escapeCString(value)}")`;
}

function stateAccess(varName: string, value: ConditionValue, cppType?: ConditionEntityType): string {
  // Treat HA boolean strings as bool, matching bind_ha_bool which produces
  // Observable<bool>. These Observables can't be cast to std::string.
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "on" || lower === "off") {
      return `state.${varName}`;
    }
    // If the observable is typed as float, use std::to_string instead of
    // static_cast<std::string> which is invalid for Observable<float>.
    // Note: std::to_string(float) emits trailing zeros (e.g. "21.500000"),
    // so string comparisons against a float-typed entity must match that
    // formatting.
    if (cppType === "float") {
      return `std::to_string(static_cast<float>(state.${varName}))`;
    }
    return `static_cast<std::string>(state.${varName})`;
  }
  return `state.${varName}`;
}

function emitComparison(
  lhs: string,
  operator: ComparisonOperator,
  value: ConditionValue,
): string {
  const rhs = emitLiteral(value);
  switch (operator) {
    case "eq": return `(${lhs} == ${rhs})`;
    case "neq": return `(${lhs} != ${rhs})`;
    case "gt": return `(${lhs} > ${rhs})`;
    case "gte": return `(${lhs} >= ${rhs})`;
    case "lt": return `(${lhs} < ${rhs})`;
    case "lte": return `(${lhs} <= ${rhs})`;
    case "contains":
      // String containment; lhs is wrapped as std::string for typeof string value.
      return `(${lhs}.find(${rhs}) != std::string::npos)`;
    case "not_contains":
      return `(${lhs}.find(${rhs}) == std::string::npos)`;
    case "matches":
      // Regex requires <regex> + exceptions, not available on ESP-IDF builds.
      // Fall back to substring containment, which covers most practical patterns.
      return `/* matches (regex fallback to contains) */ (${lhs}.find(${rhs}) != std::string::npos)`;
    default:
      return `(${lhs} == ${rhs})`;
  }
}

function emitEntity(c: EntityCondition, entityTypes?: EntityTypeMap): string {
  const varName = stateVarFromEntity(c.entityId, c.attribute ?? undefined);
  const cppType = entityTypes?.get(varName);
  const lhs = stateAccess(varName, c.value, cppType);
  return emitComparison(lhs, c.operator, c.value);
}

function emitState(c: StateCondition): string {
  const lhs = stateAccess(c.variable, c.value);
  return emitComparison(lhs, c.operator, c.value);
}

function timeToMinutes(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^(?:[01]?\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) return undefined;
  const [hours, minutes] = value.split(":").map(Number);
  return hours! * 60 + minutes!;
}

function emitTime(c: TimeCondition): string {
  const after = timeToMinutes(c.after);
  const before = timeToMinutes(c.before);

  // Invalid/empty ranges are rejected by validation. Keep code generation
  // fail-safe as well: an invalid condition must not unexpectedly show a
  // variant in firmware generated without running validation first.
  if ((c.after && after === undefined) || (c.before && before === undefined)) return "false";
  if (after === undefined && before === undefined) return "false";

  let rangeExpression: string;
  if (after !== undefined && before !== undefined) {
    // Equal endpoints represent the full day. When the start is later than
    // the end, the range crosses midnight (for example 22:00-06:00).
    if (after === before) rangeExpression = "true";
    else if (after < before) rangeExpression = `(ui_time_minutes >= ${after} && ui_time_minutes < ${before})`;
    else rangeExpression = `(ui_time_minutes >= ${after} || ui_time_minutes < ${before})`;
  } else if (after !== undefined) {
    rangeExpression = `ui_time_minutes >= ${after}`;
  } else {
    rangeExpression = `ui_time_minutes < ${before}`;
  }

  // base.yaml provides sntp_time and applies the project's configured
  // timezone. Do not select a timed variant until SNTP has synchronized.
  return `([&]() { auto ui_time_now = sntp_time->now(); if (!ui_time_now.is_valid()) return false; const int ui_time_minutes = ui_time_now.hour * 60 + ui_time_now.minute; return ${rangeExpression}; }())`;
}

function emitCompound(c: CompoundCondition, entityTypes?: EntityTypeMap): string {
  if (!c.conditions || c.conditions.length === 0) return "true";
  const op = c.operator === "and" ? " && " : " || ";
  const parts = c.conditions.map(inner => emitConditionExpression(inner, entityTypes));
  return `(${parts.join(op)})`;
}

function emitNot(c: NotCondition, entityTypes?: EntityTypeMap): string {
  return `(!${emitConditionExpression(c.condition, entityTypes)})`;
}

/**
 * Map from sanitized variable name (as produced by `stateVarFromEntity(entityId)`)
 * to the C++ type declared for that entity's Observable. Used to generate
 * type-safe access expressions in conditions.
 */
export type EntityTypeMap = Map<string, ConditionEntityType>;

/**
 * Convert a schema Condition into a C++ boolean expression that can be used
 * inside a `[&state]() { return ...; }` lambda passed to `set_visibility_condition`.
 *
 * Returns "true" when condition is undefined or unsupported, so the surrounding
 * widget remains visible by default.
 */
export function emitConditionExpression(
  condition: Condition | undefined,
  entityTypes?: EntityTypeMap,
): string {
  if (!condition) return "true";
  switch (condition.type) {
    case "entity": return emitEntity(condition, entityTypes);
    case "state": return emitState(condition);
    case "time": return emitTime(condition);
    case "compound": return emitCompound(condition, entityTypes);
    case "not": return emitNot(condition, entityTypes);
    default:
      return "true";
  }
}



export type ConditionEntityType = "bool" | "float" | "std::string";

export interface ConditionEntityRef {
  entityId: string;
  /** Sanitized variable name suitable for `state.<varName>`. */
  varName: string;
  /** C++ underlying type to use for the auto-generated Observable. */
  cppType: ConditionEntityType;
}

function inferCppType(value: ConditionValue): ConditionEntityType {
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return "float";
  // Treat HA boolean string values ("on"/"off") as bool, matching
  // bind_ha_bool which converts them to Observable<bool>.
  const lower = String(value).toLowerCase();
  if (lower === "on" || lower === "off") return "bool";
  return "std::string";
}

/** Higher rank widens to broader types. */
function typeRank(t: ConditionEntityType): number {
  if (t === "bool") return 0;
  if (t === "float") return 1;
  return 2;
}

function mergeType(existing: ConditionEntityType, incoming: ConditionEntityType): ConditionEntityType {
  return typeRank(incoming) > typeRank(existing) ? incoming : existing;
}

function visitCondition(
  condition: Condition | undefined,
  visit: (entity: EntityCondition) => void,
): void {
  if (!condition) return;
  switch (condition.type) {
    case "entity":
      visit(condition);
      return;
    case "compound":
      for (const inner of condition.conditions) visitCondition(inner, visit);
      return;
    case "not":
      visitCondition(condition.condition, visit);
      return;
    default:
      return;
  }
}

function visitComponentConditions(
  components: Component[],
  visit: (entity: EntityCondition) => void,
): void {
  for (const c of components) {
    if (c.type === "conditional_area") {
      const ca = c as ConditionalAreaComponent;
      for (const variant of ca.variants) {
        visitCondition(variant.condition, visit);
        visitComponentConditions(variant.components, visit);
      }
    } else if (c.type === "tab_container") {
      const tc = c as TabContainerComponent;
      for (const tab of tc.tabs) {
        visitComponentConditions(tab.components, visit);
      }
    }
  }
}

/**
 * Collect all distinct entity references used by `EntityCondition`s anywhere
 * in the project (currently inside `conditional_area` variants, recursively).
 *
 * Multiple references to the same entity are merged into a single ref whose
 * `cppType` is widened to fit all observed condition value types (e.g. a
 * mix of bool and string comparisons yields `std::string`).
 */
export function collectConditionEntities(project: Project): ConditionEntityRef[] {
  const map = new Map<string, ConditionEntityRef>();
  const allRoots: Component[] = [
    ...project.dashboardPages.flatMap(p => p.components),
    ...project.detailViews.flatMap(v => v.components),
  ];
  visitComponentConditions(allRoots, ec => {
    const varName = stateVarFromEntity(ec.entityId, ec.attribute ?? undefined);
    if (!varName) return;
    const incoming = inferCppType(ec.value);
    const existing = map.get(varName);
    if (existing) {
      existing.cppType = mergeType(existing.cppType, incoming);
    } else {
      map.set(varName, { entityId: ec.entityId, varName, cppType: incoming });
    }
  });
  return [...map.values()];
}
