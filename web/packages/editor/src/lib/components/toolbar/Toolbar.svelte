<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { historyStore } from "$lib/stores/history.svelte";
  import { canvasZoomStore } from "$lib/stores/canvas-zoom.svelte";
  import * as mdiIcons from "@mdi/js";
  import { dev } from "$app/environment";
  import { fade } from "svelte/transition";

  interface Props {
    onSettings: () => void;
    onDebug: () => void;
  }

  let { onSettings, onDebug }: Props = $props();

  let saving = $derived(projectStore.saving);
</script>

<header class="toolbar">
  <div class="toolbar-left">
    <a href="/" class="projects-link">
      <svg width="18" height="18" viewBox="0 0 24 24" class="icon">
        <path d={mdiIcons.mdiHome} />
      </svg>
      <span>Projects</span>
    </a>
  </div>

  <div class="toolbar-center">
    <input
      type="text"
      class="project-name"
      value={projectStore.project?.name ?? ""}
      oninput={(e: Event) =>
        projectStore.updateProject({
          name: (e.target as HTMLInputElement).value,
        })}
    />
  </div>

  <div class="toolbar-right">
    {#if saving}
      <div
        class="save-spinner"
        in:fade={{ duration: 250, delay: 500 }}
        out:fade
      ></div>
    {/if}
    <button onclick={onSettings} title="Project Settings" class="settings-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
        <path d={mdiIcons.mdiCog} />
      </svg>
      <span>Settings</span>
    </button>
    {#if dev}
      <button onclick={onDebug} title="Debug JSON" class="settings-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
          <path d={mdiIcons.mdiFlash} />
        </svg>
        <span>Debug</span>
      </button>
    {/if}
    <a href="https://docs.vesp.cloud" target="_blank" title="Documentation" class="settings-btn">
      <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
        <path d={mdiIcons.mdiBookOpenPageVariant} />
      </svg>
      <span>Docs</span>
    </a>
    <div class="separator"></div>
    <div class="zoom-control" title="Canvas Zoom">
      <svg width="14" height="14" viewBox="0 0 24 24" class="icon">
        <path d={mdiIcons.mdiMagnify} />
      </svg>
      <input
        type="range"
        min="1"
        max="2"
        step="0.25"
        value={canvasZoomStore.level}
        oninput={(e) =>
          canvasZoomStore.setLevel(
            parseFloat((e.target as HTMLInputElement).value),
          )}
        class="zoom-slider"
      />
      <span class="zoom-label">{canvasZoomStore.level.toFixed(2)}x</span>
    </div>
    <div class="separator"></div>
    <button
      onclick={() => historyStore.undo()}
      disabled={!historyStore.canUndo}
      title="Undo (Ctrl+Z)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
        <path d={mdiIcons.mdiUndo} />
      </svg>
    </button>
    <button
      onclick={() => historyStore.redo()}
      disabled={!historyStore.canRedo}
      title="Redo (Ctrl+Y)"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
        <path d={mdiIcons.mdiRedo} />
      </svg>
    </button>
    <div class="separator"></div>
    <a
      class="primary export-link"
      href="/project/{projectStore.serverProjectId}/deploy"
      title="Deploy"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" class="icon">
        <path d={mdiIcons.mdiFlash} />
      </svg>
      Deploy
    </a>
  </div>
</header>

<style>
  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--spacing-sm) var(--spacing-md);
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-border);
    height: 48px;
  }

  .toolbar-left,
  .toolbar-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .toolbar-center {
    flex: 1;
    display: flex;
    justify-content: center;
  }

  .projects-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    line-height: 1;
    text-decoration: none;
    color: var(--color-text-secondary);
    font-size: 13px;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    transition: background 0.2s;
  }

  .settings-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    line-height: 1;
    font-size: 12px;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    text-decoration: none;
    transition: background 0.2s, color 0.2s;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .settings-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    font-size: 12px;
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .projects-link:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
  }

  .logo {
    font-weight: 600;
    font-size: 14px;
    color: var(--color-accent);
  }

  .project-name {
    background: transparent;
    border: 1px solid transparent;
    text-align: center;
    font-size: 14px;
    font-weight: 500;
    padding: var(--spacing-xs) var(--spacing-md);
    min-width: 200px;
    border-radius: var(--radius-sm);
  }

  .project-name:hover {
    border-color: var(--color-border);
  }

  .project-name:focus {
    border-color: var(--color-accent);
    background: var(--color-bg-tertiary);
  }

  .separator {
    width: 1px;
    height: 24px;
    background: var(--color-border);
    margin: 0 var(--spacing-xs);
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    font-size: 12px;
    padding: var(--spacing-xs) var(--spacing-sm);
  }

  .primary {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    line-height: 1;
  }

  .export-link {
    font-size: 12px;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    background: var(--color-accent);
    color: white;
    text-decoration: none;
    transition: background 0.2s;
  }

  .export-link:hover {
    background: var(--color-accent-hover);
  }

  .icon {
    display: block;
    flex-shrink: 0;
    fill: currentColor;
    stroke: none;
  }

  .toolbar :is(button, a) > .icon {
    align-self: center;
    margin-block: auto;
  }

  .zoom-control {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--color-text-muted);
  }

  .zoom-slider {
    width: 80px;
    height: 4px;
    -webkit-appearance: none;
    appearance: none;
    background: var(--color-border);
    border-radius: 2px;
    outline: none;
    cursor: pointer;
  }

  .zoom-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-accent);
    cursor: pointer;
  }

  .zoom-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-accent);
    cursor: pointer;
    border: none;
  }

  .zoom-label {
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    min-width: 36px;
    text-align: right;
    color: var(--color-text-secondary);
  }

  .save-spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    flex-shrink: 0;
    border: 2px solid rgba(255, 255, 255, 0.15);
    border-top-color: var(--color-accent);
    border-radius: 50%;
    animation: save-spin 0.6s linear infinite;
  }

  @keyframes save-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
