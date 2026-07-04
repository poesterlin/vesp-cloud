import type { Condition } from "@vesp-cloud/schema";

export function describeCondition(condition: Condition | undefined): string {
  if (!condition) return "Always (default)";

  switch (condition.type) {
    case "entity":
      const op = { 
        eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", 
        contains: "contains", not_contains: "not contains", matches: "matches" 
      }[condition.operator] ?? condition.operator;
      return `${condition.entityId}${condition.attribute ? `[${condition.attribute}]` : ""} ${op} ${condition.value}`;
    
    case "compound":
      return `${condition.conditions.length} conditions (${condition.operator.toUpperCase()})`;
    
    case "not":
      return `NOT (${describeCondition(condition.condition)})`;
    
    case "time":
      const parts = [];
      if (condition.after) parts.push(`after ${condition.after}`);
      if (condition.before) parts.push(`before ${condition.before}`);
      return parts.join(" and ") || "any time";
    
    case "state":
      return `state.${condition.variable} ${condition.operator} ${condition.value}`;
    
    default:
      return "Unknown condition";
  }
}

export function getConditionIcon(condition: Condition | undefined): string {
  if (!condition) return "✓";
  switch (condition.type) {
    case "entity": return "🏠";
    case "time": return "🕐";
    case "compound": return condition.operator === "and" ? "∧" : "∨";
    case "not": return "¬";
    case "state": return "📊";
    default: return "?";
  }
}
