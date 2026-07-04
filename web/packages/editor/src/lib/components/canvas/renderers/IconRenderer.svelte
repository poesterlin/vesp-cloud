<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import * as mdiIcons from '@mdi/js';

  interface Props {
    component: Component & { type: "icon" };
  }

  let { component }: Props = $props();

  const colorStyle = $derived(
    component.color
      ? `rgb(${component.color.r}, ${component.color.g}, ${component.color.b})`
      : "#ffffff"
  );

  const scale = $derived(component.scale ?? 1);

  // Get MDI icon path, fallback to placeholder if not found
  const iconPath = $derived.by(() => {
    if (!component.icon) return null;
    
    // Convert icon name to @mdi/js format (e.g., "home" -> "mdiHome")
    const iconKey = 'mdi' + component.icon
      .split(/[-_]/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
    
    const path = (mdiIcons as Record<string, unknown>)[iconKey];
    return typeof path === 'string' ? path : null;
  });

  const isMdiIcon = $derived(iconPath !== null);
</script>

<Draggable {component}>
  <div class="icon-component" style:color={colorStyle} style:transform="scale({scale})">
    {#if isMdiIcon && iconPath}
      <!-- MDI icon rendered as SVG -->
      <svg viewBox="0 0 24 24" class="icon-svg">
        <path d={iconPath} fill="currentColor" />
      </svg>
    {:else}
      <!-- Fallback placeholder for unknown icons -->
      <span class="icon-placeholder" title={component.icon || 'No icon'}>
        {component.icon || '?'}
      </span>
    {/if}
  </div>
</Draggable>

<style>
  .icon-component {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-svg {
    width: 24px;
    height: 24px;
    overflow: visible;
  }

  .icon-placeholder {
    font-size: 10px;
    font-family: monospace;
    background: #333;
    padding: 2px 4px;
    border-radius: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: help;
  }
</style>
