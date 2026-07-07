class CanvasZoomStore {
  level = $state(1);

  setLevel(value: number) {
    this.level = Math.max(1, Math.min(2, value));
  }
}

export const canvasZoomStore = new CanvasZoomStore();
