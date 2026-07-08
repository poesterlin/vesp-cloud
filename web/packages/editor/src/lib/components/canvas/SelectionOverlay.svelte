<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import { snapStore } from "$lib/stores/snap.svelte";
  import { canvasZoomStore } from "$lib/stores/canvas-zoom.svelte";

  interface Props {
    region?: "header" | "content";
    regionOffset?: number;
    widthOnly?: boolean;
  }

  let { region = "content", regionOffset = 0, widthOnly = false }: Props = $props();

  // Resize handles
  type Handle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";
  const MIN_SIZE = 10;
  const SNAP_THRESHOLD = 8;

  let resizing = $state<{ id: string; handle: Handle } | null>(null);
  let resizeStart = $state<{
    x: number;
    y: number;
    width: number;
    height: number;
    compX: number;
    compY: number;
  } | null>(null);

  function handleResizeStart(id: string, handle: Handle, e: MouseEvent) {
    e.stopPropagation();
    const component = projectStore.getComponent(id);
    if (!component || !component.size) return;

    historyStore.record("Resize component");

    resizing = { id, handle };
    resizeStart = {
      x: e.clientX,
      y: e.clientY,
      width: component.size.width,
      height: component.size.height,
      compX: component.position.x,
      compY: component.position.y,
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
  }

  function handleResizeMove(e: MouseEvent) {
    if (!resizing || !resizeStart) return;

    const zoom = canvasZoomStore.level;
    const dx = (e.clientX - resizeStart.x) / zoom;
    const dy = (e.clientY - resizeStart.y) / zoom;

    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    let newX = resizeStart.compX;
    let newY = resizeStart.compY;

    const handle = resizing.handle;

    // Handle width changes
    if (handle.includes("e")) {
      newWidth = resizeStart.width + dx;
    } else if (handle.includes("w")) {
      newWidth = resizeStart.width - dx;
      newX = resizeStart.compX + dx;
    }

    // Handle height changes (skipped in widthOnly mode)
    if (!widthOnly) {
      if (handle.includes("s")) {
        newHeight = resizeStart.height + dy;
      } else if (handle.includes("n")) {
        newHeight = resizeStart.height - dy;
        newY = resizeStart.compY + dy;
      }
    }

    const parentSurface = projectStore.getComponentParentLayoutSurface(resizing.id);
    const resizedBounds = projectStore.getComponentLayoutBounds(resizing.id);

    if (!e.ctrlKey && parentSurface && resizedBounds) {
      let left = parentSurface.x + newX;
      let top = parentSurface.y + newY;
      let right = left + newWidth;
      let bottom = top + newHeight;

      let bestDiffX = SNAP_THRESHOLD;
      let bestDiffY = SNAP_THRESHOLD;
      let snapCoordX: number | null = null;
      let snapCoordY: number | null = null;

      const snapLeftTo = (target: number) => {
        const diff = Math.abs(left - target);
        const nextWidth = right - target;
        if (diff < bestDiffX && nextWidth >= MIN_SIZE) {
          bestDiffX = diff;
          snapCoordX = target;
          left = target;
          newX = left - parentSurface.x;
          newWidth = nextWidth;
        }
      };

      const snapRightTo = (target: number) => {
        const diff = Math.abs(right - target);
        const nextWidth = target - left;
        if (diff < bestDiffX && nextWidth >= MIN_SIZE) {
          bestDiffX = diff;
          snapCoordX = target;
          right = target;
          newWidth = nextWidth;
        }
      };

      const snapTopTo = (target: number) => {
        const diff = Math.abs(top - target);
        const nextHeight = bottom - target;
        if (diff < bestDiffY && nextHeight >= MIN_SIZE) {
          bestDiffY = diff;
          snapCoordY = target;
          top = target;
          newY = top - parentSurface.y;
          newHeight = nextHeight;
        }
      };

      const snapBottomTo = (target: number) => {
        const diff = Math.abs(bottom - target);
        const nextHeight = target - top;
        if (diff < bestDiffY && nextHeight >= MIN_SIZE) {
          bestDiffY = diff;
          snapCoordY = target;
          bottom = target;
          newHeight = nextHeight;
        }
      };

      const snapToTarget = (target: { x: number; y: number; width: number; height: number }) => {
        const xTargets = [target.x, target.x + target.width, target.x + target.width / 2];
        const yTargets = [target.y, target.y + target.height, target.y + target.height / 2];

        for (const xTarget of xTargets) {
          if (handle.includes("w")) snapLeftTo(xTarget);
          if (handle.includes("e")) snapRightTo(xTarget);
        }

        if (!widthOnly) {
          for (const yTarget of yTargets) {
            if (handle.includes("n")) snapTopTo(yTarget);
            if (handle.includes("s")) snapBottomTo(yTarget);
          }
        }
      };

      snapToTarget(parentSurface);

      for (const target of projectStore.getVisibleComponentLayoutBounds()) {
        if (target.id === resizing.id) continue;
        if (target.ancestorIds.includes(resizing.id)) continue;
        if (resizedBounds.ancestorIds.includes(target.id)) continue;
        snapToTarget(target);
      }

      const snapLines: Array<{ type: "v" | "h"; coord: number; start: number; end: number }> = [];
      if (snapCoordX !== null) {
        snapLines.push({
          type: "v",
          coord: snapCoordX,
          start: parentSurface.y,
          end: parentSurface.y + parentSurface.height,
        });
      }
      if (snapCoordY !== null) {
        snapLines.push({
          type: "h",
          coord: snapCoordY,
          start: parentSurface.x,
          end: parentSurface.x + parentSurface.width,
        });
      }
      snapStore.setLines(snapLines);
    } else {
      snapStore.clear();
    }

    // Apply constraints
    newWidth = Math.max(MIN_SIZE, newWidth);
    newHeight = Math.max(MIN_SIZE, newHeight);

    projectStore.updateComponent(resizing.id, {
      position: { x: Math.max(0, newX), y: Math.max(0, newY) },
      size: { width: newWidth, height: newHeight },
    });
  }

  function handleResizeEnd() {
    resizing = null;
    resizeStart = null;
    snapStore.clear();
    window.removeEventListener("mousemove", handleResizeMove);
    window.removeEventListener("mouseup", handleResizeEnd);
  }

  // Get bounding box for selection (filtered by region)
  function getSelectionBounds() {
    const bounds: Array<{
      id: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    for (const id of selectionStore.selectedIds) {
      const component = projectStore.getComponent(id);
      if (!component) continue;

      // Filter: only show components that belong to this region
      const isInHeader = projectStore.isHeaderComponent(id);
      if (region === "header" && !isInHeader) continue;
      if (region === "content" && isInHeader) continue;

      const pos = projectStore.getComponentAbsolutePosition(id);
      bounds.push({
        id,
        x: pos.x,
        y: pos.y,
        width: component.size?.width ?? 50,
        height: component.size?.height ?? 20,
      });
    }

    return bounds;
  }

  const selectedBounds = $derived(getSelectionBounds());
</script>

{#each selectedBounds as bound (bound.id)}
  <div
    class="selection-box"
    style:left="{bound.x}px"
    style:top="{bound.y}px"
    style:width="{bound.width}px"
    style:height="{bound.height}px"
  >
    {#if widthOnly}
      <!-- Width-only handles -->
      <div
        class="handle e"
        role="button"
        tabindex="-1"
        onmousedown={(e: MouseEvent) => handleResizeStart(bound.id, "e", e)}
      ></div>
      <div
        class="handle w"
        role="button"
        tabindex="-1"
        onmousedown={(e: MouseEvent) => handleResizeStart(bound.id, "w", e)}
      ></div>
    {:else}
      <!-- Resize handles -->
      <div
        class="handle nw"
        role="button"
        tabindex="-1"
        onmousedown={(e: MouseEvent) => handleResizeStart(bound.id, "nw", e)}
      ></div>
      <div
        class="handle n"
        role="button"
        tabindex="-1"
        onmousedown={(e: MouseEvent) => handleResizeStart(bound.id, "n", e)}
      ></div>
      <div
        class="handle ne"
        role="button"
        tabindex="-1"
        onmousedown={(e: MouseEvent) => handleResizeStart(bound.id, "ne", e)}
      ></div>
      <div
        class="handle e"
        role="button"
        tabindex="-1"
        onmousedown={(e: MouseEvent) => handleResizeStart(bound.id, "e", e)}
      ></div>
      <div
        class="handle se"
        role="button"
        tabindex="-1"
        onmousedown={(e: MouseEvent) => handleResizeStart(bound.id, "se", e)}
      ></div>
      <div
        class="handle s"
        role="button"
        tabindex="-1"
        onmousedown={(e: MouseEvent) => handleResizeStart(bound.id, "s", e)}
      ></div>
      <div
        class="handle sw"
        role="button"
        tabindex="-1"
        onmousedown={(e: MouseEvent) => handleResizeStart(bound.id, "sw", e)}
      ></div>
      <div
        class="handle w"
        role="button"
        tabindex="-1"
        onmousedown={(e: MouseEvent) => handleResizeStart(bound.id, "w", e)}
      ></div>
    {/if}
  </div>
{/each}

<style>
  .selection-box {
    position: absolute;
    border: 2px solid var(--color-accent);
    pointer-events: none;
    box-sizing: border-box;
  }

  .handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: var(--color-accent);
    border: 1px solid white;
    pointer-events: auto;
  }

  .handle.nw {
    left: -4px;
    top: -4px;
    cursor: nwse-resize;
  }
  .handle.n {
    left: 50%;
    top: -4px;
    transform: translateX(-50%);
    cursor: ns-resize;
  }
  .handle.ne {
    right: -4px;
    top: -4px;
    cursor: nesw-resize;
  }
  .handle.e {
    right: -4px;
    top: 50%;
    transform: translateY(-50%);
    cursor: ew-resize;
  }
  .handle.se {
    right: -4px;
    bottom: -4px;
    cursor: nwse-resize;
  }
  .handle.s {
    left: 50%;
    bottom: -4px;
    transform: translateX(-50%);
    cursor: ns-resize;
  }
  .handle.sw {
    left: -4px;
    bottom: -4px;
    cursor: nesw-resize;
  }
  .handle.w {
    left: -4px;
    top: 50%;
    transform: translateY(-50%);
    cursor: ew-resize;
  }
</style>
