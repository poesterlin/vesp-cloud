/**
 * History Store - Undo/Redo stack for project state
 *
 * Stores delta snapshots for efficient undo/redo operations.
 */

import type { Project } from "@vesp-cloud/schema";
import { projectStore } from "./project.svelte.js";

interface HistoryEntry {
  snapshot: string; // JSON serialized project state
  description: string;
  timestamp: number;
}

const MAX_HISTORY_SIZE = 50;

function createHistoryStore() {
  let undoStack = $state<HistoryEntry[]>([]);
  let redoStack = $state<HistoryEntry[]>([]);

  // Derived
  const canUndo = $derived(undoStack.length > 0);
  const canRedo = $derived(redoStack.length > 0);

  return {
    // Getters
    get canUndo() {
      return canUndo;
    },
    get canRedo() {
      return canRedo;
    },
    get undoCount() {
      return undoStack.length;
    },
    get redoCount() {
      return redoStack.length;
    },

    // Record current state before making a change
    record(description: string) {
      const snapshot = projectStore.exportJSON();
      undoStack = [
        ...undoStack.slice(-(MAX_HISTORY_SIZE - 1)),
        {
          snapshot,
          description,
          timestamp: Date.now(),
        },
      ];
      // Clear redo stack when new action is taken
      redoStack = [];
    },

    // Undo last action
    undo() {
      if (undoStack.length === 0) return;

      // Save current state to redo stack
      const currentSnapshot = projectStore.exportJSON();
      const lastEntry = undoStack[undoStack.length - 1];

      redoStack = [
        ...redoStack,
        {
          snapshot: currentSnapshot,
          description: lastEntry.description,
          timestamp: Date.now(),
        },
      ];

      // Pop from undo stack and restore
      const newUndoStack = [...undoStack];
      const entry = newUndoStack.pop()!;
      undoStack = newUndoStack;

      const project = JSON.parse(entry.snapshot) as Project;
      projectStore.importJSON(entry.snapshot);
    },

    // Redo last undone action
    redo() {
      if (redoStack.length === 0) return;

      // Save current state to undo stack
      const currentSnapshot = projectStore.exportJSON();
      const lastEntry = redoStack[redoStack.length - 1];

      undoStack = [
        ...undoStack,
        {
          snapshot: currentSnapshot,
          description: lastEntry.description,
          timestamp: Date.now(),
        },
      ];

      // Pop from redo stack and restore
      const newRedoStack = [...redoStack];
      const entry = newRedoStack.pop()!;
      redoStack = newRedoStack;

      const project = JSON.parse(entry.snapshot) as Project;
      projectStore.importJSON(entry.snapshot);
    },

    // Clear all history
    clear() {
      undoStack = [];
      redoStack = [];
    },
  };
}

export const historyStore = createHistoryStore();
