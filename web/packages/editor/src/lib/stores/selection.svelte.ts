/**
 * Selection Store - Manages UI selection state
 *
 * Tracks which components are currently selected for editing.
 */

function createSelectionStore() {
  let selectedIds = $state<Set<string>>(new Set());
  let hoveredId = $state<string | null>(null);

  // Derived
  const hasSelection = $derived(selectedIds.size > 0);
  const selectedCount = $derived(selectedIds.size);
  const firstSelectedId = $derived(
    selectedIds.size > 0 ? [...selectedIds][0] : null
  );

  return {
    // Getters
    get selectedIds() {
      return selectedIds;
    },
    get hoveredId() {
      return hoveredId;
    },
    get hasSelection() {
      return hasSelection;
    },
    get selectedCount() {
      return selectedCount;
    },
    get firstSelectedId() {
      return firstSelectedId;
    },

    // Selection operations
    select(id: string) {
      selectedIds = new Set([id]);
    },

    toggle(id: string) {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      selectedIds = newSet;
    },

    addToSelection(id: string) {
      const newSet = new Set(selectedIds);
      newSet.add(id);
      selectedIds = newSet;
    },

    removeFromSelection(id: string) {
      const newSet = new Set(selectedIds);
      newSet.delete(id);
      selectedIds = newSet;
    },

    clear() {
      selectedIds = new Set();
      hoveredId = null;
    },

    selectMultiple(ids: string[]) {
      selectedIds = new Set(ids);
    },

    isSelected(id: string): boolean {
      return selectedIds.has(id);
    },

    // Hover operations
    setHovered(id: string | null) {
      hoveredId = id;
    },

    isHovered(id: string): boolean {
      return hoveredId === id;
    },
  };
}

export const selectionStore = createSelectionStore();
