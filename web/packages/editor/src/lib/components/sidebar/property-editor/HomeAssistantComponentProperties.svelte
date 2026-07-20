<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import { HVAC_MODE_LIST } from "$lib/utils/hvac-modes";
  import ColorPicker from "../ColorPicker.svelte";
  import IconSearcher from "../IconSearcher.svelte";

  let { component, updateProperty } = $props<{
    component: Component;
    updateProperty: (key: string, value: unknown) => void;
  }>();
</script>

{#if component.type === "todo_list"}
  <div class="property-section">
    <label class="section-label">To-Do List</label>
    <div class="field">
      <span class="field-label">Scrollable</span>
      <input
        type="checkbox"
        checked={component.scrollable === true}
        onchange={(e) => updateProperty("scrollable", e.currentTarget.checked)}
      />
    </div>
    {#if component.scrollable !== true}
      <div class="field">
        <span class="field-label">Rows</span>
        <input
          type="number"
          min="1"
          max="10"
          value={component.maxItems ?? 4}
          oninput={(e) =>
            updateProperty(
              "maxItems",
              Math.max(1, Math.min(10, parseInt(e.currentTarget.value) || 4)),
            )}
        />
      </div>
    {/if}
    <div class="field">
      <span class="field-label">Row Height</span>
      <input
        type="number"
        min="20"
        max="80"
        value={component.rowHeight ?? 30}
        oninput={(e) =>
          updateProperty(
            "rowHeight",
            Math.max(20, Math.min(80, parseInt(e.currentTarget.value) || 30)),
          )}
      />
    </div>
    <div class="field">
      <span class="field-label">Checkable</span>
      <input
        type="checkbox"
        checked={component.checkable === true}
        onchange={(e) => updateProperty("checkable", e.currentTarget.checked)}
      />
    </div>
  </div>
  <div class="property-section">
    <label class="section-label">Styling</label>
    <ColorPicker
      label="Color"
      value={component.color}
      onUpdate={(color) => updateProperty("color", color)}
    />
  </div>
{/if}

{#if component.type === "light_state"}
  <div class="property-section">
    <label class="section-label">Light State</label>
    <div class="field">
      <span class="field-label">Label</span>
      <input
        type="text"
        value={component.label ?? ""}
        oninput={(e) => updateProperty("label", e.currentTarget.value)}
      />
    </div>
    <div class="field">
      <span class="field-label">Icon</span>
      <IconSearcher
        value={component.icon ?? "lightbulb"}
        onSelect={(icon) => updateProperty("icon", icon || "lightbulb")}
      />
    </div>
  </div>
  <div class="property-section">
    <label class="section-label" for="light-confirm-action">Confirmation</label>
    <div class="field">
      <span class="field-label">Require</span>
      <select
        id="light-confirm-action"
        value={component.confirmAction ?? "none"}
        onchange={(e) => updateProperty("confirmAction", e.currentTarget.value)}
      >
        <option value="none">Never</option>
        <option value="on">When turning on</option>
        <option value="off">When turning off</option>
        <option value="both">Always</option>
      </select>
    </div>
  </div>
{/if}

{#if component.type === "hvac"}
  <div class="property-section">
    <label class="section-label">HVAC Control</label>
    <div class="field">
      <span class="field-label">Label</span>
      <input
        type="text"
        value={component.label ?? ""}
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
        value={component.tempStep ?? 0.5}
        oninput={(e) =>
          updateProperty(
            "tempStep",
            Math.max(0.1, Math.min(5, parseFloat(e.currentTarget.value) || 0.5)),
          )}
      />
    </div>
    <div class="field">
      <span class="field-label">Min °C</span>
      <input
        type="number"
        value={component.minTemp ?? 10}
        oninput={(e) =>
          updateProperty("minTemp", parseFloat(e.currentTarget.value) || 10)}
      />
    </div>
    <div class="field">
      <span class="field-label">Max °C</span>
      <input
        type="number"
        value={component.maxTemp ?? 30}
        oninput={(e) =>
          updateProperty("maxTemp", parseFloat(e.currentTarget.value) || 30)}
      />
    </div>
    <div class="field">
      <span class="field-label">On Mode</span>
      <select
        value={component.onMode ?? "heat"}
        onchange={(e) => updateProperty("onMode", e.currentTarget.value)}
      >
        {#each HVAC_MODE_LIST as mode}
          <option value={mode.value}>{mode.label}</option>
        {/each}
      </select>
    </div>
  </div>
{/if}

{#if component.type === "weather"}
  <div class="property-section">
    <label class="section-label">Weather</label>
    <div class="field">
      <span class="field-label">Label</span>
      <input
        type="text"
        value={component.label ?? ""}
        oninput={(e) => updateProperty("label", e.currentTarget.value)}
      />
    </div>
    <div class="field">
      <span class="field-label">Mode</span>
      <select
        value={component.mode ?? "today"}
        onchange={(e) => updateProperty("mode", e.currentTarget.value)}
      >
        <option value="today">Today (detailed)</option>
        <option value="today-mini">Today</option>
        <option value="forecast">Forecast (3-day)</option>
      </select>
    </div>
  </div>
{/if}

{#if component.type === "calendar"}
  <div class="property-section">
    <label class="section-label">Calendar</label>
    <div class="field">
      <span class="field-label">Label</span>
      <input
        type="text"
        value={component.label ?? ""}
        oninput={(e) => updateProperty("label", e.currentTarget.value)}
      />
    </div>
    <div class="field">
      <span class="field-label">Scrollable</span>
      <input
        type="checkbox"
        checked={component.scrollable === true}
        onchange={(e) => updateProperty("scrollable", e.currentTarget.checked)}
      />
    </div>
    {#if component.scrollable !== true}
      <div class="field">
        <span class="field-label">Rows</span>
        <input
          type="number"
          min="1"
          max="10"
          value={component.maxItems ?? 4}
          oninput={(e) =>
            updateProperty(
              "maxItems",
              Math.max(1, Math.min(10, parseInt(e.currentTarget.value) || 4)),
            )}
        />
      </div>
    {/if}
    <div class="field">
      <span class="field-label">Show Days</span>
      <input
        type="number"
        min="0"
        value={component.durationDays ?? 125}
        oninput={(e) =>
          updateProperty(
            "durationDays",
            Math.max(0, parseInt(e.currentTarget.value) || 0),
          )}
      />
    </div>
  </div>
{/if}
