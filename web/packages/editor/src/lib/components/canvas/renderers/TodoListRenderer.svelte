<script lang="ts">
  import type { Component } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";

  type TodoListComponent = Extract<Component, { type: "todo_list" }>;

  interface Props {
    component: TodoListComponent;
  }

  let { component }: Props = $props();

  const maxItems = $derived(Math.max(1, Math.min(10, component.maxItems ?? 4)));
  const rowHeight = $derived(Math.max(20, Math.min(80, component.rowHeight ?? 30)));

  const previewRows = $derived.by(() => {
    const rows = [];
    for (let i = 0; i < maxItems; i++) {
      rows.push({
        text: i === 0
          ? "Buy coffee beans and filter paper"
          : i === 1
            ? "Pick up milk"
            : i === 2
              ? "Send parcel"
              : `Task ${i + 1}`,
        due: i === 0 ? "Today" : i === 1 ? "Mar 22" : i === 2 ? "Overdue" : "",
        overdue: i === 2,
      });
    }
    return rows;
  });
</script>

<Draggable {component}>
  <div class="todo-list" style:width="100%" style:height="100%">
    {#each previewRows as row (row.text)}
      <div class="todo-row" style:height="{rowHeight}px">
        <span class="checkbox">[ ]</span>
        <span class="summary" title={row.text}>{row.text}</span>
        {#if row.due}
          <span class="due" class:overdue={row.overdue}>{row.due}</span>
        {/if}
      </div>
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

  .checkbox {
    font-family: monospace;
    color: #89d185;
    flex: 0 0 auto;
    font-size: 12px;
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

  .due {
    flex: 0 0 auto;
    font-size: 10px;
    color: #f5c35a;
    white-space: nowrap;
  }

  .due.overdue {
    color: #ff6b6b;
  }
</style>
