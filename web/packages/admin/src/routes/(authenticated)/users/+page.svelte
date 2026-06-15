<script lang="ts">
  let { data } = $props();
</script>

<svelte:head>
  <title>Users - Admin</title>
</svelte:head>

<h2>Users ({data.users.length})</h2>

<table style="margin-top: 16px;">
  <thead>
    <tr>
      <th>Username</th>
      <th>Email</th>
      <th>Credits</th>
      <th>Created</th>
      <th>Last Login</th>
      <th></th>
    </tr>
  </thead>
  <tbody>
    {#each data.users as user}
      <tr>
        <td>{user.username}</td>
        <td style="color: var(--text-secondary);">{user.email ?? '—'}</td>
        <td>{user.credits}</td>
        <td>{new Date(user.createdAt).toLocaleDateString()}</td>
        <td>{user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'never'}</td>
        <td><a href="/users/{user.id}">View</a></td>
      </tr>
    {/each}
    {#if data.users.length === 0}
      <tr><td colspan="6" style="color: var(--text-muted); text-align: center;">No users found</td></tr>
    {/if}
  </tbody>
</table>
