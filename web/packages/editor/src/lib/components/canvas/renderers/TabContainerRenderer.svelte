<script lang="ts">
  import type { TabContainerComponent } from "@esphome-designer/schema";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { conditionalEditorStore } from "$lib/stores/conditional-editor.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import { canvasPasteTargetStore } from "$lib/stores/canvas-paste-target.svelte";
  import { createComponent } from "$lib/utils/component-factory";
  import ComponentRenderer from "./ComponentRenderer.svelte";
  import Draggable from "../Draggable.svelte";

  interface Props {
    component: TabContainerComponent;
    parentOffset?: { x: number; y: number };
  }

  let { component, parentOffset = { x: 0, y: 0 } }: Props = $props();

  let contentEl: HTMLDivElement | undefined = $state();
  let isDragOver = $state(false);

  let activeTabId = $derived(
    conditionalEditorStore.getActiveTab(component.id, component.defaultTabId ?? component.tabs[0]?.id),
  );

  const activeTab = $derived(component.tabs.find((tab) => tab.id === activeTabId) || component.tabs[0]);
  const isSelected = $derived(selectionStore.selectedIds.has(component.id));
  const width = $derived(component.size?.width ?? 150);
  const height = $derived(component.size?.height ?? 100);
  const tabsHeaderHeight = 30;
  const contentHeight = $derived(Math.max(0, height - tabsHeaderHeight));

  function selectTab(tabId: string) {
    conditionalEditorStore.setActiveTab(component.id, tabId);
    canvasPasteTargetStore.set({ scope: "tab", parentId: component.id, tabId });
  }

  function handleAddTab() {
    const newTab = projectStore.addTab(component.id);
    if (newTab) {
      selectTab(newTab.id);
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
    if (activeTab) {
      canvasPasteTargetStore.set({
        scope: "tab",
        parentId: component.id,
        tabId: activeTab.id,
      });
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDragOver = false;

    const componentType = e.dataTransfer?.getData("component-type");
    if (!componentType || !contentEl || !activeTab) return;

    const rect = contentEl.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);

    historyStore.record(`Add ${componentType} to tab`);
    const newComponent = createComponent(componentType, x, y);
    projectStore.addComponentToTab(component.id, activeTab.id, newComponent);
    selectionStore.select(newComponent.id);
  }
</script>

<Draggable {component}>
  <div
    class="tab-container"
    class:selected={isSelected}
    class:drag-over={isDragOver}
    style:width="{width}px"
    style:height="{height}px"
  >
    <div class="tab-header" role="tablist" tabindex="0" onmousedown={(e) => e.stopPropagation()}>
      {#each component.tabs as tab (tab.id)}
        <button
          class="tab-button"
          class:active={tab.id === activeTabId}
          onclick={() => selectTab(tab.id)}
          role="tab"
          aria-selected={tab.id === activeTabId}
          title={tab.name}
        >
          {tab.name}
        </button>
      {/each}

      {#if isSelected}
        <button class="add-tab-btn" onclick={handleAddTab} title="Add Tab">+</button>
      {/if}
    </div>

    <div
      bind:this={contentEl}
      class="tab-content"
      class:drag-over={isDragOver}
      style:height="{contentHeight}px"
      role="region"
      aria-label="Tab content drop zone"
      ondragenter={handleDragEnter}
      ondragleave={handleDragLeave}
      ondragover={handleDragOver}
      ondrop={handleDrop}
      onpointerdown={handleContentMouseDown}
    >
      {#if activeTab}
        {#each activeTab.components as childComponent (childComponent.id)}
          <ComponentRenderer
            component={childComponent}
            parentOffset={{
              x: (parentOffset?.x ?? 0) + component.position.x,
              y: (parentOffset?.y ?? 0) + component.position.y + tabsHeaderHeight,
            }}
          />
        {/each}
      {/if}

      {#if activeTab && activeTab.components.length === 0}
        <div class="empty-state">
          {isDragOver ? "Release to drop" : "Drop components here"}
        </div>
      {/if}
    </div>
  </div>
</Draggable>

<style>
  .tab-container {
    position: relative;
    border: 1px solid #3d4b5a;
    border-radius: 4px;
    background: rgba(36, 44, 56, 0.65);
    pointer-events: all;
    overflow: hidden;
  }

  .tab-container.selected {
    border-color: #4a9eff;
    box-shadow: 0 0 0 1px #4a9eff;
  }

  .tab-container.drag-over {
    border-color: #6fbf73;
    background: rgba(45, 70, 50, 0.45);
  }

  .tab-header {
    display: flex;
    align-items: center;
    gap: 2px;
    height: 30px;
    padding: 3px;
    background: rgba(22, 28, 36, 0.9);
    border-bottom: 1px solid rgba(90, 110, 130, 0.6);
    overflow-x: auto;
  }

  .tab-button {
    min-height: 24px;
    max-width: 140px;
    padding: 0 12px;
    font-size: 12px;
    line-height: 24px;
    background: rgba(68, 78, 92, 0.85);
    border: 1px solid transparent;
    border-radius: 3px;
    color: #b8c2cf;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .tab-button:hover {
    background: rgba(78, 92, 108, 0.95);
  }

  .tab-button.active {
    background: #4a9eff;
    color: #fff;
    border-color: #7eb9ff;
  }

  .add-tab-btn {
    margin-left: auto;
    min-width: 24px;
    height: 24px;
    border: 1px dashed #5f738c;
    border-radius: 3px;
    background: transparent;
    color: #8ea4bc;
    font-size: 14px;
    cursor: pointer;
    line-height: 20px;
  }

  .tab-content {
    position: relative;
    overflow: hidden;
  }

  .tab-content.drag-over {
    outline: 2px dashed #6fbf73;
    outline-offset: -2px;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: #6f7d8d;
    font-size: 10px;
    pointer-events: none;
  }
</style>
