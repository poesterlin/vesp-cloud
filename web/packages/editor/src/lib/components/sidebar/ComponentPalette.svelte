<script lang="ts">
  interface ComponentTemplate {
    type: string;
    label: string;
    icon: string;
    description: string;
  }

  const components: ComponentTemplate[] = [
    { type: "text", label: "Text", icon: "T", description: "Display text or entity value" },
    { type: "button", label: "Button", icon: "B", description: "Tap to trigger action" },
    { type: "slider", label: "Slider", icon: "S", description: "Adjust numeric value" },
    { type: "gauge", label: "Gauge", icon: "G", description: "Visual meter display" },
    { type: "icon", label: "Icon", icon: "I", description: "MDI icon display" },
  ];

  function handleDragStart(e: DragEvent, type: string) {
    if (e.dataTransfer) {
      e.dataTransfer.setData("component-type", type);
      e.dataTransfer.effectAllowed = "copy";
    }
  }
</script>

<div class="palette">
  <h3>Components</h3>

  <div class="component-list">
    {#each components as comp (comp.type)}
      <div
        class="palette-item"
        draggable="true"
        ondragstart={(e) => handleDragStart(e, comp.type)}
        role="button"
        tabindex="0"
      >
        <span class="item-icon">{comp.icon}</span>
        <div class="item-info">
          <span class="item-label">{comp.label}</span>
          <span class="item-desc">{comp.description}</span>
        </div>
      </div>
    {/each}
  </div>

  <div class="help-text">
    Drag components onto the canvas to add them.
  </div>
</div>

<style>
  .palette {
    padding: var(--spacing-md);
  }

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
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-primary);
    border-radius: var(--radius-sm);
    font-weight: bold;
    color: var(--color-accent);
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
    color: var(--color-text-muted);
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
