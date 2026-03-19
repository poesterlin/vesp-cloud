<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";

  interface Props {
    projectId: string;
    projectName: string;
    onClose: () => void;
    onSkip: () => void;
  }

  let { projectId, projectName, onClose, onSkip }: Props = $props();

  // Wizard state
  type WizardStep = "welcome" | "compiling" | "flash" | "done";
  let step = $state<WizardStep>("welcome");

  // Compilation state
  let compiling = $state(false);
  let compilationProgress = $state(0);
  let compilationStatus = $state("");
  let compilationError = $state<string | null>(null);
  let manifestUrl = $state<string | null>(null);

  async function startSetup() {
    step = "compiling";
    compiling = true;
    compilationError = null;
    compilationProgress = 0;
    compilationStatus = "Submitting build...";

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          projectName,
          config: JSON.stringify({ name: projectName }), // Minimal config for initial flash
          template: "initial",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to start compilation");
      }

      compilationProgress = 10;
      compilationStatus = "Build queued...";
      pollStatus(data.jobId);
    } catch (err: any) {
      compilationError = err.message;
      compiling = false;
    }
  }

  async function pollStatus(jobId: string) {
    const poll = async () => {
      try {
        const response = await fetch(`/api/compile?jobId=${jobId}`);
        const job = await response.json();
        if (!response.ok) throw new Error(job.error || "Failed to get status");

        if (job.status === "queued" || job.status === "pending") {
          compilationStatus = "Waiting in queue...";
          compilationProgress = 15;
        } else if (job.status === "running") {
          compilationStatus = "Compiling firmware...";
          compilationProgress = Math.min(compilationProgress + 5, 85);
        } else if (job.status === "completed") {
          compilationProgress = 100;
          compilationStatus = "Build complete!";
          compiling = false;
          manifestUrl = `/api/manifest/${jobId}`;

          setTimeout(() => {
            step = "flash";
          }, 600);
          return;
        } else if (job.status === "failed") {
          compilationError = job.error || "Compilation failed";
          compiling = false;
          return;
        }

        setTimeout(poll, 2000);
      } catch (err: any) {
        compilationError = err.message;
        compiling = false;
      }
    };

    poll();
  }

  function finishSetup() {
    step = "done";
    setTimeout(() => {
      onClose();
    }, 1500);
  }

  // Derive device name from project name for display
  const deviceName = $derived(
    projectName
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
  );
</script>

<svelte:head>
  <script
    type="module"
    src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module"
  ></script>
</svelte:head>

<div
  class="wizard-backdrop"
  onclick={onSkip}
  role="button"
  tabindex="-1"
  onkeydown={(e) => e.key === "Escape" && onSkip()}
  transition:fade={{ duration: 200 }}
>
  <div
    class="wizard"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.key === "Escape" && onSkip()}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    in:fly={{ y: 20, duration: 400, easing: cubicOut }}
  >
    <!-- Header -->
    <div class="wizard-header">
      <h2>
        {#if step === "welcome"}Project Created{:else if step === "compiling"}Building Firmware{:else if step === "flash"}Flash Your Display{:else}All Set!{/if}
      </h2>
      <button class="close-btn" onclick={onSkip} aria-label="Close">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 6L6 18M6 6L18 18"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>

    <div class="wizard-body">
      <!-- Step: Welcome -->
      {#if step === "welcome"}
        <div class="welcome-step" in:fade={{ duration: 300 }}>
          <div class="success-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" />
              <path
                d="M8 12L11 15L16 9"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>

          <h3>"{projectName}" is ready</h3>
          <p class="subtitle">Would you like to set up a display now?</p>

          <button class="primary-action" onclick={startSetup}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect
                x="4"
                y="3"
                width="16"
                height="18"
                rx="2"
                stroke="currentColor"
                stroke-width="1.5"
              />
              <path
                d="M9 13L11 15L15 11"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle cx="12" cy="7" r="1" fill="currentColor" />
            </svg>
            Setup New Display
          </button>

          <p class="action-desc">Flash initial firmware via USB to configure your device</p>

          <button class="text-action" onclick={onSkip}> Skip to Editor </button>
        </div>

        <!-- Step: Compiling -->
      {:else if step === "compiling"}
        <div class="compiling-step" in:fade={{ duration: 300 }}>
          <div class="compile-animation" class:error={compilationError}>
            {#if compilationError}
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" />
                <path
                  d="M15 9L9 15M9 9L15 15"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            {:else if compilationProgress >= 100}
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" class="check-icon">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" />
                <path
                  d="M8 12L11 15L16 9"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            {:else}
              <div class="spinner"></div>
            {/if}
          </div>

          <p class="compile-status" class:error={compilationError}>
            {compilationError ?? compilationStatus}
          </p>

          {#if !compilationError}
            <div class="progress-bar">
              <div class="progress-fill" style="width: {compilationProgress}%"></div>
            </div>
            <p class="compile-hint">This may take a few minutes on first build</p>
          {:else}
            <button class="retry-btn" onclick={startSetup}> Try Again </button>
          {/if}
        </div>

        <!-- Step: Flash -->
      {:else if step === "flash"}
        <div class="flash-step" in:fade={{ duration: 300 }}>
          <div class="success-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M8 12L11 15L16 9"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Firmware ready
          </div>

          <div class="flash-steps">
            <div class="mini-step">
              <span class="mini-step-num">1</span>
              <span>Plug in the display via USB-C</span>
            </div>
            <div class="mini-step">
              <span class="mini-step-num">2</span>
              <span>Click "Install" and select the serial port</span>
            </div>
            <div class="mini-step">
              <span class="mini-step-num">3</span>
              <span>Connect to "{deviceName} Setup" WiFi hotspot</span>
            </div>
          </div>

          {#if manifestUrl}
            <esp-web-install-button manifest={manifestUrl}>
              <button slot="activate" class="primary-action full-width"> Install to Device </button>
            </esp-web-install-button>
          {/if}

          <p class="flash-hint">
            After flashing, the display will create a WiFi hotspot. Connect to it to enter your
            WiFi credentials.
          </p>

          <button class="text-action" onclick={finishSetup}> Continue to Editor </button>
        </div>

        <!-- Step: Done -->
      {:else if step === "done"}
        <div class="done-step" in:fade={{ duration: 300 }}>
          <div class="done-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" />
              <path
                d="M8 12L11 15L16 9"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <h3>You're all set!</h3>
          <p>Opening the editor...</p>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .wizard-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(8px);
  }

  .wizard {
    background: #121212;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1.5rem;
    width: 90%;
    max-width: 480px;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .wizard-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .wizard-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #fff;
  }

  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary, #888);
    cursor: pointer;
    transition: all 0.15s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }

  .wizard-body {
    padding: 2rem;
  }

  /* Welcome Step */
  .welcome-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
  }

  .success-icon {
    color: #4ade80;
    animation: scaleIn 0.4s ease;
  }

  @keyframes scaleIn {
    from {
      transform: scale(0.5);
      opacity: 0;
    }
    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  .welcome-step h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #fff;
  }

  .subtitle {
    margin: 0;
    color: var(--color-text-secondary, #888);
    font-size: 1rem;
  }

  .primary-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    width: 100%;
    padding: 1rem 1.5rem;
    background: var(--color-accent, #4a9efe);
    color: white;
    border: none;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 0.5rem;
  }

  .primary-action:hover {
    background: var(--color-accent-hover, #3a8eee);
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(74, 158, 254, 0.3);
  }

  .primary-action.full-width {
    width: 100%;
  }

  .action-desc {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-muted, #666);
  }

  .text-action {
    background: none;
    border: none;
    color: var(--color-text-secondary, #888);
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.5rem 1rem;
    margin-top: 0.5rem;
    transition: color 0.15s;
  }

  .text-action:hover {
    color: #fff;
  }

  /* Compiling Step */
  .compiling-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1.5rem;
    padding: 1rem 0;
  }

  .compile-animation {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 80px;
    height: 80px;
  }

  .compile-animation.error {
    color: #f44336;
  }

  .check-icon {
    color: #4caf50;
    animation: scaleIn 0.3s ease;
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--color-accent, #4a9efe);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .compile-status {
    margin: 0;
    font-size: 1rem;
    font-weight: 500;
    color: #fff;
  }

  .compile-status.error {
    color: #f44336;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-accent, #4a9efe);
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .compile-hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-muted, #666);
  }

  .retry-btn {
    padding: 0.75rem 2rem;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    color: #fff;
    cursor: pointer;
    font-size: 0.95rem;
    font-weight: 500;
    transition: all 0.15s;
  }

  .retry-btn:hover {
    border-color: var(--color-accent, #4a9efe);
    background: rgba(74, 158, 254, 0.1);
  }

  /* Flash Step */
  .flash-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
  }

  .success-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 1rem;
    background: rgba(76, 175, 80, 0.12);
    color: #66bb6a;
    border-radius: 20px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .flash-steps {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    width: 100%;
    text-align: left;
    padding: 1rem 1.25rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 12px;
  }

  .mini-step {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.9rem;
    color: var(--color-text-secondary, #aaa);
    line-height: 1.4;
  }

  .mini-step-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 600;
    flex-shrink: 0;
  }

  .flash-hint {
    margin: 0;
    font-size: 0.8rem;
    color: var(--color-text-muted, #666);
    text-align: center;
    line-height: 1.5;
    max-width: 360px;
  }

  :global(esp-web-install-button) {
    display: block;
    width: 100%;
  }

  /* Done Step */
  .done-step {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
    padding: 2rem 0;
  }

  .done-icon {
    color: #4ade80;
    animation: scaleIn 0.4s ease;
  }

  .done-step h3 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #fff;
  }

  .done-step p {
    margin: 0;
    color: var(--color-text-secondary, #888);
  }
</style>
