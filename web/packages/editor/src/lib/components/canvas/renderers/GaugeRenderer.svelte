<script lang="ts">
  import type { GaugeComponent } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "../../../stores/project.svelte";
  import { colorToCss } from "../../../utils/color-utils";

  interface Props {
    component: GaugeComponent;
  }

  let { component }: Props = $props();
  const theme = $derived(projectStore.theme);

  // Mock value for preview
  let previewValue = $state(65);

  const normalizedValue = $derived(
    (previewValue - component.min) / (component.max - component.min),
  );

  // Gauge arc from -135deg to +135deg (270deg total)
  const angle = $derived(-135 + normalizedValue * 270);

  const cx = $derived((component.size?.width ?? 80) / 2);
  const cy = $derived((component.size?.height ?? 80) / 2);
  const radius = $derived(Math.min(cx, cy) - 8);

  // Calculate needle endpoint
  const needleLen = $derived(radius - 10);
  const radians = $derived((angle * Math.PI) / 180);
  const needleX = $derived(cx + needleLen * Math.cos(radians));
  const needleY = $derived(cy + needleLen * Math.sin(radians));

  const bgColor = $derived(colorToCss(component.backgroundColor, "#2a2a2a"));
  const needleColor = $derived(colorToCss(component.needleColor, "#ff6b00"));
  const valueColor = $derived(colorToCss(component.valueColor, "white"));
</script>

<Draggable {component}>
  <svg
    class="gauge-component"
    width={component.size?.width ?? 80}
    height={component.size?.height ?? 80}
  >
    <!-- Background arc -->
    <circle
      {cx}
      {cy}
      r={radius}
      fill={bgColor}
      stroke="#444"
      stroke-width="2"
    />

    <!-- Colored segments if defined -->
    {#if component.segments}
      {#each component.segments as segment}
        <!-- Would need arc path calculation -->
      {/each}
    {/if}

    <!-- Needle -->
    <line
      x1={cx}
      y1={cy}
      x2={needleX}
      y2={needleY}
      stroke={needleColor}
      stroke-width="2"
      stroke-linecap="round"
    />

    <!-- Center dot -->
    <circle {cx} {cy} r="4" fill={needleColor} />

    <!-- Value text -->
    <text
      x={cx}
      y={cy + radius / 2}
      text-anchor="middle"
      fill={valueColor}
      font-size="12"
    >
      {previewValue}{component.unit ?? ""}
    </text>
  </svg>

  {#if component.valueBinding}
    <span class="binding-indicator">{component.valueBinding.entityId}</span>
  {/if}
</Draggable>

<style>
  .gauge-component {
    display: block;
  }

  .binding-indicator {
    position: absolute;
    bottom: -14px;
    left: 0;
    font-size: 9px;
    color: var(--color-accent);
  }
</style>
