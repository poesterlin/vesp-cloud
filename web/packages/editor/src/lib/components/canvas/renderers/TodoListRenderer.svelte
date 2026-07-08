<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
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

  const width = $derived(component.size?.width ?? 200);
  const height = $derived(component.size?.height ?? 160);
  const cornerSize = 8;
  const innerCorner = 6;
  const innerMargin = 2;

  const borderColor = $derived(
    component.color
      ? `rgb(${component.color.r}, ${component.color.g}, ${component.color.b})`
      : "rgb(255, 180, 0)",
  );
  const borderDimColor = $derived(
    component.color
      ? `rgb(${Math.floor(component.color.r * 0.6)}, ${Math.floor(component.color.g * 0.6)}, ${Math.floor(component.color.b * 0.6)})`
      : "rgb(160, 110, 0)",
  );
  const containerBg = "rgb(10, 12, 18)";
  const whiteColor = "rgb(230, 240, 250)";
  const grayColor = "rgb(120, 130, 145)";
  const redColor = "rgb(255, 55, 55)";
  const greenColor = "rgb(0, 220, 120)";

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
      "Buy coffee beans and filter paper|no-date|ok",
      "Pick up milk|no-date|ok",
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

  function clippedPolygonPoints(w: number, h: number, c: number): string {
    return `${c},0 ${w - c},0 ${w},${c} ${w},${h - c} ${w - c},${h} ${c},${h} 0,${h - c} 0,${c}`;
  }

  function iconPathForRow(index: number, row: { completed: boolean }): string | null {
    if (isCompleted(index, row.completed)) return iconPathComplete;
    return iconPathIncomplete;
  }
</script>

<Draggable {component}>
  <div class="todo-list" class:scrollable={isScrollable} style:width="100%" style:height="100%">
    <svg
      class="todo-svg"
      width={width}
      height={height}
      viewBox="0 0 {width} {height}"
    >
      <polygon
        points={clippedPolygonPoints(width, height, cornerSize)}
        fill={containerBg}
        stroke={borderColor}
        stroke-width="1"
      />
      <polygon
        points={clippedPolygonPoints(width - innerMargin * 2, height - innerMargin * 2, innerCorner)}
        fill="none"
        stroke={borderDimColor}
        stroke-width="1"
        transform="translate({innerMargin}, {innerMargin})"
      />
    </svg>

    <div class="todo-rows" style:padding-top="8px" style:padding-left="8px" style:padding-right="8px">
      {#each renderedRows as row, index (row.summary + index)}
        {#if isCheckable}
          {@const completed = isCompleted(index, row.completed)}
          {@const showMDI = iconPathIncomplete !== null && iconPathComplete !== null}
          <button
            type="button"
            class="todo-row checkable"
            style:height="{rowHeight}px"
            onclick={() => toggleChecked(index)}
            onkeydown={(event) => handleRowKeydown(event, index)}
          >
            <span class="checkbox" style:color={completed ? greenColor : borderColor}>
              {#if showMDI}
                <svg viewBox="0 0 24 24" class="checkbox-icon">
                  <path d={completed ? iconPathComplete! : iconPathIncomplete!} fill="currentColor" />
                </svg>
              {:else}
                {completed ? "[x]" : "[ ]"}
              {/if}
            </span>
            {#if row.due}
              <span class="due" class:overdue={row.overdue} style:color={row.overdue ? redColor : borderColor}>{row.due}</span>
            {/if}
            <span
              class="summary"
              class:completed={completed}
              style:color={completed ? grayColor : whiteColor}
              title={row.summary}
            >{row.summary}</span>
          </button>
        {:else}
          {@const completed = isCompleted(index, row.completed)}
          {@const showMDI = iconPathIncomplete !== null && iconPathComplete !== null}
          <div
            class="todo-row"
            style:height="{rowHeight}px"
          >
            <span class="checkbox" style:color={completed ? greenColor : borderColor}>
              {#if showMDI}
                <svg viewBox="0 0 24 24" class="checkbox-icon">
                  <path d={completed ? iconPathComplete! : iconPathIncomplete!} fill="currentColor" />
                </svg>
              {:else}
                {completed ? "[x]" : "[ ]"}
              {/if}
            </span>
            {#if row.due}
              <span class="due" class:overdue={row.overdue} style:color={row.overdue ? redColor : borderColor}>{row.due}</span>
            {/if}
            <span
              class="summary"
              class:completed={completed}
              style:color={completed ? grayColor : whiteColor}
              title={row.summary}
            >{row.summary}</span>
          </div>
        {/if}
      {/each}
    </div>
  </div>
</Draggable>

<style>
  .todo-list {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
  }

  .todo-list.scrollable {
    overflow-y: auto;
  }

  .todo-svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .todo-rows {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    box-sizing: border-box;
    padding-bottom: 8px;
  }

  .todo-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 0 2px;
    min-height: 20px;
    box-sizing: border-box;
    background: none;
  }

  .todo-row.checkable {
    cursor: pointer;
    border: 0;
    width: 100%;
    text-align: left;
  }

  .checkbox {
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
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 18px);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .summary.completed {
    text-decoration: line-through;
  }

  .due {
    flex: 0 0 auto;
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 18px);
    white-space: nowrap;
    max-width: 92px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .due.overdue {
    /* color is set inline to match redColor */
  }
</style>
