<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>{data.user?.username ?? 'User'} - Admin</title>
</svelte:head>

{#if !data.user}
  <p>User not found.</p>
{:else}
  <a href="/users" style="font-size: 13px; display: inline-block; margin-bottom: 16px;">&larr; Back to users</a>

  <div class="user-header">
    <h2>{data.user.username}</h2>
    <span class="text-muted">{data.user.email ?? 'No email'}</span>
  </div>

  <div class="info-grid">
    <div class="info-card">
      <span class="info-label">User ID</span>
      <code>{data.user.id}</code>
    </div>
    <div class="info-card">
      <span class="info-label">Credits</span>
      <span class="info-value">{data.balance}</span>
    </div>
    <div class="info-card">
      <span class="info-label">Joined</span>
      <span>{new Date(data.user.createdAt).toLocaleString()}</span>
    </div>
    <div class="info-card">
      <span class="info-label">Last Login</span>
      <span>{data.user.lastLogin ? new Date(data.user.lastLogin).toLocaleString() : 'never'}</span>
    </div>
  </div>

  <h3 style="margin-top: 32px;">Projects ({data.projects.length})</h3>
  <table>
    <thead>
      <tr><th>Name</th><th>Updated</th><th>Firmware Token</th></tr>
    </thead>
    <tbody>
      {#each data.projects as p}
        <tr>
          <td>{p.name}</td>
          <td>{new Date(p.updatedAt).toLocaleString()}</td>
          <td><code style="font-size: 11px;">{p.firmwareToken.slice(0, 8)}...</code></td>
        </tr>
      {/each}
      {#if data.projects.length === 0}
        <tr><td colspan="3" class="text-muted" style="text-align: center;">No projects</td></tr>
      {/if}
    </tbody>
  </table>

  <h3 style="margin-top: 32px;">Credit History</h3>
  <table>
    <thead>
      <tr><th>Amount</th><th>Balance After</th><th>Reason</th><th>Date</th></tr>
    </thead>
    <tbody>
      {#each data.transactions as tx}
        <tr>
          <td style="color: {tx.amount > 0 ? 'var(--success)' : 'var(--error)'};">{tx.amount > 0 ? '+' : ''}{tx.amount}</td>
          <td>{tx.balanceAfter}</td>
          <td>{tx.reason}</td>
          <td>{new Date(tx.createdAt!).toLocaleString()}</td>
        </tr>
      {/each}
      {#if data.transactions.length === 0}
        <tr><td colspan="4" class="text-muted" style="text-align: center;">No transactions</td></tr>
      {/if}
    </tbody>
  </table>

  <h3 style="margin-top: 32px;">Recent Jobs</h3>
  <table>
    <thead>
      <tr><th>Project</th><th>Status</th><th>Created</th><th></th></tr>
    </thead>
    <tbody>
      {#each data.jobs as job}
        <tr>
          <td>{job.projectName}</td>
          <td><span class="badge badge-{job.status}">{job.status}</span></td>
          <td>{new Date(job.createdAt).toLocaleString()}</td>
          <td><a href="/jobs/{job.id}">View</a></td>
        </tr>
      {/each}
      {#if data.jobs.length === 0}
        <tr><td colspan="4" class="text-muted" style="text-align: center;">No jobs</td></tr>
      {/if}
    </tbody>
  </table>
{/if}

<style>
  .user-header { margin-bottom: 24px; }
  .user-header h2 { font-size: 22px; }
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
  .info-value {
    font-size: 18px;
    font-weight: 600;
    color: var(--accent);
  }
  code {
    font-size: 12px;
    background: var(--bg-tertiary);
    padding: 1px 6px;
    border-radius: 3px;
  }
</style>
