<script lang="ts">
  import type { SuggestedParam } from "$lib/data/service-presets";

  interface DataParam {
    key: string;
    value: string | number | boolean;
    type: "string" | "number" | "boolean";
  }

  interface Props {
    data: Record<string, unknown>;
    suggestedParams?: SuggestedParam[];
    onUpdate: (data: Record<string, unknown>) => void;
  }

  let { data, suggestedParams = [], onUpdate }: Props = $props();

  // Convert data object to array of params for editing
  let params = $state<DataParam[]>([]);

  $effect(() => {
    params = Object.entries(data).map(([key, value]) => ({
      key,
      value: value as string | number | boolean,
      type: typeof value as "string" | "number" | "boolean",
    }));
  });

  function addParam(key: string = "", type: "string" | "number" | "boolean" = "string") {
    const defaultValue = type === "number" ? 0 : type === "boolean" ? false : "";
    params = [...params, { key, value: defaultValue, type }];
    emitUpdate();
  }

  function addSuggestedParams() {
    const existingKeys = new Set(params.map((p) => p.key));
    const newParams = suggestedParams
      .filter((sp) => !existingKeys.has(sp.key))
      .map((sp) => ({
        key: sp.key,
        value: sp.type === "number" ? 0 : sp.type === "boolean" ? false : "",
        type: sp.type,
      }));
    params = [...params, ...newParams];
    emitUpdate();
  }

  function removeParam(index: number) {
    params = params.filter((_, i) => i !== index);
    emitUpdate();
  }

  function updateParamKey(index: number, key: string) {
    params[index].key = key;
    emitUpdate();
  }

  function updateParamValue(index: number, value: string | number | boolean) {
    params[index].value = value;
    emitUpdate();
  }

  function updateParamType(index: number, type: "string" | "number" | "boolean") {
    const param = params[index];
    // Convert value to new type
    if (type === "number") {
      param.value = typeof param.value === "number" ? param.value : parseFloat(String(param.value)) || 0;
    } else if (type === "boolean") {
      param.value = Boolean(param.value);
    } else {
      param.value = String(param.value);
    }
    param.type = type;
    emitUpdate();
  }

  function emitUpdate() {
    const result: Record<string, unknown> = {};
    for (const param of params) {
      if (param.key.trim()) {
        result[param.key.trim()] = param.value;
      }
    }
    onUpdate(result);
  }

  // Get suggested param info for a key
  function getSuggestedInfo(key: string): SuggestedParam | undefined {
    return suggestedParams.find((sp) => sp.key === key);
  }

  const hasSuggestedParams = $derived(suggestedParams.length > 0);
  const hasUnadded = $derived(
    suggestedParams.some((sp) => !params.some((p) => p.key === sp.key))
  );
</script>

<div class="service-data-editor">
  <div class="header">
    <span class="label">Parameters</span>
    <div class="buttons">
      {#if hasSuggestedParams && hasUnadded}
        <button type="button" class="add-btn suggested" onclick={addSuggestedParams}>
          + Suggested
        </button>
      {/if}
      <button type="button" class="add-btn" onclick={() => addParam()}>
        + Custom
      </button>
    </div>
  </div>

  {#if params.length === 0}
    <div class="empty">No parameters configured</div>
  {:else}
    <div class="params-list">
      {#each params as param, index}
        {@const suggested = getSuggestedInfo(param.key)}
        <div class="param-row">
          <input
            type="text"
            class="key-input"
            placeholder="key"
            value={param.key}
            oninput={(e) => updateParamKey(index, e.currentTarget.value)}
          />
          <select
            class="type-select"
            value={param.type}
            onchange={(e) => updateParamType(index, e.currentTarget.value as "string" | "number" | "boolean")}
          >
            <option value="string">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
          </select>
          {#if param.type === "boolean"}
            <label class="bool-toggle">
              <input
                type="checkbox"
                checked={Boolean(param.value)}
                onchange={(e) => updateParamValue(index, e.currentTarget.checked)}
              />
              <span>{param.value ? "true" : "false"}</span>
            </label>
          {:else if param.type === "number"}
            <input
              type="number"
              class="value-input"
              value={param.value}
              min={suggested?.min}
              max={suggested?.max}
              step={suggested?.step ?? 1}
              oninput={(e) => updateParamValue(index, parseFloat(e.currentTarget.value) || 0)}
            />
          {:else}
            <input
              type="text"
              class="value-input"
              placeholder="value"
              value={param.value}
              oninput={(e) => updateParamValue(index, e.currentTarget.value)}
            />
          {/if}
          <button type="button" class="delete-btn" onclick={() => removeParam(index)}>
            &times;
          </button>
        </div>
      {/each}
    </div>
  {/if}

  {#if params.length > 0}
    <div class="preview">
      <span class="preview-label">Data:</span>
      <code>{JSON.stringify(Object.fromEntries(params.filter(p => p.key.trim()).map(p => [p.key, p.value])))}</code>
    </div>
  {/if}
</div>

<style>
  .service-data-editor {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm);
    background: var(--color-bg-primary);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .buttons {
    display: flex;
    gap: var(--spacing-xs);
  }

  .add-btn {
    font-size: 10px;
    padding: 2px 6px;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .add-btn:hover {
    background: var(--color-bg-tertiary);
  }

  .add-btn.suggested {
    background: var(--color-accent);
    color: white;
    border-color: var(--color-accent);
  }

  .add-btn.suggested:hover {
    opacity: 0.9;
  }

  .empty {
    font-size: 11px;
    color: var(--color-text-muted);
    text-align: center;
    padding: var(--spacing-sm);
  }

  .params-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .param-row {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .key-input {
    flex: 1;
    min-width: 60px;
    font-size: 11px;
  }

  .type-select {
    width: 70px;
    font-size: 11px;
  }

  .value-input {
    flex: 1;
    min-width: 50px;
    font-size: 11px;
  }

  .bool-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    font-size: 11px;
    cursor: pointer;
  }

  .bool-toggle input {
    width: auto;
  }

  .delete-btn {
    width: 20px;
    height: 20px;
    padding: 0;
    background: transparent;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
  }

  .delete-btn:hover {
    color: var(--color-error, #e74c3c);
  }

  .preview {
    font-size: 10px;
    color: var(--color-text-muted);
    padding-top: var(--spacing-xs);
    border-top: 1px solid var(--color-border);
  }

  .preview-label {
    margin-right: 4px;
  }

  .preview code {
    color: var(--color-accent);
    word-break: break-all;
  }
</style>
