<script lang="ts">
  import type { ButtonComponent } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { colorToCss } from "$lib/utils/color-utils";
  import * as mdiIcons from "@mdi/js";

  interface Props {
    component: ButtonComponent;
  }

  let { component }: Props = $props();
  const theme = $derived(projectStore.theme);
  const isRetro = $derived(theme.id === "retro");

  const borderColor = $derived(
    colorToCss(component.borderColor, colorToCss(theme.colors.accent)),
  );
  const foregroundColor = $derived(colorToCss(theme.colors.foreground));
  const dimFill = "rgb(25, 30, 40)";

  const iconSize = 20;
  const hasIcon = $derived.by(() => {
    if (!component.icon) return false;
    const iconName = component.icon.replace(/^mdi:/, "");
    const iconKey =
      "mdi" +
      iconName
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
    const path = (mdiIcons as Record<string, unknown>)[iconKey];
    return typeof path === "string" ? path : null;
  });
  const hasLabel = $derived(
    component.label !== undefined && component.label.length > 0,
  );
  const buttonWidth = $derived(component.size?.width ?? 100);
  const buttonHeight = $derived(component.size?.height ?? 44);

  const cornerSize = $derived(buttonHeight < 40 ? 4 : 6);

  const horizontalLayout = $derived.by(() => {
    if (!hasIcon || !hasLabel) return false;
    if (buttonHeight >= 56) return false;
    const sidePad = 8;
    const gap = 6;
    const horizBudget = buttonWidth - 2 * sidePad - iconSize - gap;
    return horizBudget >= 28;
  });

  function clippedPolygonPoints(
    w: number,
    h: number,
    c: number,
    inset = 0,
  ): string {
    return `${c},${inset} ${w - c},${inset} ${w - inset},${c} ${w - inset},${h - c} ${w - c},${h - inset} ${c},${h - inset} ${inset},${h - c} ${inset},${c}`;
  }

  function glowColor(cssColor: string): string {
    return cssColor.replace(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/, (_, r, g, b) => {
      return `rgb(${Math.floor(+r / 4)}, ${Math.floor(+g / 4)}, ${Math.floor(+b / 4)})`;
    });
  }
</script>

<Draggable {component}>
  {#if component.size}
    {@const w = component.size.width}
    {@const h = component.size.height}
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 {w} {h}"
      preserveAspectRatio="none"
    >
      <polygon
        points={clippedPolygonPoints(w + 4, h + 4, cornerSize + 2)}
        fill="none"
        stroke={glowColor(borderColor)}
        stroke-width="2"
        transform="translate(-2, -2)"
      />
      <polygon
        points={clippedPolygonPoints(w, h, cornerSize, 0.5)}
        fill={dimFill}
        stroke={borderColor}
        stroke-width="1"
      />
      {#if isRetro && w >= 56 && h >= 30}
        <line x1={cornerSize + 5} y1="3" x2={w - cornerSize - 12} y2="3" stroke={glowColor(borderColor)} />
        <rect x={w - cornerSize - 8} y="2" width="3" height="3" fill={borderColor} />
        <rect x={cornerSize + 5} y={h - 4} width="8" height="1" fill={borderColor} />
        <rect x={cornerSize + 17} y={h - 4} width="3" height="1" fill={glowColor(borderColor)} />
        <rect x={cornerSize + 23} y={h - 4} width="3" height="1" fill={glowColor(borderColor)} />
      {:else if !isRetro && w >= 44 && h >= 28}
        <line x1={cornerSize + 3} y1="2" x2={w - cornerSize - 3} y2="2" stroke="rgba(255,255,255,0.13)" />
        <rect x={w / 2 - 9} y={h - 3} width="18" height="2" rx="1" fill={borderColor} />
      {/if}
    </svg>

    <div
      class="button-content"
      class:horizontal={horizontalLayout}
      style:color={foregroundColor}
    >
      {#if hasIcon}
        <svg
          class="button-icon"
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
        >
          <path d={hasIcon} fill="currentColor" />
        </svg>
      {/if}
      {#if hasLabel}
        <span
          class="button-label"
          class:with-icon={!!hasIcon}
          class:inline={horizontalLayout}
          title={component.label}
        >
          {component.label}
        </span>
      {/if}
    </div>
  {/if}
</Draggable>

<style>
  .button-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px 6px;
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .button-content.horizontal {
    flex-direction: row;
    gap: 6px;
    padding: 4px 8px;
  }

  .button-icon {
    flex: 0 0 auto;
  }

  .button-label {
    max-width: 100%;
    min-width: 0;
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 18px);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .button-label.with-icon {
    font-size: var(--display-text-tiny, 14px);
  }

  .button-label.inline {
    flex: 0 1 auto;
    text-align: left;
    font-size: var(--display-text-small, 18px);
  }
</style>
