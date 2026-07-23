<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import { RETRO_THEME } from "$lib/themes/retro";
  import { MODERN_THEME } from "$lib/themes/modern";
  import { fade } from "svelte/transition";
  import { onMount } from "svelte";
  import TimezoneEditor from "$lib/components/TimezoneEditor.svelte";
  import ColorPicker from "$lib/components/sidebar/ColorPicker.svelte";
  import { goto } from "$app/navigation";
  import homeDisplay from "@vesp-cloud/assets/imgs/examples/home-display.png";
  import homeDisplayModern from "@vesp-cloud/assets/imgs/examples/home-display-modern.png";
  import vacuumDisplay from "@vesp-cloud/assets/imgs/examples/vacuum-display.png";
  import vacuumDisplayModern from "@vesp-cloud/assets/imgs/examples/vacuum-display-modern.png";
  import weatherDisplay from "@vesp-cloud/assets/imgs/examples/weather-display.png";
  import weatherDisplayModern from "@vesp-cloud/assets/imgs/examples/weather-display-modern.png";
  import { CODEGEN_SAFE_HTTP_URL_RE } from "$lib/codegen/url-safety";

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  const themes = [RETRO_THEME, MODERN_THEME];
  const themePreviews = [
    {
      name: "Home",
      retro: homeDisplay,
      modern: homeDisplayModern,
    },
    {
      name: "Vacuum",
      retro: vacuumDisplay,
      modern: vacuumDisplayModern,
    },
    {
      name: "Weather",
      retro: weatherDisplay,
      modern: weatherDisplayModern,
    },
  ] as const;

  let themePreviewIndex = $state(0);
  let themePreviewTimer: ReturnType<typeof setTimeout> | undefined;
  let themePreviewRotationPaused = false;
  let themePreviewAutoRotate = false;

  function stopThemePreviewRotation() {
    if (themePreviewTimer) clearTimeout(themePreviewTimer);
    themePreviewTimer = undefined;
  }

  function scheduleThemePreviewRotation(delay = 3000) {
    stopThemePreviewRotation();
    if (!themePreviewAutoRotate || themePreviewRotationPaused) return;

    themePreviewTimer = setTimeout(() => {
      themePreviewIndex = (themePreviewIndex + 1) % themePreviews.length;
      scheduleThemePreviewRotation();
    }, delay);
  }

  function pauseThemePreviewRotation() {
    themePreviewRotationPaused = true;
    stopThemePreviewRotation();
  }

  function resumeThemePreviewRotation() {
    themePreviewRotationPaused = false;
    scheduleThemePreviewRotation(5000);
  }

  onMount(() => {
    themePreviewAutoRotate = !window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scheduleThemePreviewRotation();
    return stopThemePreviewRotation;
  });

  const defaultNotificationOverlay = {
    titleEntityId: "input_text.notification_title",
    bodyEntityId: "input_text.notification_body",
    severityEntityId: "input_select.notification_severity",
  };

  let projectName = $state(projectStore.project?.name ?? "");
  let selectedThemeId = $state(projectStore.theme.id);
  let chromeAccent = $state(
    projectStore.project?.theme?.chromeAccent ??
      themes.find((t) => t.id === selectedThemeId)?.chromeAccent,
  );
  let notificationOverlayEnabled = $state(
    projectStore.project?.notificationOverlay?.enabled !== false,
  );
  let notificationTitleEntityId = $state(
    projectStore.project?.notificationOverlay?.titleEntityId ??
      defaultNotificationOverlay.titleEntityId,
  );
  let notificationBodyEntityId = $state(
    projectStore.project?.notificationOverlay?.bodyEntityId ??
      defaultNotificationOverlay.bodyEntityId,
  );
  let notificationSeverityEntityId = $state(
    projectStore.project?.notificationOverlay?.severityEntityId ??
      defaultNotificationOverlay.severityEntityId,
  );
  let homeAssistantBaseUrl = $state(
    projectStore.project?.secrets?.homeAssistantBaseUrl ?? "",
  );
  let homeAssistantBaseUrlTouched = $state(false);
  const homeAssistantBaseUrlNeedsScheme = $derived(
    !!homeAssistantBaseUrl.trim() &&
      !/^[a-z][a-z\d+.-]*:\/\//i.test(homeAssistantBaseUrl.trim()),
  );

  const homeAssistantBaseUrlError = $derived.by(() => {
    const rawValue = homeAssistantBaseUrl.trim();
    if (!rawValue) return "";
    if (/^[a-z][a-z\d+.-]*:\/\//i.test(rawValue) && !/^https?:\/\//i.test(rawValue)) {
      return "Use http:// or https:// for this address.";
    }
    const value = homeAssistantBaseUrlNeedsScheme ? `http://${rawValue}` : rawValue;
    if (!CODEGEN_SAFE_HTTP_URL_RE.test(value)) {
      return "Use a URL without spaces, quotes, or backslashes.";
    }
    try {
      const url = new URL(value);
      if (!url.hostname) return "Enter a complete Home Assistant address.";
      if (url.username || url.password) {
        return "Do not include a username or password in this address.";
      }
      if (url.search || url.hash) {
        return "Remove the query string or fragment from this address.";
      }
    } catch {
      return "Enter a valid Home Assistant address.";
    }
    return "";
  });

  function normalizeHomeAssistantBaseUrl() {
    let value = homeAssistantBaseUrl.trim();
    if (value && !/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
      value = `http://${value}`;
    }
    value = value
      .replace(/^https?:\/\//i, (scheme) => scheme.toLowerCase())
      .replace(/\/+$/, "");
    homeAssistantBaseUrl = value;
    homeAssistantBaseUrlTouched = true;
  }

  let timezone = $state(projectStore.project?.timezone ?? "");

  let settingsSaving = $state(false);
  let settingsSaved = $state(false);

  async function handleSave() {
    if (settingsSaving) return;
    normalizeHomeAssistantBaseUrl();
    if (homeAssistantBaseUrlError) return;
    settingsSaving = true;

    const theme = {
      ...(themes.find((t) => t.id === selectedThemeId) ?? RETRO_THEME),
      chromeAccent,
    };

    const notificationOverlay = notificationOverlayEnabled
      ? {
          enabled: true,
          titleEntityId:
            notificationTitleEntityId.trim() ||
            defaultNotificationOverlay.titleEntityId,
          bodyEntityId:
            notificationBodyEntityId.trim() ||
            defaultNotificationOverlay.bodyEntityId,
          severityEntityId:
            notificationSeverityEntityId.trim() ||
            defaultNotificationOverlay.severityEntityId,
        }
      : {
          enabled: false,
          titleEntityId:
            notificationTitleEntityId.trim() ||
            defaultNotificationOverlay.titleEntityId,
          bodyEntityId:
            notificationBodyEntityId.trim() ||
            defaultNotificationOverlay.bodyEntityId,
          severityEntityId:
            notificationSeverityEntityId.trim() ||
            defaultNotificationOverlay.severityEntityId,
        };

    projectStore.updateProject({
      name: projectName,
      display: { width: 480, height: 480 },
      theme,
      timezone,
      notificationOverlay,
      secrets: {
        ...projectStore.project?.secrets,
        homeAssistantBaseUrl:
          homeAssistantBaseUrl.trim().replace(/\/+$/, "") || undefined,
      },
    });
    await projectStore.saveNow();
    settingsSaving = false;
    settingsSaved = true;
    setTimeout(() => onClose(), 600);
  }

  async function handleDelete() {
    if (
      confirm(
        "Are you sure you want to delete this project? This action cannot be undone.",
      )
    ) {
      const id = projectStore.project?.id;
      if (id) {
        await projectStore.deleteProject(id);
        await goto("/");
      }
    }
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
      <p class="section-hint">
        Guition ESP32-S3-4848S040 &mdash; 480 &times; 480 RGB (ST7701S + GT911
        Touch)
      </p>
    </section>

    <section>
      <h3>Theme</h3>
      <p class="section-hint">
        Select the display theme used for editor previews and generated firmware
        style values.
      </p>
      <div
        class="theme-grid"
        role="group"
        aria-label="Display theme"
        onmouseenter={pauseThemePreviewRotation}
        onmouseleave={resumeThemePreviewRotation}
        onfocusin={pauseThemePreviewRotation}
        onfocusout={resumeThemePreviewRotation}
      >
        {#each themes as theme}
          {@const preview = themePreviews[themePreviewIndex]}
          {@const previewSrc = theme.id === "modern" ? preview.modern : preview.retro}
          <button
            type="button"
            class="theme-card {selectedThemeId === theme.id ? 'active' : ''}"
            onclick={() => (selectedThemeId = theme.id)}
          >
            <div class="theme-preview">
              <img
                src={previewSrc}
                alt={`${preview.name} dashboard with the ${theme.name} theme`}
                width="640"
                height="640"
                decoding="async"
              />
            </div>
            <strong>{theme.name}</strong>
          </button>
        {/each}
      </div>
    </section>

    <section>
      <h3>Project Color</h3>
      <p class="section-hint">
        Sets the color for the clock, page indicator active dot, and detail
        header title.
      </p>
      <ColorPicker
        label="Accent Color"
        value={chromeAccent}
        defaultValue={themes.find((t) => t.id === selectedThemeId)?.chromeAccent}
        onUpdate={(v) => (chromeAccent = v)}
      />
    </section>

    <section>
      <h3>Home Assistant</h3>
      <p class="section-hint">
        Optional. Used only to resolve relative image URLs from Home Assistant
        entities. Use the same address you enter in your browser, including its
        port when applicable.
      </p>

      <div class="field" class:invalid={homeAssistantBaseUrlTouched && homeAssistantBaseUrlError}>
        <label for="ha-base-url">Home Assistant Base URL</label>
        <input
          id="ha-base-url"
          type="url"
          inputmode="url"
          autocomplete="url"
          spellcheck="false"
          bind:value={homeAssistantBaseUrl}
          placeholder="http://homeassistant.local:8123"
          aria-describedby="ha-base-url-help"
          aria-invalid={homeAssistantBaseUrlTouched && !!homeAssistantBaseUrlError}
          oninput={() => (homeAssistantBaseUrlTouched = true)}
          onblur={normalizeHomeAssistantBaseUrl}
        />
        <span
          id="ha-base-url-help"
          class:error-text={homeAssistantBaseUrlTouched && !!homeAssistantBaseUrlError}
          class="field-help"
        >
          {#if homeAssistantBaseUrlTouched && homeAssistantBaseUrlError}
            {homeAssistantBaseUrlError}
          {:else if homeAssistantBaseUrlNeedsScheme}
            This will be saved as <code>http://{homeAssistantBaseUrl.trim()}</code>.
          {:else}
            Example: <code>http://homeassistant.local:8123</code>. A missing
            scheme is added automatically.
          {/if}
        </span>
      </div>
    </section>

    <section>
      <h3>Notification Overlay</h3>
      <p class="section-hint">
        Configure the top-priority Home Assistant notification overlay entities
        used by generated firmware.
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
      <h3>Timezone</h3>
      <TimezoneEditor
        value={timezone}
        onChange={(tz) => (timezone = tz)}
        hint="Used for time displays and scheduling in generated firmware."
      />
    </section>

    <section class="danger-zone">
      <h3>Danger Zone</h3>
      <p>Once you delete a project, there is no going back.</p>
      <button class="danger" onclick={handleDelete}>Delete Project</button>
    </section>
  </div>

  <footer>
    <button class="secondary" onclick={onClose} disabled={settingsSaving}>Cancel</button>
    <button
      class="primary"
      onclick={handleSave}
      disabled={settingsSaving || settingsSaved || !!homeAssistantBaseUrlError}
    >
      {#if settingsSaving}
        <span class="spinner"></span>
        Saving…
      {:else if settingsSaved}
        <span class="check">&#10003;</span>
        Saved
      {:else}
        Save Changes
      {/if}
    </button>
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

  h2 {
    margin: 0;
    font-size: 1.5rem;
  }
  h3 {
    margin: 0 0 var(--spacing-md) 0;
    font-size: 1rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

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

  label {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  input {
    padding: var(--spacing-sm);
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
  }

  .field.invalid input {
    border-color: #f44336;
  }

  .field-help {
    min-height: 1.2em;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    line-height: 1.4;
  }

  .field-help.error-text {
    color: #f44336;
  }

  .theme-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
    color: var(--color-text-primary);
    font: inherit;
  }

  .theme-card.active {
    border-color: var(--color-accent);
    background: rgba(74, 158, 254, 0.1);
  }

  .theme-preview {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    position: relative;
    overflow: hidden;
  }

  .theme-preview img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .theme-preview {
    background: var(--color-bg-primary);
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

  .font-id {
    font-weight: 600;
    font-family: monospace;
  }
  .font-file {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-left: var(--spacing-sm);
  }

  .add-font {
    display: flex;
    gap: var(--spacing-sm);
  }

  .add-font input {
    flex: 1;
    font-size: 0.8rem;
  }

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

  .danger-zone p {
    font-size: 0.9rem;
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-md);
  }

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

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  .check {
    display: inline-block;
    font-weight: 700;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
