<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { historyStore } from "$lib/stores/history.svelte";

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let jsonContent = $state(projectStore.exportJSON());
  let isEditing = $state(false);
  let isValid = $state(true);
  let errorMessage = $state("");

  function validateJSON(json: string): boolean {
    try {
      const parsed = JSON.parse(json);
      // Basic validation
      if (!parsed.id || !parsed.name || !parsed.display) {
        errorMessage = "Missing required fields: id, name, or display";
        return false;
      }
      errorMessage = "";
      return true;
    } catch (e) {
      errorMessage = `Invalid JSON: ${e instanceof Error ? e.message : "Unknown error"}`;
      return false;
    }
  }

  function handleJSONChange() {
    isValid = validateJSON(jsonContent);
  }

  function applyChanges() {
    if (!isValid) return;
    
    const success = projectStore.importJSON(jsonContent);
    if (success) {
      historyStore.clear();
      onClose();
    } else {
      errorMessage = "Failed to apply changes to project";
    }
  }

  function formatJSON() {
    try {
      const parsed = JSON.parse(jsonContent);
      jsonContent = JSON.stringify(parsed, null, 2);
      isValid = true;
      errorMessage = "";
    } catch (e) {
      errorMessage = "Cannot format invalid JSON";
    }
  }

  function copyToClipboard() {
    navigator.clipboard.writeText(jsonContent).then(() => {
      // Could add a toast notification here
    });
  }

  function reset() {
    jsonContent = projectStore.exportJSON();
    isValid = true;
    errorMessage = "";
    isEditing = false;
  }

  $effect(() => {
    // Update JSON content when project changes (only if not editing)
    if (!isEditing) {
      const currentJSON = projectStore.exportJSON();
      if (currentJSON !== jsonContent) {
        jsonContent = currentJSON;
      }
    }
  });
</script>

<div class="debug-modal">
  <div class="modal-header">
    <h2>Project Debug</h2>
    <div class="header-actions">
      {#if !isEditing}
        <button onclick={() => isEditing = true} class="edit-btn">Edit</button>
        <button onclick={copyToClipboard} class="copy-btn">Copy</button>
        <button onclick={formatJSON} class="format-btn">Format</button>
      {:else}
        <button onclick={reset} class="reset-btn">Reset</button>
        <button onclick={applyChanges} class="apply-btn" disabled={!isValid}>Apply</button>
      {/if}
      <button onclick={onClose} class="close-btn">×</button>
    </div>
  </div>

  <div class="modal-body">
    {#if !isValid && errorMessage}
      <div class="error-message">
        <strong>Error:</strong> {errorMessage}
      </div>
    {/if}

    <div class="json-container">
      <textarea
        bind:value={jsonContent}
        class="json-editor"
        readonly={!isEditing}
        placeholder="Project JSON will appear here..."
        oninput={handleJSONChange}
        class:invalid={!isValid}
      ></textarea>
    </div>

    {#if isEditing}
      <div class="edit-warning">
        <strong>⚠️ Editing Mode</strong><br>
        Be careful when editing raw JSON. Invalid changes may break your project.
      </div>
    {/if}
  </div>
</div>

<style>
  .debug-modal {
    width: 800px;
    height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    gap: var(--spacing-xs);
  }

  .modal-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: var(--spacing-md);
    overflow: hidden;
  }

  .json-container {
    flex: 1;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .json-editor {
    width: 100%;
    height: 100%;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.4;
    padding: var(--spacing-md);
    border: none;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    resize: none;
    outline: none;
  }

  .json-editor.invalid {
    background: rgba(255, 82, 82, 0.1);
    color: #ff5252;
  }

  .json-editor:read-only {
    background: var(--color-bg-secondary);
    cursor: default;
  }

  .error-message {
    background: rgba(255, 82, 82, 0.1);
    border: 1px solid #ff5252;
    border-radius: var(--radius-sm);
    padding: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    color: #ff5252;
    font-size: 13px;
  }

  .edit-warning {
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid #ffc107;
    border-radius: var(--radius-sm);
    padding: var(--spacing-sm);
    margin-top: var(--spacing-md);
    color: #ffc107;
    font-size: 12px;
  }

  .edit-btn {
    background: var(--color-accent);
    color: white;
  }

  .copy-btn,
  .format-btn {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .reset-btn {
    background: #6c757d;
    color: white;
  }

  .apply-btn {
    background: #28a745;
    color: white;
  }

  .apply-btn:disabled {
    background: #6c757d;
    opacity: 0.6;
    cursor: not-allowed;
  }

  .close-btn {
    background: transparent;
    color: var(--color-text-secondary);
    font-size: 20px;
    padding: var(--spacing-xs);
    width: 30px;
    height: 30px;
  }

  .close-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  button {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  button:hover:not(:disabled) {
    opacity: 0.8;
  }
</style>