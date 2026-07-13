<script lang="ts">
  import type {
    Component,
    ConditionalVariant,
    TabItem,
  } from "@vesp-cloud/schema";
  import { conditionalEditorStore } from "$lib/stores/conditional-editor.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { describeCondition } from "$lib/utils/condition-utils";
  import ConditionEditor from "../ConditionEditor.svelte";

  let { component, updateProperty } = $props<{
    component: Component;
    updateProperty: (key: string, value: unknown) => void;
  }>();

  const activeVariantId = $derived(
    component.type === "conditional_area"
      ? conditionalEditorStore.getActiveVariant(
          component.id,
          component.variants[0]?.id,
        )
      : null,
  );
  const activeVariant = $derived(
    component.type === "conditional_area" && activeVariantId
      ? component.variants.find(
          (variant: ConditionalVariant) => variant.id === activeVariantId,
        )
      : null,
  );
  const activeTabId = $derived(
    component.type === "tab_container"
      ? conditionalEditorStore.getActiveTab(
          component.id,
          component.defaultTabId ?? component.tabs[0]?.id,
        )
      : null,
  );
  const activeTab = $derived(
    component.type === "tab_container" && activeTabId
      ? component.tabs.find((tab: TabItem) => tab.id === activeTabId)
      : null,
  );

  function updateVariant(updates: Record<string, unknown>) {
    if (component.type !== "conditional_area" || !activeVariantId) return;
    projectStore.updateVariant(component.id, activeVariantId, updates);
  }

  function updateTab(updates: Record<string, unknown>) {
    if (component.type !== "tab_container" || !activeTabId) return;
    projectStore.updateTab(component.id, activeTabId, updates);
  }
</script>

{#if component.type === "conditional_area"}
  <div class="property-section">
    <label class="section-label">Variants</label>
    <div class="variant-tabs-row">
      {#each component.variants as variant}
        <button
          class="variant-pill"
          class:active={variant.id === activeVariantId}
          onclick={() =>
            conditionalEditorStore.setActiveVariant(component.id, variant.id)}
          title={describeCondition(variant.condition)}
        >
          {variant.name}
        </button>
      {/each}
      <button
        class="variant-pill add-pill"
        onclick={() => projectStore.addVariant(component.id)}
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
          onclick={() => projectStore.deleteVariant(component.id, activeVariant.id)}
          disabled={component.variants.length <= 1}
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
      {#if component.evaluationMode === "priority"}
        <div class="field">
          <span class="field-label">Priority</span>
          <input
            type="number"
            value={activeVariant.priority ?? 0}
            oninput={(e) =>
              updateVariant({ priority: parseInt(e.currentTarget.value) || 0 })}
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
        value={component.evaluationMode ?? "first_match"}
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
        checked={component.clipContent !== false}
        onchange={(e) => updateProperty("clipContent", e.currentTarget.checked)}
      />
    </div>
  </div>
{/if}

{#if component.type === "tab_container"}
  <div class="property-section">
    <label class="section-label">Tabs</label>
    <div class="variant-tabs-row">
      {#each component.tabs as tab}
        <button
          class="variant-pill"
          class:active={tab.id === activeTabId}
          onclick={() => conditionalEditorStore.setActiveTab(component.id, tab.id)}
          title={tab.name}
        >
          {tab.name}
        </button>
      {/each}
      <button
        class="variant-pill add-pill"
        onclick={() => projectStore.addTab(component.id)}
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
          onclick={() => projectStore.deleteTab(component.id, activeTab.id)}
          disabled={component.tabs.length <= 1}
          title="Delete tab">x</button
        >
      </div>
      <div class="field">
        <span class="field-label">Default</span>
        <input
          type="checkbox"
          checked={component.defaultTabId === activeTab.id ||
            (!component.defaultTabId && component.tabs[0]?.id === activeTab.id)}
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
