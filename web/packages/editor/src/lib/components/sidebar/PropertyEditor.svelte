<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import EntityPicker from "./EntityPicker.svelte";
  import IconSearcher from "./IconSearcher.svelte";
  import ActionEditor from "./ActionEditor.svelte";
  import ConditionEditor from "./ConditionEditor.svelte";
  import ColorPicker from "./ColorPicker.svelte";
  import { conditionalEditorStore } from "$lib/stores/conditional-editor.svelte";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import { describeCondition } from "$lib/utils/condition-utils";
  import type { ActionBinding } from "@esphome-designer/schema";

  // Get selected component
  const selectedComponent = $derived(
    selectionStore.firstSelectedId
      ? projectStore.getComponent(selectionStore.firstSelectedId)
      : null,
  );

  const selectedAutoLayoutComponent = $derived<any>(
    selectedComponent && (selectedComponent as any).type === "auto_layout_list"
      ? (selectedComponent as any)
      : null,
  );

  const activeVariantId = $derived(
    selectedComponent?.type === "conditional_area"
      ? conditionalEditorStore.getActiveVariant(selectedComponent.id, selectedComponent.variants[0]?.id)
      : null
  );

  const activeVariant = $derived(
    selectedComponent?.type === "conditional_area" && activeVariantId
      ? selectedComponent.variants.find(v => v.id === activeVariantId)
      : null
  );

  const activeTabId = $derived(
    selectedComponent?.type === "tab_container"
      ? conditionalEditorStore.getActiveTab(selectedComponent.id, selectedComponent.defaultTabId ?? selectedComponent.tabs[0]?.id)
      : null
  );

  const activeTab = $derived(
    selectedComponent?.type === "tab_container" && activeTabId
      ? selectedComponent.tabs.find((t) => t.id === activeTabId)
      : null
  );

  let activeAutoLayoutItemId = $state<string | null>(null);

  const activeAutoLayoutItem = $derived(
    selectedAutoLayoutComponent
      ? (selectedAutoLayoutComponent.items.find((item: any) => item.id === activeAutoLayoutItemId) ?? selectedAutoLayoutComponent.items[0] ?? null)
      : null,
  );

  $effect(() => {
    if (!selectedAutoLayoutComponent) {
      activeAutoLayoutItemId = null;
      return;
    }

    const selectedExists = selectedAutoLayoutComponent.items.some((item: any) => item.id === activeAutoLayoutItemId);
    if (!selectedExists) {
      activeAutoLayoutItemId = selectedAutoLayoutComponent.items[0]?.id ?? null;
    }
  });

  function updateVariant(updates: any) {
    if (!selectedComponent || !activeVariantId) return;
    projectStore.updateVariant(selectedComponent.id, activeVariantId, updates);
  }

  function updateTab(updates: any) {
    if (!selectedComponent || !activeTabId) return;
    projectStore.updateTab(selectedComponent.id, activeTabId, updates);
  }


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

  function updateAutoLayoutItem(itemId: string, patch: Record<string, unknown>) {
    if (!selectedAutoLayoutComponent) return;
    historyStore.record("Update auto layout item");
    (projectStore as any).updateAutoLayoutItem(selectedAutoLayoutComponent.id, itemId, patch);
  }

  function addAutoLayoutItem() {
    if (!selectedAutoLayoutComponent) return;
    historyStore.record("Add auto layout item");
    const newItem = (projectStore as any).addAutoLayoutItem(selectedAutoLayoutComponent.id);
    if (newItem) activeAutoLayoutItemId = newItem.id;
  }

  function duplicateAutoLayoutItem(itemId: string) {
    if (!selectedAutoLayoutComponent) return;
    const item = selectedAutoLayoutComponent.items.find((entry: any) => entry.id === itemId);
    if (!item) return;
    historyStore.record("Duplicate auto layout item");
    const duplicated = (projectStore as any).addAutoLayoutItem(selectedAutoLayoutComponent.id);
    if (!duplicated) return;
    (projectStore as any).updateAutoLayoutItem(selectedAutoLayoutComponent.id, duplicated.id, {
      name: `${item.name} Copy`,
      icon: item.icon,
      color: item.color,
      scale: item.scale,
      condition: item.condition,
    });
    activeAutoLayoutItemId = duplicated.id;
  }

  function deleteAutoLayoutItem(itemId: string) {
    if (!selectedAutoLayoutComponent) return;
    if (selectedAutoLayoutComponent.items.length <= 1) return;
    historyStore.record("Delete auto layout item");
    (projectStore as any).deleteAutoLayoutItem(selectedAutoLayoutComponent.id, itemId);
  }

  function reorderAutoLayoutItem(itemId: string, direction: "up" | "down") {
    if (!selectedAutoLayoutComponent) return;
    historyStore.record(`Move auto layout item ${direction}`);
    (projectStore as any).reorderAutoLayoutItem(selectedAutoLayoutComponent.id, itemId, direction);
  }

  function pickLightEntityForDevice(deviceId: string): string | undefined {
    const entities = homeAssistantStore.getEntitiesByDevice(deviceId);
    const preferred = entities.find((entity) => entity.domain === "light");
    if (preferred) return preferred.entity_id;

    const fallback = entities.find((entity) =>
      ["switch", "binary_sensor", "input_boolean", "fan"].includes(entity.domain),
    );
    return fallback?.entity_id;
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
    <h3>{selectedComponent.type} Properties</h3>

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

      <div class="property-section">
        <label class="section-label">Styling</label>
        <ColorPicker
          label="Text Color"
          value={(selectedComponent as any).color}
          onUpdate={(color) => updateProperty("color", color)}
        />
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
          <!-- <input
            type="text"
            value={(selectedComponent as any).icon ?? ""}
            placeholder="mdi:icon-name"
            oninput={(e) => updateProperty("icon", e.currentTarget.value)}
          /> -->
           <IconSearcher
            value={(selectedComponent as any).icon ?? ""}
            onSelect={(icon) => updateProperty("icon", icon)}
          />
        </div>
      </div>

      <div class="property-section">
        <label class="section-label">Styling</label>
        <ColorPicker
          label="Background"
          value={(selectedComponent as any).backgroundColor}
          onUpdate={(color) => updateProperty("backgroundColor", color)}
        />
        <ColorPicker
          label="Foreground"
          value={(selectedComponent as any).foregroundColor}
          onUpdate={(color) => updateProperty("foregroundColor", color)}
        />
        <ColorPicker
          label="Border"
          value={(selectedComponent as any).borderColor}
          onUpdate={(color) => updateProperty("borderColor", color)}
        />
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
        <label class="section-label">Styling</label>
        <ColorPicker
          label="Track"
          value={(selectedComponent as any).trackColor}
          onUpdate={(color) => updateProperty("trackColor", color)}
        />
        <ColorPicker
          label="Fill"
          value={(selectedComponent as any).fillColor}
          onUpdate={(color) => updateProperty("fillColor", color)}
        />
        <ColorPicker
          label="Handle"
          value={(selectedComponent as any).handleColor}
          onUpdate={(color) => updateProperty("handleColor", color)}
        />
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

      <div class="property-section">
        <label class="section-label">Styling</label>
        <ColorPicker
          label="Background"
          value={(selectedComponent as any).backgroundColor}
          onUpdate={(color) => updateProperty("backgroundColor", color)}
        />
        <ColorPicker
          label="Needle"
          value={(selectedComponent as any).needleColor}
          onUpdate={(color) => updateProperty("needleColor", color)}
        />
        <ColorPicker
          label="Value"
          value={(selectedComponent as any).valueColor}
          onUpdate={(color) => updateProperty("valueColor", color)}
        />
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

      <div class="property-section">
        <label class="section-label">Styling</label>
        <ColorPicker
          label="Color"
          value={(selectedComponent as any).color}
          onUpdate={(color) => updateProperty("color", color)}
        />
      </div>
    {/if}

    {#if selectedComponent.type === "procedural_icon"}
      <div class="property-section">
        <label class="section-label">Procedural Icon</label>
        <div class="field">
          <span class="field-label">Type</span>
          <select
            value={(selectedComponent as any).iconType ?? "bulb"}
            onchange={(e) => updateProperty("iconType", e.currentTarget.value)}
          >
            <option value="bulb">Bulb</option>
            <option value="window">Window</option>
            <option value="vacuum">Vacuum</option>
            <option value="climate">Climate</option>
          </select>
        </div>
      </div>
      <div class="property-section">
        <label class="section-label">Styling</label>
        <ColorPicker
          label="Color"
          value={(selectedComponent as any).color}
          onUpdate={(color) => updateProperty("color", color)}
        />
      </div>
    {/if}

    {#if selectedComponent.type === "image"}
      <div class="property-section">
        <label class="section-label">Image</label>
        <div class="field">
          <span class="field-label">File</span>
          <input
            type="text"
            value={(selectedComponent as any).file ?? ""}
            oninput={(e) => updateProperty("file", e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <span class="field-label">Type</span>
          <select
            value={(selectedComponent as any).image_type ?? "BINARY"}
            onchange={(e) => updateProperty("image_type", e.currentTarget.value)}
          >
            <option value="BINARY">Binary</option>
            <option value="GRAYSCALE">Grayscale</option>
            <option value="RGB565">RGB565</option>
            <option value="RGB">RGB</option>
          </select>
        </div>
      </div>
      {#if (selectedComponent as any).image_type === "BINARY"}
        <div class="property-section">
          <label class="section-label">Binary Image Styling</label>
          <ColorPicker
            label="Foreground"
            value={(selectedComponent as any).foregroundColor}
            onUpdate={(color) => updateProperty("foregroundColor", color)}
          />
          <ColorPicker
            label="Background"
            value={(selectedComponent as any).backgroundColor}
            onUpdate={(color) => updateProperty("backgroundColor", color)}
          />
        </div>
      {/if}
    {/if}

    {#if selectedComponent.type === "container"}
      <div class="property-section">
        <label class="section-label">Container</label>
        <div class="field">
          <span class="field-label">Label</span>
          <input
            type="text"
            value={(selectedComponent as any).label ?? ""}
            oninput={(e) => updateProperty("label", e.currentTarget.value)}
          />
        </div>
      </div>
      <div class="property-section">
        <label class="section-label">Styling</label>
        <ColorPicker
          label="Background"
          value={(selectedComponent as any).backgroundColor}
          onUpdate={(color) => updateProperty("backgroundColor", color)}
        />
      </div>
    {/if}

    {#if selectedComponent.type === "todo_list"}
      <div class="property-section">
        <label class="section-label">To-Do List</label>
        <div class="field">
          <span class="field-label">Rows</span>
          <input
            type="number"
            min="1"
            max="10"
            value={selectedComponent.maxItems ?? 4}
            oninput={(e) =>
              updateProperty(
                "maxItems",
                Math.max(1, Math.min(10, parseInt(e.currentTarget.value) || 4)),
              )}
          />
        </div>
        <div class="field">
          <span class="field-label">Row Height</span>
          <input
            type="number"
            min="20"
            max="80"
            value={selectedComponent.rowHeight ?? 30}
            oninput={(e) =>
              updateProperty(
                "rowHeight",
                Math.max(20, Math.min(80, parseInt(e.currentTarget.value) || 30)),
              )}
          />
        </div>
        <div class="field">
          <span class="field-label">Scrollable</span>
          <input
            type="checkbox"
            checked={selectedComponent.scrollable === true}
            onchange={(e) => updateProperty("scrollable", e.currentTarget.checked)}
          />
        </div>
        <div class="field">
          <span class="field-label">Checkable</span>
          <input
            type="checkbox"
            checked={selectedComponent.checkable === true}
            onchange={(e) => updateProperty("checkable", e.currentTarget.checked)}
          />
        </div>
        {#if selectedComponent.checkable === true}
          <div class="field">
            <span class="field-label">Todo Entity</span>
            <EntityPicker
              component={{
                type: "procedural_icon",
                stateBinding: selectedComponent.todoEntityId
                  ? { entityId: selectedComponent.todoEntityId }
                  : undefined,
              }}
              onUpdate={(binding) => updateProperty("todoEntityId", binding?.entityId)}
            />
          </div>
        {/if}
      </div>
    {/if}

    {#if selectedComponent.type === "light_state"}
      <div class="property-section">
        <label class="section-label">Light State</label>
        <div class="field">
          <span class="field-label">Label</span>
          <input
            type="text"
            value={selectedComponent.label ?? ""}
            oninput={(e) => updateProperty("label", e.currentTarget.value)}
          />
        </div>
        <div class="field-row">
          <div class="field">
            <span class="field-label">On Text</span>
            <input
              type="text"
              value={selectedComponent.onText ?? "ON"}
              oninput={(e) => updateProperty("onText", e.currentTarget.value)}
            />
          </div>
          <div class="field">
            <span class="field-label">Off Text</span>
            <input
              type="text"
              value={selectedComponent.offText ?? "OFF"}
              oninput={(e) => updateProperty("offText", e.currentTarget.value)}
            />
          </div>
        </div>
        <div class="field">
          <span class="field-label">Show Icon</span>
          <input
            type="checkbox"
            checked={selectedComponent.showIcon !== false}
            onchange={(e) => updateProperty("showIcon", e.currentTarget.checked)}
          />
        </div>
        {#if selectedComponent.showIcon !== false}
          <div class="field">
            <span class="field-label">Icon</span>
            <IconSearcher
              value={selectedComponent.icon ?? "lightbulb"}
              onSelect={(icon) => updateProperty("icon", icon || "lightbulb")}
            />
          </div>
        {/if}
        <div class="field">
          <span class="field-label">Brightness</span>
          <input
            type="checkbox"
            checked={selectedComponent.showBrightnessControl === true}
            onchange={(e) => updateProperty("showBrightnessControl", e.currentTarget.checked)}
          />
        </div>
      </div>

      <div class="property-section">
        <label class="section-label">Binding</label>
        <div class="field-group">
          <label class="group-label">Entity Target</label>
          <EntityPicker
            component={selectedComponent}
            onUpdate={(binding) => {
              updateProperty("stateBinding", binding);
              if (binding) updateProperty("targetDevice", undefined);
            }}
          />
        </div>
        <!-- <div class="field-group">
          <label class="group-label">Device Target</label>
          <EntityPicker
            component={selectedComponent}
            deviceOnly={true}
            onDeviceSelect={(device) => {
              updateProperty("targetDevice", device);
              if (!device) {
                updateProperty("stateBinding", undefined);
                return;
              }
              const autoEntityId = pickLightEntityForDevice(device.deviceId);
              if (autoEntityId) {
                updateProperty("stateBinding", { entityId: autoEntityId });
              }
            }}
          />
        </div> -->
      </div>

      <!-- <div class="property-section">
        <label class="section-label">Styling</label>
        <ColorPicker
          label="On Color"
          value={selectedComponent.onColor}
          onUpdate={(color) => updateProperty("onColor", color)}
        />
        <ColorPicker
          label="Off Color"
          value={selectedComponent.offColor}
          onUpdate={(color) => updateProperty("offColor", color)}
        />
      </div> -->
    {/if}

    {#if selectedAutoLayoutComponent}
      <div class="property-section">
        <label class="section-label">Layout</label>
        <div class="field">
          <span class="field-label">Direction</span>
          <select
            value={selectedAutoLayoutComponent.direction ?? "horizontal"}
            onchange={(e) => updateProperty("direction", e.currentTarget.value)}
          >
            <option value="horizontal">Horizontal</option>
            <option value="vertical">Vertical</option>
          </select>
        </div>
        <div class="field">
          <span class="field-label">Gap</span>
          <input
            type="number"
            min="0"
            max="64"
            value={selectedAutoLayoutComponent.gap ?? 6}
            oninput={(e) => updateProperty("gap", Math.max(0, Math.min(64, parseInt(e.currentTarget.value) || 0)))}
          />
        </div>
        <div class="field">
          <span class="field-label">Padding</span>
          <input
            type="number"
            min="0"
            max="64"
            value={selectedAutoLayoutComponent.padding ?? 0}
            oninput={(e) => updateProperty("padding", Math.max(0, Math.min(64, parseInt(e.currentTarget.value) || 0)))}
          />
        </div>
        <div class="field">
          <span class="field-label">Cross Align</span>
          <select
            value={selectedAutoLayoutComponent.crossAxisAlign ?? "center"}
            onchange={(e) => updateProperty("crossAxisAlign", e.currentTarget.value)}
          >
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
            <option value="stretch">Stretch</option>
          </select>
        </div>
        <div class="field">
          <span class="field-label">Main Align</span>
          <select
            value={selectedAutoLayoutComponent.mainAxisJustify ?? "start"}
            onchange={(e) => updateProperty("mainAxisJustify", e.currentTarget.value)}
          >
            <option value="start">Start</option>
            <option value="center">Center</option>
            <option value="end">End</option>
            <option value="space_between">Space Between</option>
          </select>
        </div>
      </div>

      <div class="property-section">
        <label class="section-label">Items</label>
        <div class="variant-tabs-row">
          {#each selectedAutoLayoutComponent.items as item, index}
            <button
              class="variant-pill"
              class:active={item.id === activeAutoLayoutItem?.id}
              onclick={() => (activeAutoLayoutItemId = item.id)}
              title={item.condition ? describeCondition(item.condition) : "Always visible"}
            >
              {index + 1}. {item.name}
            </button>
          {/each}
          <button class="variant-pill add-pill" onclick={addAutoLayoutItem}>+</button>
        </div>
      </div>

      {#if activeAutoLayoutItem}
        <div class="property-section">
          <label class="section-label">Selected Item</label>
          <div class="field">
            <span class="field-label">Name</span>
            <input
              type="text"
              value={activeAutoLayoutItem.name}
              oninput={(e) => updateAutoLayoutItem(activeAutoLayoutItem.id, { name: e.currentTarget.value })}
            />
          </div>
          <div class="field">
            <span class="field-label">Icon</span>
            <IconSearcher
              value={activeAutoLayoutItem.icon ?? ""}
              onSelect={(icon) => updateAutoLayoutItem(activeAutoLayoutItem.id, { icon })}
            />
          </div>
          <div class="field">
            <span class="field-label">Scale</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="5"
              value={activeAutoLayoutItem.scale ?? 1}
              oninput={(e) => updateAutoLayoutItem(activeAutoLayoutItem.id, { scale: Math.max(0.1, Math.min(5, parseFloat(e.currentTarget.value) || 1)) })}
            />
          </div>
          <ColorPicker
            label="Color"
            value={activeAutoLayoutItem.color}
            onUpdate={(color) => updateAutoLayoutItem(activeAutoLayoutItem.id, { color })}
          />

          <div class="field-group">
            <label class="group-label">Condition</label>
            <ConditionEditor
              condition={activeAutoLayoutItem.condition}
              onUpdate={(condition) => updateAutoLayoutItem(activeAutoLayoutItem.id, { condition })}
            />
          </div>

          <div class="variant-tabs-row auto-item-actions">
            <button class="variant-pill" onclick={() => reorderAutoLayoutItem(activeAutoLayoutItem.id, "up")}>Up</button>
            <button class="variant-pill" onclick={() => reorderAutoLayoutItem(activeAutoLayoutItem.id, "down")}>Down</button>
            <button class="variant-pill" onclick={() => duplicateAutoLayoutItem(activeAutoLayoutItem.id)}>Duplicate</button>
            <button
              class="variant-pill"
              onclick={() => deleteAutoLayoutItem(activeAutoLayoutItem.id)}
              disabled={selectedAutoLayoutComponent.items.length <= 1}
            >Delete</button>
          </div>
        </div>
      {/if}
    {/if}

    {#if selectedComponent.type === "conditional_area"}
      <div class="property-section">
        <label class="section-label">Variants</label>
        <div class="variant-tabs-row">
          {#each selectedComponent.variants as variant}
            <button
              class="variant-pill"
              class:active={variant.id === activeVariantId}
              onclick={() => conditionalEditorStore.setActiveVariant(selectedComponent.id, variant.id)}
              title={describeCondition(variant.condition)}
            >
              {variant.name}
            </button>
          {/each}
          <button
            class="variant-pill add-pill"
            onclick={() => projectStore.addVariant(selectedComponent.id)}
            title="Add variant"
          >+</button>
        </div>
      </div>

      {#if activeVariant}
        <div class="property-section">
          <div class="variant-header">
            <input
              class="variant-name-input"
              type="text"
              value={activeVariant.name}
              oninput={(e) => updateVariant({ name: e.currentTarget.value })}
            />
            <button
              class="delete-variant-btn"
              onclick={() => projectStore.deleteVariant(selectedComponent.id, activeVariant.id)}
              disabled={selectedComponent.variants.length <= 1}
              title="Delete variant"
            >×</button>
          </div>

          <div class="field-group">
            <label class="group-label">Condition</label>
            <ConditionEditor
              condition={activeVariant.condition}
              onUpdate={(condition) => updateVariant({ condition })}
            />
          </div>

          {#if selectedComponent.evaluationMode === "priority"}
            <div class="field">
              <span class="field-label">Priority</span>
              <input
                type="number"
                value={activeVariant.priority ?? 0}
                oninput={(e) => updateVariant({ priority: parseInt(e.currentTarget.value) || 0 })}
              />
            </div>
          {/if}
        </div>
      {/if}

      <div class="property-section">
        <label class="section-label">Settings</label>
        <div class="field">
          <span class="field-label">Mode</span>
          <select
            value={selectedComponent.evaluationMode ?? "first_match"}
            onchange={(e) => updateProperty("evaluationMode", e.currentTarget.value)}
          >
            <option value="first_match">First Match</option>
            <option value="priority">By Priority</option>
          </select>
        </div>
        <div class="field">
           <span class="field-label">Clip</span>
           <input
             type="checkbox"
             checked={selectedComponent.clipContent !== false}
             onchange={(e) => updateProperty("clipContent", e.currentTarget.checked)}
           />
        </div>
      </div>
    {/if}

    {#if selectedComponent.type === "tab_container"}
      <div class="property-section">
        <label class="section-label">Tabs</label>
        <div class="variant-tabs-row">
          {#each selectedComponent.tabs as tab}
            <button
              class="variant-pill"
              class:active={tab.id === activeTabId}
              onclick={() => conditionalEditorStore.setActiveTab(selectedComponent.id, tab.id)}
              title={tab.name}
            >
              {tab.name}
            </button>
          {/each}
          <button
            class="variant-pill add-pill"
            onclick={() => projectStore.addTab(selectedComponent.id)}
            title="Add tab"
          >+</button>
        </div>
      </div>

      {#if activeTab}
        <div class="property-section">
          <div class="variant-header">
            <input
              class="variant-name-input"
              type="text"
              value={activeTab.name}
              oninput={(e) => updateTab({ name: e.currentTarget.value })}
            />
            <button
              class="delete-variant-btn"
              onclick={() => projectStore.deleteTab(selectedComponent.id, activeTab.id)}
              disabled={selectedComponent.tabs.length <= 1}
              title="Delete tab"
            >x</button>
          </div>

          <div class="field">
            <span class="field-label">Default</span>
            <input
              type="checkbox"
              checked={selectedComponent.defaultTabId === activeTab.id || (!selectedComponent.defaultTabId && selectedComponent.tabs[0]?.id === activeTab.id)}
              onchange={(e) =>
                updateProperty(
                  "defaultTabId",
                  e.currentTarget.checked ? activeTab.id : undefined,
                )}
            />
          </div>
        </div>
      {/if}

      <div class="property-section">
        <label class="section-label">Settings</label>
        <div class="field">
          <span class="field-label">Clip</span>
          <input
            type="checkbox"
            checked={selectedComponent.clipContent !== false}
            onchange={(e) => updateProperty("clipContent", e.currentTarget.checked)}
          />
        </div>
      </div>
    {/if}

    <!-- Entity Binding (only for components that display entity values) -->
    {#if selectedComponent.type === "text" || selectedComponent.type === "slider" || selectedComponent.type === "gauge" || selectedComponent.type === "procedural_icon" || selectedComponent.type === "todo_list"}
      <div class="property-section">
        <label class="section-label">Entity Binding</label>
        <EntityPicker
          component={selectedComponent}
          numericOnly={selectedComponent.type === "slider" || selectedComponent.type === "gauge"}
          onUpdate={(binding) => {
            if (selectedComponent.type === "text") {
              updateProperty("textBinding", binding);
            } else if (selectedComponent.type === "procedural_icon") {
              updateProperty("stateBinding", binding);
            } else if (selectedComponent.type === "todo_list") {
              updateProperty("itemsBinding", binding);
            } else {
              updateProperty("valueBinding", binding);
            }
          }}
        />
      </div>
    {/if}

    <!-- Actions section for components with configurable tap actions -->
    {#if selectedComponent.type !== "slider" && selectedComponent.type !== "light_state"}
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
    {#if projectStore.viewMode === "dashboard"}
      <div class="property-section">
        <label class="section-label">Page Header</label>
        <div class="field">
          <span class="field-label">Enabled</span>
          <input
            type="checkbox"
            checked={!!projectStore.pageHeader}
            onchange={(e) => {
              if (e.currentTarget.checked) {
                projectStore.enablePageHeader();
              } else {
                projectStore.disablePageHeader();
              }
            }}
          />
        </div>
        {#if projectStore.pageHeader}
          <div class="field">
            <span class="field-label">Height</span>
            <input
              type="number"
              min={20}
              max={projectStore.display?.height ? Math.floor(projectStore.display.height / 2) : 160}
              step={1}
              value={projectStore.pageHeader.height}
              oninput={(e) => {
                const val = parseInt(e.currentTarget.value);
                if (val > 0) {
                  projectStore.updatePageHeader({ height: val });
                }
              }}
            />
          </div>
          <ColorPicker
            label="Background"
            value={projectStore.pageHeader.backgroundColor}
            onUpdate={(color) => projectStore.updatePageHeader({ backgroundColor: color })}
          />
        {/if}
      </div>
    {/if}
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

  .variant-tabs-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .variant-pill {
    padding: 4px 8px;
    font-size: 10px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    color: var(--color-text-secondary);
    cursor: pointer;
    white-space: nowrap;
  }

  .variant-pill:hover {
    border-color: var(--color-accent-secondary);
  }

  .variant-pill.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: white;
  }

  .auto-item-actions .variant-pill {
    background: var(--color-bg-primary);
    border-color: var(--color-accent-secondary);
    color: var(--color-text-primary);
    font-weight: 600;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-accent-secondary) 30%, transparent);
  }

  .auto-item-actions {
    margin-top: var(--spacing-md);
  }

  .auto-item-actions .variant-pill:hover {
    background: color-mix(in srgb, var(--color-accent) 24%, var(--color-bg-primary));
    border-color: var(--color-accent);
    color: white;
  }

  .auto-item-actions .variant-pill:last-child {
    border-color: var(--color-error);
    color: color-mix(in srgb, var(--color-error) 80%, white);
  }

  .auto-item-actions .variant-pill:last-child:hover:not(:disabled) {
    background: color-mix(in srgb, var(--color-error) 24%, var(--color-bg-primary));
    border-color: var(--color-error);
    color: white;
  }

  .variant-pill.add-pill {
    background: transparent;
    border-style: dashed;
    color: var(--color-text-muted);
  }

  .variant-pill.add-pill:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .variant-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-sm);
  }

  .variant-name-input {
    flex: 1;
    font-size: 12px;
    font-weight: 600;
    padding: 4px 8px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
  }

  .variant-name-input:focus {
    border-color: var(--color-accent);
    outline: none;
  }

  .delete-variant-btn {
    background: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 14px;
  }

  .delete-variant-btn:hover:not(:disabled) {
    border-color: var(--color-error);
    color: var(--color-error);
  }

  .delete-variant-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .field-group {
    margin-top: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .group-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
</style>
