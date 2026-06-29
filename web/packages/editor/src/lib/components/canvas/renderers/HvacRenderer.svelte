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

    <!-- Bottom buttons -->
    {@const tempBtnW = Math.round(w / 5)}
    {@const powerBtnW = w - 16 - tempBtnW * 2}

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

        <!-- Target line: left dash -->
        <line
          x1="8"
          y1={Math.round(h * 0.43)}
          x2={Math.round(w * 0.21)}
          y2={Math.round(h * 0.43)}
          stroke={textDim}
          stroke-width="0.5"
          stroke-dasharray="2,2"
        />
        <!-- Target line: right dash -->
        <line
          x1={Math.round(w * 0.79)}
          y1={Math.round(h * 0.43)}
          x2={w - 8}
          y2={Math.round(h * 0.43)}
          stroke={textDim}
          stroke-width="0.5"
          stroke-dasharray="2,2"
        />

      </svg>

      <!-- Header: mode dot + mode + current temp -->
      <div class="hvac-header">
        <span class="mode-dot" style:background={onColor}></span>
        <span class="mode-text" style:color={onColor}>{onMode}</span>
        <span class="current-temp" style:color={textWhite}>21.5°</span>
      </div>

      <!-- Label -->
      <div class="hvac-label-row" style:max-width={`${w - 16}px`} style:color={textDim}>{label}</div>

      <!-- Target row -->
      <div class="target-row">
        <span class="target-label" style:color={textDim}>TRGT</span>
        <span class="target-value" style:color={textWhite}>22.0°</span>
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

  .hvac-header {
    position: absolute;
    top: 8px;
    left: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 5px;
    height: 16px;
  }

  .mode-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    box-shadow: 0 0 4px currentColor;
  }

  .mode-text {
    font-family: var(--display-font, monospace);
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-weight: 600;
  }

  .current-temp {
    margin-left: auto;
    font-family: var(--display-font, monospace);
    font-size: 13px;
    font-weight: 700;
    white-space: nowrap;
  }

  .hvac-label-row {
    position: absolute;
    top: 26px;
    left: 10px;
    right: 10px;
    font-family: var(--display-font, monospace);
    font-size: 7px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .target-row {
    position: absolute;
    top: 42%;
    left: 0;
    right: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .target-label {
    font-family: var(--display-font, monospace);
    font-size: 7px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    opacity: 0.8;
  }

  .target-value {
    font-family: var(--display-font, monospace);
    font-size: 13px;
    font-weight: 700;
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
