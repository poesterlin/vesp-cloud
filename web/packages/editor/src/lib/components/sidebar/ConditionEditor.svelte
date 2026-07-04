<script lang="ts">
  import type { Condition, EntityBinding, EntityCondition } from "@vesp-cloud/schema";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import Self from "./ConditionEditor.svelte";
  import EntityPicker from "./EntityPicker.svelte";

  interface Props {
    condition: Condition | undefined;
    onUpdate: (condition: Condition | undefined) => void;
  }

  let { condition, onUpdate }: Props = $props();

  const comparisonOperators = [
    { value: "eq", label: "equals (=)" },
    { value: "neq", label: "not equals (≠)" },
    { value: "gt", label: "greater than (>)" },
    { value: "gte", label: "greater or equal (≥)" },
    { value: "lt", label: "less than (<)" },
    { value: "lte", label: "less or equal (≤)" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "not contains" },
    { value: "matches", label: "matches (regex)" },
  ];

  const selectedEntity = $derived(
    condition?.type === "entity" && condition.entityId
      ? homeAssistantStore.getEntity(condition.entityId)
      : undefined,
  );

  const stateOptions = $derived(
    selectedEntity?.state_options?.filter((option) => option.trim() !== "") ?? [],
  );

  function setConditionType(type: string) {
    if (type === "none") {
      onUpdate(undefined);
      return;
    }

    const templates: Record<string, Condition> = {
      entity: { type: "entity", entityId: "", operator: "eq", value: "" },
      state: { type: "state", variable: "", operator: "eq", value: "" },
      time: { type: "time", after: "08:00", before: "20:00" },
      compound: { type: "compound", operator: "and", conditions: [
        { type: "entity", entityId: "", operator: "eq", value: "" },
        { type: "entity", entityId: "", operator: "eq", value: "" }
      ] },
    };

    onUpdate(templates[type]);
  }

  function updateEntityCondition(updates: Partial<EntityCondition>) {
    if (condition?.type === "entity") {
      onUpdate({ ...condition, ...updates });
    }
  }

  function updateEntityBinding(binding: EntityBinding | undefined) {
    if (condition?.type !== "entity") return;
    updateEntityCondition({
      entityId: binding?.entityId ?? "",
      attribute: binding?.attribute,
    });
  }

  function parseConditionValue(value: string): string | number | boolean {
    if (value === "true") return true;
    if (value === "false") return false;
    if (value !== "" && !isNaN(Number(value))) return Number(value);
    return value;
  }

  function addSubCondition() {
    if (condition?.type === "compound") {
      onUpdate({
        ...condition,
        conditions: [
          ...condition.conditions,
          { type: "entity", entityId: "", operator: "eq", value: "" },
        ],
      });
    }
  }

  function updateSubCondition(index: number, updated: Condition) {
    if (condition?.type === "compound") {
      const newConditions = condition.conditions.slice();
      newConditions[index] = updated;
      onUpdate({ ...condition, conditions: newConditions });
    }
  }

  function removeSubCondition(index: number) {
    if (condition?.type === "compound") {
      onUpdate({
        ...condition,
        conditions: condition.conditions.filter((_, i) => i !== index),
      });
    }
  }
</script>

<div class="condition-editor">
  <div class="field">
    <span class="field-label">Type</span>
    <select
      value={condition?.type ?? "none"}
      onchange={(e) => setConditionType(e.currentTarget.value)}
    >
      <option value="none">Always (Default)</option>
      <option value="entity">Home Assistant Entity</option>
      <option value="time">Time Range</option>
      <option value="compound">Compound (AND/OR)</option>
    </select>
  </div>

  {#if condition?.type === "entity"}
    <div class="condition-subform">
      <div class="field">
        <span class="field-label">Entity</span>
        <EntityPicker
          component={{ type: "condition" }}
          binding={{
            entityId: condition.entityId,
            attribute: condition.attribute,
          }}
          onUpdate={updateEntityBinding}
        />
      </div>

      <div class="field">
        <span class="field-label">Op</span>
        <select
          value={condition.operator}
          onchange={(e) => updateEntityCondition({ operator: e.currentTarget.value as any })}
        >
          {#each comparisonOperators as op}
            <option value={op.value}>{op.label}</option>
          {/each}
        </select>
      </div>

      <div class="field">
        <span class="field-label">Value</span>
        <input
          type="text"
          value={String(condition.value)}
          oninput={(e) => {
            updateEntityCondition({ value: parseConditionValue(e.currentTarget.value) });
          }}
        />
      </div>

      {#if stateOptions.length > 0 && !condition.attribute}
        <div class="suggestion-row" aria-label="State suggestions">
          {#each stateOptions as option}
            <button
              type="button"
              class:active={condition.value === parseConditionValue(option)}
              onclick={() => updateEntityCondition({ value: parseConditionValue(option) })}
            >
              {option}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if condition?.type === "time"}
    <div class="condition-subform">
      <div class="field">
        <span class="field-label">After</span>
        <input
          type="text"
          placeholder="HH:MM"
          value={condition.after ?? ""}
          oninput={(e) => onUpdate({ ...condition, after: e.currentTarget.value })}
        />
      </div>
      <div class="field">
        <span class="field-label">Before</span>
        <input
          type="text"
          placeholder="HH:MM"
          value={condition.before ?? ""}
          oninput={(e) => onUpdate({ ...condition, before: e.currentTarget.value })}
        />
      </div>
    </div>
  {/if}

  {#if condition?.type === "compound"}
    <div class="compound-editor">
      <div class="field">
        <span class="field-label">Combine</span>
        <select
          value={condition.operator}
          onchange={(e) => onUpdate({ ...condition, operator: e.currentTarget.value as any })}
        >
          <option value="and">AND (All match)</option>
          <option value="or">OR (Any match)</option>
        </select>
      </div>

      <div class="sub-conditions">
        {#each condition.conditions as sub, i}
          <div class="sub-condition-item">
            <div class="sub-condition-header">
              <span>#{i + 1}</span>
              <button class="remove-btn" onclick={() => removeSubCondition(i)}>×</button>
            </div>
            <Self
              condition={sub}
              onUpdate={(updated) => updated && updateSubCondition(i, updated)}
            />
          </div>
        {/each}
        <button class="add-btn" onclick={addSubCondition}>+ Add Condition</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .condition-editor {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .condition-subform {
    padding-left: var(--spacing-sm);
    border-left: 2px solid var(--color-border);
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
    font-size: 11px;
    color: var(--color-text-muted);
    min-width: 45px;
    text-transform: uppercase;
  }

  input, select {
    flex: 1;
    min-width: 0;
    font-size: 12px;
  }

  .suggestion-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding-left: 53px;
  }

  .suggestion-row button {
    padding: 4px 8px;
    border: 1px solid var(--color-border);
    border-radius: 999px;
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    font-size: 11px;
    cursor: pointer;
  }

  .suggestion-row button:hover,
  .suggestion-row button.active {
    border-color: var(--color-accent);
    color: var(--color-text-primary);
  }

  .compound-editor {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .sub-conditions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding-left: var(--spacing-sm);
    border-left: 2px solid var(--color-accent);
  }

  .sub-condition-item {
    background: var(--color-bg-primary);
    padding: var(--spacing-sm);
    border-radius: var(--radius-sm);
    position: relative;
  }

  .sub-condition-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--spacing-xs);
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .remove-btn {
    background: none;
    border: none;
    color: var(--color-error);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0 4px;
  }

  .add-btn {
    width: 100%;
    padding: var(--spacing-xs);
    font-size: 11px;
    background: none;
    border: 1px dashed var(--color-border);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .add-btn:hover {
    border-color: var(--color-accent);
    color: var(--color-accent);
  }
</style>
