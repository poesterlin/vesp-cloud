<script lang="ts">
  import { projectStore } from "../../stores/project.svelte";
  import { colorToRgb } from "../../utils/themed-drawing";

  interface Props {
    title: string;
    onBack?: () => void;
  }

  let { title, onBack }: Props = $props();
  const theme = $derived(projectStore.theme);
</script>

<div 
  class="detail-header" 
  style:border-bottom="1px solid {colorToRgb(theme.colors.foregroundMuted || {r:128,g:128,b:128})}"
>
  <div class="back-button" onclick={onBack}>
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={colorToRgb(theme.colors.accent || {r:0,g:255,b:255})} stroke-width="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
    <span style:color={colorToRgb(theme.colors.accent || {r:0,g:255,b:255})}>BACK</span>
  </div>
  
  <h1 style:color={colorToRgb(theme.colors.foreground || {r:255,g:255,b:255})}>{(title || "").toUpperCase()}</h1>
  
  <div class="spacer"></div>
</div>

<style>
  .detail-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 40px;
    display: flex;
    align-items: center;
    padding: 0 10px;
    background: inherit;
    z-index: 10;
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: bold;
    cursor: pointer;
  }

  h1 {
    flex: 1;
    text-align: center;
    font-size: 16px;
    margin: 0;
    letter-spacing: 1px;
  }

  .spacer {
    width: 60px; /* Balance the back button */
  }
</style>
