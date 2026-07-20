import type { Component } from "@vesp-cloud/schema";

function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

export function cloneComponent(component: Component): Component {
  return structuredClone($state.snapshot(component)) as Component;
}

export function cloneComponentWithFreshIds(component: Component): Component {
  const clone = cloneComponent(component);

  const rewriteIds = (target: Component) => {
    target.id = generateId(target.type);

    if (target.type === "conditional_area") {
      const variantIdMap = new Map<string, string>();
      for (const variant of target.variants) {
        const nextVariantId = generateId("variant");
        variantIdMap.set(variant.id, nextVariantId);
        variant.id = nextVariantId;
        for (const child of variant.components) rewriteIds(child);
      }
      if (target.defaultVariantId) {
        target.defaultVariantId =
          variantIdMap.get(target.defaultVariantId) ?? target.defaultVariantId;
      }
    } else if (target.type === "tab_container") {
      const tabIdMap = new Map<string, string>();
      for (const tab of target.tabs) {
        const nextTabId = generateId("tab");
        tabIdMap.set(tab.id, nextTabId);
        tab.id = nextTabId;
        for (const child of tab.components) rewriteIds(child);
      }
      if (target.defaultTabId) {
        target.defaultTabId = tabIdMap.get(target.defaultTabId) ?? target.defaultTabId;
      }
    }
  };

  rewriteIds(clone);
  return clone;
}
