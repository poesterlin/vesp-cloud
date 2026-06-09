<script lang="ts">
  import { goto } from "$app/navigation";
  import DesignCanvas from "$lib/components/canvas/DesignCanvas.svelte";
  import ComponentPalette from "$lib/components/sidebar/ComponentPalette.svelte";
  import PropertyEditor from "$lib/components/sidebar/PropertyEditor.svelte";
  import Toolbar from "$lib/components/toolbar/Toolbar.svelte";
  import BottomConsole from "$lib/components/BottomConsole.svelte";
  import ProjectDebugModal from "$lib/components/ProjectDebugModal.svelte";
  import ViewTypeSelector from "$lib/components/sidebar/ViewTypeSelector.svelte";
  import DashboardPageList from "$lib/components/sidebar/DashboardPageList.svelte";
  import DetailViewList from "$lib/components/sidebar/DetailViewList.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { deploymentStore } from "$lib/stores/deployment.svelte";
  import { onMount } from "svelte";
  import ProjectSettings from "$lib/components/sidebar/ProjectSettings.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte.js";

  let { data } = $props();

  let showSettings = $state(false);
  let showDebug = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let creditBalance = $state<number | null>(null);

  const compileCost = 1;
  let showExportInfo = $derived(
    data.isCloud && creditBalance !== null && creditBalance < compileCost,
  );

  onMount(() => {
    if (data.project) {
      projectStore.loadFromServer(data.project);
      loading = false;
    } else {
      error = "Project not found";
      loading = false;
    }

    if (data.isCloud) {
      loadCreditBalance();
    }

    if (data.activeJob) {
      deploymentStore.restoreJob(data.activeJob.id, data.activeJob.status);
    }
  });

  async function loadCreditBalance() {
    try {
      const res = await fetch("/api/credits/balance");
      if (!res.ok) return;
      const payload = await res.json();
      creditBalance = typeof payload.balance === "number" ? payload.balance : null;
    } catch {
      creditBalance = null;
    }
  }

  function openExport() {
    goto(`/project/${projectStore.serverProjectId}/deploy`);
  }

  function clearSelection(event: MouseEvent) {
    const isSelf = (event.target as HTMLElement).classList.contains("canvas-area");
    if (isSelf) {
      selectionStore.clear();
    }
  }
</script>

<svelte:head>
  <title>ESPHome Designer {projectStore.project ? `- ${projectStore.project.name}` : ''}</title>
</svelte:head>

{#if loading}
  <div class="status-screen">
    <p>Loading project...</p>
  </div>
{:else if error}
  <div class="status-screen error">
    <h1>{error}</h1>
    <a href="/" class="back-link">Back to projects</a>
  </div>
{:else if projectStore.project}
  <Toolbar
    onExport={openExport}
    onSettings={() => (showSettings = !showSettings)}
    onDebug={() => (showDebug = !showDebug)}
    {showExportInfo}
  />

  <div class="editor-container">
    <aside class="sidebar left">
      <ViewTypeSelector />
      {#if projectStore.viewMode === 'dashboard'}
        <DashboardPageList />
      {:else}
        <DetailViewList />
      {/if}
      <div class="separator"></div>
      <ComponentPalette />
    </aside>

    <main class="canvas-area" onclick={(e) => clearSelection(e)}>
      <DesignCanvas />
    </main>

    <aside class="sidebar right">
      <PropertyEditor />
    </aside>
  </div>

  <BottomConsole />

  {#if showSettings}
    <div class="modal-overlay" onclick={() => (showSettings = false)}>
      <div class="modal-content settings-modal" onclick={(e: MouseEvent) => e.stopPropagation()}>
        <ProjectSettings onClose={() => (showSettings = false)} />
      </div>
    </div>
  {/if}

  {#if showDebug}
    <div class="modal-overlay" onclick={() => (showDebug = false)}>
      <div class="modal-content debug-modal" onclick={(e: MouseEvent) => e.stopPropagation()}>
        <ProjectDebugModal onClose={() => (showDebug = false)} />
      </div>
    </div>
  {/if}

  <style>
    .editor-container {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .sidebar {
      background: var(--color-bg-secondary);
      border-color: var(--color-border);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .sidebar.left {
      width: 280px;
      border-right: 1px solid var(--color-border);
    }

    .sidebar.right {
      width: 315px;
      border-left: 1px solid var(--color-border);
    }

    .separator {
      height: 1px;
      background: #333;
      margin: 8px 0;
    }

    .canvas-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg-primary);
      overflow: auto;
      padding: var(--spacing-lg);
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(4px);
    }

    .modal-content {
      background: var(--color-bg-primary);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      max-width: 90vw;
      max-height: 90vh;
      overflow: hidden;
    }

    .modal-content.settings-modal {
      width: 600px;
      height: 80vh;
    }

    .modal-content.debug-modal {
      width: 800px;
      height: 90vh;
    }

    .status-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      gap: var(--spacing-md);
    }

    .status-screen.error h1 {
      color: #ff5252;
    }

    .back-link {
      color: var(--color-accent);
      text-decoration: none;
    }

    .back-link:hover {
      text-decoration: underline;
    }
  </style>
{/if}
