<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.job?.projectName ?? 'Job'} - Admin</title>
</svelte:head>

{#if !data.job}
  <p>Job not found.</p>
{:else}
  <a href="/jobs" style="font-size: 13px; display: inline-block; margin-bottom: 16px;">&larr; Back to jobs</a>

  <div class="job-header">
    <h2>{data.job.projectName}</h2>
    <span class="badge badge-{data.job.status}">{data.job.status}</span>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <span class="info-label">Job ID</span>
      <code>{data.job.id}</code>
    </div>
    <div class="info-card">
      <span class="info-label">Project ID</span>
      <code>{data.job.projectId ?? '—'}</code>
    </div>
    <div class="info-card">
      <span class="info-label">User ID</span>
      <code>{data.job.userId ?? '—'}</code>
    </div>
    <div class="info-card">
      <span class="info-label">Template</span>
      <span>{data.job.template ?? 'full'}</span>
    </div>
    <div class="info-card">
      <span class="info-label">Published</span>
      <span>{data.job.published ? 'Yes' : 'No'}</span>
    </div>
    <div class="info-card">
      <span class="info-label">Pinned</span>
      <span>{data.job.pinned ? 'Yes' : 'No'}</span>
    </div>
    <div class="info-card">
      <span class="info-label">Created</span>
      <span>{new Date(data.job.createdAt).toLocaleString()}</span>
    </div>
    <div class="info-card">
      <span class="info-label">Started</span>
      <span>{data.job.startedAt ? new Date(data.job.startedAt).toLocaleString() : '—'}</span>
    </div>
    <div class="info-card">
      <span class="info-label">Completed</span>
      <span>{data.job.completedAt ? new Date(data.job.completedAt).toLocaleString() : '—'}</span>
    </div>
    {#if data.job.configPath}
      <div class="info-card">
        <span class="info-label">Config Path</span>
        <code>{data.job.configPath}</code>
      </div>
    {/if}
  </div>

  {#if data.job.config}
    <h3 style="margin-top: 32px;">Configuration</h3>
    <pre>{data.job.config}</pre>
  {/if}

  {#if data.job.output}
    <h3 style="margin-top: 32px;">Output</h3>
    <pre>{data.job.output}</pre>
  {/if}

  {#if data.job.error}
    <h3 style="margin-top: 32px;">Error</h3>
    <pre style="border: 1px solid var(--error); color: var(--error);">{data.job.error}</pre>
  {/if}
{/if}

<style>
  .job-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 24px;
  }
  .job-header h2 { font-size: 22px; }
  .info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }
  .info-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .info-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: var(--text-secondary);
  }
  code {
    font-size: 12px;
    background: var(--bg-tertiary);
    padding: 1px 6px;
    border-radius: 3px;
    word-break: break-all;
  }
</style>
