<script lang="ts">
  import type { ButtonComponent } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "../../../stores/project.svelte";
  import { colorToCss } from "../../../utils/color-utils";

  interface Props {
    component: ButtonComponent;
  }

  let { component }: Props = $props();
  const theme = $derived(projectStore.theme);

  const bgColor = $derived(
    colorToCss(
      component.backgroundColor,
      colorToCss(theme.colors.backgroundSecondary),
    ),
  );
  const accentColor = $derived(
    colorToCss(component.borderColor, colorToCss(theme.colors.accent)),
  );
  const foregroundColor = $derived(
    colorToCss(component.foregroundColor, colorToCss(theme.colors.foreground)),
  );
  const shadowColor = $derived(colorToCss(theme.colors.background, "black"));

  // Retro style constants
  const shadowOffset = $derived(theme.values?.shadowOffset ?? 3);
  const cornerSize = $derived(theme.values?.cornerSize ?? 10);
</script>

<Draggable {component}>
  {#if component.size}
    {@const width = component.size.width}
    {@const height = component.size.height}
    <div class="button-wrapper" style:width="100%" style:height="100%">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 {width} {height}"
        preserveAspectRatio="none"
      >
        <!-- Shadow -->
        {#if theme.style?.buttonShadow}
          <rect
            x={shadowOffset}
            y={shadowOffset}
            width={width - shadowOffset}
            height={height - shadowOffset}
            fill={shadowColor}
          />
        {/if}

        <!-- Main Body -->
        <rect
          x="0"
          y="0"
          width={width - (theme.style?.buttonShadow ? shadowOffset : 0)}
          height={height - (theme.style?.buttonShadow ? shadowOffset : 0)}
          fill={bgColor}
          stroke={accentColor}
          stroke-width="1"
        />

        <!-- Corner Accents -->
        {#if theme.style?.buttonCornerAccents}
          <g stroke="white" stroke-width="1.5" fill="none">
            <!-- Top Left -->
            <path d="M 0 {cornerSize} L 0 0 L {cornerSize} 0" />
            <!-- Top Right -->
            <path
              d="M {component.size.width -
                (theme.style.buttonShadow ? shadowOffset : 0) -
                cornerSize} 0 
               L {component.size.width -
                (theme.style.buttonShadow ? shadowOffset : 0)} 0 
               L {component.size.width -
                (theme.style.buttonShadow ? shadowOffset : 0)} {cornerSize}"
            />
            <!-- Bottom Left -->
            <path
              d="M 0 {component.size.height -
                (theme.style.buttonShadow ? shadowOffset : 0) -
                cornerSize} 
               L 0 {component.size.height -
                (theme.style.buttonShadow ? shadowOffset : 0)} 
               L {cornerSize} {component.size.height -
                (theme.style.buttonShadow ? shadowOffset : 0)}"
            />
            <!-- Bottom Right -->
            <path
              d="M {component.size.width -
                (theme.style.buttonShadow ? shadowOffset : 0) -
                cornerSize} {component.size.height -
                (theme.style.buttonShadow ? shadowOffset : 0)} 
               L {component.size.width -
                (theme.style.buttonShadow ? shadowOffset : 0)} {component.size
                .height - (theme.style.buttonShadow ? shadowOffset : 0)} 
               L {component.size.width -
                (theme.style.buttonShadow ? shadowOffset : 0)} {component.size
                .height -
                (theme.style.buttonShadow ? shadowOffset : 0) -
                cornerSize}"
            />
          </g>
        {/if}

        <!-- Label -->
        <text
          x={(component.size.width -
            (theme.style?.buttonShadow ? shadowOffset : 0)) /
            2}
          y={(component.size.height -
            (theme.style?.buttonShadow ? shadowOffset : 0)) /
            2}
          fill={foregroundColor}
          font-family="monospace"
          font-size="14"
          text-anchor="middle"
          dominant-baseline="central"
        >
          {component.label ?? ""}
        </text>
      </svg>
    </div>
  {/if}
</Draggable>

<style>
  .button-wrapper {
    overflow: visible;
  }
</style>
