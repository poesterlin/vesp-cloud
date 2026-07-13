<script lang="ts">
    import { dev } from "$app/environment";
  import { goto } from "$app/navigation";
  import {
    generateESPHomeYAML,
    generateFontsYAML,
    generateUIScreensHeader,
    generateUIStateHeader,
    generateUIThemeHeader,
    generateUITypesHeader,
  } from "$lib/codegen/esphome";
  import { generateSecretsYAML } from "$lib/codegen/secrets";
  import { validateProject } from "$lib/codegen/validations";
  import BuildHistory from "$lib/components/BuildHistory.svelte";
  import ConfirmCompileModal from "$lib/components/ConfirmCompileModal.svelte";
  import { deploymentStore } from "$lib/stores/deployment.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import * as mdiIcons from "@mdi/js";
  import JSZip from "jszip";
  import { onMount } from "svelte";

  const TEMPLATE_PREFIX = "../../../../lib/templates/";
  const staticTemplates = import.meta.glob("../../../../lib/templates/**/*", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;

  let { data } = $props();

  let showConfirmModal = $state(false);
  let flashJobId = $state<string | null>(null);
  let supportsWebSerial = $state(true);

  onMount(() => {
    supportsWebSerial = "serial" in navigator;

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
      zip.file(
        "secrets.yaml",
        generateSecretsYAML(project, { includeOtaSecrets: false }),
      );

      const validationErrors = validateProject(project);
      if (validationErrors.length > 0) {
        const messages = validationErrors
          .map((e) => `[${e.type}] ${e.message}`)
          .join("\n");
        deploymentStore.state.error = `Project validation failed:\n${messages}`;
        deploymentStore.state.validationErrors = validationErrors;
        return;
      }

      zip.file("includes/ui_types.h", generateUITypesHeader(project));
      zip.file("includes/ui_state.h", generateUIStateHeader(project));
      zip.file("includes/ui_screens.h", generateUIScreensHeader(project));
      zip.file("includes/ui_theme.h", generateUIThemeHeader(project));
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
  <title>vESP.cloud — Deploy</title>
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
    {@const id = deploymentStore.state.validationErrors[0]?.componentId}
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
        {#if id}
          <a
            class="error-goto"
            href="/project/{projectStore.project?.id}?componentId={id}"
            >Go to issue</a
          >
        {:else}
          <a class="error-goto" href="/project/{projectStore.project?.id}"
            >Go to Editor</a
          >
        {/if}
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

        {#if !supportsWebSerial}
          <div class="browser-warning-inline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" />
              <path d="M12 8V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="12" cy="16" r="0.5" fill="currentColor" />
            </svg>
            <span>
              USB flashing requires <strong>Chrome</strong> or <strong>Edge</strong>. Your browser
              does not support the Web Serial API — the install button below will not work.
            </span>
          </div>
        {/if}

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
        <div class="info-card info-card--usb">
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
              Connect via USB and use the <strong>Flash</strong> button on a
              build to install firmware. After flashing, the device creates a
              WiFi hotspot for initial setup.
            </p>
          </div>
        </div>
        <div class="info-card info-card--ota">
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
            <a
              class="ota-check-link"
              href="https://my.home-assistant.io/redirect/updates/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path
                  d="M18 13V19C18 19.5304 17.7893 20.0391 17.4142 20.4142C17.0391 20.7893 16.5304 21 16 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V8C3 7.46957 3.21071 6.96086 3.58579 6.58579C3.96086 6.21071 4.46957 6 5 6H11"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M15 3H21V9"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M10 14L21 3"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Check for updates in Home Assistant
            </a>
          </div>
        </div>
      </div>

      <div class="getting-started">
        <h2 class="getting-started-title">First build – getting it on your device</h2>
        <p class="getting-started-subtitle">
          Here's how to put your very first build onto the display hardware.
        </p>

        {#if !supportsWebSerial}
          <div class="browser-warning-inline">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" />
              <path d="M12 8V13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
              <circle cx="12" cy="16" r="0.5" fill="currentColor" />
            </svg>
            <span>
              USB flashing requires <strong>Chrome</strong> or <strong>Edge</strong>. Please
              open this page in a supported browser before connecting your device.
            </span>
          </div>
        {/if}

        <div class="getting-started-steps">
          <div class="getting-started-step">
            <div class="getting-started-step-num">1</div>
            <div class="getting-started-step-body">
              <h4>Build the firmware</h4>
              <p>
                Click <strong>"Update Display"</strong> below to compile your
                project into firmware. This typically takes 1–2 minutes. When it
                finishes, the build appears in the history below with a
                <strong>Flash</strong> button.
              </p>
            </div>
          </div>
          <div class="getting-started-step">
            <div class="getting-started-step-num">2</div>
            <div class="getting-started-step-body">
              <h4>Connect via USB</h4>
              <p>
                Plug the display into this computer using a
                <strong>USB-C cable</strong>. Make sure the cable supports data
                (not just charging).
              </p>
            </div>
          </div>
          <div class="getting-started-step">
            <div class="getting-started-step-num">3</div>
            <div class="getting-started-step-body">
              <h4>Install the firmware</h4>
              <p>
                Click <strong>Flash</strong> on the build entry below, then
                click <strong>"Install to Device"</strong>. Your browser will
                prompt you to select the serial port — pick the one that matches
                your device and the firmware installs directly from the browser.
              </p>
            </div>
          </div>
          <div class="getting-started-step">
            <div class="getting-started-step-num">4</div>
            <div class="getting-started-step-body">
              <h4>Configure WiFi</h4>
              <p>
                Once flashed, the display restarts and creates a temporary WiFi
                hotspot. Connect your phone or computer to that hotspot and enter
                your home WiFi credentials when prompted.
              </p>
              <p class="getting-started-step-hint">
                After this initial setup, all future firmware updates arrive
                automatically over WiFi — no USB cable needed again.
              </p>
            </div>
          </div>
        </div>
      </div>

      {#if !deploymentStore.state.compiling}
        <button class="new-build-btn" onclick={handleNewBuild}>
          <svg viewBox="0 0 24 24" aria-hidden="true" class="icon">
            <path d={mdiIcons.mdiWrench} />
          </svg>
          Update Display
        </button>
      {:else}
        <button class="new-build-btn" disabled> Building… </button>
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

  .icon {
    width: 24px;
    height: 24px;
    fill: currentColor;
    flex-shrink: 0;
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

  .error-goto {
    padding: 4px 10px;
    background: transparent;
    color: var(--color-accent);
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    text-decoration: none;
    font-family: inherit;
  }

  .error-goto:hover {
    background: var(--color-accent);
    color: white;
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

  .browser-warning-inline {
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm) var(--spacing-md);
    background: rgba(255, 152, 0, 0.08);
    border: 1px solid rgba(255, 152, 0, 0.2);
    border-radius: 8px;
    color: #e6a817;
    font-size: 12px;
    line-height: 1.45;
  }

  .browser-warning-inline svg {
    flex-shrink: 0;
    margin-top: 1px;
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

  .info-card--usb {
    border-left: 3px solid #42a5f5;
  }

  .info-card--ota {
    border-left: 3px solid #66bb6a;
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

  .ota-check-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 6px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-accent);
    text-decoration: none;
    transition: opacity 0.15s;
  }

  .ota-check-link:hover {
    opacity: 0.8;
  }

  /* ── Getting Started guide ── */

  .getting-started {
    padding: var(--spacing-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
  }

  .getting-started-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .getting-started-subtitle {
    margin: 6px 0 var(--spacing-lg) 0;
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .getting-started-steps {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .getting-started-step {
    display: flex;
    gap: var(--spacing-md);
  }

  .getting-started-step-num {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-accent);
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    flex-shrink: 0;
    margin-top: 1px;
  }

  .getting-started-step-body h4 {
    margin: 0 0 3px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .getting-started-step-body p {
    margin: 0;
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.55;
  }

  .getting-started-step-body p + p {
    margin-top: 6px;
  }

  .getting-started-step-hint {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-tertiary);
    border-radius: 6px;
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.45;
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
