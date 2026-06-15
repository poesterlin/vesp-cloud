<script lang="ts">
  let { data } = $props();

  const statuses = ["", "pending", "running", "completed", "failed"];
  const statusLabels: Record<string, string> = { "": "All", pending: "Pending", running: "Running", completed: "Completed", failed: "Failed" };
</script>

<svelte:head>
  <title>Jobs - Admin</title>
</svelte:head>

<h2>Jobs</h2>

<div class="filters">
  {#each statuses as s}
    <a
      href="/jobs?status={s || ''}"
      class="filter-btn"
      class:active={data.filter === s || (!data.filter && s === "")}
    >
      {statusLabels[s] ?? s}
    </a>
  {/each}
</div>

<table style="margin-top: 16px;">
  <thead>
    <tr>
      <th>Project</th>
      <th>User</th>
      <th>Status</th>
      <th>Published</th>
      <th>Created</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    {#each data.jobs as job}
      <tr>
        <td>{job.projectName}</td>
        <td style="color: var(--text-secondary);">{job.userId ?? '—'}</td>
        <td><span class="badge badge-{job.status}">{job.status}</span></td>
        <td>{job.published ? 'Yes' : 'No'}</td>
        <td>{new Date(job.createdAt).toLocaleString()}</td>
        <td><a href="/jobs/{job.id}">View</a></td>
      </tr>
    {/each}
    {#if data.jobs.length === 0}
      <tr><td colspan="6" style="color: var(--text-muted); text-align: center;">No jobs found</td></tr>
    {/if}
  </tbody>
</table>

<style>
  .filters {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    flex-wrap: wrap;
  }
  .filter-btn {
    padding: 5px 14px;
    border-radius: var(--radius);
    font-size: 13px;
    border: 1px solid var(--border);
    color: var(--text-secondary);
    text-decoration: none;
  }
  .filter-btn:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    text-decoration: none;
  }
  .filter-btn.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
</style>
