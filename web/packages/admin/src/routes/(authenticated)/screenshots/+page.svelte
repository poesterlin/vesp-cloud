<script lang="ts">
  let { data } = $props();
  const names = $derived(data.names as string[]);
</script>

<h1>Screenshots</h1>

{#if names.length > 0}
  <div class="toolbar">
    <span>{names.length} screenshot{names.length !== 1 ? "s" : ""}</span>
    <a href="/screenshots/download" class="dl-all">Download All</a>
  </div>
{/if}

{#if names.length === 0}
  <p class="empty">No screenshots captured yet.</p>
{:else}
  <div class="screenshots-grid">
    {#each names as name}
      <div class="screenshot-card">
        <div class="screenshot-preview">
          <img
            src="/screenshots/{name}"
            alt={name}
            loading="lazy"
          />
        </div>
        <div class="screenshot-footer">
          <span class="fname">{name}</span>
          <a class="dl" href="/screenshots/{name}" download>Download</a>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  h1 { font-size: 24px; margin-bottom: 16px; }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .dl-all {
    font-size: 13px;
    color: var(--accent);
    text-decoration: none;
    padding: 4px 14px;
    border: 1px solid var(--accent);
    border-radius: 6px;
  }
  .dl-all:hover { background: var(--accent); color: #fff; }

  .empty { color: var(--text-secondary); font-size: 14px; }

  .screenshots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 16px;
  }

  .screenshot-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .screenshot-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    min-height: 280px;
  }

  .screenshot-preview img {
    display: block;
    max-width: 100%;
    max-height: 50vh;
    image-rendering: pixelated;
  }

  .screenshot-footer {
    padding: 6px 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .fname {
    font-family: monospace;
    font-size: 11px;
    color: var(--text-secondary);
  }

  .dl {
    font-size: 11px;
    color: var(--accent);
    text-decoration: none;
    padding: 2px 8px;
    border: 1px solid var(--accent);
    border-radius: 4px;
  }
  .dl:hover { background: var(--accent); color: #fff; }
</style>
