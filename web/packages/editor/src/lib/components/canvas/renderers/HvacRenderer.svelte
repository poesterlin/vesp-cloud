<script lang="ts">
  import type { HvacComponent } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import { getHvacModeColor, getHvacOffColor, colorToCss as modeColorToCss } from "$lib/utils/hvac-modes";

  interface Props {
    component: HvacComponent;
  }

  let { component }: Props = $props();

  const label = $derived(component.label?.trim() || "Climate");
  const onMode = $derived((component.onMode ?? "heat").toUpperCase());
  const onColor = $derived(modeColorToCss(getHvacModeColor(component.onMode)));
  const offColor = $derived(modeColorToCss(getHvacOffColor()));
  const dimFill = "rgb(10, 14, 22)";
  const dimBorder = "rgb(25, 30, 40)";
  const textDim = "rgb(120, 128, 144)";
  const textWhite = "rgb(230, 240, 250)";
  const cornerSize = 9;

  function clippedPolygonPoints(w: number, h: number, c: number): string {
    return `${c},0 ${w - c},0 ${w},${c} ${w},${h - c} ${w - c},${h} ${c},${h} 0,${h - c} 0,${c}`;
  }

  function glowColor(cssColor: string): string {
    return cssColor.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, (_, r, g, b) => {
      return `rgb(${Math.floor(+r / 4)}, ${Math.floor(+g / 4)}, ${Math.floor(+b / 4)})`;
    });
  }
</script>

<Draggable {component} widthOnly>
  {#if component.size}
    {@const w = component.size.width}
    {@const h = component.size.height}

    <div class="hvac-wrap" style:width="100%" style:height="100%">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 {w} {h}"
        preserveAspectRatio="none"
        style:position="absolute"
        style:inset="0"
        style:pointer-events="none"
      >
        <!-- Outer glow border -->
        <polygon
          points={clippedPolygonPoints(w + 6, h + 6, cornerSize + 3)}
          fill="none"
          stroke={glowColor(onColor)}
          stroke-width="3"
          transform="translate(-3, -3)"
        />
        <!-- Main box -->
        <polygon
          points={clippedPolygonPoints(w, h, cornerSize)}
          fill={dimFill}
          stroke={dimBorder}
          stroke-width="1.5"
        />
        <!-- Inner double-line -->
        <polygon
          points={clippedPolygonPoints(w - 6, h - 6, cornerSize - 3)}
          fill="none"
          stroke={dimBorder}
          stroke-width="0.75"
          transform="translate(3, 3)"
        />
      </svg>

      <!-- Top row: label + mode -->
      <div class="top-row">
        <span class="top-label" style:color={textDim}>{label}</span>
        <span class="top-mode" style:color={onColor}>{onMode}</span>
      </div>

      <!-- Center: current temp (preview) + target temp + "Target" -->
      <div class="target-row">
        <span class="current-value" style:color={textDim}>21.5°</span>
        <span class="target-value" style:color={textWhite}>22.0°</span>
        <span class="target-label" style:color={textDim}>Target</span>
      </div>

      <!-- Bottom buttons row -->
      <div class="buttons-row">
        <span class="temp-btn" style:color={textWhite}>−</span>
        <span class="temp-btn" style:color={textWhite}>+</span>
        <span class="power-btn" style:border-color={offColor}; style:color={offColor}>⏻</span>
      </div>
    </div>
  {/if}
</Draggable>

<style>
  .hvac-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 120px;
    min-height: 105px;
    overflow: hidden;
  }

  .top-row {
    position: absolute;
    top: 12px;
    left: 15px;
    right: 15px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    height: 18px;
  }

  .top-label {
    font-family: var(--display-font, monospace);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
  }

  .top-mode {
    font-family: var(--display-font, monospace);
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 700;
    flex-shrink: 0;
  }

  .target-row {
    position: absolute;
    /* Keep the temp stack centered in the content area between the top
       row and the button row, not the full widget height — otherwise the
       buttons visually weigh it down. These offsets mirror the C++
       layout: top_row (12 + 18) + 6 gap, and bottom = buttons (9 + 39) + 9 pad. */
    top: 36px;
    bottom: 57px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  .current-value {
    font-family: var(--display-font, monospace);
    font-size: 12px;
    margin-bottom: 3px;
  }

  .target-value {
    font-family: var(--display-font, monospace);
    font-size: 20px;
    font-weight: 700;
    line-height: 1;
  }

  .target-label {
    font-family: var(--display-font, monospace);
    font-size: 11px;
    opacity: 0.8;
    margin-top: 3px;
  }

  .buttons-row {
    position: absolute;
    bottom: 9px;
    left: 0;
    right: 0;
    display: flex;
    padding: 0 9px;
    gap: 9px;
  }

  .temp-btn {
    flex: 1;
    text-align: center;
    font-family: var(--display-font, monospace);
    font-size: 17px;
    font-weight: 700;
    padding: 9px 0;
    background: rgb(30, 36, 48);
    border: 0.75px solid rgb(60, 60, 80);
    border-radius: 3px;
    line-height: 1;
  }

  .power-btn {
    flex: 2.5;
    text-align: center;
    font-family: var(--display-font, monospace);
    font-size: 18px;
    font-weight: 700;
    padding: 9px 0;
    background: rgb(22, 26, 36);
    border: 0.75px solid;
    border-radius: 3px;
    line-height: 1;
  }
</style>
