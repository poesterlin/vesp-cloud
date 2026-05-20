<script lang="ts">
  import type { LightStateComponent } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";
  import * as mdiIcons from "@mdi/js";
  import { colorToCss } from "$lib/utils/color-utils";
  interface Props {
    component: LightStateComponent;
  }

  let { component }: Props = $props();

  const offText = $derived(component.offText?.trim() || "OFF");
  const useImageToggle = $derived(component.showIcon !== false);
  const showBrightnessControl = $derived(
    component.showBrightnessControl === true,
  );
  const hasBrightnessTarget = $derived(
    !!component.stateBinding?.entityId || !!component.targetDevice?.deviceId,
  );

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
  const offColor = $derived(
    colorToCss(component.offColor, "rgb(92, 102, 117)"),
  );
</script>

<Draggable {component} widthOnly>
    {#if useImageToggle}
      <div class="image-toggle" style:border-color={offColor}>
        <div class="icon-wrap" style:color={offColor}>
          {#if iconPath}
            <svg viewBox="0 0 24 24" class="icon-svg">
              <path d={iconPath} fill="currentColor" />
            </svg>
          {:else}
            <span class="icon-fallback">{iconName || "?"}</span>
          {/if}
        </div>
        <span class="label">{label}</span>
      </div>
      <div class="bindings">
        {#if !component.stateBinding}
          Bind a light entity
        {/if}
      </div>
    {:else}
      <span class="label">{label}</span>
      <span class="state-pill" style:background-color={offColor}>
        {offText}
      </span>
      {#if showBrightnessControl}
        <div class="brightness-row">
          <span class="brightness-label">Brightness</span>
          <div class="brightness-track">
            <div
              class="brightness-fill"
              style:background-color={offColor}
            ></div>
          </div>
          {#if !hasBrightnessTarget}
            <span class="brightness-hint">no target</span>
          {/if}
        </div>
      {/if}
    {/if}
</Draggable>

<style>
  .label {
    min-width: 0;
    /* Light-state labels print via g_theme.label (font_small / Roboto 18). */
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 18px);
    color: #f2f4f8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .state-pill {
    padding: 2px 8px;
    border-radius: 999px;
    color: #0d1117;
    font-family: monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
  }

  .bindings {
    grid-column: 1 / -1;
    min-width: 0;
    font-size: 10px;
    color: #8fa0b5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .brightness-row {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 2px;
  }

  .brightness-label {
    font-size: 10px;
    color: #9dadc1;
    flex: 0 0 auto;
  }

  .brightness-track {
    height: 6px;
    flex: 1;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.16);
    overflow: hidden;
  }

  .brightness-fill {
    width: 55%;
    height: 100%;
    border-radius: 999px;
  }

  .brightness-hint {
    font-size: 10px;
    color: #8fa0b5;
  }

  .image-toggle {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
    min-height: 32px;
    padding: 6px 10px;
    border: 1px solid;
    border-radius: 8px;
    background: rgba(8, 10, 14, 0.45);
    overflow: hidden;
  }

  .image-toggle .label {
    flex: 1 1 auto;
  }

  .icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex: 0 0 auto;
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
</style>
