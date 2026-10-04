<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { projectStore } from '$lib/stores/project.svelte';
  import { compileUiManifest } from '$lib/codegen/ui-manifest';
  import { manifestFingerprint, uiManifestRequirements, uiCompatibilityReasons } from '$lib/codegen/ui-capabilities';
  import { validateProject } from '$lib/codegen/validations';
  import type { UiDeploymentStatus } from '$lib/types/ui-deployment';

  let { projectId, initial, onBuildFirmware, onStatusChange, building = false }: {
    projectId: string; initial: UiDeploymentStatus; onBuildFirmware: () => void;
    onStatusChange?: (status: UiDeploymentStatus) => void; building?: boolean;
  } = $props();
  let status = $state<UiDeploymentStatus>(untrack(() => initial));
  let publishing = $state(false);
  let removingDevice = $state<string | null>(null);
  let loadError = $state('');
  let publishError = $state('');
  let notice = $state('');
  let disposed = false;
  let request: AbortController | null = null;

  const compatibility = $derived.by(() => {
    const project = projectStore.project;
    if (!project) return { reasons: ['Loading project…'], fingerprint: null };
    const errors = validateProject(project);
    if (errors.length) return { reasons: errors.map(issue => issue.message), fingerprint: null };
    const manifest = compileUiManifest(project);
    if (!manifest.ok) return { reasons: manifest.errors.map(issue => issue.message), fingerprint: null };
    const requirements = uiManifestRequirements(project);
    return { reasons: [...new Set(status.firmwareBuilds.flatMap(build => uiCompatibilityReasons(requirements, build.capabilities)))],
      fingerprint: manifestFingerprint(manifest.bytes) };
  });
  const unchanged = $derived(compatibility.reasons.length === 0 && compatibility.fingerprint !== null && compatibility.fingerprint === status.published?.fingerprint);
  const canPublish = $derived(status.ready && compatibility.reasons.length === 0 && !unchanged && !building);

  async function refresh() {
    request?.abort();
    const controller = new AbortController();
    request = controller;
    try {
      const response = await fetch(`/api/projects/${projectId}/ui-manifest`, { signal: controller.signal, headers: { Accept: 'application/json' } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Could not load layout deployment status.');
      if (!disposed) { status = result; loadError = ''; onStatusChange?.(status); }
    } catch (error) {
      if (!controller.signal.aborted && !disposed) loadError = error instanceof Error ? error.message : 'Could not load layout deployment status.';
    }
  }

  onMount(() => {
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && !publishing) void refresh(); }, 5000);
    return () => { disposed = true; request?.abort(); clearInterval(timer); };
  });

  async function publish() {
    if (!canPublish || publishing) return;
    publishing = true; publishError = ''; notice = '';
    try {
      await projectStore.saveNow();
      const response = await fetch(`/api/projects/${projectId}/ui-manifest`, { method: 'POST', headers: { Accept: 'application/json' } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Could not publish layout.');
      notice = `Layout revision ${result.revision} published. It will load when the device next restarts.`;
      await refresh();
    } catch (error) {
      publishError = error instanceof Error ? error.message : 'Could not publish layout.';
    } finally { publishing = false; }
  }

  async function removeDevice(deviceId: string) {
    if (removingDevice !== null) return;
    removingDevice = deviceId;
    publishError = '';
    try {
      const response = await fetch(`/api/projects/${projectId}/ui-devices/${encodeURIComponent(deviceId)}`, { method: 'DELETE' });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.message || 'Could not remove device.');
      }
      await refresh();
    } catch (error) {
      publishError = error instanceof Error ? error.message : 'Could not remove device.';
    } finally { removingDevice = null; }
  }
</script>

<section class="manifest-panel" aria-labelledby="manifest-title">
  <div class="summary">
    <div>
      <p class="eyebrow">Reboot-only layout updates</p>
      <h2 id="manifest-title">{status.ready ? 'Manifest-enabled firmware' : 'Install manifest-enabled firmware'}</h2>
      <p class="description">Publish compatible layout changes without compiling firmware. Updates take effect after a restart.</p>
    </div>
    <div class="actions">
      <button class="primary" onclick={publish} disabled={!canPublish || publishing}>
        {publishing ? 'Publishing…' : unchanged ? 'Layout up to date' : 'Publish layout'}
      </button>
      <button onclick={onBuildFirmware} disabled={building || publishing}>Build firmware</button>
    </div>
  </div>

  {#if !status.ready}
    <p class="hint">Build and install firmware once, or download and install the source ZIP. Existing generated firmware cannot fetch layouts.</p>
  {:else if !status.installationConfirmed}
    <p class="hint">Firmware is ready for installation. Its installation and active layout are unconfirmed until the device reports a boot.</p>
  {/if}
  {#if compatibility.reasons.length}
    <div class="requirements">
      <strong>Firmware update or project changes required</strong>
      <ul>{#each compatibility.reasons as reason (reason)}<li>{reason}</li>{/each}</ul>
    </div>
  {/if}

  <div class="revision-summary">
    <span><strong>Draft:</strong> {unchanged ? 'Matches published layout' : 'Unpublished changes'}</span>
    <span><strong>Published:</strong> {status.published ? `Revision ${status.published.revision}` : 'No layout published'}</span>
    <button class="refresh" onclick={refresh}>Refresh status</button>
  </div>
  {#if notice}<p class="notice" role="status">{notice}</p>{/if}
  {#if publishError || loadError}<p class="error" role="alert">{publishError || loadError}</p>{/if}

  {#if status.devices.length}
    <ul class="devices">
      {#each status.devices as device (device.deviceId)}
        <li>
          <div class="device-heading"><strong>{device.deviceId}</strong>
            <span>{device.activeRevision !== null ? `Revision ${device.activeRevision} active` : 'Embedded or unrecognized layout'}</span></div>
          <p>{device.source === 'download' ? 'Downloaded at boot' : device.source === 'cache' ? 'Using cached manifest' : 'Using embedded fallback'}
            · Last boot report {new Date(device.reportedAt).toLocaleString()}</p>
          {#if status.published && device.activeRevision !== status.published.revision}
            <p class="hint">Revision {status.published.revision} is published.
              {device.canLoadPublished ? 'Restart the device to apply it.' : 'Install updated firmware before applying this layout.'}</p>
          {/if}
          {#if device.error}<p class="error">Boot fallback reason: {device.error}</p>{/if}
          <button onclick={() => removeDevice(device.deviceId)} disabled={removingDevice !== null || publishing}>
            {removingDevice === device.deviceId ? 'Removing…' : 'Remove device'}
          </button>
          <p class="hint">Remove retired devices from publication checks. A device that reports another boot will reappear.</p>
        </li>
      {/each}
    </ul>
  {:else}
    <p class="hint">Active revision unknown. Restart the installed device to receive its first boot report. Reports confirm past boots, not current connectivity.</p>
  {/if}
</section>

<style>
  .manifest-panel { margin: 24px; padding: 24px; border: 1px solid var(--color-border); border-radius: 12px; background: var(--color-bg-secondary); color: var(--color-text-primary); }
  .summary, .actions, .revision-summary, .device-heading { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
  .summary { justify-content: space-between; }
  .summary > div:first-child { flex: 1; min-width: 220px; }
  h2 { margin: 6px 0; font-size: 20px; }
  p { margin: 8px 0; line-height: 1.5; }
  .eyebrow { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--color-accent); }
  .description, .hint, .devices p { color: var(--color-text-secondary); font-size: 13px; }
  button { padding: 10px 14px; border: 1px solid var(--color-border); border-radius: 6px; background: var(--color-bg-tertiary); color: var(--color-text-primary); cursor: pointer; font: inherit; font-size: 13px; }
  button.primary { background: var(--color-accent); color: #fff; border-color: transparent; }
  button:disabled { opacity: .5; cursor: default; }
  button:not(:disabled):hover { filter: brightness(1.1); }
  .requirements { margin: 16px 0; padding: 14px; background: var(--color-bg-tertiary); border-radius: 6px; font-size: 13px; }
  .requirements ul { margin: 8px 0 0; padding-left: 18px; }
  .revision-summary { margin-top: 18px; font-size: 13px; }
  .refresh { margin-left: auto; }
  .notice { color: var(--color-accent); }
  .error, .devices p.error { color: #ef7777; font-size: 13px; }
  .devices { list-style: none; margin: 16px 0 0; padding: 0; }
  .devices li { padding-top: 14px; margin-top: 12px; border-top: 1px solid var(--color-border); font-size: 13px; }
  .device-heading { justify-content: space-between; }
  @media (max-width: 600px) { .manifest-panel { margin: 12px; padding: 16px; } .actions { width: 100%; } .refresh { margin-left: 0; } }
</style>
