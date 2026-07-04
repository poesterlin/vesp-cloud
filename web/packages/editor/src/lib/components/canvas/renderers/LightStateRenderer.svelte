<script lang="ts">
  import type { LightStateComponent } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import * as mdiIcons from "@mdi/js";
  import { colorToCss } from "$lib/utils/color-utils";

  interface Props {
    component: LightStateComponent;
  }

  let { component }: Props = $props();

  const offText = $derived(component.offText?.trim() || "OFF");
  const useImageToggle = $derived(component.showIcon !== false);
  const label = $derived(component.label?.trim() || "Light");
  const iconName = $derived(
    (component.icon?.trim() || "lightbulb").replace(/^mdi:/, ""),
  );
  const iconPath = $derived.by(() => {
    const iconKey =
      "mdi" +
      iconName
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
    const path = (mdiIcons as Record<string, unknown>)[iconKey];
    return typeof path === "string" ? path : null;
  });

  const onColor = $derived(
    colorToCss(component.onColor, "rgb(255, 180, 0)"),
  );
  const offColor = $derived(
    colorToCss(component.offColor, "rgb(80, 80, 80)"),
  );
  const dimFill = "rgb(25, 30, 40)";
  const cornerSize = 6;

  const width = $derived(component.size?.width ?? 200);
  const height = $derived(component.size?.height ?? 90);

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
  {#if useImageToggle}
    {#if component.size}
      {@const w = component.size.width}
      {@const h = component.size.height}
      <div class="image-toggle-wrap" style:width="100%" style:height="100%">
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 {w} {h}"
          preserveAspectRatio="none"
          style:position="absolute"
          style:inset="0"
        >
          <polygon
            points={clippedPolygonPoints(w + 4, h + 4, cornerSize + 2)}
            fill="none"
            stroke={glowColor(offColor)}
            stroke-width="2"
            transform="translate(-2, -2)"
          />
          <polygon
            points={clippedPolygonPoints(w, h, cornerSize)}
            fill={dimFill}
            stroke={offColor}
            stroke-width="1"
          />
        </svg>

        <div class="toggle-icon" style:color={offColor}>
          {#if iconPath}
            <svg viewBox="0 0 24 24" class="icon-svg">
              <path d={iconPath} fill="currentColor" />
            </svg>
          {:else}
            <span class="icon-fallback">{iconName || "?"}</span>
          {/if}
        </div>
        <span class="toggle-label">{label}</span>
      </div>
    {/if}
  {:else}
    {@const w = component.size?.width ?? 200}
    {@const h = component.size?.height ?? 90}
    <div class="text-toggle-wrap" style:width="100%" style:height="100%">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 {w} {h}"
        preserveAspectRatio="none"
        style:position="absolute"
        style:inset="0"
        style:pointer-events="none"
      >
        <rect x="0" y="0" width={w} height={20} fill="rgb(2, 3, 5)" />
      </svg>
      <span class="text-label">{label}</span>
      <span class="state-pill" style:background-color={offColor}>
        {offText}
      </span>
    </div>
  {/if}
</Draggable>

<style>
  .image-toggle-wrap {
    position: relative;
    display: flex;
    align-items: center;
    gap: 0;
    min-width: 0;
    min-height: 32px;
    overflow: hidden;
  }

  .toggle-icon {
    position: absolute;
    left: 16px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
  }

  .toggle-label {
    position: absolute;
    left: 52px;
    right: 6px;
    top: 50%;
    transform: translateY(-50%);
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 18px);
    color: rgb(230, 240, 250);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .icon-svg {
    width: 24px;
    height: 24px;
  }

  .icon-fallback {
    max-width: 24px;
    font-size: 9px;
    line-height: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-transform: lowercase;
  }

  .text-toggle-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
    overflow: hidden;
  }

  .text-label {
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 18px);
    color: rgb(230, 240, 250);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    max-width: 100%;
    padding-top: 22px;
    padding-left: 2px;
  }

  .state-pill {
    padding: 2px 8px;
    border-radius: 0;
    color: #0d1117;
    font-family: monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }
</style>
