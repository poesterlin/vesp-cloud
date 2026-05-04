<script lang="ts">
  import type { LightStateComponent } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";
  import { colorToCss } from "$lib/utils/color-utils";

  interface Props {
    component: LightStateComponent;
  }

  let { component }: Props = $props();

  const onText = $derived(component.onText?.trim() || "ON");
  const offText = $derived(component.offText?.trim() || "OFF");
  const showIcon = $derived(component.showIcon !== false);
  const showBrightnessControl = $derived(component.showBrightnessControl === true);
  const hasBrightnessTarget = $derived(
    !!component.stateBinding?.entityId || !!component.targetDevice?.deviceId,
  );

  const offColor = $derived(colorToCss(component.offColor, "rgb(92, 102, 117)"));
</script>

<Draggable {component}>
  <div class="light-state-card" style:width="100%" style:height="100%">
    {#if showIcon}
      <span class="bulb">💡</span>
    {/if}
    <span class="label">{component.label || "Light"}</span>
    <span class="state-pill" style:background-color={offColor}>
      {offText}
    </span>
    <div class="bindings">
      {#if component.stateBinding}
        {component.stateBinding.entityId}
      {:else}
        Bind a light entity
      {/if}
    </div>
    {#if showBrightnessControl}
      <div class="brightness-row">
        <span class="brightness-label">Brightness</span>
        <div class="brightness-track">
          <div class="brightness-fill" style:background-color={offColor}></div>
        </div>
        {#if !hasBrightnessTarget}
          <span class="brightness-hint">no target</span>
        {/if}
      </div>
    {/if}
  </div>
</Draggable>

<style>
  .light-state-card {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    border-radius: 8px;
    background: rgba(20, 24, 32, 0.7);
    box-sizing: border-box;
    overflow: hidden;
  }

  .bulb {
    font-size: 14px;
  }

  .label {
    min-width: 0;
    font-size: 12px;
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
</style>
