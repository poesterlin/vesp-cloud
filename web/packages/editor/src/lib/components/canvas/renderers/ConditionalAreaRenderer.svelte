<script lang="ts">
  import type { ConditionalAreaComponent, Condition } from "@esphome-designer/schema";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { conditionalEditorStore } from "$lib/stores/conditional-editor.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import { canvasPasteTargetStore } from "$lib/stores/canvas-paste-target.svelte";
  import { createComponent } from "$lib/utils/component-factory";
  import ComponentRenderer from "./ComponentRenderer.svelte";
  import Draggable from "../Draggable.svelte";

  interface Props {
    component: ConditionalAreaComponent;
    parentOffset?: { x: number; y: number };
  }

  let { component, parentOffset = { x: 0, y: 0 } }: Props = $props();

  let contentEl: HTMLDivElement | undefined = $state();
  let isDragOver = $state(false);

  // Which variant is currently being viewed/edited in the designer
  let activeVariantId = $derived(conditionalEditorStore.getActiveVariant(component.id, component.variants[0]?.id));

  const activeVariant = $derived(
    component.variants.find((v) => v.id === activeVariantId) || component.variants[0]
  );

  const isSelected = $derived(selectionStore.selectedIds.has(component.id));

  // Safe size access with defaults
  const width = $derived(component.size?.width ?? 100);
  const height = $derived(component.size?.height ?? 100);

  function selectVariant(variantId: string) {
    conditionalEditorStore.setActiveVariant(component.id, variantId);
    canvasPasteTargetStore.set({ scope: "variant", parentId: component.id, variantId });
  }

  function handleAddVariant() {
    const newVariant = projectStore.addVariant(component.id);
    if (newVariant) {
      selectVariant(newVariant.id);
    }
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = true;
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if leaving the content area entirely
    if (e.currentTarget === e.target) {
      isDragOver = false;
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function handleContentMouseDown() {
    if (activeVariant) {
      canvasPasteTargetStore.set({
        scope: "variant",
        parentId: component.id,
        variantId: activeVariant.id,
      });
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;

    const componentType = e.dataTransfer?.getData("component-type");
    if (!componentType || !contentEl || !activeVariant) return;

    const rect = contentEl.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    historyStore.record(`Add ${componentType} to variant`);
    const newComponent = createComponent(componentType, x, y);
    projectStore.addComponentToVariant(component.id, activeVariant.id, newComponent);
    selectionStore.select(newComponent.id);
  }

  function describeCondition(condition: Condition): string {
    switch (condition.type) {
      case "entity":
        const op = { eq: "=", neq: "≠", gt: ">", gte: "≥", lt: "<", lte: "≤", contains: "contains", not_contains: "not contains", matches: "matches" }[condition.operator] ?? condition.operator;
        return `${condition.entityId} ${op} ${condition.value}`;
      case "compound":
        return `${condition.conditions.length} conditions (${condition.operator.toUpperCase()})`;
      case "not":
        return `NOT (${describeCondition(condition.condition)})`;
      case "time":
        const parts = [];
        if (condition.after) parts.push(`after ${condition.after}`);
        if (condition.before) parts.push(`before ${condition.before}`);
        return parts.join(" and ") || "time condition";
      case "state":
        return `${condition.variable} ${condition.operator} ${condition.value}`;
      default:
        return "condition";
    }
  }

  function getConditionIcon(condition: Condition): string {
    switch (condition.type) {
      case "entity": return "🏠";
      case "time": return "🕐";
      case "compound": return condition.operator === "and" ? "∧" : "∨";
      case "not": return "¬";
      case "state": return "📊";
      default: return "?";
    }
  }
</script>

<Draggable {component}>
  <!-- Variant tabs positioned above the area -->
  {#if isSelected}
    <div class="variant-tabs" role="tablist" tabindex="0" onmousedown={(e) => e.stopPropagation()}>
      {#each component.variants as variant (variant.id)}
        <button
          class="variant-tab"
          class:active={variant.id === activeVariantId}
          onclick={() => selectVariant(variant.id)}
          title={variant.condition ? describeCondition(variant.condition) : "Default"}
          role="tab"
          aria-selected={variant.id === activeVariantId}
        >
          {variant.name}
          {#if !variant.condition}
            <span class="default-badge">def</span>
          {/if}
        </button>
      {/each}
      <button class="add-variant-btn" onclick={handleAddVariant} title="Add Variant">
        +
      </button>
    </div>
  {/if}

  <div
    class="conditional-area"
    class:selected={isSelected}
    class:drag-over={isDragOver}
    style:width="{width}px"
    style:height="{height}px"
  >
    <!-- Render active variant's components -->
    <div
      bind:this={contentEl}
      class="variant-content"
      class:drag-over={isDragOver}
      style:height="{height}px"
      role="region"
      aria-label="Variant content drop zone"
      ondragenter={handleDragEnter}
      ondragleave={handleDragLeave}
      ondragover={handleDragOver}
      ondrop={handleDrop}
      onpointerdown={handleContentMouseDown}
    >
      {#if activeVariant}
        {#each activeVariant.components as childComponent (childComponent.id)}
          <ComponentRenderer
            component={childComponent}
            parentOffset={{
              x: (parentOffset?.x ?? 0) + component.position.x,
              y: (parentOffset?.y ?? 0) + component.position.y
            }}
          />
        {/each}
      {/if}

      <!-- Empty state -->
      {#if activeVariant && activeVariant.components.length === 0}
        <div class="empty-state">
          {isDragOver ? "Release to drop" : "Drop components here"}
        </div>
      {/if}
    </div>

    <!-- Condition indicator (show when not selected) -->
    {#if !isSelected && activeVariant?.condition}
      <div class="condition-badge" title={describeCondition(activeVariant.condition)}>
        {getConditionIcon(activeVariant.condition)}
      </div>
    {/if}
  </div>
</Draggable>

<style>
  .conditional-area {
    position: relative;
    border: 1px dashed #555;
    border-radius: 4px;
    background: rgba(50, 50, 80, 0.2);
    pointer-events: all;
  }

  .conditional-area.selected {
    border: 1px solid #4a9eff;
    box-shadow: 0 0 0 1px #4a9eff;
  }

  .conditional-area.drag-over {
    border-color: #6fbf73;
    background: rgba(50, 100, 50, 0.3);
  }

  .variant-tabs {
    position: absolute;
    bottom: 100%;
    left: 0;
    display: flex;
    gap: 2px;
    padding: 2px;
    background: #2a2a2a;
    border-radius: 4px 4px 0 0;
    overflow-x: auto;
    height: 20px;
    z-index: 10;
  }

  .variant-tab {
    padding: 2px 6px;
    font-size: 10px;
    background: #3a3a3a;
    border: none;
    border-radius: 2px;
    color: #aaa;
    cursor: pointer;
    white-space: nowrap;
  }

  .variant-tab:hover {
    background: #4a4a4a;
  }

  .variant-tab.active {
    background: #4a9eff;
    color: white;
  }

  .default-badge {
    font-size: 8px;
    background: #666;
    padding: 0px 3px;
    border-radius: 2px;
    margin-left: 2px;
  }

  .add-variant-btn {
    padding: 2px 6px;
    background: transparent;
    border: 1px dashed #555;
    border-radius: 2px;
    color: #888;
    cursor: pointer;
    font-size: 10px;
  }

  .variant-content {
    position: relative;
    overflow: hidden;
  }

  .variant-content.drag-over {
    outline: 2px dashed #6fbf73;
    outline-offset: -2px;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #666;
    font-size: 10px;
    pointer-events: none;
  }

  .condition-badge {
    position: absolute;
    bottom: 4px;
    right: 4px;
    font-size: 10px;
    background: rgba(0, 0, 0, 0.6);
    padding: 1px 4px;
    border-radius: 3px;
    color: white;
    pointer-events: none;
  }
</style>