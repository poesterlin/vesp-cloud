export type CanvasPasteTarget =
  | { scope: "root" }
  | { scope: "header" }
  | { scope: "tab"; parentId: string; tabId: string }
  | { scope: "variant"; parentId: string; variantId: string };

class CanvasPasteTargetStore {
  target = $state<CanvasPasteTarget | null>(null);
  version = $state(0);

  set(target: CanvasPasteTarget) {
    this.target = target;
    this.version += 1;
  }

  clear() {
    this.target = null;
    this.version += 1;
  }
}

export const canvasPasteTargetStore = new CanvasPasteTargetStore();
