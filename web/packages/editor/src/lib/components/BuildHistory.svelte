<script lang="ts">
  import * as mdiIcons from "@mdi/js";
  import { projectStore } from "$lib/stores/project.svelte";
  import { deploymentStore, type JobStatus } from "$lib/stores/deployment.svelte";
  import { diffProject } from "$lib/diff";
  import type { Project } from "@esphome-designer/schema";

  let jobs = $state<JobStatus[]>([]);
  let loading = $state(true);
  let popoverOk = $state(false);
  let diffs = $state<Map<string, string[]>>(new Map());

  $effect(() => {
    const projectId = projectStore.serverProjectId;
    if (!projectId) {
      loading = false;
      jobs = [];
      return;
    }
    loadJobs(projectId);
  });

  $effect(() => {
    popoverOk = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype;
  });

  $effect(() => {
    const step = deploymentStore.state.step;
    const err = deploymentStore.state.error;
    const projectId = projectStore.serverProjectId;
    if (!projectId) return;
    if (step === "ready" || step === "done" || err) {
      loadJobs(projectId);
    }
  });

  async function loadJobs(projectId: string) {
    loading = true;
    try {
      const res = await fetch(`/api/compile?projectId=${projectId}`);
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
    if (isBusy) return;
    const a = document.createElement("a");
    a.href = `/api/builds/${jobId}`;
    a.download = `${projectStore.project?.name?.toLowerCase().replace(/\s+/g, "-") || "firmware"}.bin`;
    a.click();
  }

  async function rollbackProject(job: JobStatus) {
    if (isBusy || !job.config || !projectStore.serverProjectId) return;
    const ok = window.confirm("Roll back the project to this build?");
    if (!ok) return;

    try {
      const config = JSON.parse(job.config);
      const name = typeof config.name === "string" ? config.name : projectStore.project?.name;
      const res = await fetch(`/api/projects/${projectStore.serverProjectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, data: config }),
      });
      if (!res.ok) throw new Error("Rollback failed");
      const saved = await res.json();
      projectStore.loadFromServer(saved);
    } catch (e) {
      console.error("Failed to roll back project", e);
      window.alert("Could not roll back to this build.");
    }
  }

  function toggleDiff(job: JobStatus) {
    if (isBusy) return;
    const next = new Map(diffs);
    if (next.has(job.id)) {
      next.delete(job.id);
    } else if (job.config) {
      try {
        const idx = jobs.findIndex((j) => j.id === job.id);
        const prior = idx >= 0 && idx + 1 < jobs.length ? jobs[idx + 1] : null;
        const base = prior?.config ? (JSON.parse(prior.config) as Project) : null;
        const current = JSON.parse(job.config) as Project;
        const changes = base
          ? diffProject(current, base)
          : { items: [{ message: "First build" }] };
        next.set(job.id, changes.items.map((i) => i.message));
      } catch {
        next.set(job.id, ["Could not read build config"]);
      }
    }
    diffs = next;
  }

  function flashBuild(jobId: string) {
    if (isBusy) return;
    deploymentStore.state.jobId = jobId;
    deploymentStore.state.manifestUrl = `/api/manifest/${jobId}`;
    deploymentStore.state.flow = "new";
    deploymentStore.state.step = "flash";
  }

  const activeJob = $derived(jobs.find((j) => j.published && j.status === "completed"));
  const isBusy = $derived(deploymentStore.state.compiling || deploymentStore.state.publishing);
</script>

<div class="build-history">
  <div class="history-heading">
    <span>Release Board</span>
    {#if isBusy}
      <small>Actions locked while work is running</small>
    {/if}
  </div>

  <!-- Active Release Spotlight -->
  {#if activeJob}
    <div class="active-card">
      <div class="active-header">
        <span class="active-badge">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d={mdiIcons.mdiCheckCircle} />
          </svg>
          Current firmware
        </span>
        <span class="active-date">Updated {timeAgo(activeJob.createdAt)}</span>
      </div>
      <div class="active-body">
        <div class="active-row">
          <span class="active-label">Delivery</span>
          <span class="active-value">Device updates</span>
        </div>
        <div class="active-row">
          <span class="active-label">Status</span>
          <span class="status-badge success">
            <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={mdiIcons.mdiCloudCheck} />
            </svg>
            Live
          </span>
        </div>
      </div>
    </div>
  {:else}
    <div class="active-card empty">
      <p>No firmware published yet. Build your project to get started.</p>
    </div>
  {/if}

  <!-- Previous Builds List -->
  <div class="builds-section">
    <h3>Builds</h3>
    {#if loading}
      <p class="loading">Loading build history...</p>
    {:else if jobs.length === 0}
      <p class="empty">No builds yet. Compile your project to get started.</p>
    {:else}
      <div class="builds-list">
        {#each jobs as job, index (job.id)}
          <div class="build-item">
            <div class="build-main">
              <div class="build-meta">
                <span class="build-name">{jobs.length - index}</span>
                <span class="status-badge" class:success={job.status === "completed"} class:failed={job.status === "failed"} class:running={job.status === "running"}>
                  {#if job.status === "completed"}
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={mdiIcons.mdiCheckCircle} />
                    </svg>
                  {:else if job.status === "failed"}
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={mdiIcons.mdiAlertCircle} />
                    </svg>
                  {:else}
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={mdiIcons.mdiProgressClock} />
                    </svg>
                  {/if}
                  {job.status}
                </span>
                {#if job.published}
                  <span class="status-badge published">
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={mdiIcons.mdiCloudCheck} />
                    </svg>
                    Live
                  </span>
                {/if}
              </div>
              <div class="build-right">
                <div class="build-date">{timeAgo(job.createdAt)}</div>
                {#if popoverOk}
                  <button
                    class="menu-toggle"
                    command="toggle-popover"
                    commandfor="power-menu-{job.id}"
                    popovertarget="power-menu-{job.id}"
                    style="anchor-name: --power-{job.id};"
                    aria-label="Power user actions"
                    title="Power user actions"
                  >
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={mdiIcons.mdiDotsHorizontal} />
                    </svg>
                  </button>
                  <menu
                    class="power-menu"
                    popover
                    id="power-menu-{job.id}"
                    style="position-anchor: --power-{job.id};"
                  >
                    <li>
                      <button onclick={() => downloadBin(job.id)} disabled={isBusy}>
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d={mdiIcons.mdiDownload} />
                        </svg>
                        Download .bin
                      </button>
                    </li>
                    <li>
                      <button onclick={() => rollbackProject(job)} disabled={isBusy || !job.config}>
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d={mdiIcons.mdiRestore} />
                        </svg>
                        Roll back project
                      </button>
                    </li>
                    <li>
                      <button onclick={() => toggleDiff(job)} disabled={isBusy || !job.config}>
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d={mdiIcons.mdiCompare} />
                        </svg>
                        {diffs.has(job.id) ? "Hide changes" : "View changes"}
                      </button>
                    </li>
                  </menu>
                {:else}
                  <details class="power-menu-fallback">
                    <summary aria-label="Power user actions" title="Power user actions">
                      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={mdiIcons.mdiDotsHorizontal} />
                      </svg>
                    </summary>
                    <div class="power-menu-content">
                      <button onclick={() => downloadBin(job.id)} disabled={isBusy}>
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d={mdiIcons.mdiDownload} />
                        </svg>
                        Download .bin
                      </button>
                      <button onclick={() => rollbackProject(job)} disabled={isBusy || !job.config}>
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d={mdiIcons.mdiRestore} />
                        </svg>
                        Roll back project
                      </button>
                      <button onclick={() => toggleDiff(job)} disabled={isBusy || !job.config}>
                        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d={mdiIcons.mdiCompare} />
                        </svg>
                        {diffs.has(job.id) ? "Hide changes" : "View changes"}
                      </button>
                    </div>
                  </details>
                {/if}
              </div>
            </div>
            {#if job.status === "completed"}
              <div class="build-actions">
                <button class="action-btn" onclick={() => flashBuild(job.id)} disabled={isBusy}>
                  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={mdiIcons.mdiUsbPort} />
                  </svg>
                  Flash
                </button>
              </div>
            {/if}
            {#if diffs.has(job.id)}
              <div class="diff-panel">
                <div class="diff-header">
                  <span>Changes</span>
                  <button class="diff-close" onclick={() => toggleDiff(job)} aria-label="Close">
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={mdiIcons.mdiClose} />
                    </svg>
                  </button>
                </div>
                <ul class="diff-list">
                  {#each diffs.get(job.id) ?? [] as msg}
                    <li>{msg}</li>
                  {/each}
                </ul>
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

  .icon {
    width: 14px;
    height: 14px;
    fill: currentColor;
    flex-shrink: 0;
  }

  .history-heading {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .history-heading span {
    margin: 0;
    font-size: 20px;
    font-weight: 750;
    color: var(--color-text-primary);
  }

  .history-heading small {
    color: #ffb74d;
    font-size: 12px;
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
    gap: 6px;
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
    font-weight: 600;
    font-size: 13px;
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

  .build-name {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--color-bg-tertiary);
    font-size: 13px;
    font-weight: 700;
    color: var(--color-text-primary);
  }

  .build-date {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .build-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-shrink: 0;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
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
    align-items: center;
  }

  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
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

  .menu-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0;
  }

  .menu-toggle:hover {
    color: var(--color-text-primary);
    border-color: var(--color-accent);
  }

  .power-menu {
    position-area: block-end span-inline-end;
    position-try: flip-block;
    margin: 0;
    padding: 6px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-primary);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
    min-width: 180px;
    list-style: none;
  }

  .power-menu li button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .power-menu li button:hover:not(:disabled) {
    background: var(--color-bg-secondary);
  }

  .power-menu li button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .power-menu-fallback {
    position: relative;
  }

  .power-menu-fallback summary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    list-style: none;
  }

  .power-menu-fallback summary::-webkit-details-marker {
    display: none;
  }

  .power-menu-fallback summary:hover {
    color: var(--color-text-primary);
    border-color: var(--color-accent);
  }

  .power-menu-content {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 10;
    min-width: 180px;
    padding: 6px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-primary);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
  }

  .power-menu-content button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    font-size: 12px;
    text-align: left;
    cursor: pointer;
  }

  .power-menu-content button:hover:not(:disabled) {
    background: var(--color-bg-secondary);
  }

  .power-menu-content button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .diff-panel {
    margin-top: var(--spacing-sm);
    padding: var(--spacing-md);
    border-top: 1px solid var(--color-border);
  }

  .diff-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-sm);
  }

  .diff-header span {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-secondary);
  }

  .diff-close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--color-text-secondary);
    cursor: pointer;
    padding: 0;
  }

  .diff-close:hover {
    color: var(--color-text-primary);
    background: var(--color-bg-tertiary);
  }

  .diff-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .diff-list li {
    position: relative;
    padding-left: 16px;
    font-size: 12px;
    color: var(--color-text-secondary);
    line-height: 1.5;
  }

  .diff-list li::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 6px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-accent);
  }
</style>
