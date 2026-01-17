<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { generateESPHomeYAML } from "$lib/codegen/esphome";
  import { generateCppRenderer } from "$lib/codegen/cpp";
  import { generateStateHeader } from "$lib/codegen/state-manager";
  import { generateTouchHandler } from "$lib/codegen/touch-handler";
  import { generateSensorsYAML } from "$lib/codegen/sensors";
  import { generateRenderHelpers } from "$lib/codegen/render-helpers";
  import { generateRenderPages } from "$lib/codegen/render-pages";
  import { generateRenderDetails } from "$lib/codegen/render-details";
  import { assert } from "$lib/utils";
  import JSZip from "jszip";

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  let compiling = $state(false);
  let compilationStatus = $state<string | null>(null);
  let manifestUrl = $state<string | null>(null);

  async function compile() {
    if (compiling) return;

    assert(projectStore.project, "No project loaded for compilation");
    compiling = true;
    compilationStatus = "Starting...";

    try {
      const response = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectStore.project.id,
          projectName: projectStore.project.name,
          config: projectStore.exportJSON(),
        }),
      });

      if (!response.ok) throw new Error("Failed to start compilation");

      const { jobId } = await response.json();
      pollStatus(jobId);
    } catch (err: any) {
      compilationStatus = `Error: ${err.message}`;
      compiling = false;
    }
  }

  async function pollStatus(jobId: string) {
    const poll = async () => {
      try {
        const response = await fetch(`/api/compile?jobId=${jobId}`);
        if (!response.ok) throw new Error("Failed to get status");

        const job = await response.json();
        compilationStatus = job.status;

        if (job.status === "completed") {
          compiling = false;
          createManifest(jobId);
        } else if (job.status === "failed") {
          compiling = false;
        } else {
          setTimeout(poll, 2000);
        }
      } catch (err: any) {
        compilationStatus = `Error: ${err.message}`;
        compiling = false;
      }
    };

    poll();
  }

  async function downloadProject() {
    if (!projectStore.project) return;
    
    try {
      const zip = new JSZip();
      const fileName = projectStore.project.name.toLowerCase().replace(/\s+/g, "-");
      const project = projectStore.project;
      
      // Main config
      zip.file(`${fileName}.yaml`, generateESPHomeYAML(project));
      zip.file("sensors.yaml", generateSensorsYAML(project));
      
      // Includes directory
      const includes = zip.folder("includes");
      if (includes) {
        includes.file("state_manager.h", generateStateHeader(project));
        includes.file("render_helpers.h", generateRenderHelpers(project));
        includes.file("render_pages.h", generateRenderPages(project));
        includes.file("render_details.h", generateRenderDetails(project));
        includes.file("display_renderer.h", generateCppRenderer(project));
        includes.file("touch_handler.h", generateTouchHandler(project));
      }
      
      // Add a README
      zip.file("README.md", `# ${projectStore.project.name}\n\nThis project was exported from the Home Display Designer.\n\n## How to use\n1. Install ESPHome: \`pip install esphome\`\n2. Run: \`esphome run ${fileName}.yaml\``);
      
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

  function createManifest(jobId: string) {
    const firmware = `/builds/${jobId}.bin`;
    const manifest = {
      name: projectStore.project?.name || "ESP32 Firmware",
      version: new Date().toISOString().split('T')[0],
      new_install_prompt_erase: true,
      builds: [
        {
          chipFamily: "ESP32-S3",
          parts: [
            { path: firmware, offset: 0 }
          ]
        }
      ]
    };

    const json = JSON.stringify(manifest);
    const blob = new Blob([json], { type: "application/json" });
    manifestUrl = URL.createObjectURL(blob);

    // Initialize the ESP Web Tools button after manifest is ready
    setTimeout(() => {
      const button = document.querySelector('esp-web-install-button') as any;
      if (button) {
        button.manifest = manifestUrl;
      }
    }, 100);
  }

  const showFlashButton = $derived(compilationStatus === "completed" && manifestUrl);
</script>

<svelte:head>
  <script
    type="module"
    src="https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module"
  ></script>
</svelte:head>

<div class="export-panel">
  <div class="header">
    <h2>Export & Compile</h2>
    <button class="close-btn" onclick={onClose}>Close</button>
  </div>

  <div class="actions">
      <button class="compile-btn" class:loading={compiling} disabled={compiling} onclick={compile}>
      <span class="btn-title">Prepare Firmware</span>
      <span class="btn-desc">Create the software for your display so it's ready to be installed</span>
      {#if compiling}
        <div class="status-text">{compilationStatus}</div>
      {:else}
        <span class="btn-note">Note: The first time usually takes a few minutes</span>
      {/if}
    </button>

    {#if showFlashButton}
      <esp-web-install-button>
        <div slot="activate" class="flash-btn-content">
          <span class="btn-title">Install to Display</span>
          <span class="btn-desc">Plug in your display via USB to send the software directly to it</span>
        </div>
      </esp-web-install-button>
    {/if}

    <button class="download-btn" onclick={downloadProject}>
      <span class="btn-title">Download Project</span>
      <span class="btn-desc">Get a ZIP file with the code and instructions for manual setup</span>
    </button>
  </div>
</div>

<style>
  .export-panel {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    padding: var(--spacing-xl);
    min-width: 500px;
    background: var(--color-bg-primary);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--color-border);
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
    color: var(--color-text-primary);
  }

  .close-btn {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: var(--spacing-sm) var(--spacing-md);
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-accent);
    color: var(--color-text-primary);
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }

  .compile-btn {
    background: linear-gradient(135deg, #4caf50, #43a047);
    color: white;
    border: none;
    padding: var(--spacing-xl);
    border-radius: 12px;
    cursor: pointer;
    width: 100%;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    text-align: center;
  }

  .compile-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #43a047, #388e3c);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(76, 175, 80, 0.3);
  }

  .compile-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .compile-btn:disabled {
    background: linear-gradient(135deg, #81c784, #66bb6a);
    cursor: wait;
    opacity: 0.8;
  }

  .download-btn {
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    border: 1px solid var(--color-border);
    padding: var(--spacing-xl);
    border-radius: 12px;
    cursor: pointer;
    width: 100%;
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    text-align: center;
  }

  .download-btn:hover {
    background: var(--color-bg-tertiary);
    border-color: var(--color-accent);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
  }

  .btn-title {
    font-size: 18px;
    font-weight: 700;
  }

  .btn-desc {
    font-size: 14px;
    opacity: 0.9;
    font-weight: 400;
    max-width: 320px;
  }

  .btn-note {
    font-size: 11px;
    opacity: 0.7;
    font-weight: 400;
    margin-top: var(--spacing-xs);
    font-style: italic;
  }

  .status-text {
    font-size: 13px;
    margin-top: var(--spacing-xs);
    font-weight: 500;
    background: rgba(0, 0, 0, 0.2);
    padding: 4px 12px;
    border-radius: 20px;
  }

  :global(esp-web-install-button) {
    display: block;
    width: 100%;
  }

  :global(esp-web-install-button::part(button)) {
    width: 100%;
    height: auto;
    padding: var(--spacing-xl);
    border-radius: 12px;
    background: linear-gradient(135deg, #2196f3, #1976d2);
    border: none;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(33, 150, 243, 0.2);
    transition: all 0.3s ease;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-sm);
    color: white;
    font-family: inherit;
  }

  :global(esp-web-install-button::part(button):hover) {
    background: linear-gradient(135deg, #1976d2, #1565c0);
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(33, 150, 243, 0.3);
  }

  .flash-btn-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-xs);
    pointer-events: none;
  }
</style>
