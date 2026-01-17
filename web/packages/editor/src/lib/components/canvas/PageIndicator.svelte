<script lang="ts">
  import { projectStore } from "../../stores/project.svelte";
  import { colorToRgb } from "../../utils/themed-drawing";

  interface Props {
    count: number;
    currentIndex: number;
  }

  let { count, currentIndex }: Props = $props();
  const theme = $derived(projectStore.theme);
</script>

<div class="indicator-container">
  {#each Array(count) as _, i}
    <div
      class="dot"
      style:background-color={i === currentIndex 
        ? colorToRgb(theme.colors.accent || {r:0,g:255,b:255}) 
        : colorToRgb(theme.colors.foregroundMuted || {r:128,g:128,b:128})}
    ></div>
  {/each}
</div>

<style>
  .indicator-container {
    position: absolute;
    bottom: 10px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 8px;
    pointer-events: none;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    transition: background-color 0.2s;
  }
</style>
