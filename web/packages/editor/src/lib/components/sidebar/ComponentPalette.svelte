<script lang="ts">
  import { projectStore } from '$lib/stores/project.svelte';
  import { selectionStore } from '$lib/stores/selection.svelte';
  import { historyStore } from '$lib/stores/history.svelte';
  import { createComponent } from '$lib/utils/component-factory';
  import {
    mdiFormatText,
    mdiClockOutline,
    mdiGestureTap,
    mdiStarOutline,
    mdiRectangleOutline,
    mdiLightbulbOutline,
    mdiImageOutline,
    mdiFormatListChecks,
    mdiTab,
    mdiSourceBranch,
    mdiThermometer,
    mdiWeatherPartlyCloudy,
    mdiCalendarMonth,
  } from '@mdi/js';

  interface ComponentTemplate {
    type: string;
    label: string;
    icon: string;
    description: string;
  }

  const components: ComponentTemplate[] = [
    {
      type: "text",
      label: "Text",
      icon: mdiFormatText,
      description: "Display static text or Home Assistant entity values",
    },
    {
      type: "digital_clock",
      label: "Digital Clock",
      icon: mdiClockOutline,
      description: "Large bold clock, replaces the header",
    },
    {
      type: "button",
      label: "Button",
      icon: mdiGestureTap,
      description: "Tap to trigger actions, navigate, or call services",
    },
    {
      type: "icon",
      label: "Icon",
      icon: mdiStarOutline,
      description: "Render Material Design Icons with custom color and size",
    },
    {
      type: "rectangle",
      label: "Rectangle",
      icon: mdiRectangleOutline,
      description: "Simple background block with configurable color",
    },
    {
      type: "light_state",
      label: "Switch",
      icon: mdiLightbulbOutline,
      description: "Visual on/off indicator for lights or switches",
    },
    {
      type: "hvac",
      label: "HVAC",
      icon: mdiThermometer,
      description: "Climate control with temperature setting and on/off",
    },
    {
      type: "weather",
      label: "Weather",
      icon: mdiWeatherPartlyCloudy,
      description: "Read-only weather entity card with condition, temperature, and more",
    },
    {
      type: "calendar",
      label: "Calendar",
      icon: mdiCalendarMonth,
      description: "Upcoming calendar events with configurable rows and scrolling",
    },
    {
      type: "image",
      label: "Image",
      icon: mdiImageOutline,
      description: "Display images from URL or camera entity snapshots",
    },
    {
      type: "todo_list",
      label: "To-Do List",
      icon: mdiFormatListChecks,
      description: "Interactive checklist for shopping or todo items",
    },
    {
      type: "tab_container",
      label: "Tabs",
      icon: mdiTab,
      description: "Organize content into switchable named tab sections",
    },
    {
      type: "conditional_area",
      label: "Conditional",
      icon: mdiSourceBranch,
      description: "Show or hide child content when conditions are met",
    },
  ];

  let query = $state('');
  const filteredComponents = $derived(components.filter((component) =>
    `${component.label} ${component.description}`.toLowerCase().includes(query.trim().toLowerCase()),
  ));

  function addComponent(type: string) {
    const component = createComponent(type, 24, 24);
    if (!component) return;
    historyStore.record(`Add ${type}`);
    projectStore.addComponent(component);
    selectionStore.select(component.id);
  }

  function handleDragStart(e: DragEvent, type: string) {
    if (e.dataTransfer) {
      e.dataTransfer.setData("component-type", type);
      e.dataTransfer.effectAllowed = "copy";
    }
  }
</script>

<div class="palette">
  <h3>Components</h3>
  <input class="component-search" type="search" bind:value={query} placeholder="Search components…" aria-label="Search components" />

  <div class="component-list">
    {#each filteredComponents as comp (comp.type)}
      <button
        type="button"
        class="palette-item"
        draggable="true"
        ondragstart={(e) => handleDragStart(e, comp.type)}
        onclick={() => addComponent(comp.type)}
        title={`Click to add ${comp.label}, or drag onto the canvas`}
      >
        <span class="item-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
            <path d={comp.icon} fill="currentColor" />
          </svg>
        </span>
        <div class="item-info">
          <span class="item-label">{comp.label}</span>
          <span class="item-desc">{comp.description}</span>
        </div>
      </button>
    {:else}
      <p class="empty-search">No components match “{query}”. Try another search.</p>
    {/each}
  </div>

  <div class="help-text">
    Click to add, or drag onto the canvas.
  </div>
</div>

<style>
  .palette {
    padding: var(--spacing-md);
  }

  .component-search {
    width: 100%;
    margin-bottom: 14px;
    padding: 10px 12px;
    border-radius: 8px;
    background: var(--color-bg-primary);
  }

  .empty-search { color: var(--color-text-secondary); font-size: 12px; padding: 16px 0; }
  .palette-item:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }

  h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-md);
  }

  .component-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .palette-item {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: grab;
    width: 100%;
    text-align: left;
    color: var(--color-text-primary);
    transition: all var(--transition-fast);
  }

  .palette-item:hover {
    border-color: var(--color-accent);
    background: var(--color-bg-primary);
  }

  .palette-item:active {
    cursor: grabbing;
  }

  .item-icon {
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-primary);
    border-radius: var(--radius-sm);
    color: var(--color-accent);
  }

  .item-icon :global(svg) {
    flex-shrink: 0;
  }

  .item-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .item-label {
    font-size: 13px;
    font-weight: 500;
  }

  .item-desc {
    font-size: 11px;
    color: var(--color-text-secondary);
  }

  .help-text {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-sm);
    font-size: 11px;
    color: var(--color-text-muted);
    text-align: center;
    border-top: 1px solid var(--color-border);
  }
</style>
