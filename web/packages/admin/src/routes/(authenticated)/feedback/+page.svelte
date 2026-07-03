<script lang="ts">
  let { data, form } = $props();

  function formatDate(value: string) {
    return new Date(value).toLocaleString();
  }
</script>

<svelte:head>
  <title>Feedback - Admin</title>
</svelte:head>

<h2>Feedback ({data.entries.length})</h2>

{#if form?.message}
  <p class="message error">{form.message}</p>
{:else if form?.success}
  <p class="message success">Reply sent.</p>
{/if}

<table style="margin-top: 16px;">
  <thead>
    <tr>
      <th>User</th>
      <th>Feedback</th>
      <th>Reply</th>
      <th>Created</th>
    </tr>
  </thead>
  <tbody>
    {#each data.entries as entry (entry.id)}
      <tr>
        <td>
          <div>{entry.username ?? entry.userId}</div>
          <div class="muted">{entry.email ?? 'no email'}</div>
        </td>
        <td>
          <div class="text-cell">{entry.message}</div>
        </td>
        <td>
          {#if entry.adminReply}
            <div class="text-cell">{entry.adminReply}</div>
            <div class="muted">{entry.repliedAt ? formatDate(entry.repliedAt) : ''}</div>
          {:else}
            <form method="POST" action="?/reply" class="reply-form">
              <input type="hidden" name="id" value={entry.id} />
              <textarea
                name="reply"
                rows="3"
                minlength="2"
                maxlength="2000"
                required
                placeholder="Write one reply"
              ></textarea>
              <button type="submit" class="btn primary">Send Reply</button>
            </form>
          {/if}
        </td>
        <td>{formatDate(entry.createdAt)}</td>
      </tr>
    {/each}
    {#if data.entries.length === 0}
      <tr><td colspan="4" style="color: var(--text-muted); text-align: center;">No feedback found</td></tr>
    {/if}
  </tbody>
</table>

<style>
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }

  .message {
    margin-top: 12px;
    padding: 8px 10px;
    border-radius: var(--radius);
    width: fit-content;
  }

  .message.error {
    background: rgba(244, 67, 54, 0.15);
    border: 1px solid rgba(244, 67, 54, 0.35);
    color: #ffb0a8;
  }

  .message.success {
    background: rgba(76, 175, 80, 0.15);
    border: 1px solid rgba(76, 175, 80, 0.35);
    color: #a6e3aa;
  }

  .text-cell {
    max-width: 420px;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .reply-form {
    display: grid;
    gap: 8px;
    min-width: 240px;
  }

  .reply-form textarea {
    width: 100%;
    font-family: inherit;
    font-size: 13px;
    background: var(--bg-tertiary);
    color: var(--text-primary);
    border: 1px solid var(--border);
    padding: 6px 10px;
    border-radius: var(--radius);
    resize: vertical;
  }
</style>
