<script lang="ts">
  import { ESPHOME_VERSION } from "$lib/codegen/esphome-version";

  interface Props {
    onConfirm: () => void;
    onCancel: () => void;
  }

  let { onConfirm, onCancel }: Props = $props();
</script>

<div class="modal-overlay" onclick={onCancel}>
  <div class="modal-content" onclick={(e: MouseEvent) => e.stopPropagation()}>
    <div class="modal-header">
      <h3>Download Project Files</h3>
      <button class="close-btn" onclick={onCancel} aria-label="close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="modal-body">
      <p class="description">
        The zip contains the complete ESPHome configuration for your project:
        the main YAML, fonts, secrets template, and all C++ include files.
        Compile it with your own ESPHome installation.
      </p>

      <div class="version-row">
        <span class="version-label">Configured for ESPHome</span>
        <span class="version-value">{ESPHOME_VERSION}</span>
      </div>

      <div class="info-note">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 16V11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="12" cy="8" r="0.5" fill="currentColor"/>
        </svg>
        <span>
          The generated code is tested against ESPHome
          <strong>{ESPHOME_VERSION}</strong>. Other versions may require
          adjustments. Cloud builds on vESP.cloud always use this version.
        </span>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn secondary" onclick={onCancel}>Cancel</button>
      <button class="btn primary" onclick={onConfirm}>Download</button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    width: 420px;
    max-width: 90vw;
    overflow: hidden;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-lg) var(--spacing-xl);
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
  }

  .modal-body {
    padding: var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
    max-height: min(70vh, 560px);
    overflow-y: auto;
  }

  .description {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .version-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }

  .version-label {
    color: var(--color-text-secondary);
  }

  .version-value {
    color: var(--color-text-primary);
    font-weight: 600;
    font-family: monospace;
    font-size: 14px;
  }

  .info-note {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: rgba(33, 150, 243, 0.08);
    border: 1px solid rgba(33, 150, 243, 0.25);
    border-radius: 8px;
    color: #64b5f6;
    font-size: 13px;
    line-height: 1.5;
  }

  .info-note svg {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-sm);
    padding: var(--spacing-md) var(--spacing-xl);
    border-top: 1px solid var(--color-border);
  }

  .btn {
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
    border: 1px solid var(--color-border);
  }

  .btn.secondary {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
  }

  .btn.secondary:hover {
    background: var(--color-bg-tertiary);
  }

  .btn.primary {
    background: var(--color-accent);
    color: white;
    border-color: var(--color-accent);
  }

  .btn.primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
