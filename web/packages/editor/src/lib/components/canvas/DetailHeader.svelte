<script lang="ts">
  import { projectStore } from "../../stores/project.svelte";
  import { colorToRgb } from "../../utils/themed-drawing";

  interface Props {
    title: string;
    onBack?: () => void;
  }

  let { title, onBack }: Props = $props();
  const theme = $derived(projectStore.theme);

  const accent = $derived(
    colorToRgb(
      theme.chromeAccent ?? theme.colors.accent ?? { r: 0, g: 255, b: 255 },
    ),
  );
  const foreground = $derived(colorToRgb(theme.colors.foreground ?? { r: 255, g: 255, b: 255 }));
  const muted = $derived(colorToRgb(theme.colors.foregroundMuted ?? { r: 128, g: 128, b: 128 }));
</script>

<div class="detail-header" style:border-bottom="1px solid {muted}">
  <button
    class="back-button"
    onclick={onBack}
    aria-label="Back"
    style:color={accent}
    style:border-color={accent}
  >
    &lt;
  </button>

  <h1 style:color={foreground}>{title ?? ""}</h1>

  <div class="spacer"></div>
</div>

<style>
  .detail-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    box-sizing: border-box;
    height: 50px;
    display: flex;
    align-items: center;
    padding: 0;
    background: rgb(2, 3, 5);
    z-index: 10;
  }

  .back-button {
    position: absolute;
    left: 14px;
    top: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 38px;
    /* The device uses font_medium (Roboto 24) for the boxed `<`. */
    font-size: var(--display-text-medium, 24px);
    font-weight: bold;
    font-family: var(--display-font, monospace);
    cursor: pointer;
    background: transparent;
    border: 1px solid currentColor;
    border-radius: 2px;
    padding: 0;
    line-height: 1;
  }

  h1 {
    position: absolute;
    left: 72px;
    right: 72px;
    top: 8px;
    line-height: 24px;
    text-align: center;
    /* Title prints via font_medium (Roboto 24) -- see DetailHeaderWidget. */
    font-size: var(--display-text-medium, 24px);
    font-weight: bold;
    font-family: var(--display-font, monospace);
    margin: 0;
    letter-spacing: 1px;
    /* Match the device: do not uppercase the supplied title. */
    text-transform: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .spacer {
    display: none;
  }
</style>
