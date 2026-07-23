<script lang="ts">
  let { data } = $props();

  let showRawJson = $state(false);

  interface Component {
    id: string;
    type: string;
    [key: string]: unknown;
  }

  function formatBytes(bytes: number): string {
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  }

  function getComponentType(comp: Component): string {
    return comp.type ?? 'unknown';
  }

  function countComponents(components: Component[] | undefined): Record<string, number> {
    const counts: Record<string, number> = {};
    if (!components) return counts;
    function walk(comps: Component[]) {
      for (const c of comps) {
        const t = getComponentType(c);
        counts[t] = (counts[t] ?? 0) + 1;
        if (c.tabs && Array.isArray(c.tabs)) {
          for (const tab of c.tabs as { components?: Component[] }[]) {
            walk(tab.components ?? []);
          }
        }
      }
    }
    walk(components);
    return counts;
  }

</script>

<svelte:head>
  <title>{data.project?.data?.name ?? 'Project'} - Admin</title>
</svelte:head>

{#if !data.project}
  <p>Project not found.</p>
{:else}
  {@const pd = data.project.data}
  <a href="/projects" style="font-size: 13px; display: inline-block; margin-bottom: 16px;">&larr; Back to projects</a>

  <div class="header">
    <h2>{pd.name ?? '(unnamed)'}</h2>
    <div class="header-meta">
      {#if data.username}
        <a href="/users/{data.project.userId}">{data.username}</a>
        <span class="sep"></span>
      {/if}
      <span class="text-muted">v{pd.version ?? '?'}</span>
      <span class="sep"></span>
      <span class="text-muted">{pd.timezone ?? '?'}</span>
      <span class="sep"></span>
      <span class="text-muted">{pd.display?.width ?? '?'}x{pd.display?.height ?? '?'}</span>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <span class="info-label">Project ID</span>
      <code>{data.project.id}</code>
    </div>
    <div class="info-card">
      <span class="info-label">Firmware Token</span>
      <code style="font-size: 11px;">{data.project.firmwareToken.slice(0, 8)}...</code>
    </div>
    <div class="info-card">
      <span class="info-label">Created</span>
      <span>{new Date(data.project.createdAt).toLocaleString()}</span>
    </div>
    <div class="info-card">
      <span class="info-label">Updated</span>
      <span>{new Date(data.project.updatedAt).toLocaleString()}</span>
    </div>
    <div class="info-card">
      <span class="info-label">Data Size</span>
      <span>{formatBytes(JSON.stringify(pd).length)}</span>
    </div>
    {#if data.project.lastSavedData}
      <div class="info-card">
        <span class="info-label">Last Save Snapshot</span>
        <span>{formatBytes(JSON.stringify(data.project.lastSavedData).length)}</span>
      </div>
    {/if}
  </div>

  <!-- Theme -->
  {#if pd.theme}
    {@const theme = pd.theme as Record<string,unknown>}
    <h3 style="margin-top: 28px;">Theme: {theme.name ?? theme.id ?? '?'}</h3>
  {/if}

  <!-- Dashboard Pages -->
  {@const dpages = pd.dashboardPages as {id:string; name:string; components?:Component[]}[] | undefined}
  {#if dpages}
    <h3 style="margin-top: 28px;">Dashboard Pages ({dpages.length})</h3>
    {#each dpages as page}
      {@const typeCounts = countComponents(page.components)}
      <h4 style="margin-top: 16px;">{page.name ?? page.id}</h4>
      <table>
        <thead><tr><th>Component Type</th><th>Count</th></tr></thead>
        <tbody>
          {#each Object.entries(typeCounts).sort(([,a],[,b]) => b - a) as [type, count]}
            <tr><td>{type}</td><td>{count}</td></tr>
          {/each}
        </tbody>
      </table>
    {/each}
  {/if}

  <!-- Detail Views -->
  {@const dviews = pd.detailViews as {id:string; title:string; height?:number; components?:Component[]}[] | undefined}
  {#if dviews}
    <h3 style="margin-top: 28px;">Detail Views ({dviews.length})</h3>
    {#each dviews as view}
      {@const typeCounts = countComponents(view.components)}
      <h4 style="margin-top: 16px;">{view.title ?? view.id} {#if view.height}<span class="text-muted">({view.height}px)</span>{/if}</h4>
      <table>
        <thead><tr><th>Component Type</th><th>Count</th></tr></thead>
        <tbody>
          {#each Object.entries(typeCounts).sort(([,a],[,b]) => b - a) as [type, count]}
            <tr><td>{type}</td><td>{count}</td></tr>
          {/each}
        </tbody>
      </table>
    {/each}
  {/if}

  <!-- Page Header -->
  {@const pheader = pd.pageHeader as {height?:number; components?:Component[]} | undefined}
  {#if pheader}
    <h3 style="margin-top: 28px;">Page Header {#if pheader.height}<span class="text-muted">({pheader.height}px)</span>{/if}</h3>
    {@const typeCounts = countComponents(pheader.components)}
    <table>
      <thead><tr><th>Component Type</th><th>Count</th></tr></thead>
      <tbody>
        {#each Object.entries(typeCounts).sort(([,a],[,b]) => b - a) as [type, count]}
          <tr><td>{type}</td><td>{count}</td></tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <!-- Notification Overlay -->
  {@const no = pd.notificationOverlay as Record<string,unknown> | undefined}
  {#if no}
    <h3 style="margin-top: 28px;">Notification Overlay: <span class="badge" class:badge-completed={!!no.enabled} class:badge-failed={!no.enabled}>{no.enabled ? 'Enabled' : 'Disabled'}</span></h3>
  {/if}

  <!-- Compilation Jobs -->
  <h3 style="margin-top: 28px;">Compilation Jobs ({data.jobs.length})</h3>
  <table>
    <thead>
      <tr><th>Status</th><th>Template</th><th>Published</th><th>Binary Size</th><th>Created</th><th>Completed</th><th></th></tr>
    </thead>
    <tbody>
      {#each data.jobs as job}
        <tr>
          <td><span class="badge badge-{job.status}">{job.status}</span></td>
          <td>{job.template ?? 'full'}</td>
          <td>{job.published ? 'Yes' : 'No'}</td>
          <td>
            {#if job.binarySizeFormatted}
              {job.binarySizeFormatted}
            {:else}
              <span class="text-muted">—</span>
            {/if}
          </td>
          <td>{new Date(job.createdAt).toLocaleString()}</td>
          <td>{job.completedAt ? new Date(job.completedAt).toLocaleString() : '—'}</td>
          <td><a href="/jobs/{job.id}">View</a></td>
        </tr>
      {/each}
      {#if data.jobs.length === 0}
        <tr><td colspan="7" style="color: var(--text-muted); text-align: center;">No jobs</td></tr>
      {/if}
    </tbody>
  </table>

  <!-- Raw JSON toggle -->
  <div style="margin-top: 28px; border-top: 1px solid var(--border); padding-top: 16px;">
    <button onclick={() => showRawJson = !showRawJson} class:primary={showRawJson}>
      {showRawJson ? 'Hide' : 'Show'} Raw JSON
    </button>
    {#if showRawJson}
      <pre style="margin-top: 12px; max-height: 600px;">{JSON.stringify(pd, null, 2)}</pre>
    {/if}
  </div>
{/if}

<style>
  .header { margin-bottom: 24px; }
  .header h2 { font-size: 22px; }
  .header-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 4px;
    font-size: 13px;
    flex-wrap: wrap;
  }
  .header-meta a { color: var(--accent); text-decoration: none; }
  .header-meta a:hover { text-decoration: underline; }
  .sep {
    width: 1px;
    height: 12px;
    background: var(--border);
    display: inline-block;
  }
  .text-muted { color: var(--text-muted); }
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
  }
  h4 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 6px;
  }
  h4 .text-muted {
    font-weight: 400;
    font-size: 12px;
  }
</style>
