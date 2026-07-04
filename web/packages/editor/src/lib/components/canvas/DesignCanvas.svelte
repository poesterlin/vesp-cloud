<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import { projectStore } from "$lib/stores/project.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import { snapStore } from "$lib/stores/snap.svelte";
  import { conditionalEditorStore } from "$lib/stores/conditional-editor.svelte";
  import {
    canvasPasteTargetStore,
    type CanvasPasteTarget,
  } from "$lib/stores/canvas-paste-target.svelte";
  import ComponentRenderer from "./renderers/ComponentRenderer.svelte";
  import SelectionOverlay from "./SelectionOverlay.svelte";
  import DetailHeader from "./DetailHeader.svelte";
  import DashboardHeader from "./DashboardHeader.svelte";
  import PageIndicator from "./PageIndicator.svelte";
  import { createComponent } from "$lib/utils/component-factory";
  import { sortComponentsForRender } from "$lib/utils/component-layering";

  let canvasEl: HTMLDivElement | undefined = $state();
  let clipboardComponent = $state<{
    component: Component;
    context: ComponentContext;
    pasteCount: number;
    pasteTargetVersionAtCopy: number;
  } | null>(null);
  let selectedComponent = $derived(
    selectionStore.firstSelectedId
      ? projectStore.getComponent(selectionStore.firstSelectedId)
      : null,
  );

  const canvasHeight = $derived(
    projectStore.project &&
      projectStore.viewMode === "detail" &&
      projectStore.currentDetailView
      ? projectStore.currentDetailView.height || projectStore.display!.height
      : (projectStore.display?.height ?? 320),
  );

  const hasHeader = $derived(
    projectStore.viewMode === "dashboard" && !!projectStore.pageHeader,
  );

  function hasDigitalClockInComponents(components: Component[]): boolean {
    for (const component of components) {
      if (component.type === "digital_clock") return true;
      if (component.type === "conditional_area") {
        if (component.variants.some((variant) => hasDigitalClockInComponents(variant.components))) {
          return true;
        }
      } else if (component.type === "tab_container") {
        if (component.tabs.some((tab) => hasDigitalClockInComponents(tab.components))) {
          return true;
        }
      }
    }
    return false;
  }

  const hideHeaderForCurrentPage = $derived(
    projectStore.viewMode === "dashboard" && hasDigitalClockInComponents(projectStore.activeComponents),
  );

  const headerHeight = $derived(
    hasHeader && !hideHeaderForCurrentPage ? projectStore.pageHeader!.height : 0,
  );

  const contentHeight = $derived(
    projectStore.viewMode === "detail"
      ? canvasHeight
      : (projectStore.display?.height ?? 320) - headerHeight,
  );

  const orderedActiveComponents = $derived(
    sortComponentsForRender(projectStore.activeComponents),
  );

  type ComponentContext = CanvasPasteTarget;

  function generateId(prefix: string): string {
    return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
  }

  function cloneComponent(component: Component): Component {
    return structuredClone($state.snapshot(component)) as Component;
  }

  function cloneComponentWithFreshIds(component: Component): Component {
    const clone = cloneComponent(component);

    const rewriteIds = (target: Component) => {
      target.id = generateId(target.type);

      if (target.type === "conditional_area") {
        const variantIdMap = new Map<string, string>();
        for (const variant of target.variants) {
          const nextVariantId = generateId("variant");
          variantIdMap.set(variant.id, nextVariantId);
          variant.id = nextVariantId;
          for (const child of variant.components) {
            rewriteIds(child);
          }
        }
        if (target.defaultVariantId) {
          target.defaultVariantId =
            variantIdMap.get(target.defaultVariantId) ??
            target.defaultVariantId;
        }
      } else if (target.type === "tab_container") {
        const tabIdMap = new Map<string, string>();
        for (const tab of target.tabs) {
          const nextTabId = generateId("tab");
          tabIdMap.set(tab.id, nextTabId);
          tab.id = nextTabId;
          for (const child of tab.components) {
            rewriteIds(child);
          }
        }
        if (target.defaultTabId) {
          target.defaultTabId =
            tabIdMap.get(target.defaultTabId) ?? target.defaultTabId;
        }
      }
    };

    rewriteIds(clone);
    return clone;
  }

  function findComponentContext(componentId: string): ComponentContext | null {
    const search = (
      components: Component[],
      currentContext: ComponentContext,
    ): ComponentContext | null => {
      for (const component of components) {
        if (component.id === componentId) {
          return currentContext;
        }
        if (component.type === "conditional_area") {
          for (const variant of component.variants) {
            const found = search(variant.components, {
              scope: "variant",
              parentId: component.id,
              variantId: variant.id,
            });
            if (found) return found;
          }
        } else if (component.type === "tab_container") {
          for (const tab of component.tabs) {
            const found = search(tab.components, {
              scope: "tab",
              parentId: component.id,
              tabId: tab.id,
            });
            if (found) return found;
          }
        }
      }
      return null;
    };

    return search(projectStore.activeComponents, { scope: "root" });
  }

  function getValidatedPasteTarget(): ComponentContext | null {
    const target = canvasPasteTargetStore.target;
    if (!target) return null;

    if (target.scope === "root") return target;

    const parent = projectStore.getComponent(target.parentId);
    if (target.scope === "tab") {
      if (
        parent?.type === "tab_container" &&
        parent.tabs.some((tab) => tab.id === target.tabId)
      ) {
        return target;
      }
      return null;
    }

    if (
      parent?.type === "conditional_area" &&
      parent.variants.some((variant) => variant.id === target.variantId)
    ) {
      return target;
    }

    return null;
  }

  function resolvePasteContext(): ComponentContext | null {
    const explicitTarget = getValidatedPasteTarget();
    if (
      explicitTarget &&
      clipboardComponent &&
      canvasPasteTargetStore.version >
        clipboardComponent.pasteTargetVersionAtCopy
    ) {
      return explicitTarget;
    }

    const selectedId = selectionStore.firstSelectedId;
    if (selectedId) {
      const selected = projectStore.getComponent(selectedId);

      // If the user selects a different parent before pasting, paste into the
      // currently edited child area. Pasting the just-copied parent duplicates
      // it beside the original instead of nesting it into itself.
      if (
        selected?.type === "tab_container" &&
        selected.id !== clipboardComponent?.component.id
      ) {
        const tabId =
          conditionalEditorStore.getActiveTab(
            selected.id,
            selected.defaultTabId ?? selected.tabs[0]?.id,
          ) ?? selected.tabs[0]?.id;
        if (tabId) {
          return { scope: "tab", parentId: selected.id, tabId };
        }
      }
      if (
        selected?.type === "conditional_area" &&
        selected.id !== clipboardComponent?.component.id
      ) {
        const variantId =
          conditionalEditorStore.getActiveVariant(
            selected.id,
            selected.defaultVariantId ?? selected.variants[0]?.id,
          ) ?? selected.variants[0]?.id;
        if (variantId) {
          return { scope: "variant", parentId: selected.id, variantId };
        }
      }

      const selectedContext = findComponentContext(selectedId);
      if (selectedContext) {
        return selectedContext;
      }
    }

    return explicitTarget ?? clipboardComponent?.context ?? null;
  }

  function clampPositionForContext(
    position: { x: number; y: number },
    context: ComponentContext,
    component: Component,
  ): { x: number; y: number } {
    const componentWidth = component.size?.width ?? 50;
    const componentHeight = component.size?.height ?? 20;
    let maxX = Number.POSITIVE_INFINITY;
    let maxY = Number.POSITIVE_INFINITY;

    if (context.scope === "root") {
      maxX = (projectStore.display?.width ?? 240) - componentWidth;
      maxY = contentHeight - componentHeight;
    } else if (context.scope === "tab") {
      const parent = projectStore.getComponent(context.parentId);
      if (parent?.type === "tab_container") {
        maxX = (parent.size?.width ?? 150) - componentWidth;
        maxY = (parent.size?.height ?? 100) - 30 - componentHeight;
      }
    } else if (context.scope === "variant") {
      const parent = projectStore.getComponent(context.parentId);
      if (parent?.type === "conditional_area") {
        maxX = (parent.size?.width ?? 100) - componentWidth;
        maxY = (parent.size?.height ?? 100) - componentHeight;
      }
    }

    return {
      x: Math.max(0, Math.min(position.x, Math.max(0, maxX))),
      y: Math.max(0, Math.min(position.y, Math.max(0, maxY))),
    };
  }

  function insertComponentAtContext(
    component: Component,
    context: ComponentContext,
  ): Component | undefined {
    if (context.scope === "root") return projectStore.addComponent(component);
    if (context.scope === "tab") {
      return projectStore.addComponentToTab(
        context.parentId,
        context.tabId,
        component,
      );
    }
    return projectStore.addComponentToVariant(
      context.parentId,
      context.variantId,
      component,
    );
  }

  function handleCanvasClick(e: MouseEvent) {
    if (e.target === canvasEl) {
      canvasPasteTargetStore.set({ scope: "root" });
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

  // Keyboard shortcuts
  function handleKeyDown(e: KeyboardEvent) {
    // Check if the event target is a form input field
    const isFormInput =
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      (e.target instanceof HTMLElement && e.target.contentEditable === "true");

    // Delete selected components (but not when editing form inputs)
    if ((e.key === "Delete" || e.key === "Backspace") && !isFormInput) {
      if (selectionStore.hasSelection) {
        e.preventDefault();
        historyStore.record("Delete components");
        for (const id of selectionStore.selectedIds) {
          projectStore.deleteComponent(id);
        }
        selectionStore.clear();
      }
    }

    // Nudge selected components with arrow keys
    if (!isFormInput && selectionStore.hasSelection) {
      const step = e.shiftKey ? 10 : 1;
      const deltaByKey: Record<string, { x: number; y: number }> = {
        ArrowLeft: { x: -step, y: 0 },
        ArrowRight: { x: step, y: 0 },
        ArrowUp: { x: 0, y: -step },
        ArrowDown: { x: 0, y: step },
      };
      const delta = deltaByKey[e.key];
      if (delta) {
        e.preventDefault();
        const updates: Array<{ id: string; updates: Partial<Component> }> = [];

        for (const id of selectionStore.selectedIds) {
          const component = projectStore.getComponent(id);
          if (!component) continue;

          const parentSurface = projectStore.getComponentParentLayoutSurface(id);
          const width = component.size?.width ?? 50;
          const height = component.size?.height ?? 20;
          const maxX = parentSurface
            ? Math.max(0, parentSurface.width - width)
            : Number.POSITIVE_INFINITY;
          const maxY = parentSurface
            ? Math.max(0, parentSurface.height - height)
            : Number.POSITIVE_INFINITY;

          const nextX = Math.max(
            0,
            Math.min(component.position.x + delta.x, maxX),
          );
          const nextY = Math.max(
            0,
            Math.min(component.position.y + delta.y, maxY),
          );

          if (nextX === component.position.x && nextY === component.position.y) {
            continue;
          }

          updates.push({
            id,
            updates: { position: { x: nextX, y: nextY } },
          });
        }

        if (updates.length > 0) {
          historyStore.record("Nudge components");
          projectStore.batchUpdateComponents(updates);
        }
        return;
      }
    }

    // Clipboard operations
    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "c" &&
      !isFormInput
    ) {
      if (!selectionStore.firstSelectedId) return;
      const source = projectStore.getComponent(selectionStore.firstSelectedId);
      if (!source) return;

      const context = findComponentContext(source.id);
      if (!context) return;

      e.preventDefault();
      canvasPasteTargetStore.set(context);
      clipboardComponent = {
        component: cloneComponent(source),
        context,
        pasteCount: 0,
        pasteTargetVersionAtCopy: canvasPasteTargetStore.version,
      };
      return;
    }

    if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "v" &&
      !isFormInput
    ) {
      if (!clipboardComponent) return;
      const destinationContext = resolvePasteContext();
      if (!destinationContext) return;

      e.preventDefault();

      const duplicate = cloneComponentWithFreshIds(
        clipboardComponent.component,
      );
      const offsetStep = 12 * (clipboardComponent.pasteCount + 1);
      duplicate.position = clampPositionForContext(
        {
          x: duplicate.position.x + offsetStep,
          y: duplicate.position.y + offsetStep,
        },
        destinationContext,
        duplicate,
      );

      historyStore.record("Paste component");
      const inserted = insertComponentAtContext(duplicate, destinationContext);
      if (inserted) {
        selectionStore.select(inserted.id);
        clipboardComponent = {
          ...clipboardComponent,
          pasteCount: clipboardComponent.pasteCount + 1,
        };
      }
      return;
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
  style:width="{projectStore.display?.width ?? 240}px"
  style:height="{canvasHeight}px"
>
  {#if projectStore.viewMode === "detail" && projectStore.currentDetailView}
    <DetailHeader
      title={projectStore.currentDetailView.title}
      onBack={() => projectStore.setViewMode("dashboard")}
    />
  {/if}

  {#if hasHeader && !hideHeaderForCurrentPage}
    <DashboardHeader />
  {/if}

  <div
    bind:this={canvasEl}
    class="canvas"
    role="application"
    tabindex="0"
    aria-label="Design canvas"
    onclick={handleCanvasClick}
    ondrop={handleDrop}
    ondragover={handleDragOver}
    style:height="{contentHeight}px"
  >
    {#if orderedActiveComponents}
      {#each orderedActiveComponents as component (component.id)}
        <ComponentRenderer {component} />
      {/each}
    {/if}

    <SelectionOverlay
      region="content"
      regionOffset={headerHeight}
      widthOnly={selectedComponent?.type === "light_state" || selectedComponent?.type === "hvac" || selectedComponent?.type === "weather"}
    />

    {#if projectStore.viewMode === "dashboard"}
      <PageIndicator
        count={projectStore.dashboardPages.length}
        currentIndex={projectStore.currentPageIndex}
      />
    {/if}
  </div>

  <!-- Alignment Snapping Guide lines -->
  {#each snapStore.activeSnapLines as line}
    {#if line.type === "v"}
      <div
        class="snap-line vertical"
        style:left="{line.coord}px"
        style:top="{line.start}px"
        style:height="{line.end - line.start}px"
      ></div>
    {:else}
      <div
        class="snap-line horizontal"
        style:top="{line.coord}px"
        style:left="{line.start}px"
        style:width="{line.end - line.start}px"
      ></div>
    {/if}
  {/each}

  <!-- Display size indicator -->
  <div class="size-indicator">
    {projectStore.display?.width ?? 240} x {canvasHeight}
    {#if projectStore.viewMode === "dashboard" && projectStore.currentDashboardPage}
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
    background: #1a1a1a;
    outline: 30px solid black;

    /* Mirror the device's font system so widget previews can use the
       same typeface and pixel sizes as the rasterised bitmap fonts
       ESPHome ships (see esphome/fonts.yaml: font_tiny=14, font_small=18,
       font_medium=24, font_large=32, all Roboto). */
    --display-font: "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI",
      sans-serif;
    --display-text-tiny: 14px;
    --display-text-small: 18px;
    --display-text-medium: 24px;
    --display-text-large: 32px;

    /* Bitmap fonts on the device have no kerning, ligatures, or sub-pixel
       AA. Disabling those in the preview keeps glyph-advance widths close
       to what `display.get_text_bounds()` will measure on hardware. */
    font-family: var(--display-font);
    font-feature-settings:
      "kern" off,
      "liga" off,
      "calt" off;
    font-kerning: none;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: geometricPrecision;
  }

  .canvas {
    width: 100%;
    position: relative;
    overflow: hidden;
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

  .snap-line {
    position: absolute;
    pointer-events: none;
    z-index: 9999;
  }

  .snap-line.vertical {
    width: 0px;
    border-left: 1px dashed #ff4a8b;
  }

  .snap-line.horizontal {
    height: 0px;
    border-top: 1px dashed #ff4a8b;
  }
</style>
