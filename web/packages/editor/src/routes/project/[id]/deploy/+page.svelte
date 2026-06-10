<script lang="ts">
  import { goto } from "$app/navigation";
  import { projectStore } from "$lib/stores/project.svelte";
  import { deploymentStore } from "$lib/stores/deployment.svelte";
  import ConfirmCompileModal from "$lib/components/ConfirmCompileModal.svelte";
  import BuildHistory from "$lib/components/BuildHistory.svelte";
  import {
    generateESPHomeYAML,
    generateUITypesHeader,
    generateUIStateHeader,
    generateUIScreensHeader,
    generateFontsYAML,
  } from "$lib/codegen/esphome";
  import { validateProject } from "$lib/codegen/validations";
  import JSZip from "jszip";
  import { onMount } from "svelte";

  const TEMPLATE_PREFIX = "../templates/";
  const staticTemplates = import.meta.glob("../templates/**/*", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  let { data } = $props();

  let showConfirmModal = $state(false);
  let flashJobId = $state<string | null>(null);

  onMount(() => {
    if (data.project) {
      projectStore.loadFromServer(data.project);
    }

    deploymentStore.reset();

    if (data.activeJob) {
      deploymentStore.restoreJob(data.activeJob.id, data.activeJob.status);
    }
  });

  function handleNewBuild() {
    showConfirmModal = true;
  }

  function handleConfirmBuild() {
    showConfirmModal = false;
    deploymentStore.compile();
  }

  function handleFlash(jobId: string) {
    deploymentStore.state.jobId = jobId;
    deploymentStore.state.manifestUrl = `/api/manifest/${jobId}`;
    flashJobId = jobId;
  }

  function handleExitFlash() {
    flashJobId = null;
    deploymentStore.state.step = "idle";
  }

  async function handleDownloadProject() {
    if (!projectStore.project) return;
    try {
      const zip = new JSZip();
      const fileName = projectStore.project.name
        .toLowerCase()
        .replace(/\s+/g, "-");

      const project = {
        ...projectStore.project,
        secrets: {
          ...projectStore.project.secrets,
          firmwareUpdateUrl: undefined,
        },
      };

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

      zip.file("fonts.yaml", generateFontsYAML(project, baseFontsYaml));

      const validationErrors = validateProject(project);
      if (validationErrors.length > 0) {
        const messages = validationErrors
          .map((e) => `[${e.type}] ${e.message}`)
          .join("\n");
        deploymentStore.state.error = `Project validation failed:\n${messages}`;
        return;
      }

      zip.file("includes/ui_types.h", generateUITypesHeader(project));
      zip.file("includes/ui_state.h", generateUIStateHeader(project));
      zip.file("includes/ui_screens.h", generateUIScreensHeader(project));
      zip.file(`${fileName}.yaml`, generateESPHomeYAML(project));

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

  $effect(() => {
    if (
      deploymentStore.state.step === "done" &&
      deploymentStore.state.published
    ) {
      try {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;

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
  });
</script>

<svelte:head>
  <title
    >Deploy {projectStore.project
      ? `- ${projectStore.project.name}`
      : ""}</title
  >
  <script
    type="module"
    src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module"
  ></script>
</svelte:head>

<div class="deploy-page">
  <header class="deploy-header">
    <button
      class="back-btn"
      onclick={() => goto(`/project/${data.project.id}`)}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M10 12L6 8L10 4"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      Editor
    </button>
    <h1>Deploy</h1>
    <div class="header-actions">
      {#if !flashJobId}
        <button class="download-link" onclick={handleDownloadProject}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2V10M8 10L5 7M8 10L11 7"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M2 12V13C2 13.55 2.45 14 3 14H13C13.55 14 14 13.55 14 13V12"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Download files
        </button>
      {/if}
    </div>
  </header>

  {#if deploymentStore.state.step === "compiling" && deploymentStore.state.error}
    <div class="error-banner">
      <div class="error-banner-content">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M15 9L9 15M9 9L15 15"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        <span>Build failed: {deploymentStore.state.error}</span>
        <button class="error-retry" onclick={handleNewBuild}>Retry</button>
        <button class="error-dismiss" onclick={() => deploymentStore.reset()}
          >Dismiss</button
        >
      </div>
    </div>
  {/if}

  <div class="deploy-body">
    {#if flashJobId}
      <div class="flash-section">
        <button class="back-to-builds-btn" onclick={handleExitFlash}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 12L6 8L10 4"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Back to builds
        </button>
        <div class="flash-section-header">
          <h2>Install on a New Device</h2>
          <p class="flash-subtitle">
            Set up a display for the first time using USB.
          </p>
        </div>

        <div class="flash-cards">
          <div class="flash-card">
            <div class="flash-card-num">1</div>
            <div class="flash-card-body">
              <h4>Connect via USB</h4>
              <p>Plug the display into this computer using a USB-C cable.</p>
            </div>
          </div>
          <div class="flash-card">
            <div class="flash-card-num">2</div>
            <div class="flash-card-body">
              <h4>Install firmware</h4>
              <p>
                Click <strong>"Install to Device"</strong> below, then select the
                serial port.
              </p>
            </div>
          </div>
          <div class="flash-card">
            <div class="flash-card-num">3</div>
            <div class="flash-card-body">
              <h4>Configure WiFi</h4>
              <p>
                The device will restart and create a WiFi hotspot. Connect to it
                and enter your WiFi credentials.
              </p>
            </div>
          </div>
        </div>

        {#if deploymentStore.state.manifestUrl}
          <esp-web-install-button manifest={deploymentStore.state.manifestUrl}>
            <button slot="activate" class="install-btn">
              Install to Device
            </button>
          </esp-web-install-button>
        {/if}
      </div>
    {:else}
      <div class="info-section">
        <div class="info-card">
          <div class="info-card-icon usb-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2V10M12 10L9 7M12 10L15 7"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <rect
                x="8"
                y="10"
                width="8"
                height="12"
                rx="2"
                stroke="currentColor"
                stroke-width="1.5"
              />
            </svg>
          </div>
          <div class="info-card-text">
            <h4>New Device Setup</h4>
            <p>
              Connect via USB and use the <strong>Flash</strong> button on a build
              to install firmware. After flashing, the device creates a WiFi hotspot
              for initial setup.
            </p>
          </div>
        </div>
        <div class="info-card">
          <div class="info-card-icon ota-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <path
                d="M22 2L13 11"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
              <path
                d="M16 2H22V8"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <div class="info-card-text">
            <h4>Auto Updates</h4>
            <p>
              Already-running devices update automatically over WiFi via Home
              Assistant. No USB connection needed.
            </p>
          </div>
        </div>
      </div>

      {#if !deploymentStore.state.compiling}
        <button class="new-build-btn" onclick={handleNewBuild}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3V13M3 8H13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          New Build
        </button>
      {:else}
        <button class="new-build-btn" disabled>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3V13M3 8H13"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          Building…
        </button>
      {/if}

      <BuildHistory onFlash={handleFlash} />
    {/if}
  </div>
</div>

{#if showConfirmModal}
  <ConfirmCompileModal
    onConfirm={handleConfirmBuild}
    onCancel={() => (showConfirmModal = false)}
  />
{/if}

<style>
  .deploy-page {
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    background: var(--color-bg-primary);
  }

  .deploy-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-xl);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    height: 56px;
    flex-shrink: 0;
  }

  .back-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 13px;
    cursor: pointer;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 8px;
    transition: all 0.15s;
    font-family: inherit;
  }

  .back-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }

  .deploy-header h1 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .header-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .back-to-builds-btn {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-sm);
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 13px;
    cursor: pointer;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 8px;
    transition: all 0.15s;
    font-family: inherit;
    align-self: flex-start;
  }

  .back-to-builds-btn:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-secondary);
  }

  .download-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-size: 12px;
    cursor: pointer;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 6px;
    transition: all 0.15s;
    font-family: inherit;
  }

  .download-link:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }

  .new-build-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .new-build-btn:hover {
    background: var(--color-accent-hover);
  }

  .new-build-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error-banner {
    flex-shrink: 0;
    padding: var(--spacing-sm) var(--spacing-xl);
    background: rgba(244, 67, 54, 0.1);
    border-bottom: 1px solid rgba(244, 67, 54, 0.25);
  }

  .error-banner-content {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    color: #f44336;
    font-size: 13px;
  }

  .error-banner-content svg {
    flex-shrink: 0;
  }

  .error-banner-content span {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .error-retry {
    padding: 4px 10px;
    background: #f44336;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }

  .error-retry:hover {
    background: #e53935;
  }

  .error-dismiss {
    padding: 4px 10px;
    background: transparent;
    color: #f44336;
    border: 1px solid rgba(244, 67, 54, 0.4);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    font-family: inherit;
  }

  .error-dismiss:hover {
    background: rgba(244, 67, 54, 0.15);
  }

  .deploy-body {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    max-width: 680px;
    width: 100%;
    margin: 0 auto;
  }

  .flash-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    padding-top: var(--spacing-lg);
  }

  .flash-section-header h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .flash-subtitle {
    margin: 6px 0 0;
    font-size: 14px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .flash-cards {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .flash-card {
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 10px;
  }

  .flash-card-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--color-bg-tertiary);
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
    flex-shrink: 0;
  }

  .flash-card-body h4 {
    margin: 0 0 2px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .flash-card-body p {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .install-btn {
    width: 100%;
    padding: 14px;
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
    font-family: inherit;
  }

  .install-btn:hover {
    background: var(--color-accent-hover);
  }

  :global(esp-web-install-button) {
    display: block;
    width: 100%;
  }

  .ota-note {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    color: var(--color-text-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .ota-note svg {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .info-section {
    display: flex;
    gap: var(--spacing-md);
  }

  .info-card {
    flex: 1;
    display: flex;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 10px;
  }

  .info-card-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    flex-shrink: 0;
  }

  .usb-icon {
    background: rgba(33, 150, 243, 0.12);
    color: #64b5f6;
  }

  .ota-icon {
    background: rgba(76, 175, 80, 0.12);
    color: #66bb6a;
  }

  .info-card-text h4 {
    margin: 0 0 4px 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .info-card-text p {
    margin: 0;
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.5;
    text-wrap-style: balance;
  }

  @media (max-width: 700px) {
    .info-section {
      flex-direction: column;
    }

    .deploy-header {
      padding: var(--spacing-md);
    }

    .deploy-body {
      padding: var(--spacing-md);
    }

    .download-link {
      display: none;
    }
  }
</style>
