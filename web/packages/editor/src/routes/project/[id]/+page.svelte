<script lang="ts">
  import DesignCanvas from "$lib/components/canvas/DesignCanvas.svelte";
  import ComponentPalette from "$lib/components/sidebar/ComponentPalette.svelte";
  import PropertyEditor from "$lib/components/sidebar/PropertyEditor.svelte";
  import Toolbar from "$lib/components/toolbar/Toolbar.svelte";
  import ExportPanel from "$lib/components/ExportPanel.svelte";
  import ViewTypeSelector from "$lib/components/sidebar/ViewTypeSelector.svelte";
  import DashboardPageList from "$lib/components/sidebar/DashboardPageList.svelte";
  import DetailViewList from "$lib/components/sidebar/DetailViewList.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { page } from "$app/state";
  import { onMount } from "svelte";

  let showExport = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(() => {
    const id = page.params.id;
    if (id) {
      const success = projectStore.loadProjectById(id);
      if (!success) {
        error = "Project not found";
      }
    } else {
      error = "No project ID provided";
    }
    loading = false;
  });
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
  <Toolbar onExport={() => (showExport = !showExport)} />

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

  <main class="canvas-area">
    <DesignCanvas />
  </main>

  <aside class="sidebar right">
    <PropertyEditor />
  </aside>
</div>

{#if showExport}
  <div class="modal-overlay" onclick={() => (showExport = false)}>
    <div class="modal-content" onclick={(e: MouseEvent) => e.stopPropagation()}>
      <ExportPanel onClose={() => (showExport = false)} />
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
    width: 280px;
    background: var(--color-bg-secondary);
    border-color: var(--color-border);
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .sidebar.left {
    border-right: 1px solid var(--color-border);
  }

  .sidebar.right {
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
