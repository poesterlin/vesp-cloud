<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { RETRO_THEME } from "$lib/themes/retro";
  import { MODERN_THEME } from "$lib/themes/modern";
  import type { DisplayConfig, Theme, FontDefinition } from "@esphome-designer/schema";
  import { fade, fly } from "svelte/transition";

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const themes = [RETRO_THEME, MODERN_THEME];
  
  let projectName = $state(projectStore.project?.name ?? "");
  let displayWidth = $state(projectStore.display?.width ?? 240);
  let displayHeight = $state(projectStore.display?.height ?? 320);
  let displayPlatform = $state<DisplayConfig["platform"]>(projectStore.display?.platform ?? "ili9xxx");
  let selectedThemeId = $state(projectStore.theme.id);
  
  let newFontId = $state("");
  let newFontFile = $state("");
  let newFontSize = $state(16);

  function handleSave() {
    const theme = themes.find(t => t.id === selectedThemeId) ?? RETRO_THEME;
    projectStore.updateProject({
      name: projectName,
      display: {
        width: displayWidth,
        height: displayHeight,
        platform: displayPlatform
      },
      theme
    });
    onClose();
  }

  function handleDelete() {
    if (confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      const id = projectStore.project?.id;
      if (id) {
        projectStore.deleteProject(id);
        window.location.href = "/";
      }
    }
  }

  function addFont() {
    if (!newFontId || !newFontFile) return;
    const fonts = [...projectStore.fonts, {
      id: newFontId,
      file: newFontFile,
      size: newFontSize
    }];
    projectStore.updateProject({ fonts });
    newFontId = "";
    newFontFile = "";
  }

  function removeFont(id: string) {
    const fonts = projectStore.fonts.filter(f => f.id !== id);
    projectStore.updateProject({ fonts });
  }
</script>

<div class="config-panel" transition:fade={{ duration: 200 }}>
  <header>
    <h2>Project Settings</h2>
    <button class="close-btn" onclick={onClose}>&times;</button>
  </header>

  <div class="content">
    <section>
      <h3>General</h3>
      <div class="field">
        <label for="p-name">Project Name</label>
        <input id="p-name" type="text" bind:value={projectName} />
      </div>
    </section>

    <section>
      <h3>Display Hardware</h3>
      <div class="field-group">
        <div class="field">
          <label for="p-width">Width</label>
          <input id="p-width" type="number" bind:value={displayWidth} />
        </div>
        <div class="field">
          <label for="p-height">Height</label>
          <input id="p-height" type="number" bind:value={displayHeight} />
        </div>
      </div>
      <div class="field">
        <label for="p-platform">Platform</label>
        <select id="p-platform" bind:value={displayPlatform}>
          <option value="ili9xxx">ILI9xxx (Common TFT)</option>
          <option value="st7789">ST7789 (Compact IPS)</option>
          <option value="ssd1306">SSD1306 (OLED)</option>
          <option value="waveshare_epaper">Waveshare (E-Paper)</option>
        </select>
      </div>
    </section>

    <section>
      <h3>Theme</h3>
      <div class="theme-grid">
        {#each themes as theme}
          <button 
            class="theme-card" 
            class:active={selectedThemeId === theme.id}
            onclick={() => selectedThemeId = theme.id}
          >
            <div class="theme-preview" style:background="rgb({theme.colors.background.r}, {theme.colors.background.g}, {theme.colors.background.b})">
              <div class="accent" style:background="rgb({theme.colors.accent.r}, {theme.colors.accent.g}, {theme.colors.accent.b})"></div>
            </div>
            <span>{theme.name}</span>
          </button>
        {/each}
      </div>
    </section>

    <section>
      <h3>Fonts</h3>
      <div class="font-list">
        {#each projectStore.fonts as font}
          <div class="font-item">
            <div class="font-info">
              <span class="font-id">{font.id}</span>
              <span class="font-file">{font.file} ({font.size}px)</span>
            </div>
            <button class="remove-btn" onclick={() => removeFont(font.id)}>Remove</button>
          </div>
        {/each}
      </div>
      <div class="add-font">
        <input placeholder="ID (e.g. font_small)" bind:value={newFontId} />
        <input placeholder="File (e.g. Arial.ttf)" bind:value={newFontFile} />
        <input type="number" bind:value={newFontSize} style="width: 60px" />
        <button class="secondary" onclick={addFont}>Add Font</button>
      </div>
    </section>

    <section class="danger-zone">
      <h3>Danger Zone</h3>
      <p>Once you delete a project, there is no going back.</p>
      <button class="danger" onclick={handleDelete}>Delete Project</button>
    </section>
  </div>

  <footer>
    <button class="secondary" onclick={onClose}>Cancel</button>
    <button class="primary" onclick={handleSave}>Save Changes</button>
  </footer>
</div>

<style>
  .config-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-lg) var(--spacing-xl);
    border-bottom: 1px solid var(--color-border);
  }

  h2 { margin: 0; font-size: 1.5rem; }
  h3 { margin: 0 0 var(--spacing-md) 0; font-size: 1rem; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .content {
    flex: 1;
    overflow-y: auto;
    padding: var(--spacing-xl);
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  section {
    display: flex;
    flex-direction: column;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
  }

  .field-group {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-md);
  }

  label { font-size: 0.9rem; color: var(--color-text-secondary); }
  
  input, select {
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    gap: var(--spacing-md);
  }

  .theme-card {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border: 2px solid transparent;
    border-radius: var(--radius-md);
    cursor: pointer;
    align-items: center;
  }

  .theme-card.active {
    border-color: var(--color-accent);
    background: rgba(74, 158, 254, 0.1);
  }

  .theme-preview {
    width: 100%;
    aspect-ratio: 16/9;
    border-radius: var(--radius-sm);
    position: relative;
    overflow: hidden;
  }

  .theme-preview .accent {
    position: absolute;
    bottom: 20%;
    right: 20%;
    width: 30%;
    height: 30%;
    border-radius: 50%;
  }

  .font-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-md);
  }

  .font-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border-radius: var(--radius-sm);
  }

  .font-id { font-weight: 600; font-family: monospace; }
  .font-file { font-size: 0.8rem; color: var(--color-text-muted); margin-left: var(--spacing-sm); }

  .add-font {
    display: flex;
    gap: var(--spacing-sm);
  }

  .add-font input { flex: 1; font-size: 0.8rem; }

  .danger-zone {
    padding: var(--spacing-lg);
    border: 1px solid rgba(244, 67, 54, 0.3);
    border-radius: var(--radius-md);
    background: rgba(244, 67, 54, 0.05);
  }

  .danger-zone p { font-size: 0.9rem; color: var(--color-text-muted); margin-bottom: var(--spacing-md); }

  button.danger {
    background: #f44336;
    color: white;
    border: none;
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  button.remove-btn {
    background: none;
    border: none;
    color: #f44336;
    font-size: 0.8rem;
    cursor: pointer;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    padding: var(--spacing-lg) var(--spacing-xl);
    border-top: 1px solid var(--color-border);
  }
</style>
