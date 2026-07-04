<script lang="ts">
  import type { ContainerComponent } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "../../../stores/project.svelte";
  import { colorToCss } from "../../../utils/color-utils";

  interface Props {
    component: ContainerComponent;
  }

  let { component }: Props = $props();
  const theme = $derived(projectStore.theme);
  
  const bgColor = $derived(colorToCss(component.backgroundColor, "transparent"));
  const accentColor = $derived(colorToCss(theme.colors.accent));
  const foregroundColor = $derived(colorToCss(theme.colors.foreground));
  const width = $derived(component.size?.width ?? 0);
  const height = $derived(component.size?.height ?? 0);
  const cornerSize = $derived(theme.values?.cornerSize ?? 10);
</script>

<Draggable {component}>
  <div class="container-wrapper" style:width="100%" style:height="100%">
    {#if component.label}
      <div class="container-label" style:color={accentColor} title={component.label}>
        {component.label.toUpperCase()}
      </div>
    {/if}
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 {width} {height}"
      preserveAspectRatio="none"
    >
      <!-- Background -->
      <rect x="0" y="0" width={width} height={height} fill={bgColor} />

      <!-- Retro Corners -->
      {#if theme.style?.containerCorners}
        <g stroke={accentColor} stroke-width="1.5" fill="none">
          <!-- Top Left -->
          <path d="M 0 {cornerSize} L 0 0 L {cornerSize} 0" />
          <path d="M 3 {cornerSize} L 3 3 L {cornerSize} 3" />
          
          <!-- Top Right -->
          <path d="M {width - cornerSize} 0 L {width} 0 L {width} {cornerSize}" />
          <path d="M {width - cornerSize} 3 L {width - 3} 3 L {width - 3} {cornerSize}" />
          
          <!-- Bottom Left -->
          <path d="M 0 {height - cornerSize} L 0 {height} L {cornerSize} {height}" />
          <path d="M 3 {height - cornerSize} L 3 {height - 3} L {cornerSize} {height - 3}" />
          
          <!-- Bottom Right -->
          <path d="M {width - cornerSize} {height} L {width} {height} L {width} {height - cornerSize}" />
          <path d="M {width - cornerSize} {height - 3} L {width - 3} {height - 3} L {width - 3} {height - cornerSize}" />
        </g>
      {/if}

    </svg>
  </div>
</Draggable>

<style>
  .container-wrapper {
    position: relative;
    overflow: hidden;
  }

  .container-label {
    position: absolute;
    left: 6px;
    right: 6px;
    top: 4px;
    z-index: 1;
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-tiny, 14px);
    font-weight: bold;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    pointer-events: none;
  }
</style>
