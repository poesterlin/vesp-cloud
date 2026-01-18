<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import EntityPicker from "./EntityPicker.svelte";
  import IconSearcher from "./IconSearcher.svelte";
  import ActionEditor from "./ActionEditor.svelte";
  import type { ActionBinding } from "@esphome-designer/schema";

  // Get selected component
  const selectedComponent = $derived(
    selectionStore.firstSelectedId
      ? projectStore.getComponent(selectionStore.firstSelectedId)
      : null,
  );

  function updateProperty(key: string, value: unknown) {
    if (!selectedComponent) return;
    historyStore.record(`Update ${key}`);
    projectStore.updateComponent(selectedComponent.id, { [key]: value });
  }

  function updatePosition(axis: "x" | "y", value: number) {
    if (!selectedComponent) return;
    historyStore.record("Move component");
    projectStore.updateComponent(selectedComponent.id, {
      position: {
        ...selectedComponent.position,
        [axis]: value,
      },
    });
  }

  function updateSize(dim: "width" | "height", value: number) {
    if (!selectedComponent?.size) return;
    historyStore.record("Resize component");
    projectStore.updateComponent(selectedComponent.id, {
      size: {
        ...selectedComponent.size,
        [dim]: value,
      },
    });
  }
</script>

<div class="property-editor">
  <!-- Detail View specific properties -->
  {#if projectStore.viewMode === "detail" && projectStore.currentDetailView && !selectedComponent && projectStore.display}
    <h3>Detail View Properties</h3>
    <div class="property-section">
      <div class="field">
        <span class="field-label">Title</span>
        <input
          type="text"
          value={projectStore.currentDetailView.title}
          oninput={(e) =>
            projectStore.updateDetailView(projectStore.currentDetailView!.id, {
              title: e.currentTarget.value,
            })}
        />
      </div>
      <div class="field">
        <span class="field-label">Height</span>
        <input
          type="number"
          min={projectStore.display.height}
          step={10}
          value={projectStore.currentDetailView.height}
          oninput={(e) =>
            projectStore.updateDetailView(projectStore.currentDetailView!.id, {
              height:
                parseInt(e.currentTarget.value) || projectStore.display!.height,
            })}
        />
      </div>
    </div>
  {/if}

  {#if selectedComponent}
    <h3>Properties</h3>

    <div class="property-section">
      <label class="section-label">Component</label>
      <div class="field">
        <span class="field-label">Type</span>
        <span class="field-value">{selectedComponent.type}</span>
      </div>
      <div class="field">
        <span class="field-label">ID</span>
        <input
          type="text"
          value={selectedComponent.id}
          readonly
          class="readonly"
        />
      </div>
    </div>

    <div class="property-section">
      <label class="section-label">Position</label>
      <div class="field-row">
        <div class="field">
          <span class="field-label">X</span>
          <input
            type="number"
            value={selectedComponent.position.x}
            oninput={(e) =>
              updatePosition("x", parseInt(e.currentTarget.value) || 0)}
          />
        </div>
        <div class="field">
          <span class="field-label">Y</span>
          <input
            type="number"
            value={selectedComponent.position.y}
            oninput={(e) =>
              updatePosition("y", parseInt(e.currentTarget.value) || 0)}
          />
        </div>
      </div>
    </div>

    {#if selectedComponent.size}
      <div class="property-section">
        <label class="section-label">Size</label>
        <div class="field-row">
          <div class="field">
            <span class="field-label">W</span>
            <input
              type="number"
              value={selectedComponent.size.width}
              oninput={(e) =>
                updateSize("width", parseInt(e.currentTarget.value) || 10)}
            />
          </div>
          <div class="field">
            <span class="field-label">H</span>
            <input
              type="number"
              value={selectedComponent.size.height}
              oninput={(e) =>
                updateSize("height", parseInt(e.currentTarget.value) || 10)}
            />
          </div>
        </div>
      </div>
    {/if}

    <!-- Type-specific properties -->
    {#if selectedComponent.type === "text"}
      <div class="property-section">
        <label class="section-label">Text</label>
        <div class="field">
          <span class="field-label">Content</span>
          <input
            type="text"
            value={(selectedComponent as any).text ?? ""}
            oninput={(e) => updateProperty("text", e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <span class="field-label">Size</span>
          <select
            value={(selectedComponent as any).fontSize ?? "medium"}
            onchange={(e) => updateProperty("fontSize", e.currentTarget.value)}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
        <div class="field">
          <span class="field-label">Align</span>
          <select
            value={(selectedComponent as any).align ?? "left"}
            onchange={(e) => updateProperty("align", e.currentTarget.value)}
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>
      </div>
    {/if}

    {#if selectedComponent.type === "button"}
      <div class="property-section">
        <label class="section-label">Button</label>
        <div class="field">
          <span class="field-label">Label</span>
          <input
            type="text"
            value={(selectedComponent as any).label ?? ""}
            oninput={(e) => updateProperty("label", e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <span class="field-label">Icon</span>
          <input
            type="text"
            value={(selectedComponent as any).icon ?? ""}
            placeholder="mdi:icon-name"
            oninput={(e) => updateProperty("icon", e.currentTarget.value)}
          />
        </div>
      </div>
    {/if}

    {#if selectedComponent.type === "slider"}
      <div class="property-section">
        <label class="section-label">Slider</label>
        <div class="field-row">
          <div class="field">
            <span class="field-label">Min</span>
            <input
              type="number"
              value={(selectedComponent as any).min ?? 0}
              oninput={(e) =>
                updateProperty("min", parseFloat(e.currentTarget.value) || 0)}
            />
          </div>
          <div class="field">
            <span class="field-label">Max</span>
            <input
              type="number"
              value={(selectedComponent as any).max ?? 100}
              oninput={(e) =>
                updateProperty("max", parseFloat(e.currentTarget.value) || 100)}
            />
          </div>
        </div>
        <div class="field">
          <span class="field-label">Orientation</span>
          <select
            value={(selectedComponent as any).orientation ?? "horizontal"}
            onchange={(e) =>
              updateProperty("orientation", e.currentTarget.value)}
          >
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </div>
      </div>

      <div class="property-section">
        <label class="section-label">Slider Actions</label>
        <ActionEditor
          label="On Change"
          action={(selectedComponent as any).onChange as ActionBinding | undefined}
          onUpdate={(action) => updateProperty("onChange", action)}
        />
      </div>
    {/if}

    {#if selectedComponent.type === "gauge"}
      <div class="property-section">
        <label class="section-label">Gauge</label>
        <div class="field-row">
          <div class="field">
            <span class="field-label">Min</span>
            <input
              type="number"
              value={(selectedComponent as any).min ?? 0}
              oninput={(e) =>
                updateProperty("min", parseFloat(e.currentTarget.value) || 0)}
            />
          </div>
          <div class="field">
            <span class="field-label">Max</span>
            <input
              type="number"
              value={(selectedComponent as any).max ?? 100}
              oninput={(e) =>
                updateProperty("max", parseFloat(e.currentTarget.value) || 100)}
            />
          </div>
        </div>
        <div class="field">
          <span class="field-label">Unit</span>
          <input
            type="text"
            value={(selectedComponent as any).unit ?? ""}
            placeholder="e.g. %"
            oninput={(e) => updateProperty("unit", e.currentTarget.value)}
          />
        </div>
      </div>
    {/if}

    {#if selectedComponent.type === "icon"}
      <div class="property-section">
        <label class="section-label">Icon</label>
        <div class="field">
          <span class="field-label">Icon</span>
          <IconSearcher
            value={(selectedComponent as any).icon ?? ""}
            onSelect={(icon) => updateProperty("icon", icon)}
          />
        </div>
        <div class="field">
          <span class="field-label">Scale</span>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="5"
            value={(selectedComponent as any).scale ?? 1}
            oninput={(e) =>
              updateProperty("scale", parseFloat(e.currentTarget.value) || 1)}
          />
        </div>
      </div>
    {/if}

    <!-- Entity Binding -->
    <div class="property-section">
      <label class="section-label">Entity Binding</label>
      <EntityPicker
        component={selectedComponent}
        onUpdate={(binding) => {
          if (selectedComponent.type === "text") {
            updateProperty("textBinding", binding);
          } else {
            updateProperty("valueBinding", binding);
          }
        }}
      />
    </div>

    <!-- Actions section for all components except sliders (which have onChange) -->
    {#if selectedComponent.type !== "slider"}
      <div class="property-section">
        <label class="section-label">Actions</label>
        <ActionEditor
          label="On Tap"
          action={(selectedComponent as any).onTap as ActionBinding | undefined}
          onUpdate={(action) => updateProperty("onTap", action)}
        />
      </div>
    {/if}
  {:else}
    <div class="no-selection">
      <p>Select a component to edit its properties</p>
    </div>
  {/if}
</div>

<style>
  .property-editor {
    padding: var(--spacing-md);
  }

  h3 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-md);
  }

  .property-section {
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
  }

  .section-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-sm);
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
  }

  .field-row {
    display: flex;
    gap: var(--spacing-sm);
    flex-direction: column;
  }

  .field-row .field {
    flex: 1;
  }

  .field-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    min-width: 50px;
  }

  .field-value {
    font-size: 12px;
    color: var(--color-text-primary);
    text-transform: capitalize;
  }

  input,
  select {
    flex: 1;
    min-width: 0;
  }

  input.readonly {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .no-selection {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-text-muted);
  }

  .no-selection p {
    font-size: 13px;
  }
</style>
