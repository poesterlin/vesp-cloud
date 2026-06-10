<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { RETRO_THEME } from "$lib/themes/retro";
  import { MODERN_THEME } from "$lib/themes/modern";
  import type { Theme, FontDefinition } from "@esphome-designer/schema";
  import { fade, fly } from "svelte/transition";

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const themes = [RETRO_THEME, MODERN_THEME];
  const defaultNotificationOverlay = {
    titleEntityId: "input_text.notification_title",
    bodyEntityId: "input_text.notification_body",
    severityEntityId: "input_select.notification_severity",
  };
  
  let projectName = $state(projectStore.project?.name ?? "");
  let selectedThemeId = $state(projectStore.theme.id);
  let notificationOverlayEnabled = $state(projectStore.project?.notificationOverlay?.enabled !== false);
  let notificationTitleEntityId = $state(
    projectStore.project?.notificationOverlay?.titleEntityId ?? defaultNotificationOverlay.titleEntityId
  );
  let notificationBodyEntityId = $state(
    projectStore.project?.notificationOverlay?.bodyEntityId ?? defaultNotificationOverlay.bodyEntityId
  );
  let notificationSeverityEntityId = $state(
    projectStore.project?.notificationOverlay?.severityEntityId ?? defaultNotificationOverlay.severityEntityId
  );
  let homeAssistantBaseUrl = $state(projectStore.project?.secrets?.homeAssistantBaseUrl ?? "");
  
  let newFontId = $state("");
  let newFontFile = $state("");
  let newFontSize = $state(16);

  // Timezone
  function getBrowserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }

  const browserTz = getBrowserTimezone();
  const browserOffset = $derived(getOffsetLabel(browserTz));

  function getOffsetLabel(tz: string): string {
    try {
      const now = new Date();
      const tzFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
      });
      const parts = tzFormatter.formatToParts(now);
      const offsetPart = parts.find(p => p.type === "timeZoneName");
      return offsetPart?.value ?? "";
    } catch {
      return "";
    }
  }

  const allTimezones: string[] = (() => {
    try {
      if ("supportedValuesOf" in Intl) {
        return (Intl as any).supportedValuesOf("timeZone") as string[];
      }
    } catch {}
    return [
      "UTC",
      "Pacific/Midway", "Pacific/Honolulu", "America/Anchorage",
      "America/Los_Angeles", "America/Phoenix", "America/Denver",
      "America/Chicago", "America/New_York", "America/Halifax",
      "America/Argentina/Buenos_Aires", "America/Sao_Paulo",
      "Atlantic/South_Georgia", "Atlantic/Azores",
      "Europe/London", "Europe/Dublin", "Europe/Paris",
      "Europe/Berlin", "Europe/Zurich", "Europe/Stockholm",
      "Europe/Warsaw", "Europe/Bucharest", "Europe/Helsinki",
      "Europe/Moscow", "Europe/Istanbul",
      "Africa/Cairo", "Africa/Johannesburg", "Africa/Lagos",
      "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka",
      "Asia/Jakarta", "Asia/Shanghai", "Asia/Singapore",
      "Asia/Tokyo", "Asia/Seoul", "Australia/Sydney",
      "Australia/Adelaide", "Pacific/Auckland", "Pacific/Fiji",
    ];
  })();

  let timezone = $state(projectStore.project?.timezone ?? "");
  let tzSearch = $state("");

  const filteredTimezones = $derived(
    tzSearch.trim()
      ? allTimezones.filter(tz =>
          tz.toLowerCase().includes(tzSearch.toLowerCase())
        )
      : allTimezones
  );

  function selectTimezone(tz: string) {
    timezone = tz;
    tzSearch = "";
  }

  function handleSave() {
    const theme = themes.find(t => t.id === selectedThemeId) ?? RETRO_THEME;

    const notificationOverlay = notificationOverlayEnabled
      ? {
          enabled: true,
          titleEntityId: notificationTitleEntityId.trim() || defaultNotificationOverlay.titleEntityId,
          bodyEntityId: notificationBodyEntityId.trim() || defaultNotificationOverlay.bodyEntityId,
          severityEntityId: notificationSeverityEntityId.trim() || defaultNotificationOverlay.severityEntityId,
        }
      : {
          enabled: false,
          titleEntityId: notificationTitleEntityId.trim() || defaultNotificationOverlay.titleEntityId,
          bodyEntityId: notificationBodyEntityId.trim() || defaultNotificationOverlay.bodyEntityId,
          severityEntityId: notificationSeverityEntityId.trim() || defaultNotificationOverlay.severityEntityId,
        };

    projectStore.updateProject({
      name: projectName,
      display: { width: 480, height: 480 },
      theme,
      timezone,
      notificationOverlay,
      secrets: {
        ...projectStore.project?.secrets,
        homeAssistantBaseUrl: homeAssistantBaseUrl.trim().replace(/\/+$/, "") || undefined,
      },
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
      <p class="section-hint">Guition ESP32-S3-4848S040 &mdash; 480 &times; 480 RGB (ST7701S + GT911 Touch)</p>
    </section>

    <section>
      <h3>Theme</h3>
      <div class="theme-grid">
        {#each themes as theme (theme.id)}
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
        {#each projectStore.fonts as font (font.id)}
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

    <section>
      <h3>Notification Overlay</h3>
      <p class="section-hint">
        Configure the top-priority Home Assistant notification overlay entities used by generated firmware.
      </p>

      <label class="checkbox-row" for="notification-overlay-enabled">
        <input
          id="notification-overlay-enabled"
          type="checkbox"
          bind:checked={notificationOverlayEnabled}
        />
        Enable global notification overlay
      </label>

      <div class="field">
        <label for="notification-title-entity">Title Entity</label>
        <input
          id="notification-title-entity"
          type="text"
          bind:value={notificationTitleEntityId}
          placeholder="input_text.notification_title"
          disabled={!notificationOverlayEnabled}
        />
      </div>

      <div class="field">
        <label for="notification-body-entity">Body Entity</label>
        <input
          id="notification-body-entity"
          type="text"
          bind:value={notificationBodyEntityId}
          placeholder="input_text.notification_body"
          disabled={!notificationOverlayEnabled}
        />
      </div>

      <div class="field">
        <label for="notification-severity-entity">Severity Entity</label>
        <input
          id="notification-severity-entity"
          type="text"
          bind:value={notificationSeverityEntityId}
          placeholder="input_select.notification_severity"
          disabled={!notificationOverlayEnabled}
        />
      </div>
    </section>

    <section>
      <h3>Home Assistant</h3>
      <p class="section-hint">
        Optional. Used only to resolve relative image URLs from Home Assistant entities, such as <code>/api/image_proxy/...</code>.
      </p>

      <div class="field">
        <label for="ha-base-url">Home Assistant Base URL</label>
        <input
          id="ha-base-url"
          type="url"
          bind:value={homeAssistantBaseUrl}
          placeholder="http://homeassistant.local:8123"
        />
      </div>
    </section>

    <section>
      <h3>Timezone</h3>
      <p class="section-hint">Used for time displays and scheduling in generated firmware.</p>

      <button
        class="browser-tz-pick"
        class:active={timezone === browserTz}
        onclick={() => selectTimezone(browserTz)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="browser-tz-icon">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5"/>
          <path d="M12 7V12L15 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <div class="browser-tz-text">
          <span class="browser-tz-label">Your browser timezone</span>
          <span class="browser-tz-value">{browserTz.replace("_", " ")} <span class="browser-tz-offset">{browserOffset}</span></span>
        </div>
        {#if timezone === browserTz}
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" class="tz-check">
            <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        {/if}
      </button>

      <div class="tz-search-wrapper">
        <input
          type="text"
          placeholder="Search timezones..."
          bind:value={tzSearch}
          class="tz-search"
        />
      </div>

      <div class="tz-list">
        {#each filteredTimezones as tz}
          <button
            class="tz-option"
            class:selected={tz === timezone}
            onclick={() => selectTimezone(tz)}
          >
            <span class="tz-name">{tz.replace("_", " ")}</span>
            <span class="tz-offset">{getOffsetLabel(tz)}</span>
            {#if tz === timezone}
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="tz-check">
                <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            {/if}
          </button>
        {/each}
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

  label { font-size: 0.9rem; color: var(--color-text-secondary); }
  
  input {
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

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    color: var(--color-text-primary);
  }

  .checkbox-row input[type="checkbox"] {
    margin-right: 0;
  }

  .section-hint {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-md);
    line-height: 1.4;
  }

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

  .tz-search-wrapper {
    margin-bottom: var(--spacing-sm);
  }

  .tz-search {
    width: 100%;
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    font-size: 0.9rem;
    box-sizing: border-box;
  }

  .tz-search:focus {
    border-color: var(--color-accent);
    outline: none;
    box-shadow: 0 0 0 3px rgba(74, 158, 254, 0.1);
  }

  .tz-list {
    max-height: 200px;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    background: var(--color-bg-secondary);
  }

  .tz-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.6rem;
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text-secondary);
    font-size: 0.82rem;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: background 0.1s;
  }

  .tz-option:last-child {
    border-bottom: none;
  }

  .tz-option:hover {
    background: rgba(255, 255, 255, 0.04);
    color: var(--color-text-primary);
  }

  .tz-option.selected {
    background: rgba(74, 158, 254, 0.1);
    color: var(--color-text-primary);
  }

  .tz-name {
    flex: 1;
  }

  .tz-offset {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .tz-option.selected .tz-offset {
    color: var(--color-accent);
  }

  .tz-check {
    color: var(--color-accent);
    flex-shrink: 0;
  }

  .browser-tz-pick {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.75rem 0.85rem;
    background: rgba(74, 158, 254, 0.05);
    border: 1px solid rgba(74, 158, 254, 0.18);
    border-radius: 8px;
    color: var(--color-text-primary);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition: all 0.15s;
    margin-bottom: var(--spacing-md);
  }

  .browser-tz-pick:hover {
    background: rgba(74, 158, 254, 0.1);
    border-color: var(--color-accent);
  }

  .browser-tz-pick.active {
    background: rgba(74, 158, 254, 0.12);
    border-color: var(--color-accent);
  }

  .browser-tz-icon {
    color: var(--color-accent);
    flex-shrink: 0;
    opacity: 0.8;
  }

  .browser-tz-text {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .browser-tz-label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .browser-tz-value {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .browser-tz-offset {
    font-weight: 400;
    color: var(--color-text-muted);
    margin-left: 0.25rem;
  }

  footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    padding: var(--spacing-lg) var(--spacing-xl);
    border-top: 1px solid var(--color-border);
  }
</style>
