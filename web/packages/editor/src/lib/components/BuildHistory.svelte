<script lang="ts">
  import * as mdiIcons from "@mdi/js";
  import { projectStore } from "$lib/stores/project.svelte";
  import {
    deploymentStore,
    type JobStatus,
  } from "$lib/stores/deployment.svelte";
  import { diffProject } from "$lib/diff";
  import type { Project } from "@vesp-cloud/schema";

  interface Props {
    onFlash?: (jobId: string) => void;
  }

  let { onFlash }: Props = $props();

  let jobs = $state<JobStatus[]>([]);
  let loading = $state(true);
  let popoverOk = $state(false);
  let diffs = $state<Map<string, string[]>>(new Map());
  let expanded = $state(false);

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
    popoverOk =
      typeof HTMLElement !== "undefined" && "popover" in HTMLElement.prototype;
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

  $effect(() => {
    if (jobs.length > 0 && diffs.size === 0) {
      const latest = jobs[0];
      if (latest?.config) {
        toggleDiff(latest);
      }
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
    if (diffHour < 24)
      return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
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
      const name =
        typeof config.name === "string"
          ? config.name
          : projectStore.project?.name;
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
        const base = prior?.config
          ? (JSON.parse(prior.config) as Project)
          : null;
        const current = JSON.parse(job.config) as Project;
        const changes = base
          ? diffProject(current, base)
          : { items: [{ message: "First build" }] };
        next.set(
          job.id,
          changes.items.map((i) => i.message),
        );
      } catch {
        next.set(job.id, ["Could not read build config"]);
      }
    }
    diffs = next;
  }

  function handleFlash(jobId: string) {
    if (isBusy) return;
    onFlash?.(jobId);
  }

  const activeJob = $derived(
    jobs.find((j) => j.published && j.status === "completed"),
  );
  const isBusy = $derived(
    deploymentStore.state.compiling || deploymentStore.state.publishing,
  );
  const isCompiling = $derived(deploymentStore.state.compiling);
  const activeJobId = $derived(deploymentStore.state.jobId);
  const filteredJobs = $derived(
    isCompiling && activeJobId
      ? jobs.filter(
          (j) =>
            j.id !== activeJobId &&
            !["running", "queued", "pending"].includes(j.status),
        )
      : jobs,
  );
  const visibleJobs = $derived(
    expanded ? filteredJobs : filteredJobs.slice(0, 1),
  );
  const hasMore = $derived(filteredJobs.length > 1);
</script>

<div class="build-list-section">
  {#if isCompiling}
    <div class="active-build-row">
      <div class="build-row-main">
        <div class="build-status-icon compiling">
          <div class="spinner"></div>
        </div>
        <div class="build-info">
          <span class="build-status-text"
            >{deploymentStore.state.status || "Building..."}</span
          >
          {#if !deploymentStore.state.error}
            <div class="progress-bar">
              <div
                class="progress-fill"
                style="width: {deploymentStore.state.progress}%"
              ></div>
            </div>
          {/if}
        </div>
      </div>
      {#if deploymentStore.state.error}
        <span class="status-badge failed">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d={mdiIcons.mdiAlertCircle} />
          </svg>
          Failed
        </span>
      {:else}
        <span class="status-badge running">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d={mdiIcons.mdiProgressClock} />
          </svg>
          Building
        </span>
      {/if}
    </div>
  {/if}

  {#if loading}
    <p class="empty-state">Loading builds...</p>
  {:else if jobs.length === 0 && !isCompiling}
    <p class="empty-state">
      No builds yet. Click "Update Display" to compile your project.
    </p>
  {:else}
    <div class="builds-list">
      {#each visibleJobs as job, idx (job.id)}
        {@const isFirst = idx === 0}
        <div class="build-item" class:published={job.published}>
          <div class="build-row">
            <div class="build-row-main">
              <div
                class="build-status-icon"
                class:success={job.status === "completed"}
                class:failed={job.status === "failed"}
                class:running={job.status === "running" ||
                  job.status === "queued" ||
                  job.status === "pending"}
              >
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
              </div>
              <div class="build-info">
                <div class="build-info-row">
                  <span class="build-time">{timeAgo(job.createdAt)}</span>
                  {#if job.published}
                    <span class="badge live">Live</span>
                  {/if}
                </div>
                {#if job.status === "failed" && job.error}
                  <span class="build-error">{job.error}</span>
                {/if}
              </div>
            </div>

            <div class="build-actions">
              {#if isFirst && job.status === "completed"}
                <button
                  class="action-btn flash-btn"
                  onclick={() => handleFlash(job.id)}
                  disabled={isBusy}
                >
                  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={mdiIcons.mdiUsbPort} />
                  </svg>
                  Flash
                </button>
              {/if}

              {#if popoverOk}
                <button
                  class="menu-toggle"
                  command="toggle-popover"
                  commandfor="power-menu-{job.id}"
                  popovertarget="power-menu-{job.id}"
                  style="anchor-name: --power-{job.id};"
                  aria-label="Build actions"
                  title="Build actions"
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
                  {#if job.status === "completed"}
                    <li>
                      <button
                        onclick={() => handleFlash(job.id)}
                        disabled={isBusy}
                      >
                        <svg
                          class="icon"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d={mdiIcons.mdiUsbPort} />
                        </svg>
                        Flash via USB
                      </button>
                    </li>
                  {/if}
                  <li>
                    <button
                      onclick={() => downloadBin(job.id)}
                      disabled={isBusy}
                    >
                      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={mdiIcons.mdiDownload} />
                      </svg>
                      Download .bin
                    </button>
                  </li>
                  <li>
                    <button
                      onclick={() => rollbackProject(job)}
                      disabled={isBusy || !job.config}
                    >
                      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={mdiIcons.mdiRestore} />
                      </svg>
                      Roll back project
                    </button>
                  </li>
                  <li>
                    <button
                      onclick={() => toggleDiff(job)}
                      disabled={isBusy || !job.config}
                    >
                      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={mdiIcons.mdiCompare} />
                      </svg>
                      {diffs.has(job.id) ? "Hide changes" : "View changes"}
                    </button>
                  </li>
                </menu>
              {:else}
                <details class="power-menu-fallback">
                  <summary aria-label="Build actions" title="Build actions">
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={mdiIcons.mdiDotsHorizontal} />
                    </svg>
                  </summary>
                  <div class="power-menu-content">
                    {#if job.status === "completed"}
                      <button
                        onclick={() => handleFlash(job.id)}
                        disabled={isBusy}
                      >
                        <svg
                          class="icon"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d={mdiIcons.mdiUsbPort} />
                        </svg>
                        Flash via USB
                      </button>
                    {/if}
                    <button
                      onclick={() => downloadBin(job.id)}
                      disabled={isBusy}
                    >
                      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={mdiIcons.mdiDownload} />
                      </svg>
                      Download .bin
                    </button>
                    <button
                      onclick={() => rollbackProject(job)}
                      disabled={isBusy || !job.config}
                    >
                      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={mdiIcons.mdiRestore} />
                      </svg>
                      Roll back project
                    </button>
                    <button
                      onclick={() => toggleDiff(job)}
                      disabled={isBusy || !job.config}
                    >
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

          {#if diffs.has(job.id)}
            <div class="diff-panel">
              <div class="diff-header">
                <span>Changes</span>
                {#if !isFirst}
                  <button
                    class="diff-close"
                    onclick={() => toggleDiff(job)}
                    aria-label="Close"
                  >
                    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={mdiIcons.mdiClose} />
                    </svg>
                  </button>
                {/if}
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

    {#if hasMore}
      <button class="toggle-more" onclick={() => (expanded = !expanded)}>
        {expanded
          ? "Show less"
          : `Show ${jobs.length - 1} older build${jobs.length - 1 === 1 ? "" : "s"}`}
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          class:expanded
        >
          <path
            d="M3 5L6 8L9 5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {/if}
  {/if}
</div>

<style>
  .build-list-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
  }

  .icon {
    width: 14px;
    height: 14px;
    fill: currentColor;
    flex-shrink: 0;
  }

  .empty-state {
    color: var(--color-text-secondary);
    font-size: 13px;
    margin: 0;
    padding: var(--spacing-lg);
    text-align: center;
  }

  .active-build-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-md);
    padding: var(--spacing-md) var(--spacing-lg);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-accent);
    border-radius: 10px;
  }

  .build-row-main {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
    min-width: 0;
  }

  .build-status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    flex-shrink: 0;
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
  }

  .build-status-icon.success {
    background: rgba(76, 175, 80, 0.15);
    color: #66bb6a;
  }

  .build-status-icon.failed {
    background: rgba(244, 67, 54, 0.15);
    color: #f44336;
  }

  .build-status-icon.running {
    background: rgba(33, 150, 243, 0.15);
    color: #64b5f6;
  }

  .build-status-icon.compiling {
    background: rgba(33, 150, 243, 0.15);
    color: #64b5f6;
  }

  .build-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .build-info-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .build-status-text {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .build-time {
    font-size: 13px;
    color: var(--color-text-secondary);
  }

  .build-error {
    font-size: 12px;
    color: #f44336;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .badge.live {
    background: rgba(76, 175, 80, 0.15);
    color: #66bb6a;
  }

  .progress-bar {
    width: 100%;
    height: 3px;
    background: var(--color-bg-tertiary);
    border-radius: 2px;
    overflow: hidden;
    margin-top: 2px;
  }

  .progress-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: 2px;
    transition: width 0.5s ease;
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
    white-space: nowrap;
  }

  .status-badge.failed {
    background: rgba(244, 67, 54, 0.15);
    color: #f44336;
  }

  .status-badge.running {
    background: rgba(33, 150, 243, 0.15);
    color: #64b5f6;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
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

  .build-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-md);
  }

  .build-item.published {
    border-color: rgba(76, 175, 80, 0.35);
  }

  .build-actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-left: auto;
    flex-shrink: 0;
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
    content: "";
    position: absolute;
    left: 2px;
    top: 6px;
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--color-accent);
  }

  .toggle-more {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: var(--spacing-sm);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-secondary);
    font-size: 13px;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }

  .toggle-more:hover {
    color: var(--color-text-primary);
    border-color: var(--color-accent);
    background: var(--color-bg-secondary);
  }

  .toggle-more svg {
    transition: transform 0.2s;
  }

  .toggle-more svg.expanded {
    transform: rotate(180deg);
  }
</style>
