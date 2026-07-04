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

  // Placeholder for image rendering logic in the editor
  // In a real application, you might fetch and display the image
  // For now, we'll represent it with a colored rectangle
  const imageUrl = $derived.by(() => {
    if (component.imageBinding?.entityId) {
      return `ha:${component.imageBinding.entityId}`;
    }
    // Attempt to parse mdi:icon-name or https://... for display
    if (
      component.file.startsWith("mdi:") ||
      component.file.startsWith("mdil:")
    ) {
      // Basic MDI icon display - requires a font-awesome or similar setup
      // For now, just show text representation
      return component.file;
    } else if (
      component.file.startsWith("http://") ||
      component.file.startsWith("https://")
    ) {
      return component.file; // Could be used in an an <img> tag
    }
    return "/placeholder_image.png"; // Fallback placeholder
  });
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
    {#if imageUrl.startsWith("ha:")}
      <span class="image-text" style:color={fgColor} title={imageUrl}>HA image: {imageUrl.slice(3)}</span>
    {:else if imageUrl.startsWith("mdi:") || imageUrl.startsWith("mdil:")}
      <span class="image-text" style:font-size="24px" style:color={fgColor} title={imageUrl}>{imageUrl}</span>
    {:else if imageUrl.startsWith("http://") || imageUrl.startsWith("https://")}
      <img
        src={imageUrl}
        alt="preview"
        style="max-width: 100%; max-height: 100%; object-fit: contain;"
      />
    {:else}
      <span class="image-text" style:color={fgColor} title={component.file}>IMG: {component.file}</span>
    {/if}
  </div>
</Draggable>

<style>
  .image-renderer {
    box-sizing: border-box;
    position: relative;
    user-select: none;
  }

  .image-text {
    max-width: 100%;
    padding: 0 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
