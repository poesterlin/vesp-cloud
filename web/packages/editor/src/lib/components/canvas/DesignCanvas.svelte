<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import ComponentRenderer from "./renderers/ComponentRenderer.svelte";
  import SelectionOverlay from "./SelectionOverlay.svelte";
  import DetailHeader from "./DetailHeader.svelte";
  import type { Component } from "@esphome-designer/schema";

  let canvasEl: HTMLDivElement | undefined = $state();

  function handleCanvasClick(e: MouseEvent) {
    if (e.target === canvasEl) {
      selectionStore.clear();
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    const componentType = e.dataTransfer?.getData("component-type");
    if (!componentType || !canvasEl) return;

    const rect = canvasEl.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    historyStore.record(`Add ${componentType}`);

    const newComponent = createComponent(componentType, x, y);
    projectStore.addComponent(newComponent);
    selectionStore.select(newComponent.id);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function createComponent(type: string, x: number, y: number): Component {
    const id = `${type}-${Date.now()}`;

    const base = {
      id,
      position: { x, y },
      size: { width: 100, height: 40 },
    };

    switch (type) {
      case "text":
        return {
          ...base,
          type: "text",
          text: "Text",
          fontSize: "medium",
          align: "left",
        } as Component;

      case "button":
        return {
          ...base,
          type: "button",
          label: "Button",
          size: { width: 80, height: 36 },
        } as Component;

      case "slider":
        return {
          ...base,
          type: "slider",
          min: 0,
          max: 100,
          step: 1,
          orientation: "horizontal",
          size: { width: 120, height: 24 },
        } as Component;

      case "gauge":
        return {
          ...base,
          type: "gauge",
          min: 0,
          max: 100,
          size: { width: 80, height: 80 },
        } as Component;

      case "icon":
        return {
          ...base,
          type: "icon",
          icon: "mdi:home",
          size: { width: 32, height: 32 },
          scale: 1,
        } as Component;
      
      case "procedural_icon":
        return {
          ...base,
          type: "procedural_icon",
          iconType: "bulb",
          size: { width: 32, height: 32 },
        } as Component;
      
      case "container":
        return {
          ...base,
          type: "container",
          label: "Container",
          size: { width: 100, height: 60 },
        } as Component;

      default:
        return {
          ...base,
          type: "text",
          text: type,
        } as Component;
    }
  }

  // Keyboard shortcuts
  function handleKeyDown(e: KeyboardEvent) {
    // Delete selected components
    if (e.key === "Delete" || e.key === "Backspace") {
      if (selectionStore.hasSelection) {
        historyStore.record("Delete components");
        for (const id of selectionStore.selectedIds) {
          projectStore.deleteComponent(id);
        }
        selectionStore.clear();
      }
    }

    // Undo/Redo
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        historyStore.undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        e.preventDefault();
        historyStore.redo();
      }
    }
  }
</script>

<svelte:window onkeydown={handleKeyDown} />

<div
  class="canvas-wrapper"
  style:width="{projectStore.display.width}px"
  style:height="{(projectStore.viewMode === 'detail' && projectStore.currentDetailView) ? (projectStore.currentDetailView.height || 320) : projectStore.display.height}px"
>
  <DetailHeader 
    title={projectStore.currentDetailView?.title || ""} 
    onBack={() => projectStore.setViewMode("dashboard")} 
  />
  <div
    bind:this={canvasEl}
    class="canvas"
    role="application"
    tabindex="0"
    aria-label="Design canvas"
    onclick={handleCanvasClick}
    ondrop={handleDrop}
    ondragover={handleDragOver}
    style:height="{(projectStore.viewMode === 'detail' && projectStore.currentDetailView) ? (projectStore.currentDetailView.height || 320) - 45 : '100%'}px"
  >
    {#each projectStore.activeComponents as component (component.id)}
      <ComponentRenderer {component} />
    {/each}

    <SelectionOverlay />
  </div>

  <!-- Display size indicator -->
  <div class="size-indicator">
    {projectStore.display.width} x {(projectStore.viewMode === 'detail' && projectStore.currentDetailView) ? (projectStore.currentDetailView.height || 320) : projectStore.display.height}
    {#if projectStore.viewMode === 'dashboard'}
      (Dashboard: {projectStore.currentDashboardPage.name})
    {:else}
      (Detail: {projectStore.currentDetailView?.title || "Unknown"})
    {/if}
  </div>
</div>

<style>
  .canvas-wrapper {
    position: relative;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-sm);
    box-shadow: var(--shadow-lg);
  }

  .canvas {
    width: 100%;
    height: 100%;
    background: #1a1a1a;
    position: relative;
    overflow-y: auto;
    cursor: crosshair;
  }

  .canvas:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }

  .size-indicator {
    position: absolute;
    bottom: -24px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 11px;
    color: var(--color-text-muted);
    white-space: nowrap;
  }
</style>
