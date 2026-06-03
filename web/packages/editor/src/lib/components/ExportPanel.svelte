<script lang="ts">
  import { goto } from "$app/navigation";
  import { projectStore } from "$lib/stores/project.svelte";
  import {
    generateESPHomeYAML,
    generateUITypesHeader,
    generateUIStateHeader,
    generateUIScreensHeader,
    generateFontsYAML,
  } from "$lib/codegen/esphome";
  import { validateProject } from "$lib/codegen/validations";
  import { assert } from "$lib/utils";
  import JSZip from "jszip";

  // Static ESPHome template files (base.yaml, hardware.yaml, fonts.yaml,
  // includes/*.h, ...) bundled at build time. This is the client-side
  // counterpart of `copyStaticTemplates` used by the server queue and
  // MUST stay in sync with `$lib/server/esphome-templates.ts`.
  const TEMPLATE_PREFIX = "../templates/";
  const staticTemplates = import.meta.glob("../templates/**/*", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  interface Props {
    onClose: () => void;
    onCompilingChange?: (isCompiling: boolean) => void;
  }

  let { onClose, onCompilingChange }: Props = $props();

  // Wizard state
  type WizardStep = "choose" | "compiling" | "flash" | "publish" | "done";
  type FlowType = "new" | "update" | null;

  let step = $state<WizardStep>("choose");
  let flow = $state<FlowType>(null);

  // Compilation state
  let compiling = $state(false);
  let compilationProgress = $state(0);
  let compilationStatus = $state<string>("");
  let compilationError = $state<string | null>(null);
  let lastJobId = $state<string | null>(null);
  let manifestUrl = $state<string | null>(null);

  // Publish state
  let published = $state(false);
  let publishing = $state(false);

  // Check for existing builds on mount
  let hasExistingBuild = $state(false);
  let existingBuildPublished = $state(false);

  $effect(() => {
    onCompilingChange?.(compiling);
  });

  $effect(() => {
    checkExistingBuild();
  });

  async function checkExistingBuild() {
    if (!projectStore.project) return;
    try {
      const res = await fetch(
        `/api/compile?projectId=${projectStore.serverProjectId}&latest=true`,
      );
      if (res.ok) {
        const job = await res.json();
        if (job?.id) {
          hasExistingBuild = true;
          existingBuildPublished = !!job.published;
        }
      }
    } catch {}
  }

  function startFlow(type: FlowType) {
    flow = type;
    compile();
  }

  async function compile() {
    assert(projectStore.project, "No project loaded");
    compiling = true;
    compilationError = null;
    compilationProgress = 0;
    compilationStatus = "Submitting build...";
    step = "compiling";

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectStore.serverProjectId,
          projectName: projectStore.project.name,
          config: projectStore.exportJSON(),
        }),
      });

      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Failed to start compilation");

      lastJobId = data.jobId;
      published = false;
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

        if (job.status === "queued") {
          compilationStatus = "Waiting in queue...";
          compilationProgress = 15;
        } else if (job.status === "running") {
          compilationStatus = "Compiling firmware...";
          // Gradually increase progress while running
          compilationProgress = Math.min(compilationProgress + 5, 85);
        } else if (job.status === "completed") {
          compilationProgress = 100;
          compilationStatus = "Build complete!";
          compiling = false;
          manifestUrl = `/api/manifest/${jobId}`;
          playPling();

          // Move to next step after brief pause
          setTimeout(() => {
            step = flow === "new" ? "flash" : "publish";
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

  async function publishBuild() {
    if (!lastJobId || publishing) return;
    publishing = true;
    try {
      const res = await fetch(`/api/compile/${lastJobId}/publish`, {
        method: "POST",
      });
      if (res.ok) {
        published = true;
        if (projectStore.firmwareToken) {
          const url = `${window.location.origin}/api/firmware/${projectStore.firmwareToken}/manifest`;
          projectStore.updateProject({
            secrets: {
              ...projectStore.secrets,
              firmwareUpdateUrl: url,
            },
          });
        }
        step = "done";
      }
    } catch (e) {
      console.error("Failed to publish", e);
    } finally {
      publishing = false;
    }
  }

  async function downloadProject() {
    if (!projectStore.project) return;
    try {
      const zip = new JSZip();
      const fileName = projectStore.project.name
        .toLowerCase()
        .replace(/\s+/g, "-");

      // Mirror the server queue: if we have a firmware token and the
      // project does not already carry a firmwareUpdateUrl, inject one
      // pointing at this server so OTA updates work out of the box.
      const project = projectStore.project;

      // 1. Copy bundled static templates (base.yaml, hardware.yaml,
      //    includes/*.h, ...). fonts.yaml is held back so we can append
      //    per-project MDI icon glyphs below.
      let baseFontsYaml = "";
      for (const [key, content] of Object.entries(staticTemplates)) {
        const relativePath = key.startsWith(TEMPLATE_PREFIX)
          ? key.slice(TEMPLATE_PREFIX.length)
          : key;
        if (relativePath === "fonts.yaml") {
          baseFontsYaml = content;
          continue;
        }
        zip.file(relativePath, content);
      }

      // 2. fonts.yaml augmented with project-specific MDI icons.
      zip.file("fonts.yaml", generateFontsYAML(project, baseFontsYaml));

      // Validate project before codegen
      const validationErrors = validateProject(project);
      if (validationErrors.length > 0) {
        const messages = validationErrors.map((e) => `[${e.type}] ${e.message}`).join('\n');
        compilationError = `Project validation failed:\n${messages}`;
        return;
      }

      // 3. Generated dynamic C++ headers (mirrors the queue).
      zip.file("includes/ui_types.h", generateUITypesHeader(project));
      zip.file("includes/ui_state.h", generateUIStateHeader(project));
      zip.file("includes/ui_screens.h", generateUIScreensHeader(project));

      // 4. The main ESPHome config + secrets.
      zip.file(`${fileName}.yaml`, generateESPHomeYAML(project));
      // zip.file("secrets.yaml", generateSecretsYAML(project));

      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download project zip:", err);
    }
  }

  let firmwareUrl = $derived(
    projectStore.firmwareToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/api/firmware/${projectStore.firmwareToken}/manifest`
      : null,
  );

  let copied = $state(false);

  const insufficientCreditsRegex =
    /Insufficient credits\. Cost: (?<cost>\d+), balance: (?<balance>\d+)/;

  let insufficientCreditsDetails = $derived.by(() => {
    if (!compilationError) return null;
    const match = compilationError.match(insufficientCreditsRegex);
    if (!match?.groups) return null;

    return {
      cost: Number(match.groups.cost),
      balance: Number(match.groups.balance),
    };
  });

  function copyFirmwareUrl() {
    if (firmwareUrl) {
      navigator.clipboard.writeText(firmwareUrl);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  function playPling() {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      // Note 1: B5 (987.77 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.15, now + 0.01);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Note 2: E6 (1318.51 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1318.51, now + 0.07);
      gain2.gain.setValueAtTime(0, now + 0.07);
      gain2.gain.linearRampToValueAtTime(0.2, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.07);
      osc2.stop(now + 0.55);
    } catch (err) {
      console.warn("Failed to play pling sound:", err);
    }
  }

  function reset() {
    step = "choose";
    flow = null;
    compilationError = null;
    compilationProgress = 0;
    compilationStatus = "";
  }
</script>

<svelte:head>
  <script
    type="module"
    src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module"
  ></script>
</svelte:head>

<div class="wizard">
  <!-- Header -->
  <div class="wizard-header">
    {#if step !== "choose"}
      <button class="back-btn" onclick={reset} disabled={compiling} aria-label="back">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    {/if}
    <h2>
      {#if step === "choose"}Deploy{:else if step === "compiling"}Building{:else if step === "flash"}Install{:else if step === "publish"}Publish{:else}Done{/if}
    </h2>
    <button class="close-btn" onclick={() => !compiling && onClose()} disabled={compiling} aria-label="close">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    </button>
  </div>

  <!-- Steps indicator -->
  {#if flow}
    <div class="steps-bar">
      <div class="step-dot" class:active={step === "compiling"} class:done={step === "flash" || step === "publish" || step === "done"}></div>
      <div class="step-line" class:done={step === "flash" || step === "publish" || step === "done"}></div>
      <div class="step-dot" class:active={step === "flash" || step === "publish"} class:done={step === "done"}></div>
      <div class="step-line" class:done={step === "done"}></div>
      <div class="step-dot" class:active={step === "done"}></div>
    </div>
  {/if}

  <div class="wizard-body">
    <!-- Step: Choose flow -->
    {#if step === "choose"}
      <div class="choose-flow">
        <p class="subtitle">How would you like to deploy <strong>{projectStore.project?.name}</strong>?</p>

        <button class="flow-card" onclick={() => startFlow("new")}>
          <div class="flow-icon new-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M9 13L11 15L15 11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="12" cy="7" r="1" fill="currentColor"/>
            </svg>
          </div>
          <div class="flow-text">
            <span class="flow-title">Setup New Device</span>
            <span class="flow-desc">Build firmware and flash it to a new display over USB</span>
          </div>
          <svg class="flow-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 5L12 10L7 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <button class="flow-card" onclick={() => startFlow("update")}>
          <div class="flow-icon update-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M22 2L16 8M22 2V8M22 2H16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="flow-text">
            <span class="flow-title">Push Update</span>
            <span class="flow-desc">Build and publish an over-the-air update for existing devices</span>
          </div>
          <svg class="flow-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 5L12 10L7 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>

        <div class="divider">
          <span>or</span>
        </div>

        <button class="download-link" onclick={downloadProject}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2V10M8 10L5 7M8 10L11 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12V13C2 13.55 2.45 14 3 14H13C13.55 14 14 13.55 14 13V12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Download project files for manual setup
        </button>
      </div>

    <!-- Step: Compiling -->
    {:else if step === "compiling"}
      <div class="compiling-view">
        <div class="compile-animation" class:error={compilationError}>
          {#if compilationError}
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
              <path d="M15 9L9 15M9 9L15 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          {:else if compilationProgress >= 100}
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" class="check-icon">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
              <path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
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
          <p class="compile-hint">This can take a few minutes on first build</p>
        {:else}
          {#if insufficientCreditsDetails}
            <div class="credits-cta">
              <p class="credits-cta-title">You're out of credits</p>
              <p class="credits-cta-copy">
                This build costs {insufficientCreditsDetails.cost} credit{insufficientCreditsDetails.cost === 1 ? "" : "s"}, and your balance is {insufficientCreditsDetails.balance}.
              </p>
              <button class="primary-action" onclick={() => goto("/credits")}>Add Credits</button>
            </div>
          {:else}
            <button class="retry-btn" onclick={() => compile()}>
              Try Again
            </button>
          {/if}
        {/if}
      </div>

    <!-- Step: Flash new device -->
    {:else if step === "flash"}
      <div class="flash-view">
        <div class="success-badge">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Firmware ready
        </div>

        <p class="step-instruction">
          Connect your display to this computer via USB, then click install below.
        </p>

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
            <span>The display will restart with your dashboard</span>
          </div>
        </div>

        {#if manifestUrl}
          <esp-web-install-button manifest={manifestUrl}>
            <button slot="activate" class="primary-action">
              Install to Device
            </button>
          </esp-web-install-button>
        {/if}

        <p class="step-hint">
          After flashing, the device will create a WiFi hotspot for initial setup.
          Connect to it and enter your WiFi credentials.
        </p>

        <button class="text-action" onclick={() => { step = "done"; }}>
          Skip — I'll flash later
        </button>
      </div>

    <!-- Step: Publish OTA -->
    {:else if step === "publish"}
      <div class="publish-view">
        <div class="success-badge">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Firmware ready
        </div>

        <p class="step-instruction">
          Publish this build so your devices can update automatically through Home Assistant.
        </p>

        {#if existingBuildPublished}
          <div class="info-note">
            This will replace the currently published version.
          </div>
        {/if}

        <button
          class="primary-action"
          disabled={publishing}
          onclick={publishBuild}
        >
          {publishing ? "Publishing..." : "Publish Update"}
        </button>

        <button class="text-action" onclick={() => { step = "done"; }}>
          Skip — don't publish yet
        </button>
      </div>

    <!-- Step: Done -->
    {:else if step === "done"}
      <div class="done-view">
        <div class="done-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
            <path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        {#if published}
          <h3>Update Published</h3>
          <p class="done-desc">
            Your devices will show an update notification in Home Assistant. They'll download and install the new firmware automatically.
          </p>

          {#if firmwareUrl}
            <div class="firmware-url-section">
              <label>Firmware URL</label>
              <div class="url-row">
                <input type="text" readonly value={firmwareUrl} class="url-input" />
                <button class="copy-btn" onclick={copyFirmwareUrl}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p class="url-hint">
                Devices use this URL to check for updates. It's already configured in your project.
              </p>
            </div>
          {/if}
        {:else if flow === "new"}
          <h3>You're All Set</h3>
          <p class="done-desc">
            Your firmware has been built. You can come back here anytime to flash it to a device or publish it for OTA updates.
          </p>
        {:else}
          <h3>Build Complete</h3>
          <p class="done-desc">
            Your firmware is ready but hasn't been published yet. Come back when you're ready to push it to your devices.
          </p>
        {/if}

        <button class="primary-action" onclick={onClose}>Done</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .wizard {
    display: flex;
    flex-direction: column;
    width: 480px;
    max-height: 80vh;
    background: var(--color-bg-primary);
    overflow: hidden;
  }

  .wizard-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-lg) var(--spacing-xl);
    border-bottom: 1px solid var(--color-border);
  }

  .wizard-header h2 {
    flex: 1;
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .back-btn,
  .close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .back-btn:hover:not(:disabled),
  .close-btn:hover {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
  }

  .back-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .close-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Steps bar */
  .steps-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    padding: var(--spacing-md) var(--spacing-xl);
    border-bottom: 1px solid var(--color-border);
  }

  .step-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--color-bg-tertiary, #333);
    border: 2px solid var(--color-border);
    transition: all 0.3s;
  }

  .step-dot.active {
    background: var(--color-accent);
    border-color: var(--color-accent);
    box-shadow: 0 0 0 3px rgba(74, 158, 255, 0.2);
  }

  .step-dot.done {
    background: #4caf50;
    border-color: #4caf50;
  }

  .step-line {
    width: 60px;
    height: 2px;
    background: var(--color-border);
    transition: background 0.3s;
  }

  .step-line.done {
    background: #4caf50;
  }

  /* Body */
  .wizard-body {
    padding: var(--spacing-xl);
    overflow-y: auto;
    flex: 1;
  }

  /* Choose flow */
  .choose-flow {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .subtitle {
    margin: 0 0 var(--spacing-sm);
    color: var(--color-text-secondary);
    font-size: 14px;
    line-height: 1.5;
  }

  .flow-card {
    display: flex;
    align-items: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
    color: var(--color-text-primary);
    font-family: inherit;
  }

  .flow-card:hover {
    border-color: var(--color-accent);
    background: var(--color-bg-tertiary, rgba(74, 158, 255, 0.05));
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .flow-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    flex-shrink: 0;
  }

  .new-icon {
    background: rgba(33, 150, 243, 0.12);
    color: #64b5f6;
  }

  .update-icon {
    background: rgba(255, 152, 0, 0.12);
    color: #ffb74d;
  }

  .flow-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .flow-title {
    font-size: 15px;
    font-weight: 600;
  }

  .flow-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .flow-arrow {
    color: var(--color-text-secondary);
    flex-shrink: 0;
    opacity: 0.5;
    transition: all 0.2s;
  }

  .flow-card:hover .flow-arrow {
    opacity: 1;
    transform: translateX(2px);
    color: var(--color-accent);
  }

  .divider {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    margin: var(--spacing-xs) 0;
    color: var(--color-text-secondary);
    font-size: 12px;
  }

  .divider::before,
  .divider::after {
    content: "";
    flex: 1;
    height: 1px;
    background: var(--color-border);
  }

  .download-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-sm);
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 13px;
    cursor: pointer;
    padding: var(--spacing-sm);
    border-radius: 8px;
    transition: color 0.15s;
    font-family: inherit;
  }

  .download-link:hover {
    color: var(--color-accent);
  }

  /* Compiling */
  .compiling-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: var(--spacing-lg);
    padding: var(--spacing-xl) 0;
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

  @keyframes scaleIn {
    from { transform: scale(0.5); opacity: 0; }
    to { transform: scale(1); opacity: 1; }
  }

  .spinner {
    width: 48px;
    height: 48px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .compile-status {
    margin: 0;
    font-size: 15px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .compile-status.error {
    color: #f44336;
  }

  .progress-bar {
    width: 100%;
    height: 4px;
    background: var(--color-bg-secondary);
    border-radius: 2px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .compile-hint {
    margin: 0;
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .retry-btn {
    padding: var(--spacing-sm) var(--spacing-xl);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: 14px;
    font-family: inherit;
    transition: all 0.15s;
  }

  .retry-btn:hover {
    border-color: var(--color-accent);
    background: var(--color-bg-tertiary, #333);
  }

  .credits-cta {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    width: 100%;
    padding: var(--spacing-lg);
    border: 1px solid rgba(255, 152, 0, 0.35);
    border-radius: 12px;
    background: rgba(255, 152, 0, 0.08);
  }

  .credits-cta-title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: #ffcc80;
  }

  .credits-cta-copy {
    margin: 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--color-text-secondary);
  }

  /* Flash view */
  .flash-view,
  .publish-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-lg);
    text-align: center;
  }

  .success-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    padding: 6px 14px;
    background: rgba(76, 175, 80, 0.12);
    color: #66bb6a;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
  }

  .step-instruction {
    margin: 0;
    font-size: 14px;
    line-height: 1.6;
    color: var(--color-text-secondary);
    max-width: 360px;
  }

  .flash-steps {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    width: 100%;
    text-align: left;
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--color-bg-secondary);
    border-radius: 10px;
  }

  .mini-step {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.4;
  }

  .mini-step-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--color-bg-tertiary, #333);
    color: var(--color-text-primary);
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .primary-action {
    width: 100%;
    padding: 14px;
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    font-family: inherit;
  }

  .primary-action:hover:not(:disabled) {
    background: var(--color-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 14px rgba(74, 158, 255, 0.3);
  }

  .primary-action:disabled {
    opacity: 0.6;
    cursor: wait;
  }

  .text-action {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 13px;
    cursor: pointer;
    padding: var(--spacing-sm);
    font-family: inherit;
    transition: color 0.15s;
  }

  .text-action:hover {
    color: var(--color-text-primary);
  }

  .step-hint {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.5;
    max-width: 340px;
    opacity: 0.7;
  }

  .info-note {
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 152, 0, 0.1);
    color: #ffb74d;
    border-radius: 8px;
    font-size: 13px;
    width: 100%;
  }

  :global(esp-web-install-button) {
    display: block;
    width: 100%;
  }

  /* Done view */
  .done-view {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-lg);
    text-align: center;
    padding: var(--spacing-lg) 0;
  }

  .done-icon {
    color: #4caf50;
    animation: scaleIn 0.4s ease;
  }

  .done-view h3 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .done-desc {
    margin: 0;
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.6;
    max-width: 360px;
  }

  .firmware-url-section {
    width: 100%;
    text-align: left;
  }

  .firmware-url-section label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-secondary);
    margin-bottom: var(--spacing-xs);
    display: block;
  }

  .url-row {
    display: flex;
    gap: var(--spacing-sm);
  }

  .url-input {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    font-family: monospace;
    font-size: 12px;
  }

  .copy-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: 13px;
    white-space: nowrap;
    font-family: inherit;
    transition: border-color 0.15s;
  }

  .copy-btn:hover {
    border-color: var(--color-accent);
  }

  .url-hint {
    margin: var(--spacing-xs) 0 0;
    font-size: 12px;
    color: var(--color-text-secondary);
    opacity: 0.7;
  }
</style>
