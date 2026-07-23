<script lang="ts">
  import type { ImageComponent } from "@vesp-cloud/schema";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import Draggable from "../Draggable.svelte";
  import { colorToCss } from "../../../utils/color-utils";

  interface Props {
    component: ImageComponent;
  }

  let { component }: Props = $props();

  const isSelected = $derived(selectionStore.selectedIds.has(component.id));

  const bgColor = $derived(
    component.image_type === "BINARY"
      ? colorToCss(component.backgroundColor, "darkgrey")
      : "lightgrey",
  );

  const fgColor = $derived(
    component.image_type === "BINARY"
      ? colorToCss(component.foregroundColor, "black")
      : "black",
  );
  const imageWidth = $derived(component.size?.width ?? 100);
  const imageHeight = $derived(component.size?.height ?? 100);

  const entityId = $derived(component.imageBinding?.entityId ?? "");
</script>

<Draggable {component}>
  <div
    class="image-renderer"
    class:selected={isSelected}
    style:width={`${imageWidth}px`}
    style:height={`${imageHeight}px`}
    style:background-color={bgColor}
    style:border={isSelected ? "2px solid #4a9eff" : "1px solid #777"}
    style:display="flex"
    style:align-items="center"
    style:justify-content="center"
    style:overflow="hidden"
  >
    <div class="image-placeholder" style:color={fgColor} title={entityId}>
      <div class="placeholder-grid"></div>
      <svg class="placeholder-icon" viewBox="0 0 64 64" aria-hidden="true">
        <rect x="9" y="11" width="46" height="42" rx="3"></rect>
        <circle cx="22" cy="24" r="5"></circle>
        <path d="M13 47l13-13 9 9 6-6 10 10"></path>
      </svg>
      <div class="placeholder-copy">
        <span class="placeholder-source">HOME ASSISTANT</span>
        <span class="placeholder-label">{entityId || "No entity selected"}</span>
      </div>
    </div>
  </div>
</Draggable>

<style>
  .image-renderer {
    box-sizing: border-box;
    position: relative;
    user-select: none;
  }

  .image-placeholder {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px;
    box-sizing: border-box;
    isolation: isolate;
    overflow: hidden;
  }

  .placeholder-grid {
    position: absolute;
    inset: 0;
    z-index: -1;
    opacity: 0.12;
    background-image:
      linear-gradient(currentColor 1px, transparent 1px),
      linear-gradient(90deg, currentColor 1px, transparent 1px);
    background-size: 16px 16px;
    mask-image: linear-gradient(to bottom, transparent, black 30%, black 70%, transparent);
  }

  .placeholder-icon {
    width: clamp(28px, 24%, 64px);
    height: auto;
    flex: 0 1 auto;
    opacity: 0.58;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .placeholder-copy {
    display: flex;
    max-width: 100%;
    min-width: 0;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    font-family: var(--display-font, monospace);
    text-align: center;
  }

  .placeholder-source {
    padding: 4px 6px 2px;
    border: 1px solid currentColor;
    border-radius: 2px;
    font-size: 9px;
    line-height: 1;
    letter-spacing: 0.12em;
    opacity: 0.65;
  }

  .placeholder-label {
    display: block;
    max-width: 100%;
    overflow: hidden;
    font-size: var(--display-text-tiny, 12px);
    line-height: 1.2;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
