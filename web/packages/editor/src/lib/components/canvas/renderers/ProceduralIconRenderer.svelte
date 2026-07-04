<script lang="ts">
  import type { ProceduralIconComponent } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { colorToCss } from "$lib/utils/color-utils";

  interface Props {
    component: ProceduralIconComponent;
  }

  let { component }: Props = $props();
  const theme = $derived(projectStore.theme);
  const iconColor = $derived(
    colorToCss(component.color, colorToCss(theme.colors.accent)),
  );
</script>

<Draggable {component}>
  {#if component.size}
    {@const size = component.size}
    {@const width = size.width}
    {@const height = size.height}
    <div class="icon-wrapper" style:width="100%" style:height="100%">
      <svg width="100%" height="100%" viewBox="0 0 {width} {height}">
        {#if component.iconType === "bulb"}
          <g stroke={iconColor} stroke-width="2" fill="none">
            <circle
              cx={width / 2}
              cy={height / 2}
              r={width / 4}
            />
            {#each Array(8) as _, i}
              {@const angle = (i * 45 * Math.PI) / 180}
              {@const r1 = width / 4 + 4}
              {@const r2 = width / 4 + 10}
              <line
                x1={width / 2 + Math.cos(angle) * r1}
                y1={height / 2 + Math.sin(angle) * r1}
                x2={width / 2 + Math.cos(angle) * r2}
                y2={height / 2 + Math.sin(angle) * r2}
              />
            {/each}
          </g>
        {:else if component.iconType === "window"}
          <g stroke={iconColor} stroke-width="2" fill="none">
            <rect
              x={width * 0.2}
              y={height * 0.1}
              width={width * 0.6}
              height={height * 0.8}
            />
            <line
              x1={width * 0.5}
              y1={height * 0.1}
              x2={width * 0.5}
              y2={height * 0.9}
            />
            <line
              x1={width * 0.2}
              y1={height * 0.4}
              x2={width * 0.8}
              y2={height * 0.4}
            />
          </g>
        {:else if component.iconType === "vacuum"}
          <g stroke={iconColor} stroke-width="2" fill="none">
            <circle
              cx={width / 2}
              cy={height / 2}
              r={width * 0.35}
            />
            <circle
              cx={width / 2}
              cy={height * 0.4}
              r={width * 0.1}
            />
          </g>
        {:else if component.iconType === "climate"}
          <g stroke={iconColor} stroke-width="2" fill="none">
            <path
              d="M {width * 0.5} {height * 0.2} 
          L {width * 0.5} {height * 0.6} 
          A {width * 0.15} {width * 0.15} 0 1 0 {width *
                0.6} {height * 0.6} 
          Z"
            />
          </g>
        {/if}
      </svg>
    </div>
  {/if}
</Draggable>
