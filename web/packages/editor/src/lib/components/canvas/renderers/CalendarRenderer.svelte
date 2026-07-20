<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "$lib/stores/project.svelte";

  type CalendarComponent = Extract<Component, { type: "calendar" }>;

  interface Props {
    component: CalendarComponent;
  }

  let { component }: Props = $props();

  const label = $derived(component.label?.trim() || "Calendar");
  const maxItems = $derived(Math.max(1, Math.min(10, component.maxItems ?? 4)));
  const rowHeight = 40;
  const isScrollable = $derived(component.scrollable === true);
  const isRetro = $derived(projectStore.theme.id === "retro");

  const previewRows = $derived([
    { start: "2026-07-03", summary: "Trash Collection", location: "Front Curb" },
    { start: "2026-07-04", summary: "Family BBQ", location: "Backyard" },
    { start: "2026-07-06", summary: "HVAC Service Window", location: "Home" },
    { start: "2026-07-09", summary: "Parent-Teacher Meeting", location: "Rosenweg School" },
    { start: "2026-07-12", summary: "Grocery Restock", location: "Market Hall" },
    { start: "2026-07-15", summary: "Package Delivery", location: "Apartment Lobby" },
  ]);

  const rows = $derived.by(() => {
    if (isScrollable) return previewRows;
    return previewRows.slice(0, maxItems);
  });

  function shortDate(v: string): string {
    if (v.length >= 10 && v[4] === "-" && v[7] === "-") return v.slice(5, 10);
    return v;
  }
</script>

<Draggable {component}>
  {#if component.size}
    <div class="calendar" class:scrollable={isScrollable} class:retro={isRetro} style:width="100%" style:height="100%">
      <div class="frame"></div>
      <div class="header">{label}</div>
      <div class="rows" style:top="28px">
        {#each rows as row, i (row.start + row.summary + i)}
          <div class="row" style:height="{rowHeight}px">
            <div class="date">{shortDate(row.start)}</div>
            <div class="content">
              <div class="summary" title={row.summary}>{row.summary}</div>
              {#if row.location}
                <div class="location" title={row.location}>{row.location}</div>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</Draggable>

<style>
  .calendar {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    background: rgb(10, 14, 22);
    border: 1px solid rgb(25, 30, 40);
    border-radius: 8px;
  }

  .calendar.scrollable {
    overflow-y: auto;
  }

  .calendar.retro {
    border-radius: 0;
    clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
  }

  .frame {
    position: absolute;
    inset: 2px;
    border: 1px solid rgb(30, 36, 45);
    border-radius: 6px;
    pointer-events: none;
  }

  .header {
    position: absolute;
    top: 4px;
    left: 12px;
    right: 12px;
    color: rgb(120, 128, 144);
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 16px);
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rows {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 8px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    background: rgb(18, 22, 32);
    border: 1px solid rgb(35, 40, 55);
    border-radius: 0;
    padding: 3px 6px;
    box-sizing: border-box;
  }

  .date {
    width: 60px;
    color: rgb(120, 128, 144);
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 16px);
    font-weight: 400;
    flex-shrink: 0;
  }

  .content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .summary {
    color: rgb(230, 240, 250);
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 16px);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .location {
    color: rgb(120, 128, 144);
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-weather-tiny, 11px);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

</style>
