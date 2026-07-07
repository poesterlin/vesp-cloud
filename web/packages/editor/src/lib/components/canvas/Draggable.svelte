<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import { snapStore } from "$lib/stores/snap.svelte";
  import { validationStore } from "$lib/stores/validation.svelte";
  import { canvasZoomStore } from "$lib/stores/canvas-zoom.svelte";
  import type { Component } from "@vesp-cloud/schema";
  import type { Snippet } from "svelte";


  interface Props {
    component: Component;
    children: Snippet;
    widthOnly?: boolean;
  }

  let { component, children, widthOnly = false }: Props = $props();

  let dragging = $state(false);
  let dragStart = $state<{
    x: number;
    y: number;
    compX: number;
    compY: number;
    compWidth: number;
    compHeight: number;
  } | null>(null);

  let multiSelectDrag = $state(false);
  let multiSelectStartPositions = $state<Map<string, { x: number; y: number }>>(new Map());

  const isSelected = $derived(selectionStore.isSelected(component.id));
  const isHovered = $derived(selectionStore.isHovered(component.id));
  const hasValidationError = $derived(validationStore.hasErrors(component.id));

  function handleMouseDown(e: MouseEvent) {
    e.stopPropagation();

    const wasSelected = selectionStore.isSelected(component.id);

    if (!wasSelected) {
      if (e.shiftKey) {
        selectionStore.addToSelection(component.id);
      } else {
        selectionStore.select(component.id);
      }
    }

    if (wasSelected && selectionStore.selectedCount > 1) {
      multiSelectDrag = true;
      const positions = new Map<string, { x: number; y: number }>();
      for (const id of selectionStore.selectedIds) {
        const comp = projectStore.getComponent(id);
        if (comp) {
          positions.set(id, { x: comp.position.x, y: comp.position.y });
        }
      }
      multiSelectStartPositions = positions;
      historyStore.record("Move components");
    } else {
      historyStore.record("Move component");
    }

    dragging = true;
    dragStart = {
      x: e.clientX,
      y: e.clientY,
      compX: component.position.x,
      compY: component.position.y,
      compWidth: component.size?.width ?? 0,
      compHeight: component.size?.height ?? 0,
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!dragging || !dragStart) return;

    const zoom = canvasZoomStore.level;
    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;

    if (multiSelectDrag && multiSelectStartPositions.size > 0) {
      const updates: Array<{ id: string; updates: Partial<Component> }> = [];
      for (const [id, startPos] of multiSelectStartPositions) {
        const newX = Math.max(0, startPos.x + dx);
        const newY = Math.max(0, startPos.y + dy);
        updates.push({
          id,
          updates: { position: { x: Math.round(newX), y: Math.round(newY) } },
        });
      }
      projectStore.batchUpdateComponents(updates);
      snapStore.clear();
      return;
    }

    const newX = Math.max(0, dragStart.compX + dx);
    const newY = Math.max(0, dragStart.compY + dy);

    let finalX = newX;
    let finalY = newY;

    const parentSurface = projectStore.getComponentParentLayoutSurface(component.id);
    const draggedBounds = projectStore.getComponentLayoutBounds(component.id);

    if (!e.ctrlKey && parentSurface && draggedBounds) {
      const w = component.size?.width ?? 50;
      const h = component.size?.height ?? 20;
      const tentativeLeft = parentSurface.x + newX;
      const tentativeTop = parentSurface.y + newY;

      const SNAP_THRESHOLD = 8;
      let snappedLeft = tentativeLeft;
      let snappedTop = tentativeTop;
      let snapCoordX: number | null = null;
      let snapCoordY: number | null = null;

      let bestDiffX = SNAP_THRESHOLD;
      let bestDiffY = SNAP_THRESHOLD;

      // Check snaps on X axis (vertical lines, horizontal snapping)
      const checkSnapX = (dragVal: number, targetVal: number) => {
        const diff = Math.abs(dragVal - targetVal);
        if (diff < bestDiffX) {
          bestDiffX = diff;
          snapCoordX = targetVal;
          return true;
        }
        return false;
      };

      // Check snaps on Y axis (horizontal lines, vertical snapping)
      const checkSnapY = (dragVal: number, targetVal: number) => {
        const diff = Math.abs(dragVal - targetVal);
        if (diff < bestDiffY) {
          bestDiffY = diff;
          snapCoordY = targetVal;
          return true;
        }
        return false;
      };

      const checkTarget = (target: { x: number; y: number; width: number; height: number }) => {
        const tLeft = target.x;
        const tRight = target.x + target.width;
        const tCenter = target.x + target.width / 2;

        if (checkSnapX(tentativeLeft, tLeft)) snappedLeft = tLeft;
        if (checkSnapX(tentativeLeft, tRight)) snappedLeft = tRight;
        if (checkSnapX(tentativeLeft, tCenter)) snappedLeft = tCenter;

        if (checkSnapX(tentativeLeft + w, tLeft)) snappedLeft = tLeft - w;
        if (checkSnapX(tentativeLeft + w, tRight)) snappedLeft = tRight - w;
        if (checkSnapX(tentativeLeft + w, tCenter)) snappedLeft = tCenter - w;

        if (checkSnapX(tentativeLeft + w / 2, tLeft)) snappedLeft = tLeft - w / 2;
        if (checkSnapX(tentativeLeft + w / 2, tRight)) snappedLeft = tRight - w / 2;
        if (checkSnapX(tentativeLeft + w / 2, tCenter)) snappedLeft = tCenter - w / 2;

        const tTop = target.y;
        const tBottom = target.y + target.height;
        const tCenterY = target.y + target.height / 2;

        if (checkSnapY(tentativeTop, tTop)) snappedTop = tTop;
        if (checkSnapY(tentativeTop, tBottom)) snappedTop = tBottom;
        if (checkSnapY(tentativeTop, tCenterY)) snappedTop = tCenterY;

        if (checkSnapY(tentativeTop + h, tTop)) snappedTop = tTop - h;
        if (checkSnapY(tentativeTop + h, tBottom)) snappedTop = tBottom - h;
        if (checkSnapY(tentativeTop + h, tCenterY)) snappedTop = tCenterY - h;

        if (checkSnapY(tentativeTop + h / 2, tTop)) snappedTop = tTop - h / 2;
        if (checkSnapY(tentativeTop + h / 2, tBottom)) snappedTop = tBottom - h / 2;
        if (checkSnapY(tentativeTop + h / 2, tCenterY)) snappedTop = tCenterY - h / 2;
      };

      const parentCenterX = parentSurface.x + parentSurface.width / 2;
      const parentCenterY = parentSurface.y + parentSurface.height / 2;

      if (checkSnapX(tentativeLeft, parentSurface.x)) snappedLeft = parentSurface.x;
      if (checkSnapX(tentativeLeft + w, parentSurface.x + parentSurface.width)) {
        snappedLeft = parentSurface.x + parentSurface.width - w;
      }
      if (checkSnapX(tentativeLeft + w / 2, parentCenterX)) snappedLeft = parentCenterX - w / 2;

      if (checkSnapY(tentativeTop, parentSurface.y)) snappedTop = parentSurface.y;
      if (checkSnapY(tentativeTop + h, parentSurface.y + parentSurface.height)) {
        snappedTop = parentSurface.y + parentSurface.height - h;
      }
      if (checkSnapY(tentativeTop + h / 2, parentCenterY)) snappedTop = parentCenterY - h / 2;

      for (const target of projectStore.getVisibleComponentLayoutBounds()) {
        if (target.id === component.id) continue;
        if (target.ancestorIds.includes(component.id)) continue;
        if (draggedBounds.ancestorIds.includes(target.id)) continue;
        checkTarget(target);
      }

      // Populate snap guidelines
      const snapLines: Array<{ type: "v" | "h"; coord: number; start: number; end: number }> = [];
      if (snapCoordX !== null) {
        snapLines.push({
          type: "v",
          coord: snapCoordX,
          start: parentSurface.y,
          end: parentSurface.y + parentSurface.height,
        });
        finalX = snappedLeft - parentSurface.x;
      }
      if (snapCoordY !== null) {
        snapLines.push({
          type: "h",
          coord: snapCoordY,
          start: parentSurface.x,
          end: parentSurface.x + parentSurface.width,
        });
        finalY = snappedTop - parentSurface.y;
      }

      snapStore.setLines(snapLines);
    } else {
      snapStore.clear();
    }

    projectStore.updateComponent(component.id, {
      position: { x: Math.round(finalX), y: Math.round(finalY) },
    });
  }

  function handleMouseUp() {
    dragging = false;
    dragStart = null;
    multiSelectDrag = false;
    multiSelectStartPositions = new Map();
    snapStore.clear();
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }

  function handleMouseEnter() {
    selectionStore.setHovered(component.id);
  }

  function handleMouseLeave() {
    if (selectionStore.hoveredId === component.id) {
      selectionStore.setHovered(null);
    }
  }
</script>

<div
  class="draggable"
  class:selected={isSelected}
  class:hovered={isHovered}
  class:dragging
  class:has-error={hasValidationError}
  style:left="{component.position.x}px"
  style:top="{component.position.y}px"
  style:width="{component.size?.width ?? 'auto'}px"
  style:height="{component.size?.height ?? 'auto'}px"
  role="button"
  tabindex="0"
  onmousedown={handleMouseDown}
  onmouseenter={handleMouseEnter}
  onmouseleave={handleMouseLeave}
>
  {#if hasValidationError}
    <div class="error-badge" title="Validation error">
      <svg width="18" height="18" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="11" fill="#f44336" />
        <path
          d="M12 7v6M12 15v2"
          stroke="white"
          stroke-width="2.5"
          stroke-linecap="round"
        />
      </svg>
    </div>
  {/if}
  {@render children()}
</div>

<style>
  .draggable {
    position: absolute;
    cursor: move;
    user-select: none;
    overflow: hidden;
    box-sizing: border-box;
  }

  .draggable.hovered {
    outline: 1px dashed var(--color-accent);
    outline-offset: 1px;
  }

  .draggable.dragging {
    opacity: 0.8;
    cursor: grabbing;
  }

  .draggable.has-error {
    overflow: visible;
    outline: 2px solid var(--color-error);
    outline-offset: 1px;
    animation: error-pulse 1.5s ease-in-out infinite;
  }

  .error-badge {
    position: absolute;
    top: -9px;
    right: -9px;
    z-index: 10;
    pointer-events: none;
    line-height: 0;
    filter: drop-shadow(0 0 3px rgba(244, 67, 54, 0.6));
  }

  @keyframes error-pulse {
    0%, 100% { outline-color: var(--color-error); }
    50% { outline-color: rgba(244, 67, 54, 0.4); }
  }
</style>
