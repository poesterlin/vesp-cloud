export type SnapLine = {
  type: "v" | "h";
  coord: number;
  start: number;
  end: number;
};

class SnapStore {
  activeSnapLines = $state<SnapLine[]>([]);

  setLines(lines: SnapLine[]) {
    this.activeSnapLines = lines;
  }

  clear() {
    this.activeSnapLines = [];
  }
}

export const snapStore = new SnapStore();
