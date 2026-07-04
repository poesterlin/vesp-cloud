<script lang="ts">
  import type { ConditionalAreaComponent, Condition } from "@vesp-cloud/schema";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { conditionalEditorStore } from "$lib/stores/conditional-editor.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import { canvasPasteTargetStore } from "$lib/stores/canvas-paste-target.svelte";
  import { createComponent } from "$lib/utils/component-factory";
  import { sortComponentsForRender } from "$lib/utils/component-layering";
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
  const orderedVariantComponents = $derived(
    activeVariant ? sortComponentsForRender(activeVariant.components) : [],
  );

  const isSelected = $derived(selectionStore.selectedIds.has(component.id));

  // Safe size access with defaults
  const width = $derived(component.size?.width ?? 100);
  const height = $derived(component.size?.height ?? 100);

  const variantColors = [
    "#4a9eff", "#6fbf73", "#ff914d", "#e06cae",
    "#7ec8e3", "#c792ea", "#ffd666", "#ff6464",
  ];

  function getVariantColor(index: number): string {
    return variantColors[index % variantColors.length];
  }

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
  <div
    class="conditional-area"
    class:selected={isSelected}
    class:drag-over={isDragOver}
    style:width="{width}px"
    style:height="{height}px"
  >
    <div class="variant-header" role="tablist" tabindex="0" onmousedown={(e) => e.stopPropagation()}>
      {#each component.variants as variant, i (variant.id)}
        {@const color = getVariantColor(i)}
        {@const isActive = variant.id === activeVariantId}
        <button
          class="variant-tab"
          class:active={isActive}
          style:background={isActive ? color : `${color}33`}
          style:border-color={isActive ? color : `${color}44`}
          style:color={isActive ? '#fff' : color}
          onclick={() => selectVariant(variant.id)}
          title={variant.condition ? describeCondition(variant.condition) : "Default"}
          role="tab"
          aria-selected={isActive}
        >
          {variant.name}
          {#if !variant.condition}
            <span class="default-badge">def</span>
          {/if}
        </button>
      {/each}
      {#if isSelected}
        <button class="add-variant-btn" onclick={handleAddVariant} title="Add Variant">
          +
        </button>
      {/if}
    </div>

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
        {#each orderedVariantComponents as childComponent (childComponent.id)}
          <ComponentRenderer
            component={childComponent}
            parentOffset={{
              x: (parentOffset?.x ?? 0) + component.position.x,
              y: (parentOffset?.y ?? 0) + component.position.y,
            }}
          />
        {/each}
      {/if}

      {#if activeVariant && activeVariant.components.length === 0}
        <div class="empty-state">
          {isDragOver ? "Release to drop" : "Drop new components here"}
        </div>
      {/if}
    </div>

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
    overflow: hidden;
  }

  .conditional-area.selected {
    border: 1px solid #4a9eff;
    box-shadow: 0 0 0 1px #4a9eff;
  }

  .conditional-area.drag-over {
    border-color: #6fbf73;
    background: rgba(50, 100, 50, 0.3);
  }

  .variant-header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 22px;
    padding: 0 0 2px 2px;
    background: transparent;
    overflow-x: auto;
    overflow-y: hidden;
    z-index: 5;
    transform: translateY(-14px);
    transition: transform 0.15s ease, background 0.15s ease, box-shadow 0.15s ease;
  }

  .variant-header > :last-child {
    margin-right: 2px;
  }

  .variant-header:hover {
    transform: translateY(0);
    background: rgba(22, 28, 36, 0.94);
    box-shadow: 0 1px 0 rgba(90, 110, 130, 0.55);
  }

  .variant-tab {
    padding: 0;
    width: 12px;
    min-width: 12px;
    height: 8px;
    font-size: 0;
    border: 1px solid transparent;
    border-radius: 2px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
    transition: padding 0.12s ease, width 0.12s ease, min-width 0.12s ease,
                height 0.12s ease, font-size 0.12s ease, border-radius 0.12s ease,
                filter 0.1s;
  }

  .variant-header:hover .variant-tab {
    padding: 1px 5px;
    width: auto;
    min-width: auto;
    height: auto;
    font-size: 9px;
    border-radius: 3px;
  }

  .variant-tab:hover {
    filter: brightness(1.3);
  }

  .variant-tab.active {
    font-weight: 600;
    width: 24px;
    min-width: 24px;
  }

  .default-badge {
    display: none;
    font-size: 7px;
    background: rgba(255, 255, 255, 0.2);
    padding: 0px 3px;
    border-radius: 2px;
    margin-left: 2px;
  }

  .variant-header:hover .default-badge {
    display: inline;
  }

  .add-variant-btn {
    margin-left: auto;
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px dashed #5f738c;
    border-radius: 2px;
    color: #8ea4bc;
    cursor: pointer;
    font-size: 0;
    line-height: 1;
    opacity: 0;
    transition: opacity 0.12s ease, font-size 0.12s ease;
  }

  .variant-header:hover .add-variant-btn {
    font-size: 14px;
    opacity: 1;
  }

  .variant-content {
    position: relative;
    flex: 1;
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
