<script lang="ts">
  import { projectStore } from "../../stores/project.svelte";
  import { colorToRgb } from "../../utils/themed-drawing";

  interface Props {
    count: number;
    currentIndex: number;
    isStatic?: boolean;
    onSelect?: (index: number) => void;
  }

  let { count, currentIndex, isStatic = false, onSelect }: Props = $props();
  const theme = $derived(projectStore.theme);
  const isRetro = $derived(theme.id === "retro");

  function handleDotClick(index: number) {
    onSelect?.(index);
  }

  function handleDotKeydown(event: KeyboardEvent, index: number) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect?.(index);
    }
  }
</script>

{#if count > 1}
  <div class="indicator-container" class:static={isStatic}>
    {#each Array(count) as _, i}
      <button
        type="button"
        class="dot"
        style:left="calc(50% + {(i - (count - 1) / 2) * 28}px)"
        onclick={() => handleDotClick(i)}
        onkeydown={(event) => handleDotKeydown(event, i)}
        aria-label="Go to page {i + 1}"
      >
        <svg viewBox="0 0 18 18" aria-hidden="true">
          {#if isRetro}
            {@const radius = i === currentIndex ? 7 : 5}
            <path
              d="M 9 {9 - radius} L {9 + radius} 9 L 9 {9 + radius} L {9 - radius} 9 Z"
              fill="none"
              stroke={i === currentIndex
                ? colorToRgb(theme.chromeAccent ?? theme.colors.accent ?? { r: 0, g: 255, b: 255 })
                : colorToRgb(theme.colors.foregroundMuted ?? { r: 128, g: 128, b: 128 })}
            />
          {:else}
            <circle
              cx="9"
              cy="9"
              r={i === currentIndex ? 5 : 3}
              fill={i === currentIndex
                ? colorToRgb(theme.chromeAccent ?? theme.colors.accent ?? { r: 0, g: 255, b: 255 })
                : colorToRgb(theme.colors.foregroundMuted ?? { r: 128, g: 128, b: 128 })}
            />
          {/if}
        </svg>
      </button>
    {/each}
  </div>
{/if}

<style>
  .indicator-container {
    position: absolute;
    bottom: 11px;
    left: 0;
    right: 0;
    height: 18px;
    z-index: 100;
    pointer-events: none;
  }

  .indicator-container.static {
    position: static;
    bottom: auto;
    left: auto;
    right: auto;
  }

  .dot {
    position: absolute;
    top: 0;
    width: 18px;
    height: 18px;
    border: 0;
    padding: 0;
    cursor: pointer;
    transform: translateX(-50%);
    background-color: transparent;
    pointer-events: auto;
  }

  .dot svg {
    display: block;
    width: 18px;
    height: 18px;
    overflow: visible;
    shape-rendering: crispEdges;
  }

</style>
