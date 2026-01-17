<script lang="ts">
  import { projectStore } from "../../stores/project.svelte";
  import { colorToRgb } from "../../utils/themed-drawing";

  const theme = $derived(projectStore.theme);
  
  let time = $state("12:00");
  let date = $state("SAT JAN 17");

  // Mock clock
  $effect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
      date = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: '2-digit' }).toUpperCase();
    }, 1000);
    return () => clearInterval(interval);
  });
</script>

<div class="common-header" style:background={colorToRgb(theme.colors.background || {r:0,g:0,b:0})}>
  {#if theme.style?.headerBorders}
    <div class="border-left" style:background={colorToRgb(theme.colors.accent || {r:0,g:255,b:255})}></div>
    <div class="border-right" style:background={colorToRgb(theme.colors.accent || {r:0,g:255,b:255})}></div>
  {/if}

  <div class="content">
    <span class="time" style:color={colorToRgb(theme.colors.foreground || {r:255,g:255,b:255})}>{time}</span>
    <span class="date" style:color={colorToRgb(theme.colors.accent || {r:0,g:255,b:255})}>{date}</span>
  </div>
</div>

<style>
  .common-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40px;
    z-index: 10;
  }

  .border-left, .border-right {
    position: absolute;
    top: 5px;
    bottom: 5px;
    width: 2px;
  }

  .border-left { left: 5px; }
  .border-right { right: 5px; }

  .content {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    line-height: 1.1;
  }

  .time {
    font-size: 18px;
    font-weight: bold;
    font-family: monospace;
  }

  .date {
    font-size: 10px;
    letter-spacing: 1px;
    font-family: monospace;
  }
</style>
