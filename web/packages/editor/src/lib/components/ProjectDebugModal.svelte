<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import { page } from "$app/stores";

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();
  const screenshotDebugEnabled = $derived(
    ($page.data as { screenshotDebugEnabled?: boolean } | undefined)?.screenshotDebugEnabled === true,
  );
  const screenshotDeviceId = $derived(
    (projectStore.project?.name ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, ""),
  );
  let screenshotUrl = $state<string | null>(null);
  let screenshotError = $state<string | null>(null);
  let screenshotLoading = $state(false);

  function revokeBlobUrl() {
    if (screenshotUrl) {
      URL.revokeObjectURL(screenshotUrl);
      screenshotUrl = null;
    }
  }

  async function refreshScreenshot() {
    if (!screenshotDebugEnabled) return;
    screenshotError = null;
    try {
      const res = await fetch(`/api/screenshot/${screenshotDeviceId}?_=${Date.now()}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        revokeBlobUrl();
        return;
      }
      if (!res.ok) {
        screenshotError = `${res.status} ${res.statusText}`;
        return;
      }
      const blob = await res.blob();
      revokeBlobUrl();
      screenshotUrl = URL.createObjectURL(blob);
    } catch (err) {
      screenshotError = err instanceof Error ? err.message : "Failed to load screenshot";
    }
  }

  function onCaptureScreenshot() {
    // Devices wake on `button.press` of `button.<deviceId>_screenshot`.
    const entity = `button.${screenshotDeviceId}_screenshot`;
    // Poll for a new screenshot after the device has had time to capture +
    // upload (~1.5s). The editor cannot call button.press directly without
    // HA credentials; the user must press the entity in Home Assistant.
    screenshotLoading = true;
    setTimeout(async () => {
      await refreshScreenshot();
      screenshotLoading = false;
    }, 1500);
    void entity;
  }

  $effect(() => {
    if (screenshotDebugEnabled && screenshotDeviceId) {
      refreshScreenshot();
    }
  });

  let jsonContent = $state(JSON.stringify(JSON.parse(projectStore.exportJSON()), null, 2));
  let isEditing = $state(false);
  let isValid = $state(true);
  let errorMessage = $state("");
  let hasBeenFormatted = $state(true);

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
      const formatted = JSON.stringify(parsed, null, 2);
      jsonContent = formatted;
      hasBeenFormatted = true;
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
    jsonContent = JSON.stringify(JSON.parse(projectStore.exportJSON()), null, 2);
    hasBeenFormatted = true;
    isValid = true;
    errorMessage = "";
    isEditing = false;
  }

  $effect(() => {
    // Update JSON content when project changes (only if not editing and hasn't been manually formatted)
    if (!isEditing && !hasBeenFormatted) {
      const currentJSON = projectStore.exportJSON();
      if (currentJSON !== jsonContent) {
        jsonContent = JSON.stringify(JSON.parse(currentJSON), null, 2);
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
      {:else}
        <button onclick={reset} class="reset-btn">Reset</button>
        <button onclick={applyChanges} class="apply-btn" disabled={!isValid}>Apply</button>
      {/if}
      <button onclick={copyToClipboard} class="copy-btn">Copy</button>
      <button onclick={formatJSON} class="format-btn">Format</button>
      <button onclick={onClose} class="close-btn">×</button>
    </div>
  </div>

  <div class="modal-body">
    {#if !isValid && errorMessage}
      <div class="error-message">
        <strong>Error:</strong> {errorMessage}
      </div>
    {/if}

    {#if screenshotDebugEnabled}
      <section class="screenshot-section">
        <header class="screenshot-header">
          <h3>Device Screenshot (debug)</h3>
          <div class="screenshot-actions">
            <button
              type="button"
              onclick={refreshScreenshot}
              disabled={screenshotLoading}
              class="capture-btn"
            >
              Refresh
            </button>
            <button
              type="button"
              onclick={onCaptureScreenshot}
              disabled={screenshotLoading}
              class="capture-btn primary"
              title="Press button.{screenshotDeviceId}_screenshot in Home Assistant, then wait ~1.5s for the device to upload."
            >
              Capture
            </button>
          </div>
        </header>
        {#if screenshotError}
          <p class="error-message">{screenshotError}</p>
        {/if}
        <div class="screenshot-frame">
          {#if screenshotUrl}
            <img
              src={screenshotUrl}
              alt="Latest device screenshot"
            />
          {:else}
            <p class="screenshot-empty">
              {screenshotLoading ? "Requesting..." : "No screenshot yet"}
            </p>
          {/if}
        </div>
        <p class="screenshot-hint">
          Entity: <code>button.{screenshotDeviceId}_screenshot</code>
        </p>
      </section>
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
    white-space: pre-wrap;
    word-wrap: break-word;
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

  .screenshot-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
    margin-bottom: var(--spacing-md);
  }

  .screenshot-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .screenshot-header h3 {
    margin: 0;
    font-size: 14px;
    text-transform: none;
    letter-spacing: 0;
    color: var(--color-text-primary);
  }

  .screenshot-actions {
    display: flex;
    gap: var(--spacing-xs);
  }

  .capture-btn {
    padding: 4px 10px;
    font-size: 12px;
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .capture-btn.primary {
    background: var(--color-accent);
    color: white;
    border-color: var(--color-accent);
  }

  .capture-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .screenshot-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    background: #000;
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .screenshot-frame img {
    display: block;
    width: 480px;
    height: 480px;
    max-width: 100%;
    max-height: 60vh;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .screenshot-empty {
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .screenshot-hint {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .screenshot-hint code {
    font-family: 'Consolas', 'Monaco', monospace;
    background: var(--color-bg-tertiary);
    padding: 1px 4px;
    border-radius: 3px;
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