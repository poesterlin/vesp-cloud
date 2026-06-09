<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { deploymentStore, type JobStatus } from "$lib/stores/deployment.svelte";
  import { onMount } from "svelte";

  let jobs = $state<JobStatus[]>([]);
  let loading = $state(true);

  onMount(() => {
    loadJobs();
  });

  async function loadJobs() {
    if (!projectStore.serverProjectId) return;
    try {
      const res = await fetch(`/api/compile?projectId=${projectStore.serverProjectId}`);
      if (res.ok) {
        const data = await res.json();
        jobs = Array.isArray(data) ? data : [];
      }
    } catch (e) {
      console.error("Failed to load jobs", e);
    } finally {
      loading = false;
    }
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  }

  function timeAgo(dateStr: string) {
    if (!dateStr) return "";
    const now = new Date().getTime();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin} min ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  }

  function downloadBin(jobId: string) {
    const a = document.createElement("a");
    a.href = `/api/builds/${jobId}`;
    a.download = `${jobId}.bin`;
    a.click();
  }

  async function publishJob(jobId: string) {
    await deploymentStore.publishBuild(jobId);
    await loadJobs();
  }

  const activeJob = $derived(jobs.find((j) => j.published && j.status === "completed"));
</script>

<div class="build-history">
  <h2>Build Archives & Release Board</h2>

  <!-- Active Release Spotlight -->
  {#if activeJob}
    <div class="active-card">
      <div class="active-header">
        <span class="active-badge">Active Release</span>
        <span class="active-date">{timeAgo(activeJob.createdAt)}</span>
      </div>
      <div class="active-body">
        <div class="active-row">
          <span class="active-label">Build ID</span>
          <span class="active-value">{activeJob.id}</span>
        </div>
        <div class="active-row">
          <span class="active-label">Published</span>
          <span class="active-value">{formatDate(activeJob.createdAt)}</span>
        </div>
        <div class="active-row">
          <span class="active-label">Status</span>
          <span class="status-badge success">OTA Live</span>
        </div>
      </div>
    </div>
  {:else}
    <div class="active-card empty">
      <p>No active OTA release published yet.</p>
    </div>
  {/if}

  <!-- Previous Builds List -->
  <div class="builds-section">
    <h3>Previous Builds</h3>
    {#if loading}
      <p class="loading">Loading build history...</p>
    {:else if jobs.length === 0}
      <p class="empty">No builds yet. Compile your project to get started.</p>
    {:else}
      <div class="builds-list">
        {#each jobs as job (job.id)}
          <div class="build-item">
            <div class="build-main">
              <div class="build-meta">
                <span class="build-id">{job.id.slice(0, 8)}</span>
                <span class="status-badge" class:success={job.status === "completed"} class:failed={job.status === "failed"} class:running={job.status === "running"}>
                  {job.status}
                </span>
                {#if job.published}
                  <span class="status-badge published">Published</span>
                {/if}
              </div>
              <div class="build-date">{formatDate(job.createdAt)}</div>
            </div>
            {#if job.status === "completed"}
              <div class="build-actions">
                <button class="action-btn" onclick={() => publishJob(job.id)} disabled={job.published}>
                  {job.published ? "Published" : "Publish OTA"}
                </button>
                <button class="action-btn secondary" onclick={() => downloadBin(job.id)}>
                  Download .bin
                </button>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .build-history {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xl);
    padding: var(--spacing-xl);
    overflow-y: auto;
  }

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .active-card {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .active-card.empty {
    color: var(--color-text-secondary);
    font-size: 14px;
  }

  .active-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .active-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    background: rgba(76, 175, 80, 0.15);
    color: #66bb6a;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }

  .active-date {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .active-body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .active-row {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
  }

  .active-label {
    color: var(--color-text-secondary);
  }

  .active-value {
    color: var(--color-text-primary);
    font-family: monospace;
    font-size: 12px;
  }

  .builds-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }

  .loading,
  .empty {
    color: var(--color-text-secondary);
    font-size: 13px;
  }

  .builds-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .build-item {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: var(--spacing-md);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .build-main {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .build-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }

  .build-id {
    font-family: monospace;
    font-size: 12px;
    color: var(--color-text-primary);
  }

  .build-date {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    text-transform: capitalize;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
  }

  .status-badge.success {
    background: rgba(76, 175, 80, 0.15);
    color: #66bb6a;
  }

  .status-badge.failed {
    background: rgba(244, 67, 54, 0.15);
    color: #f44336;
  }

  .status-badge.running {
    background: rgba(33, 150, 243, 0.15);
    color: #64b5f6;
  }

  .status-badge.published {
    background: rgba(255, 152, 0, 0.15);
    color: #ffb74d;
  }

  .build-actions {
    display: flex;
    gap: var(--spacing-xs);
    flex-wrap: wrap;
  }

  .action-btn {
    padding: 6px 12px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .action-btn:hover:not(:disabled) {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: white;
  }

  .action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .action-btn.secondary {
    background: transparent;
    color: var(--color-text-secondary);
  }

  .action-btn.secondary:hover {
    color: var(--color-text-primary);
  }
</style>
