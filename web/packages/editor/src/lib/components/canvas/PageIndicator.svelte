<script lang="ts">
  import { projectStore } from "../../stores/project.svelte";
  import { colorToRgb } from "../../utils/themed-drawing";

  interface Props {
    count: number;
    currentIndex: number;
    isStatic?: boolean;
  }

  let { count, currentIndex, isStatic = false }: Props = $props();
  const theme = $derived(projectStore.theme);
</script>

{#if count > 1}
  <div class="indicator-container" class:static={isStatic}>
    {#each Array(count) as _, i}
      <div
        class="dot"
        style:border-color={i === currentIndex
          ? colorToRgb(theme.colors.accent || { r: 0, g: 255, b: 255 })
          : colorToRgb(
              theme.colors.foregroundMuted || { r: 128, g: 128, b: 128 },
            )}
      ></div>
    {/each}
  </div>
{/if}

<style>
  .indicator-container {
    position: absolute;
    bottom: 14px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 8px;
    pointer-events: none;
  }

  .indicator-container.static {
    position: static;
    bottom: auto;
    left: auto;
    right: auto;
  }

  .dot {
    border-radius: 0;
    width: 12px;
    height: 12px;
    border: 2px solid;
    transition: background-color 0.2s;
    transform: rotate(45deg);
  }
</style>
