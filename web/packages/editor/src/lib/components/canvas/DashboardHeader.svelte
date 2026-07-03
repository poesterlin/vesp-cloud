<script lang="ts">
  import { projectStore } from "../../stores/project.svelte";

  const headerHeight = $derived(projectStore.pageHeader?.height ?? 49);

  const timeColor = "rgb(0, 240, 255)";
  const colonColor = "rgb(230, 240, 250)";
  const dateColor = "rgb(120, 130, 145)";
  const voidBg = "rgb(2, 3, 5)";
  const darkColor = "rgb(8, 12, 18)";
  const dimmerColor = "rgb(50, 60, 75)";
  const cyanDim = "rgb(0, 120, 150)";
  const hatchColor = "rgba(0, 30, 45, 0.6)";
</script>

<div
  class="dashboard-header"
  style:height="{headerHeight}px"
  style:background-color={voidBg}
>
  <div class="header-borders" style:border-color={darkColor}></div>

  <div class="time-block" style:color={timeColor}>
    <span class="time-hours">12</span>
    <span class="time-colon" style:color={colonColor}>:</span>
    <span class="time-minutes">00</span>
  </div>

  <div class="date-block" style:color={dateColor}>FRI 05 JUN</div>

  <div class="bottom-sep">
    <div class="sep-line sep-line-1" style:background-color={dimmerColor}></div>
    <div class="sep-line sep-line-2" style:background-color={darkColor}></div>
  </div>

  <div class="corner corner-tl" style:border-color={cyanDim}></div>
  <div class="corner corner-tr" style:border-color={cyanDim}></div>

  <div class="hatch-pattern">
    {#each Array(5) as _, i}
      <div
        class="hatch-line"
        style:left="{i * 8}px"
        style:background-color={hatchColor}
      ></div>
    {/each}
  </div>
</div>

<style>
  .dashboard-header {
    width: 100%;
    position: relative;
    overflow: hidden;
    user-select: none;
    pointer-events: none;
    font-family: var(--display-font, monospace);
  }

  .header-borders {
    position: absolute;
    inset: 0;
    pointer-events: none;
    border-left: 1px solid;
    border-right: 1px solid;
  }

  .time-block {
    position: absolute;
    left: 13px;
    top: 10px;
    display: flex;
    gap: 0;
    line-height: 1;
    font-size: var(--display-text-medium, 24px);
    font-weight: 700;
  }

  .time-hours,
  .time-minutes {
    color: inherit;
  }

  .time-colon {
    color: inherit;
    display: inline-block;
    width: 0.6em;
    text-align: center;
  }

  .date-block {
    position: absolute;
    right: 18px;
    top: 14px;
    font-size: var(--display-text-small, 18px);
    font-weight: 400;
    letter-spacing: 0.5px;
    line-height: 1;
    color: inherit;
  }

  .bottom-sep {
    position: absolute;
    bottom: 2px;
    left: 18px;
    right: 18px;
    pointer-events: none;
  }

  .sep-line {
    height: 1px;
    width: 100%;
  }

  .corner {
    position: absolute;
    top: 2px;
    width: 7px;
    height: 7px;
    pointer-events: none;
    border-style: solid;
  }

  .corner-tl {
    left: 1px;
    border-width: 1px 0 0 1px;
  }

  .corner-tr {
    right: 3px;
    border-width: 1px 1px 0 0;
  }

  .hatch-pattern {
    position: absolute;
    top: 2px;
    right: 2px;
    width: 50px;
    height: 5px;
    pointer-events: none;
  }

  .hatch-line {
    position: absolute;
    top: 0;
    width: 1px;
    height: 5px;
    transform: skewX(-35deg);
  }
</style>
