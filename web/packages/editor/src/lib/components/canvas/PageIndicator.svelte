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
        class:active={i === currentIndex}
        style:border-color={i === currentIndex
          ? colorToRgb(theme.colors.accent || { r: 0, g: 255, b: 255 })
          : colorToRgb(
              theme.colors.foregroundMuted || { r: 128, g: 128, b: 128 },
            )}
        onclick={() => handleDotClick(i)}
        onkeydown={(event) => handleDotKeydown(event, i)}
        aria-label="Go to page {i + 1}"
      ></button>
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
    padding: 0;
    background: none;
    cursor: pointer;
    transform: rotate(45deg);
  }

  .dot.active {
    background-color: currentColor;
  }
</style>
