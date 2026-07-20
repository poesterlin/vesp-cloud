<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import { historyStore } from "$lib/stores/history.svelte";
  import { projectStore } from "$lib/stores/project.svelte";

  let { component } = $props<{ component: Component }>();

  function updatePosition(axis: "x" | "y", value: number) {
    historyStore.record("Move component");
    projectStore.updateComponent(component.id, {
      position: { ...component.position, [axis]: value },
    });
  }

  function updateSize(dimension: "width" | "height", value: number) {
    if (!component.size) return;
    historyStore.record("Resize component");
    projectStore.updateComponent(component.id, {
      size: { ...component.size, [dimension]: value },
    });
  }
</script>

<div class="property-section">
  <label class="section-label">Position</label>
  <div class="field-row">
    <div class="field">
      <span class="field-label">X</span>
      <input
        type="number"
        value={component.position.x}
        oninput={(e) => updatePosition("x", parseInt(e.currentTarget.value) || 0)}
      />
    </div>
    <div class="field">
      <span class="field-label">Y</span>
      <input
        type="number"
        value={component.position.y}
        oninput={(e) => updatePosition("y", parseInt(e.currentTarget.value) || 0)}
      />
    </div>
  </div>
</div>

{#if component.size && component.type !== "hvac"}
  <div class="property-section">
    <label class="section-label">Size</label>
    <div class="field-row">
      <div class="field">
        <span class="field-label">W</span>
        <input
          type="number"
          value={component.size.width}
          oninput={(e) =>
            updateSize("width", parseInt(e.currentTarget.value) || 10)}
        />
      </div>
      {#if component.type !== "light_state" && component.type !== "weather"}
        <div class="field">
          <span class="field-label">H</span>
          <input
            type="number"
            value={component.size.height}
            oninput={(e) =>
              updateSize("height", parseInt(e.currentTarget.value) || 10)}
          />
        </div>
      {/if}
    </div>
  </div>
{/if}
