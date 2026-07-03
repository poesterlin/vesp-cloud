<script lang="ts">
  import { page } from "$app/state";

  interface Props {
    flow?: "new" | "update" | null;
    onConfirm: () => void;
    onCancel: () => void;
  }

  let { onConfirm, onCancel }: Props = $props();

  let creditBalance = $state<number | null>(null);
  let balanceLoading = $state(true);
  const isCloud = page.data.isCloud;
  const cost = 1;

  let title = $derived("Build Firmware");
  let description = $derived(
    "This compiles one firmware image. After the build finishes, you can choose USB install, OTA publish, or download the binary.",
  );

  let canAfford = $derived(!isCloud || (creditBalance !== null && creditBalance >= cost));

  $effect(() => {
    if (isCloud) loadBalance();
    else balanceLoading = false;
  });

  async function loadBalance() {
    balanceLoading = true;
    try {
      const res = await fetch("/api/credits/balance");
      if (!res.ok) return;
      const payload = await res.json();
      creditBalance = typeof payload.balance === "number" ? payload.balance : null;
    } catch {
      creditBalance = null;
    } finally {
      balanceLoading = false;
    }
  }
</script>

<div class="modal-overlay" onclick={onCancel}>
  <div class="modal-content" onclick={(e: MouseEvent) => e.stopPropagation()}>
    <div class="modal-header">
      <h3>{title}</h3>
      <button class="close-btn" onclick={onCancel} aria-label="close">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    </div>

    <div class="modal-body">
      <p class="description">{description}</p>

      {#if isCloud}
        <div class="cost-row">
          <span class="cost-label">Cost</span>
          <span class="cost-value">{cost} credit</span>
        </div>
        <div class="cost-row">
          <span class="cost-label">Your balance</span>
          {#if balanceLoading}
            <span class="cost-value loading">Loading...</span>
          {:else}
            <span class="cost-value" class:low={!canAfford}>
              {creditBalance !== null ? `${creditBalance} credits` : "Unavailable"}
            </span>
          {/if}
        </div>

        {#if !canAfford}
          <a href="/credits" class="warning">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 9V13M12 17H12.01M10.29 3.86L1.82 18C1.64 18.3 1.55 18.65 1.55 19C1.55 20.1 2.45 21 3.55 21H20.45C21.55 21 22.45 20.1 22.45 19C22.45 18.65 22.36 18.3 22.18 18L13.71 3.86C13.32 3.18 12.69 2.81 12 2.81C11.31 2.81 10.68 3.18 10.29 3.86Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <span>Insufficient credits. Add credits before compiling.</span>
          </a>
        {/if}
      {/if}
    </div>

    <div class="modal-footer">
      <button class="btn secondary" onclick={onCancel}>Cancel</button>
      <button class="btn primary" onclick={onConfirm} disabled={balanceLoading || !canAfford}>
        {#if isCloud}
          Confirm & Compile
        {:else}
          Compile
        {/if}
      </button>
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
  }

  .description {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .cost-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }

  .cost-label {
    color: var(--color-text-secondary);
  }

  .cost-value {
    color: var(--color-text-primary);
    font-weight: 500;
  }

  .cost-value.low {
    color: #f44336;
  }

  .cost-value.loading {
    color: var(--color-text-secondary);
    font-style: italic;
  }

  .warning {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: rgba(244, 67, 54, 0.08);
    border: 1px solid rgba(244, 67, 54, 0.25);
    border-radius: 8px;
    color: #f44336;
    font-size: 13px;
  }

  .warning svg {
    flex-shrink: 0;
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
