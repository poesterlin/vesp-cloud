<script lang="ts">
  import type { Component } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";

  interface Props {
    component: Component & { type: "text" };
  }

  let { component }: Props = $props();

  const fontSize = $derived(
    component.fontSize === "small" ? 12 : component.fontSize === "large" ? 20 : 14
  );

  const textAlign = $derived(component.align === "left" || component.align === undefined ? "flex-start" : component.align === "right" ? "flex-end" : "center");

  const colorStyle = $derived(
    component.color
      ? `rgb(${component.color.r}, ${component.color.g}, ${component.color.b})`
      : "#ffffff"
  );
</script>

<Draggable {component}>
  <div
    class="text-component"
    style:font-size="{fontSize}px"
    style:justify-content="{textAlign}"
    style:color={colorStyle}
  >
    {component.text ?? "Text"}
    {#if component.textBinding}
      <span class="binding-indicator">({component.textBinding.entityId})</span>
    {/if}
  </div>
</Draggable>

<style>
  .text-component {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
  }

  .binding-indicator {
    font-size: 10px;
    color: var(--color-accent);
    margin-left: 4px;
  }
</style>
