<script lang="ts">
  import { goto } from "$app/navigation";
  import { projectStore } from "$lib/stores/project.svelte";
  import { deploymentStore } from "$lib/stores/deployment.svelte";
  import DeployWizard from "$lib/components/DeployWizard.svelte";
  import BuildHistory from "$lib/components/BuildHistory.svelte";
  import { onMount } from "svelte";

  let { data } = $props();

  onMount(() => {
    if (data.project) {
      projectStore.loadFromServer(data.project);
    }

    deploymentStore.reset();

    if (data.activeJob) {
      deploymentStore.restoreJob(data.activeJob.id, data.activeJob.status);
    }
  });
</script>

<svelte:head>
  <title>Deploy {projectStore.project ? `- ${projectStore.project.name}` : ''}</title>
</svelte:head>

<div class="deploy-page">
  <header class="deploy-header">
    <div class="header-left">
      <button class="back-btn" onclick={() => goto(`/project/${data.project.id}`)}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        Back to Editor
      </button>
    </div>
    <h1>Deploy</h1>
    <div class="header-right">
      <span class="project-name">{data.project.name}</span>
    </div>
  </header>

  <div class="deploy-body">
    <div class="deploy-left">
      <DeployWizard standalone lastSavedData={data.lastSavedData} />
    </div>
    <div class="deploy-right">
      <BuildHistory />
    </div>
  </div>
</div>

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
    justify-content: space-between;
    padding: var(--spacing-md) var(--spacing-xl);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    height: 56px;
    flex-shrink: 0;
  }

  .header-left {
    flex: 1;
  }

  .header-right {
    flex: 1;
    display: flex;
    justify-content: flex-end;
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

  .project-name {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .deploy-body {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .deploy-left {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: var(--spacing-xl);
  }

  .deploy-right {
    width: 420px;
    min-width: 420px;
    overflow-y: auto;
    background: var(--color-bg-secondary);
  }

  @media (max-width: 900px) {
    .deploy-body {
      flex-direction: column;
    }
    .deploy-right {
      width: 100%;
      min-width: 0;
      border-top: 1px solid var(--color-border);
      border-right: none;
    }
  }
</style>
