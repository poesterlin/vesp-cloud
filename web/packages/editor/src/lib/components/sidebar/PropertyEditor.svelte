<script lang="ts">
  import type { NavigationAction } from "@vesp-cloud/schema";
  import { projectStore } from "$lib/stores/project.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import { validationStore } from "$lib/stores/validation.svelte";
  import EntityPicker from "./EntityPicker.svelte";
  import IconSearcher from "./IconSearcher.svelte";
  import ConditionEditor from "./ConditionEditor.svelte";
  import ColorPicker from "./ColorPicker.svelte";
  import LabelTemplateInput from "./LabelTemplateInput.svelte";
  import { conditionalEditorStore } from "$lib/stores/conditional-editor.svelte";
  import { describeCondition } from "$lib/utils/condition-utils";
  import ActionEditor from "./ActionEditor.svelte";
  import { HVAC_MODE_LIST } from "$lib/utils/hvac-modes";
  import { WEATHER_CONDITION_COLORS, colorToCss as weatherColorToCss } from "$lib/utils/weather-conditions";

  const NAV_ICONS: Record<string, string> = {
    OPEN_DETAIL: "mdi:open-in-new",
    GO_BACK: "mdi:arrow-left",
    NEXT_PAGE: "mdi:chevron-right",
    PREV_PAGE: "mdi:chevron-left",
  };

  const NAV_ICON_NAMES = new Set([
    "open-in-new",
    "arrow-left",
    "chevron-right",
    "chevron-left",
  ]);

  const LIGHT_STATE_ALLOWED_DOMAINS = [
    "light",
    "switch",
    "fan",
    "input_boolean",
    "automation",
    "camera",
    "media_player",
  ];

  const CLIMATE_ALLOWED_DOMAINS = [
    "climate",
  ];

  const WEATHER_ALLOWED_DOMAINS = [
    "weather",
  ];

  const CALENDAR_ALLOWED_DOMAINS = [
    "calendar",
  ];

  function getNavIcon(action: NavigationAction): string | undefined {
    return NAV_ICONS[action.type];
  }

  function isNavPresetIcon(icon: string | undefined): boolean {
    if (!icon) return false;
    const name = icon.replace(/^mdi:/, "");
    return NAV_ICON_NAMES.has(name);
  }

  // Get selected component
  const selectedComponent = $derived(
    selectionStore.firstSelectedId
      ? projectStore.getComponent(selectionStore.firstSelectedId)
      : null,
  );

  const componentValidationErrors = $derived(
    selectionStore.firstSelectedId
      ? validationStore.getErrorsForComponent(selectionStore.firstSelectedId)
      : [],
  );

  const selectedAutoLayoutComponent = $derived<any>(
    selectedComponent && selectedComponent.type === "auto_layout_list"
      ? (selectedComponent as any)
      : null,
  );

  const activeVariantId = $derived(
    selectedComponent?.type === "conditional_area"
      ? conditionalEditorStore.getActiveVariant(
          selectedComponent.id,
          selectedComponent.variants[0]?.id,
        )
      : null,
  );

  const activeVariant = $derived(
    selectedComponent?.type === "conditional_area" && activeVariantId
      ? selectedComponent.variants.find((v) => v.id === activeVariantId)
      : null,
  );

  const activeTabId = $derived(
    selectedComponent?.type === "tab_container"
      ? conditionalEditorStore.getActiveTab(
          selectedComponent.id,
          selectedComponent.defaultTabId ?? selectedComponent.tabs[0]?.id,
        )
      : null,
  );

  const activeTab = $derived(
    selectedComponent?.type === "tab_container" && activeTabId
      ? selectedComponent.tabs.find((t) => t.id === activeTabId)
      : null,
  );

  let activeAutoLayoutItemId = $state<string | null>(null);

  $effect(() => {
    if (!selectedAutoLayoutComponent) {
      activeAutoLayoutItemId = null;
      return;
    }

    const selectedExists = selectedAutoLayoutComponent.items.some(
      (item: any) => item.id === activeAutoLayoutItemId,
    );
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

    if (key === "onTap") {
      if (
        value &&
        typeof value === "object" &&
        "type" in value &&
        (value as any).type !== "SERVICE_CALL"
      ) {
        const navAction = value as NavigationAction;
        const comp = selectedComponent as any;
        if (comp.icon === undefined || comp.icon === null || comp.icon === "") {
          const presetIcon = getNavIcon(navAction);
          if (presetIcon) {
            projectStore.updateComponent(comp.id, { icon: presetIcon });
          }
        }
      } else if (value === undefined) {
        const comp = selectedComponent as any;
        if (isNavPresetIcon(comp.icon)) {
          projectStore.updateComponent(comp.id, { icon: undefined });
        }
        projectStore.updateComponent(selectedComponent.id, {
          onHold: undefined,
          onDragStart: undefined,
          onDragEnd: undefined,
          ...(selectedComponent.type === "button"
            ? { pressAction: undefined, holdAction: undefined }
            : {}),
        } as any);
      }
    }
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

  function updateTextContent(text: string) {
    if (!selectedComponent) return;
    historyStore.record("Update text content");
    // Bindings are derived from the `{{...}}` placeholders in `text`
    // at codegen time, so we don't need to persist them separately.
    // Clear the legacy `textBinding` so the new template form is the
    // sole source of truth going forward.
    projectStore.updateComponent(selectedComponent.id, {
      text,
      textBinding: undefined,
    });
  }

  function updateImageSource(source: "static" | "ha") {
    if (!selectedComponent || selectedComponent.type !== "image") return;
    historyStore.record("Update image source");
    projectStore.updateComponent(
      selectedComponent.id,
      source === "static"
        ? { imageSource: "static", imageBinding: undefined }
        : { imageSource: "ha", file: "" },
    );
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

    {#if componentValidationErrors.length > 0}
      <div class="validation-errors">
        {#each componentValidationErrors as err}
          <div class="validation-error">
            <svg class="error-icon" width="14" height="14" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="11" fill="#f44336" />
              <path
                d="M12 7v6M12 15v2"
                stroke="white"
                stroke-width="2.5"
                stroke-linecap="round"
              />
            </svg>
            <span>{err.message}</span>
          </div>
        {/each}
      </div>
    {/if}

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

    {#if selectedComponent.size && selectedComponent.type !== "hvac"}
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
          {#if selectedComponent?.type !== "light_state"}
            <div class="field">
              <span class="field-label">H</span>
              <input
                type="number"
                value={selectedComponent.size.height}
                oninput={(e) =>
                  updateSize("height", parseInt(e.currentTarget.value) || 10)}
              />
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Type-specific properties -->
    {#if selectedComponent.type === "text"}
      <div class="property-section">
        <label class="section-label">Text</label>
        <div class="field">
          <span class="field-label">Content</span>
          <LabelTemplateInput
            value={selectedComponent.text ?? ""}
            onChange={updateTextContent}
          />
        </div>

        <div class="field">
          <span class="field-label">Size</span>
          <select
            value={selectedComponent.fontSize ?? "medium"}
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
            value={selectedComponent.align ?? "left"}
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
          value={selectedComponent.color}
          onUpdate={(color) => updateProperty("color", color)}
        />
      </div>
    {/if}

    {#if selectedComponent.type === "digital_clock"}
      <div class="property-section">
        <label class="section-label">Digital Clock</label>
        <ColorPicker
          label="Clock Color"
          value={selectedComponent.color}
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
            value={selectedComponent.label ?? ""}
            oninput={(e) => updateProperty("label", e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <span class="field-label">Icon</span>
          <IconSearcher
            value={selectedComponent.icon ?? ""}
            onSelect={(icon) => updateProperty("icon", icon)}
          />
        </div>
      </div>

      <div class="property-section">
        <label class="section-label">Styling</label>
        <ColorPicker
          label="Border"
          value={selectedComponent.borderColor}
          onUpdate={(color) => updateProperty("borderColor", color)}
        />
      </div>
    {/if}

    {#if selectedComponent.type === "icon"}
      <div class="property-section">
        <label class="section-label">Icon</label>
        <div class="field">
          <span class="field-label">Icon</span>
          <IconSearcher
            value={selectedComponent.icon ?? ""}
            onSelect={(icon) => updateProperty("icon", icon)}
          />
        </div>
      </div>

      <div class="property-section">
        <label class="section-label">Styling</label>
        <ColorPicker
          label="Color"
          value={selectedComponent.color}
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
            value={selectedComponent.iconType ?? "bulb"}
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
          value={selectedComponent.color}
          onUpdate={(color) => updateProperty("color", color)}
        />
      </div>
    {/if}

    {#if selectedComponent.type === "rectangle"}
      <div class="property-section">
        <label class="section-label">Styling</label>
        <ColorPicker
          label="Background"
          value={selectedComponent.backgroundColor}
          onUpdate={(color) => updateProperty("backgroundColor", color)}
        />
      </div>
    {/if}

    {#if selectedComponent.type === "image"}
      <div class="property-section">
        <div class="section-label">Image</div>
        <div class="field">
          <span class="field-label">Source</span>
          <select
            value={selectedComponent.imageSource ??
              (selectedComponent.imageBinding?.entityId ? "ha" : "static")}
            onchange={(e) =>
              updateImageSource(
                e.currentTarget.value === "ha" ? "ha" : "static",
              )}
          >
            <option value="static">Static file / URL</option>
            <option value="ha">Home Assistant entity</option>
          </select>
        </div>

        {#if (selectedComponent.imageSource ?? (selectedComponent.imageBinding?.entityId ? "ha" : "static")) === "ha"}
          <div class="field-group">
            <label class="group-label">Home Assistant Image</label>
            <EntityPicker
              preselectedDomain="image"
              component={selectedComponent}
              onUpdate={(binding) => updateProperty("imageBinding", binding)}
            />
            <br>
          </div>
        {:else}
          <div class="field">
            <span class="field-label">File</span>
            <input
              type="text"
              value={selectedComponent.file ?? ""}
              placeholder="images/photo.png"
              oninput={(e) => updateProperty("file", e.currentTarget.value)}
            />
          </div>
        {/if}

        <details class="advanced-details">
          <summary class="advanced-summary">Advanced</summary>
          <p class="advanced-note">These defaults work for most cases. Adjust only if your image doesn't display correctly.</p>

          <div class="field">
            <span class="field-label">Type</span>
            <select
              value={selectedComponent.image_type ?? "RGB565"}
              onchange={(e) =>
                updateProperty("image_type", e.currentTarget.value)}
            >
              <option value="BINARY">Binary</option>
              <option value="GRAYSCALE">Grayscale</option>
              <option value="RGB565">RGB565</option>
              <option value="RGB">RGB</option>
            </select>
          </div>
          <div class="field">
            <span class="field-label">Resize</span>
            <input
              type="text"
              value={selectedComponent.resize ??
                `${selectedComponent.size?.width ?? 100}x${selectedComponent.size?.height ?? 100}`}
              placeholder="100x100"
              oninput={(e) => updateProperty("resize", e.currentTarget.value)}
            />
          </div>
        </details>
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
                Math.max(
                  20,
                  Math.min(80, parseInt(e.currentTarget.value) || 30),
                ),
              )}
          />
        </div>
        <div class="field">
          <span class="field-label">Scrollable</span>
          <input
            type="checkbox"
            checked={selectedComponent.scrollable === true}
            onchange={(e) =>
              updateProperty("scrollable", e.currentTarget.checked)}
          />
        </div>
        <div class="field">
          <span class="field-label">Checkable</span>
          <input
            type="checkbox"
            checked={selectedComponent.checkable === true}
            onchange={(e) =>
              updateProperty("checkable", e.currentTarget.checked)}
          />
        </div>

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
        <div class="field">
          <span class="field-label">Icon</span>
          <IconSearcher
            value={selectedComponent.icon ?? "lightbulb"}
            onSelect={(icon) => updateProperty("icon", icon || "lightbulb")}
          />
        </div>
      </div>
    {/if}

    {#if selectedComponent.type === "hvac"}
      <div class="property-section">
        <label class="section-label">HVAC Control</label>
        <div class="field">
          <span class="field-label">Label</span>
          <input
            type="text"
            value={selectedComponent.label ?? ""}
            oninput={(e) => updateProperty("label", e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <span class="field-label">Step</span>
          <input
            type="number"
            min="0.1"
            max="5"
            step="0.5"
            value={selectedComponent.tempStep ?? 0.5}
            oninput={(e) =>
              updateProperty(
                "tempStep",
                Math.max(0.1, Math.min(5, parseFloat(e.currentTarget.value) || 0.5)),
              )}
          />
        </div>
        <div class="field-row">
          <div class="field">
            <span class="field-label">Min °C</span>
            <input
              type="number"
              value={selectedComponent.minTemp ?? 10}
              oninput={(e) =>
                updateProperty(
                  "minTemp",
                  parseFloat(e.currentTarget.value) || 10,
                )}
            />
          </div>
          <div class="field">
            <span class="field-label">Max °C</span>
            <input
              type="number"
              value={selectedComponent.maxTemp ?? 30}
              oninput={(e) =>
                updateProperty(
                  "maxTemp",
                  parseFloat(e.currentTarget.value) || 30,
                )}
            />
          </div>
        </div>
        <div class="field">
          <span class="field-label">On Mode</span>
          <select
            value={selectedComponent.onMode ?? "heat"}
            onchange={(e) => updateProperty("onMode", e.currentTarget.value)}
          >
            {#each HVAC_MODE_LIST as mode}
              <option value={mode.value}>{mode.label}</option>
            {/each}
          </select>
        </div>
      </div>
    {/if}

    {#if selectedComponent.type === "weather"}
      <div class="property-section">
        <label class="section-label">Weather</label>
        <div class="field">
          <span class="field-label">Label</span>
          <input
            type="text"
            value={selectedComponent.label ?? ""}
            oninput={(e) => updateProperty("label", e.currentTarget.value)}
          />
        </div>
        <div class="field">
          <span class="field-label">Mode</span>
          <select
            value={selectedComponent.mode ?? "today"}
            onchange={(e) => updateProperty("mode", e.currentTarget.value)}
          >
            <option value="today">Today</option>
            <option value="forecast">Forecast (3-day)</option>
          </select>
        </div>
      </div>
    {/if}

    {#if selectedComponent.type === "calendar"}
      <div class="property-section">
        <label class="section-label">Calendar</label>
        <div class="field">
          <span class="field-label">Label</span>
          <input
            type="text"
            value={selectedComponent.label ?? ""}
            oninput={(e) => updateProperty("label", e.currentTarget.value)}
          />
        </div>
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
          <span class="field-label">Scrollable</span>
          <input
            type="checkbox"
            checked={selectedComponent.scrollable === true}
            onchange={(e) => updateProperty("scrollable", e.currentTarget.checked)}
          />
        </div>
        <div class="field">
          <span class="field-label">Duration Days</span>
          <input
            type="number"
            min="0"
            value={selectedComponent.durationDays ?? 125}
            oninput={(e) =>
              updateProperty("durationDays", Math.max(0, parseInt(e.currentTarget.value) || 0))}
          />
        </div>
      </div>
    {/if}

    {#if selectedComponent.type === "conditional_area"}
      <div class="property-section">
        <label class="section-label">Variants</label>
        <div class="variant-tabs-row">
          {#each selectedComponent.variants as variant}
            <button
              class="variant-pill"
              class:active={variant.id === activeVariantId}
              onclick={() =>
                conditionalEditorStore.setActiveVariant(
                  selectedComponent.id,
                  variant.id,
                )}
              title={describeCondition(variant.condition)}
            >
              {variant.name}
            </button>
          {/each}
          <button
            class="variant-pill add-pill"
            onclick={() => projectStore.addVariant(selectedComponent.id)}
            title="Add variant">+</button
          >
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
              onclick={() =>
                projectStore.deleteVariant(
                  selectedComponent.id,
                  activeVariant.id,
                )}
              disabled={selectedComponent.variants.length <= 1}
              title="Delete variant">×</button
            >
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
                oninput={(e) =>
                  updateVariant({
                    priority: parseInt(e.currentTarget.value) || 0,
                  })}
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
            onchange={(e) =>
              updateProperty("evaluationMode", e.currentTarget.value)}
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
            onchange={(e) =>
              updateProperty("clipContent", e.currentTarget.checked)}
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
              onclick={() =>
                conditionalEditorStore.setActiveTab(
                  selectedComponent.id,
                  tab.id,
                )}
              title={tab.name}
            >
              {tab.name}
            </button>
          {/each}
          <button
            class="variant-pill add-pill"
            onclick={() => projectStore.addTab(selectedComponent.id)}
            title="Add tab">+</button
          >
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
              onclick={() =>
                projectStore.deleteTab(selectedComponent.id, activeTab.id)}
              disabled={selectedComponent.tabs.length <= 1}
              title="Delete tab">x</button
            >
          </div>

          <div class="field">
            <span class="field-label">Default</span>
            <input
              type="checkbox"
              checked={selectedComponent.defaultTabId === activeTab.id ||
                (!selectedComponent.defaultTabId &&
                  selectedComponent.tabs[0]?.id === activeTab.id)}
              onchange={(e) =>
                updateProperty(
                  "defaultTabId",
                  e.currentTarget.checked ? activeTab.id : undefined,
                )}
            />
          </div>
        </div>
      {/if}
    {/if}

    <!-- Entity Binding (only for components that display entity values) -->
    {#if selectedComponent.type === "todo_list" || selectedComponent.type === "light_state" || selectedComponent.type === "hvac" || selectedComponent.type === "weather" || selectedComponent.type === "calendar"}
      <div class="property-section">
        <label class="section-label">Entity Binding</label>
        <EntityPicker
          preselectedDomain={selectedComponent.type === "todo_list"
            ? "todo"
            : selectedComponent.type === "hvac"
              ? "climate"
              : selectedComponent.type === "weather"
                ? "weather"
                : selectedComponent.type === "calendar"
                  ? "calendar"
                : "light"}
          allowedDomains={selectedComponent.type === "todo_list"
            ? ["todo"]
            : selectedComponent.type === "light_state"
              ? LIGHT_STATE_ALLOWED_DOMAINS
            : selectedComponent.type === "hvac"
                ? CLIMATE_ALLOWED_DOMAINS
                : selectedComponent.type === "weather"
                  ? WEATHER_ALLOWED_DOMAINS
                  : selectedComponent.type === "calendar"
                    ? CALENDAR_ALLOWED_DOMAINS
                  : undefined}
          component={selectedComponent}
          onUpdate={(binding) => {
            if (selectedComponent.type === "todo_list") {
              updateProperty("itemsBinding", binding);
            } else if (selectedComponent.type === "calendar") {
              updateProperty("entityBinding", binding);
            } else {
              updateProperty("stateBinding", binding);
            }
          }}
        />
      </div>
    {/if}
    {#if selectedComponent.type !== "light_state" && selectedComponent.type !== "hvac" && selectedComponent.type !== "text"}
      <div class="property-section">
        <label class="section-label">Actions</label>
        <ActionEditor
          label="On Tap"
          action={selectedComponent.onTap}
          onUpdate={(action) => updateProperty("onTap", action)}
        />
      </div>
    {/if}
  {:else}
    {#if projectStore.viewMode === "dashboard"}
      <div class="property-section">
        <label class="section-label">Page Name</label>
        <div class="field">
          <input
            type="text"
            value={projectStore.currentDashboardPage?.name ?? ""}
            oninput={(e) => {
              const page = projectStore.currentDashboardPage;
              if (page && e.currentTarget.value.trim()) {
                projectStore.renameDashboardPage(
                  page.id,
                  e.currentTarget.value.trim(),
                );
              }
            }}
          />
        </div>
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
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-md);
  }

  .property-section {
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-md);

    &:not(:last-child) {
      border-bottom: 1px solid var(--color-border);
    }
  }

  .section-label {
    display: block;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
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
    font-size: 11px;
    color: var(--color-text-muted);
    min-width: 50px;
  }

  input,
  select {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-family: inherit;
    height: 30px;
    padding: 0 var(--spacing-sm);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    outline: none;
    transition:
      border-color var(--transition-fast),
      background-color var(--transition-fast);
  }

  select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 24px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 8px center;
    cursor: pointer;
  }

  input:hover,
  select:hover {
    border-color: var(--color-border-light);
  }

  input:focus,
  select:focus {
    border-color: var(--color-accent);
    background: var(--color-bg-tertiary);
  }

  input[type="checkbox"] {
    flex: 0 0 auto;
    width: 16px;
    height: 16px;
    padding: 0;
    accent-color: var(--color-accent);
    cursor: pointer;
    background: transparent;
    border-radius: 2px;
  }

  .no-selection {
    text-align: center;
    padding: var(--spacing-xl);
    color: var(--color-text-muted);
  }

  .no-selection p {
    font-size: 12px;
    color: var(--color-text-muted);
  }

  .variant-tabs-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .variant-pill {
    padding: 5px 10px;
    font-size: 11px;
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
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
  }

  .validation-errors {
    margin-bottom: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .validation-error {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 10px;
    background: rgba(244, 67, 54, 0.1);
    border: 1px solid rgba(244, 67, 54, 0.3);
    border-radius: var(--radius-sm);
    color: var(--color-error);
    font-size: 12px;
    line-height: 1.4;
  }

  .validation-error .error-icon {
    flex: 0 0 auto;
    margin-top: 1px;
  }

  .advanced-details {
    margin-top: var(--spacing-sm);
    border-top: 1px solid var(--color-border);
    padding-top: var(--spacing-sm);
  }

  .advanced-summary {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    cursor: pointer;
    user-select: none;
  }

  .advanced-note {
    font-size: 11px;
    color: var(--color-text-muted);
    margin: var(--spacing-xs) 0 var(--spacing-sm);
    line-height: 1.4;
  }

  .mode-color-legend {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .mode-color-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .mode-color-swatch {
    width: 16px;
    height: 16px;
    border-radius: 3px;
    border: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .mode-color-label {
    text-transform: capitalize;
  }

  .mode-color-hint {
    font-size: 11px;
    color: var(--color-text-muted);
    margin: var(--spacing-xs) 0 0 0;
    line-height: 1.4;
  }

  .condition-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
  }

  .condition-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 6px;
    background: var(--color-bg-tertiary, #1a1d24);
    border: 1px solid var(--color-border, #2a2e38);
    border-radius: 4px;
    min-width: 0;
  }

  .condition-swatch {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .condition-name {
    font-size: 10px;
    font-family: var(--display-font, monospace);
    text-transform: capitalize;
    color: var(--color-text-secondary, #a0a4ad);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
