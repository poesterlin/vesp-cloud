<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { diffProject, type ProjectChanges } from "$lib/diff";
  import type { Project } from "@esphome-designer/schema";

  interface Props {
    lastSavedData: unknown;
  }

  let { lastSavedData }: Props = $props();

  let changes = $state<ProjectChanges | null>(null);
  let loading = $state(true);
  let referenceLabel = $state('your last save');

  function tryDiff(prevConfig: Project) {
    const current = projectStore.project;
    if (!current) return false;
    changes = diffProject(current, prevConfig);
    return true;
  }

  async function loadComparison() {
    const projectId = projectStore.serverProjectId;
    if (!projectId) {
      loading = false;
      return;
    }

    try {
      const res = await fetch(`/api/compile?projectId=${encodeURIComponent(projectId)}&latest=true`);
      if (res.ok) {
        const job = await res.json();
        if (job?.config) {
          const prevConfig = JSON.parse(job.config) as Project;
          if (tryDiff(prevConfig)) {
            referenceLabel = 'your last firmware build';
            loading = false;
            return;
          }
        }
      }
    } catch {
      // continue to fallback
    }

    if (lastSavedData) {
      const prevConfig = lastSavedData as Project;
      if (tryDiff(prevConfig)) {
        referenceLabel = 'your last save';
      }
    }

    loading = false;
  }

  $effect(() => {
    if (projectStore.serverProjectId) {
      loadComparison();
    }
  });
</script>

{#if loading}
  <div class="change-summary loading">
    <span class="spinner" />
    <span>Checking for changes...</span>
  </div>
{:else if changes && changes.items.length > 0}
  <div class="change-summary">
    <h3 class="summary-title">What's changed since {referenceLabel}</h3>
    <ul class="change-list">
      {#each changes.items as change}
        <li>{change.message}</li>
      {/each}
    </ul>
  </div>
{:else if changes && changes.items.length === 0}
  <div class="change-summary no-changes">
    No changes since {referenceLabel}.
  </div>
{/if}

<style>
  .change-summary {
    background: var(--color-bg-tertiary, #1a1d23);
    border: 1px solid var(--color-border, #2a2d35);
    border-radius: 10px;
    padding: 18px 20px;
    margin-bottom: 16px;
  }

  .change-summary.loading {
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
  }

  .change-summary.no-changes {
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent, #6366f1);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .summary-title {
    margin: 0 0 12px 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .change-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .change-list li {
    position: relative;
    padding-left: 18px;
    font-size: 13px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .change-list li::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 7px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent, #6366f1);
  }
</style>
