import type { Component } from "@vesp-cloud/schema";

export function isBackgroundComponent(component: Component): boolean {
  return component.type === "rectangle";
}

export function sortComponentsForRender<T extends Component>(components: T[]): T[] {
  return [...components].sort((a, b) => {
    const aIsBackground = isBackgroundComponent(a);
    const bIsBackground = isBackgroundComponent(b);
    if (aIsBackground === bIsBackground) return 0;
    return aIsBackground ? -1 : 1;
  });
}
