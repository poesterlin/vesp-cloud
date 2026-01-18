<script lang="ts">
  import type { Component, EntityBinding } from "@esphome-designer/schema";

  interface Props {
    component: Component;
    onUpdate: (binding: EntityBinding | undefined) => void;
  }

  let { component, onUpdate }: Props = $props();

  // Get current binding based on component type
  const currentBinding = $derived.by<EntityBinding | undefined>(() => {
    if (component.type === "text") {
      return (component as any).textBinding;
    }
    return (component as any).valueBinding;
  });

  let entityId = $state("");
  let attribute = $state("");

  $effect(() => {
    entityId = currentBinding?.entityId ?? "";
    attribute = currentBinding?.attribute ?? "";
  });

  function handleUpdate() {
    if (!entityId.trim()) {
      onUpdate(undefined);
      return;
    }

    const binding: EntityBinding = {
      entityId: entityId.trim(),
    };

    if (attribute.trim()) {
      binding.attribute = attribute.trim();
    }

    onUpdate(binding);
  }

  // Common entity domains for autocomplete hints
  const domainHints = [
    "sensor",
    "binary_sensor",
    "switch",
    "light",
    "climate",
    "cover",
    "media_player",
    "input_number",
    "input_boolean",
  ];
</script>

<div class="entity-picker">
  <div class="field">
    <span class="field-label">Entity</span>
    <input
      type="text"
      placeholder="sensor.temperature"
      bind:value={entityId}
      oninput={handleUpdate}
      list="entity-domains"
    />
    <datalist id="entity-domains">
      {#each domainHints as domain}
        <option value="{domain}."></option>
      {/each}
    </datalist>
  </div>

  <div class="field">
    <span class="field-label">Attribute</span>
    <input
      type="text"
      placeholder="(optional)"
      bind:value={attribute}
      oninput={handleUpdate}
    />
  </div>

  {#if entityId}
    <div class="preview">
      Binding: <code>{entityId}{attribute ? `.${attribute}` : ""}</code>
    </div>
  {/if}
</div>

<style>
  .entity-picker {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .field-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    min-width: 50px;
  }

  input {
    flex: 1;
    min-width: 0;
  }

  .preview {
    font-size: 11px;
    color: var(--color-text-muted);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-bg-primary);
    border-radius: var(--radius-sm);
  }

  .preview code {
    color: var(--color-accent);
  }
</style>
