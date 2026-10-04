<script lang="ts">
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
  import { page } from "$app/state";
  import { onNavigate } from "$app/navigation";
  import ProjectSettings from "$lib/components/sidebar/ProjectSettings.svelte";
  import type { Component } from "@vesp-cloud/schema";
  import { selectionStore } from "$lib/stores/selection.svelte.js";

  let { data } = $props();

  let showSettings = $state(false);
  let showDebug = $state(false);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onNavigate(() => {
    selectionStore.clear();
  });

  onMount(() => {
    if (data.project) {
      projectStore.loadFromServer(data.project);
      loading = false;

      const componentId = page.url.searchParams.get("componentId");
      if (componentId) {
        navigateToComponent(componentId);
      }
    } else {
      error = "Project not found";
      loading = false;
    }

    if (data.activeJob) {
      deploymentStore.restoreJob(data.activeJob.id, data.activeJob.status);
    }
  });

  function navigateToComponent(compId: string) {
    const project = projectStore.project;
    if (!project) return;

    function containsId(components: Component[], target: string): boolean {
      for (const c of components) {
        if (c.id === target) return true;
        if (c.type === "conditional_area") {
          for (const v of c.variants) {
            if (containsId(v.components, target)) return true;
          }
        } else if (c.type === "tab_container") {
          for (const t of c.tabs) {
            if (containsId(t.components, target)) return true;
          }
        }
      }
      return false;
    }

    if (project.pageHeader && containsId(project.pageHeader.components, compId)) {
      // Header components are visible on any dashboard page
      if (projectStore.viewMode !== "dashboard") {
        projectStore.setDashboardPage(projectStore.dashboardPages[0]?.id);
      }
      selectionStore.select(compId);
      return;
    }

    for (const page of projectStore.dashboardPages) {
      if (containsId(page.components, compId)) {
        projectStore.setDashboardPage(page.id);
        selectionStore.select(compId);
        return;
      }
    }

    for (const view of projectStore.detailViews) {
      if (containsId(view.components, compId)) {
        projectStore.setDetailView(view.id);
        selectionStore.select(compId);
        return;
      }
    }
  }

  function clearSelection(event: MouseEvent) {
    const isSelf = (event.target as HTMLElement).classList.contains("canvas-area");
    if (isSelf) {
      selectionStore.clear();
    }
  }
</script>

<svelte:head>
  <title>{projectStore.project?.name || "Project"} — vESP.cloud</title>
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
    onSettings={() => (showSettings = !showSettings)}
    onDebug={() => (showDebug = !showDebug)}
  />

  <div class="editor-container">
    <aside class="sidebar left">
      <div class="panel-heading"><span>Workspace</span><span class="panel-caption">Build your display</span></div>
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
      <div class="panel-heading"><span>Inspector</span><span class="panel-caption">{selectionStore.hasSelection ? `${selectionStore.selectedCount} selected` : 'Select a component'}</span></div>
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
      --color-bg-primary: #11151d;
      --color-bg-secondary: #191f2a;
      --color-bg-tertiary: #222b38;
      --color-border: #303b4c;
      --color-text-muted: #94a0b4;
      display: flex;
      flex: 1;
      overflow: hidden;
      min-height: 0;
    }

    .panel-heading { display: flex; flex-direction: column; gap: 4px; padding: 18px 16px; border-bottom: 1px solid var(--color-border); font-size: 13px; font-weight: 600; }
    .panel-caption { font-size: 11px; font-weight: 400; color: var(--color-text-secondary); }

    .sidebar {
      background: var(--color-bg-secondary);
      border-color: var(--color-border);
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    .sidebar.left {
      width: 264px;
      flex-shrink: 0;
      border-right: 1px solid var(--color-border);
    }

    .sidebar.right {
      width: 320px;
      flex-shrink: 0;
      border-left: 1px solid var(--color-border);
    }

    .separator {
      height: 1px;
      background: var(--color-border);
      margin: 8px 0;
    }

    .canvas-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--color-bg-primary);
      background-image: radial-gradient(circle, #354054 1px, transparent 1px);
      background-size: 20px 20px;
      overflow: auto;
      padding: 64px;
      min-width: 0;
    }

    @media (max-width: 1100px) {
      .sidebar.left { width: 220px; }
      .sidebar.right { width: 280px; }
      .canvas-area { justify-content: flex-start; padding: 48px; }
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
      width: 760px;
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
