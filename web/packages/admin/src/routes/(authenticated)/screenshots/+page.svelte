<script lang="ts">
  interface DeviceScreenshot {
    deviceId: string;
    size: number;
    mtime: number;
  }

  let { data } = $props();
  const devices = $derived(data.devices as DeviceScreenshot[]);

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }

  function formatAge(ms: number): string {
    const delta = Date.now() - ms;
    if (delta < 60_000) return "just now";
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    return new Date(ms).toLocaleString();
  }
</script>

<h1>Device Screenshots</h1>

{#if devices.length === 0}
  <p class="empty">No screenshots captured yet.</p>
  <p class="hint">
    Set <code>SCREENSHOT_DEBUG_ENABLED=1</code> on the editor server,
    then press <code>"Take Screenshot"</code> in Home Assistant.
  </p>
{:else}
  <div class="screenshots-grid">
    {#each devices as device}
      <div class="screenshot-card">
        <div class="screenshot-preview">
          <img
            src="/screenshots/{device.deviceId}?_={device.mtime}"
            alt="Screenshot from {device.deviceId}"
            loading="lazy"
          />
        </div>
        <div class="screenshot-info">
          <h3>{device.deviceId}</h3>
          <span class="size">{formatSize(device.size)}</span>
          <span class="age">{formatAge(device.mtime)}</span>
        </div>
      </div>
    {/each}
  </div>
{/if}

<style>
  h1 {
    font-size: 24px;
    margin-bottom: 24px;
  }

  .empty {
    color: var(--text-secondary);
    font-size: 14px;
  }

  .hint {
    color: var(--text-secondary);
    font-size: 13px;
    margin-top: 8px;
  }
  .hint code {
    background: var(--bg-tertiary);
    padding: 1px 5px;
    border-radius: 4px;
    font-family: monospace;
  }

  .screenshots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    gap: 24px;
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
    min-height: 320px;
  }

  .screenshot-preview img {
    display: block;
    max-width: 100%;
    max-height: 60vh;
    image-rendering: pixelated;
  }

  .screenshot-info {
    padding: 12px 16px;
    display: flex;
    align-items: baseline;
    gap: 12px;
  }

  .screenshot-info h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    font-family: monospace;
  }

  .size {
    color: var(--text-secondary);
    font-size: 12px;
  }

  .age {
    color: var(--text-secondary);
    font-size: 12px;
    margin-left: auto;
  }
</style>
