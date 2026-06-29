<script lang="ts">
  import type { HvacComponent } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";
  import { colorToCss } from "$lib/utils/color-utils";

  interface Props {
    component: HvacComponent;
  }

  let { component }: Props = $props();

  const label = $derived(component.label?.trim() || "Climate");
  const onMode = $derived((component.onMode ?? "heat").toUpperCase());
  const onColor = $derived(colorToCss(component.onColor, "rgb(255, 180, 0)"));
  const offColor = $derived(colorToCss(component.offColor, "rgb(80, 80, 80)"));
  const dimFill = "rgb(10, 14, 22)";
  const dimBorder = "rgb(25, 30, 40)";
  const textDim = "rgb(120, 128, 144)";
  const textWhite = "rgb(230, 240, 250)";
  const cornerSize = 6;

  const width = $derived(component.size?.width ?? 150);
  const height = $derived(component.size?.height ?? 105);

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
          points={clippedPolygonPoints(w + 4, h + 4, cornerSize + 2)}
          fill="none"
          stroke={glowColor(onColor)}
          stroke-width="2"
          transform="translate(-2, -2)"
        />
        <!-- Main box -->
        <polygon
          points={clippedPolygonPoints(w, h, cornerSize)}
          fill={dimFill}
          stroke={dimBorder}
          stroke-width="1"
        />
        <!-- Inner double-line -->
        <polygon
          points={clippedPolygonPoints(w - 4, h - 4, cornerSize - 2)}
          fill="none"
          stroke={dimBorder}
          stroke-width="0.5"
          transform="translate(2, 2)"
        />
      </svg>

      <!-- Top row: label + mode -->
      <div class="top-row">
        <span class="top-label" style:color={textDim}>{label}</span>
        <span class="top-mode" style:color={onColor}>{onMode}</span>
      </div>

      <!-- Center: target temp + "Target" -->
      <div class="target-row">
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
    min-width: 80px;
    min-height: 70px;
    overflow: hidden;
  }

  .top-row {
    position: absolute;
    top: 8px;
    left: 10px;
    right: 10px;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    height: 14px;
  }

  .top-label {
    font-family: var(--display-font, monospace);
    font-size: 7px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 70%;
  }

  .top-mode {
    font-family: var(--display-font, monospace);
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
    flex-shrink: 0;
  }

  .target-row {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    transform: translateY(-40%);
  }

  .target-value {
    font-family: var(--display-font, monospace);
    font-size: 13px;
    font-weight: 700;
  }

  .target-label {
    font-family: var(--display-font, monospace);
    font-size: 7px;
    opacity: 0.8;
    margin-top: 2px;
  }

  .buttons-row {
    position: absolute;
    bottom: 6px;
    left: 0;
    right: 0;
    display: flex;
    padding: 0 6px;
    gap: 6px;
  }

  .temp-btn {
    flex: 1;
    text-align: center;
    font-family: var(--display-font, monospace);
    font-size: 11px;
    font-weight: 700;
    padding: 6px 0;
    background: rgb(30, 36, 48);
    border: 0.5px solid rgb(60, 60, 80);
    border-radius: 2px;
    line-height: 1;
  }

  .power-btn {
    flex: 2.5;
    text-align: center;
    font-family: var(--display-font, monospace);
    font-size: 12px;
    font-weight: 700;
    padding: 6px 0;
    background: rgb(22, 26, 36);
    border: 0.5px solid;
    border-radius: 2px;
    line-height: 1;
  }
</style>
