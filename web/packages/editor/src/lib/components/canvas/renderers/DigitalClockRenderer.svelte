<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "$lib/stores/project.svelte";

  interface Props {
    component: Component & { type: "digital_clock" };
  }

  let { component }: Props = $props();
  const theme = $derived(projectStore.theme);
  const isRetro = $derived(theme.id === "retro");

  const colorStyle = $derived(
    component.color
      ? `rgb(${component.color.r}, ${component.color.g}, ${component.color.b})`
      : "#00ffff",
  );

  const clockFontSize = "64px";
  const dateFontSize = "16px";
</script>

<Draggable {component}>
  <div class="digital-clock" class:retro={isRetro} class:modern={!isRetro} style:color={colorStyle}>
    <div class="clock-panel" style:border-color={colorStyle}>
      <span class="clock-value" style:font-size={clockFontSize}>20:03</span>
      <span class="clock-date" style:font-size={dateFontSize}>Monday 29 June</span>
    </div>
  </div>
</Draggable>

<style>
  .digital-clock {
    width: 100%;
    height: 100%;
    position: relative;
  }

  .clock-panel {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid;
    border-radius: 9px;
    box-sizing: border-box;
    position: relative;
    overflow: hidden;
    padding: 8px 10px;
    align-items: flex-start;
    justify-content: flex-start;
    flex-direction: column;
  }

  .retro .clock-panel {
    background: #020f1f;
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.5),
      0 0 0 1px rgba(0, 255, 255, 0.15);
  }

  .retro .clock-panel::after {
    content: "";
    position: absolute;
    inset: 1px;
    background: repeating-linear-gradient(
      to bottom,
      rgba(120, 180, 220, 0.06) 0,
      rgba(120, 180, 220, 0.06) 1px,
      transparent 1px,
      transparent 4px
    );
    pointer-events: none;
  }

  .modern .clock-panel {
    background: #0c1320;
    border-color: #334861;
    box-shadow:
      inset 0 0 0 1px rgba(255, 255, 255, 0.03),
      0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .clock-value {
    font-family: var(--display-font, monospace);
    font-weight: 800;
    letter-spacing: 0.01em;
    line-height: 1;
    white-space: nowrap;
    margin-top: 2px;
  }

  .clock-date {
    margin-top: 4px;
    font-family: var(--display-font, monospace);
    font-weight: 600;
    letter-spacing: 0.01em;
    opacity: 0.7;
    white-space: nowrap;
  }

  .retro .clock-value {
    text-shadow:
      0 0 8px color-mix(in srgb, currentColor 28%, transparent),
      1px 1px 0 rgba(0, 0, 0, 0.45);
  }

  .modern .clock-value {
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.45);
  }
</style>
