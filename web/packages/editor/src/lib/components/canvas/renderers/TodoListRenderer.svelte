<script lang="ts">
  import type { Component } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";
  import * as mdiIcons from "@mdi/js";

  type TodoListComponent = Extract<Component, { type: "todo_list" }>;

  interface Props {
    component: TodoListComponent;
  }

  let { component }: Props = $props();

  const maxItems = $derived(Math.max(1, Math.min(10, component.maxItems ?? 4)));
  const rowHeight = $derived(Math.max(20, Math.min(80, component.rowHeight ?? 30)));
  const isScrollable = $derived(component.scrollable === true);
  const isCheckable = $derived(component.checkable === true);
  let toggledByIndex = $state<Record<number, boolean>>({});

  const iconPathIncomplete = $derived.by(() => {
    const path = (mdiIcons as Record<string, unknown>).mdiCheckboxBlankOutline;
    return typeof path === "string" ? path : null;
  });
  const iconPathComplete = $derived.by(() => {
    const path = (mdiIcons as Record<string, unknown>).mdiCheckboxMarked;
    return typeof path === "string" ? path : null;
  });

  const previewRows = $derived.by(() => {
    const psv = [
      "Buy coffee beans and filter paper|2026-05-19|ok",
      "Pick up milk|2026-05-22|ok",
      "Send parcel|2026-05-15|overdue",
      "Refill cat food|no-date|completed",
      "Call insurance|2026-05-23|ok",
      "Clean desk|no-date|ok",
    ];
    return psv.map((line) => {
      const [summaryRaw, dueRaw, statusRaw] = line.split("|");
      const summary = summaryRaw?.trim() || "Task";
      const due = (dueRaw || "").trim();
      const status = (statusRaw || "").trim();
      return {
        summary,
        due: due === "no-date" ? "" : due,
        overdue: status.includes("overdue"),
        completed: status.includes("completed"),
      };
    });
  });

  const renderedRows = $derived.by(() => {
    if (isScrollable) return previewRows;
    return previewRows.slice(0, maxItems);
  });

  function toggleChecked(index: number) {
    if (!isCheckable) return;
    const current = toggledByIndex[index] ?? renderedRows[index]?.completed ?? false;
    toggledByIndex = { ...toggledByIndex, [index]: !current };
  }

  function isCompleted(index: number, completed: boolean): boolean {
    return toggledByIndex[index] ?? completed;
  }

  function handleRowKeydown(event: KeyboardEvent, index: number) {
    if (!isCheckable) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleChecked(index);
    }
  }
</script>

<Draggable {component}>
  <div class="todo-list" class:scrollable={isScrollable} style:width="100%" style:height="100%">
    {#each renderedRows as row, index (row.summary + index)}
      {#if isCheckable}
        <button
          type="button"
          class="todo-row checkable"
          style:height="{rowHeight}px"
          onclick={() => toggleChecked(index)}
          onkeydown={(event) => handleRowKeydown(event, index)}
        >
          <span class="checkbox">
            {#if iconPathIncomplete && iconPathComplete}
              <svg viewBox="0 0 24 24" class="checkbox-icon">
                <path d={isCompleted(index, row.completed) ? iconPathComplete : iconPathIncomplete} fill="currentColor" />
              </svg>
            {:else}
              {isCompleted(index, row.completed) ? "[x]" : "[ ]"}
            {/if}
          </span>
          {#if row.due}
            <span class="due" class:overdue={row.overdue}>{row.due}</span>
          {/if}
          <span class="summary" class:completed={isCompleted(index, row.completed)} title={row.summary}>{row.summary}</span>
        </button>
      {:else}
        <div
          class="todo-row"
          style:height="{rowHeight}px"
        >
          <span class="checkbox">
            {#if iconPathIncomplete && iconPathComplete}
              <svg viewBox="0 0 24 24" class="checkbox-icon">
                <path d={isCompleted(index, row.completed) ? iconPathComplete : iconPathIncomplete} fill="currentColor" />
              </svg>
            {:else}
              {isCompleted(index, row.completed) ? "[x]" : "[ ]"}
            {/if}
          </span>
          {#if row.due}
            <span class="due" class:overdue={row.overdue}>{row.due}</span>
          {/if}
          <span class="summary" class:completed={isCompleted(index, row.completed)} title={row.summary}>{row.summary}</span>
        </div>
      {/if}
    {/each}
  </div>
</Draggable>

<style>
  .todo-list {
    background: rgba(0, 0, 0, 0.22);
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 6px;
    padding: 4px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-sizing: border-box;
  }

  .todo-list.scrollable {
    overflow-y: auto;
  }

  .todo-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 4px;
    min-height: 20px;
    box-sizing: border-box;
  }

  .todo-row.checkable {
    cursor: pointer;
    border: 0;
    width: 100%;
    text-align: left;
  }

  .checkbox {
    color: #f5c35a;
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .checkbox-icon {
    width: 16px;
    height: 16px;
  }

  .summary {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 11px;
    color: #ffffff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .summary.completed {
    color: #8aa0b4;
    text-decoration: line-through;
  }

  .due {
    flex: 0 0 auto;
    font-size: 10px;
    color: #f5c35a;
    white-space: nowrap;
    max-width: 92px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .due.overdue {
    color: #ff6b6b;
  }
</style>
