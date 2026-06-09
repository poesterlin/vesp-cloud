<script lang="ts">
  import type { TabContainerComponent } from "@esphome-designer/schema";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { conditionalEditorStore } from "$lib/stores/conditional-editor.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import { canvasPasteTargetStore } from "$lib/stores/canvas-paste-target.svelte";
  import { createComponent } from "$lib/utils/component-factory";
  import { colorToCss } from "$lib/utils/color-utils";
  import ComponentRenderer from "./ComponentRenderer.svelte";
  import Draggable from "../Draggable.svelte";

  interface Props {
    component: TabContainerComponent;
    parentOffset?: { x: number; y: number };
  }

  let { component, parentOffset = { x: 0, y: 0 } }: Props = $props();

  let contentEl: HTMLDivElement | undefined = $state();
  let isDragOver = $state(false);

  const theme = $derived(projectStore.theme);
  const accentColor = $derived(colorToCss(theme.colors.accent));
  const foregroundColor = $derived(colorToCss(theme.colors.foreground));
  const dimColor = "rgb(25, 30, 40)";

  let activeTabId = $derived(
    conditionalEditorStore.getActiveTab(component.id, component.defaultTabId ?? component.tabs[0]?.id),
  );

  const activeTab = $derived(component.tabs.find((tab) => tab.id === activeTabId) || component.tabs[0]);
  const isSelected = $derived(selectionStore.selectedIds.has(component.id));
  const width = $derived(component.size?.width ?? 150);
  const height = $derived(component.size?.height ?? 100);
  const kTabBarHeight = 36;
  const kTabPadding = 6;
  const kTabVertPadding = 2;
  const kTabCorner = 3;
  const contentHeight = $derived(Math.max(0, height - kTabBarHeight));

  function tabPolygonPoints(w: number, h: number, c: number): string {
    return `${c},0 ${w - c},0 ${w},${c} ${w},${h - c} ${w - c},${h} ${c},${h} 0,${h - c} 0,${c}`;
  }

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
    <svg class="tab-bar-svg" width={width} height={kTabBarHeight} viewBox="0 0 {width} {kTabBarHeight}">
      <rect x="0" y="0" width={width} height={kTabBarHeight} fill={dimColor} />
      {#each component.tabs as tab, i (tab.id)}
        {@const tabW = (width - kTabPadding * (component.tabs.length + 1)) / component.tabs.length}
        {@const tx = kTabPadding + i * (tabW + kTabPadding)}
        {@const ty = kTabVertPadding}
        {@const tabH = kTabBarHeight - kTabVertPadding * 2}
        {#if tab.id === activeTabId}
          <polygon
            points={tabPolygonPoints(tabW, tabH, kTabCorner)}
            fill={accentColor}
            stroke={accentColor}
            stroke-width="1"
            transform="translate({tx}, {ty})"
          />
          <text
            x={tx + tabW / 2}
            y={ty + tabH / 2}
            fill="black"
            font-family="var(--display-font, monospace)"
            font-size="14"
            text-anchor="middle"
            dominant-baseline="central"
          >{tab.name}</text>
        {:else}
          <polygon
            points={tabPolygonPoints(tabW, tabH, kTabCorner)}
            fill="none"
            stroke={accentColor}
            stroke-width="1"
            transform="translate({tx}, {ty})"
          />
          <text
            x={tx + tabW / 2}
            y={ty + tabH / 2}
            fill={foregroundColor}
            font-family="var(--display-font, monospace)"
            font-size="14"
            text-anchor="middle"
            dominant-baseline="central"
          >{tab.name}</text>
        {/if}
      {/each}
    </svg>

    <div class="tab-bar-overlay" role="tablist" tabindex="0" onmousedown={(e) => e.stopPropagation()}>
      {#each component.tabs as tab (tab.id)}
        <button
          class="tab-hit-area"
          class:active={tab.id === activeTabId}
          onclick={() => selectTab(tab.id)}
          role="tab"
          aria-selected={tab.id === activeTabId}
          title={tab.name}
        >
          <span class="visually-hidden">{tab.name}</span>
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
              y: (parentOffset?.y ?? 0) + component.position.y + kTabBarHeight,
            }}
          />
        {/each}
      {/if}

      {#if activeTab && activeTab.components.length === 0}
        <div class="empty-state">
          {isDragOver ? "Release to drop" : "Drop new components here"}
        </div>
      {/if}
    </div>
  </div>
</Draggable>

<style>
  .tab-container {
    position: relative;
    pointer-events: all;
    overflow: hidden;
    background: rgb(2, 3, 5);
  }

  .tab-container.selected {
    outline: 1px solid #4a9eff;
    outline-offset: 1px;
  }

  .tab-container.drag-over {
    outline: 1px solid #6fbf73;
    outline-offset: 1px;
  }

  .tab-bar-svg {
    display: block;
    pointer-events: none;
  }

  .tab-bar-overlay {
    position: absolute;
    top: 2px;
    left: 0;
    right: 0;
    height: 32px;
    display: flex;
    align-items: stretch;
    padding: 0 6px;
    gap: 6px;
    pointer-events: all;
  }

  .tab-hit-area {
    flex: 1 1 0;
    min-width: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
    position: relative;
  }

  .tab-hit-area:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  .add-tab-btn {
    flex: 0 0 24px;
    min-width: 24px;
    height: 24px;
    align-self: center;
    border: 1px solid;
    border-color: inherit;
    background: transparent;
    color: #8ea4bc;
    font-size: 14px;
    cursor: pointer;
    line-height: 20px;
    padding: 0;
    margin-left: 2px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
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
