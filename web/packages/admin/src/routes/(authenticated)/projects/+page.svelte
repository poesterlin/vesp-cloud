<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Projects - Admin</title>
</svelte:head>

<h2>Projects ({data.projects.length})</h2>

<table style="margin-top: 16px;">
  <thead>
    <tr>
      <th>Name</th>
      <th>Owner</th>
      <th>Created</th>
      <th>Updated</th>
      <th>Jobs</th>
      <th>Last Job</th>
      <th>Firmware Token</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    {#each data.projects as p}
      <tr>
        <td>{p.name}</td>
        <td><a href="/users/{p.userId}">{p.username ?? p.userId}</a></td>
        <td>{new Date(p.createdAt).toLocaleDateString()}</td>
        <td>{new Date(p.updatedAt).toLocaleDateString()}</td>
        <td>{p.jobCount}</td>
        <td>
          {#if p.lastJobStatus}
            <span class="badge badge-{p.lastJobStatus}">{p.lastJobStatus}</span>
          {:else}
            <span style="color: var(--text-muted);">—</span>
          {/if}
        </td>
        <td><code style="font-size: 11px;">{p.firmwareToken.slice(0, 8)}...</code></td>
        <td><a href="/projects/{p.id}">View</a></td>
      </tr>
    {/each}
    {#if data.projects.length === 0}
      <tr><td colspan="8" style="color: var(--text-muted); text-align: center;">No projects found</td></tr>
    {/if}
  </tbody>
</table>
