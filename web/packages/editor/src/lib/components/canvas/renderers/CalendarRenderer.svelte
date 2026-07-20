<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { colorToCss } from "$lib/utils/color-utils";

  type CalendarComponent = Extract<Component, { type: "calendar" }>;

  interface Props {
    component: CalendarComponent;
  }

  let { component }: Props = $props();

  const label = $derived(component.label?.trim() || "Calendar");
  const maxItems = $derived(Math.max(1, Math.min(10, component.maxItems ?? 4)));
  const rowHeight = 46;
  const headerHeight = 32;
  const bottomPadding = 6;
  const isScrollable = $derived(component.scrollable === true);
  const theme = $derived(projectStore.theme);
  const isRetro = $derived(theme.id === "retro");
  const accentColor = $derived(colorToCss(theme.colors.accent));
  const foregroundColor = $derived(colorToCss(theme.colors.foreground));
  const componentWidth = $derived(component.size?.width ?? 225);
  const componentHeight = $derived(component.size?.height ?? 180);

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
    const rowsThatFit = Math.max(
      1,
      Math.floor((componentHeight - headerHeight - bottomPadding) / rowHeight),
    );
    return previewRows.slice(0, Math.min(maxItems, rowsThatFit));
  });

  function shortDate(v: string): string {
    if (v.length >= 10 && v[4] === "-" && v[7] === "-") return v.slice(5, 10);
    return v;
  }

  function clippedPolygonPoints(
    width: number,
    height: number,
    corner: number,
    inset: number,
  ): string {
    return `${corner},${inset} ${width - corner},${inset} ${width - inset},${corner} ${width - inset},${height - corner} ${width - corner},${height - inset} ${corner},${height - inset} ${inset},${height - corner} ${inset},${corner}`;
  }
</script>

<Draggable {component}>
  {#if component.size}
    <div
      class="calendar"
      class:retro={isRetro}
      style:width="100%"
      style:height="100%"
      style:--calendar-accent={accentColor}
      style:--calendar-foreground={foregroundColor}
    >
      {#if isRetro}
        <svg
          class="retro-frame"
          width="100%"
          height="100%"
          viewBox="0 0 {componentWidth} {componentHeight}"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            points={clippedPolygonPoints(componentWidth, componentHeight, 8, 0.5)}
            fill="#0c1320"
            stroke={accentColor}
            stroke-width="1"
          />
          <polygon
            points={clippedPolygonPoints(componentWidth, componentHeight, 8, 2.5)}
            fill="none"
            stroke="rgba(255, 255, 255, 0.06)"
            stroke-width="1"
          />
        </svg>
      {:else}
        <div class="frame"></div>
      {/if}
      <div class="header">
        <span class="title">{label}</span>
      </div>
      <div class="header-rule"><span></span></div>
      <div class="rows" class:scrollable={isScrollable} style:top="{headerHeight}px">
        {#each rows as row, i (row.start + row.summary + i)}
          <div class="row" style:height="{rowHeight}px">
            <div class="date">{shortDate(row.start)}</div>
            <div class="divider"></div>
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
    color: var(--calendar-accent);
    background: #0c1320;
    border: 1px solid var(--calendar-accent);
    border-radius: 9px;
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.45),
      0 0 0 1px color-mix(in srgb, var(--calendar-accent) 15%, transparent);
  }

  .calendar.retro {
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .retro-frame {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .frame {
    position: absolute;
    inset: 2px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 7px;
    pointer-events: none;
    z-index: 2;
  }

  .header {
    position: absolute;
    top: 0;
    left: 11px;
    right: 11px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    color: var(--calendar-foreground);
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 16px);
    font-weight: 400;
    line-height: 1;
  }

  .title {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .header-rule {
    position: absolute;
    top: 29px;
    left: 10px;
    right: 10px;
    height: 1px;
    background: rgba(120, 128, 144, 0.22);
  }

  .header-rule span {
    display: block;
    width: min(38px, 22%);
    height: 1px;
    background: var(--calendar-accent);
    box-shadow: 0 0 4px color-mix(in srgb, var(--calendar-accent) 45%, transparent);
  }

  .rows {
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 6px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .rows.scrollable {
    overflow-y: auto;
    scrollbar-width: none;
  }

  .rows.scrollable::-webkit-scrollbar {
    display: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: 0 0 auto;
    padding: 4px 2px;
    box-sizing: border-box;
  }

  .row + .row {
    border-top: 1px solid rgba(120, 128, 144, 0.22);
  }

  .retro .row + .row {
    border-top-style: dashed;
  }

  .date {
    width: 44px;
    color: var(--calendar-accent);
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-weather-tiny, 11px);
    font-weight: 400;
    letter-spacing: 0.03em;
    flex-shrink: 0;
    opacity: 0.82;
  }

  .divider {
    align-self: stretch;
    width: 1px;
    margin: 3px 1px;
    background: color-mix(in srgb, var(--calendar-accent) 32%, transparent);
  }

  .content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .summary {
    color: var(--calendar-foreground);
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 16px);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .location {
    color: color-mix(in srgb, var(--calendar-foreground) 52%, transparent);
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-weather-tiny, 11px);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

</style>
