<script lang="ts">
  import type { NotificationOverlayConfig } from "@esphome-designer/schema";
  import { fade, fly } from "svelte/transition";
  import { cubicOut } from "svelte/easing";
  import TimezoneEditor from "$lib/components/TimezoneEditor.svelte";

  export interface CreateProjectConfig {
    name: string;
    timezone: string;
    notificationOverlay: NotificationOverlayConfig;
  }

  interface Props {
    onClose: () => void;
    onCreate: (config: CreateProjectConfig) => void;
  }

  let { onClose, onCreate }: Props = $props();

  const defaultNotificationOverlay = {
    titleEntityId: "input_text.notification_title",
    bodyEntityId: "input_text.notification_body",
    severityEntityId: "input_select.notification_severity",
  };

  let step = $state<"name" | "timezone" | "notifications">("name");
  let projectName = $state("");

  let notificationOverlayEnabled = $state(false);
  let notificationTitleEntityId = $state(defaultNotificationOverlay.titleEntityId);
  let notificationBodyEntityId = $state(defaultNotificationOverlay.bodyEntityId);
  let notificationSeverityEntityId = $state(defaultNotificationOverlay.severityEntityId);

  function getBrowserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }

  let timezone = $state(getBrowserTimezone());

  function goToStep(s: "name" | "timezone" | "notifications") {
    step = s;
  }

  function handleCreate() {
    const notificationOverlay: NotificationOverlayConfig = notificationOverlayEnabled
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

    onCreate({
      name: projectName.trim(),
      timezone,
      notificationOverlay,
    });
  }
</script>

<div
  class="modal-backdrop"
  onclick={onClose}
  transition:fade={{ duration: 200 }}
>
  <div
    class="modal"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="modal-header">
      <h2>
        {#if step === "name"}
          New Project
        {:else if step === "timezone"}
          Timezone
        {:else}
          Notification Overlay
        {/if}
      </h2>
      <button class="close-icon" onclick={onClose}>&times;</button>
    </div>

    {#if step === "name"}
      <form
        class="step-content"
        onsubmit={(e) => { e.preventDefault(); goToStep("timezone"); }}
        in:fly={{ y: 10, duration: 300, easing: cubicOut }}
      >
        <div class="field">
          <label for="p-name">Project Name</label>
          <input
            id="p-name"
            type="text"
            placeholder="Living Room Dashboard"
            bind:value={projectName}
            autofocus
          />
        </div>

        <div class="field">
          <label>Display Hardware</label>
          <p class="hardware-info">
            Guition ESP32-S3-4848S040 &mdash; 480 &times; 480 RGB (ST7701S + GT911 Touch)
          </p>
        </div>

        <footer>
          <button type="button" class="btn-text" onclick={onClose}>Cancel</button>
          <button
            class="primary"
            type="submit"
            disabled={!projectName.trim()}
          >
            Next
          </button>
        </footer>
      </form>
    {:else if step === "timezone"}
      <div
        class="step-content"
        in:fly={{ y: 10, duration: 300, easing: cubicOut }}
      >
        <div class="field">
          <label>Select Timezone</label>
          <TimezoneEditor
            value={timezone}
            onChange={(tz) => (timezone = tz)}
            hint="Used for time displays and scheduling. Defaults to your browser's timezone."
            initialMode="read"
          />
        </div>

        <footer>
          <button type="button" class="btn-text" onclick={() => goToStep("name")}>&larr; Back</button>
          <button
            class="primary"
            type="button"
            onclick={() => goToStep("notifications")}
          >
            Next
          </button>
        </footer>
      </div>
    {:else}
      <div
        class="step-content"
        in:fly={{ y: 10, duration: 300, easing: cubicOut }}
      >
        <div class="field checkbox-field">
          <label class="checkbox-row" for="notification-overlay-enabled">
            <input
              id="notification-overlay-enabled"
              type="checkbox"
              bind:checked={notificationOverlayEnabled}
            />
            Enable global notification overlay
          </label>
          <p class="section-hint">
            Displays Home Assistant notifications on the screen with configurable severity styling.
          </p>
        </div>

        {#if notificationOverlayEnabled}
          <div class="notification-fields" in:fly={{ y: 5, duration: 200 }}>
            <section class="setup-help">
              <h3>Set up in Home Assistant</h3>
              <p>Create these helpers in your <code>configuration.yaml</code> or via the UI:</p>
              <pre><code>input_text:
  notification_title:
    name: Notification Title
  notification_body:
    name: Notification Body

input_select:
  notification_severity:
    name: Notification Severity
    options:
      - info
      - warning
      - question
      - critical</code></pre>
              <p class="note">
                Install the <a href="https://github.com/esphome-designer/ha-integration" target="_blank" rel="noopener">ESPHome Designer HACS integration</a> to auto-create these entities.
              </p>
            </section>

            <section class="entity-fields">
              <h3>Entity IDs</h3>

              <div class="field">
                <label for="notification-title-entity">Title Entity</label>
                <input
                  id="notification-title-entity"
                  type="text"
                  bind:value={notificationTitleEntityId}
                  placeholder="input_text.notification_title"
                />
              </div>

              <div class="field">
                <label for="notification-body-entity">Body Entity</label>
                <input
                  id="notification-body-entity"
                  type="text"
                  bind:value={notificationBodyEntityId}
                  placeholder="input_text.notification_body"
                />
              </div>

              <div class="field">
                <label for="notification-severity-entity">Severity Entity</label>
                <input
                  id="notification-severity-entity"
                  type="text"
                  bind:value={notificationSeverityEntityId}
                  placeholder="input_select.notification_severity"
                />
              </div>
            </section>
          </div>
        {/if}

        <footer>
          <button type="button" class="btn-text" onclick={() => goToStep("timezone")}>&larr; Back</button>
          <button
            class="primary"
            type="button"
            disabled={!projectName.trim()}
            onclick={handleCreate}
          >
            Create Project
          </button>
        </footer>
      </div>
    {/if}
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    backdrop-filter: blur(8px);
  }

  .modal {
    background: #121212;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 1.5rem;
    padding: 2.5rem;
    width: 90%;
    max-width: 580px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0;
    flex-shrink: 0;
  }

  h2 {
    font-size: 1.5rem;
    margin: 0;
    font-weight: 700;
    color: #fff;
  }

  h3 {
    margin: 0 0 0.75rem 0;
    font-size: 0.85rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-secondary);
  }

  .close-icon {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: 2rem;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    transition: color 0.2s;
  }

  .close-icon:hover {
    color: #fff;
  }

  .step-content {
    flex: 1;
    overflow-y: auto;
    padding-top: 1.75rem;
    padding-right: 0.5rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin-bottom: 1rem;
  }

  .checkbox-field {
    gap: 0.25rem;
  }

  .field label {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
  }

  input[type="text"],
  input[type="number"] {
    padding: 0.75rem;
    background: #1e1e1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    color: #fff;
    font-size: 0.95rem;
    transition: all 0.2s;
  }

  input:focus {
    border-color: var(--color-accent);
    background: #252525;
    outline: none;
    box-shadow: 0 0 0 3px rgba(74, 158, 254, 0.1);
  }

  input:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .hardware-info {
    padding: 0.75rem;
    background: #1e1e1e;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin: 0;
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-primary);
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
  }

  .checkbox-row input[type="checkbox"] {
    width: 1.1rem;
    height: 1.1rem;
    accent-color: var(--color-accent);
    cursor: pointer;
  }

  .section-hint {
    font-size: 0.82rem;
    color: var(--color-text-muted);
    margin-top: 0.35rem;
    margin-bottom: 0;
    line-height: 1.4;
  }

  .notification-fields {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .setup-help {
    padding: 1rem;
    background: rgba(74, 158, 254, 0.05);
    border: 1px solid rgba(74, 158, 254, 0.15);
    border-radius: var(--radius-md);
  }

  .setup-help h3 {
    margin-bottom: 0.5rem;
    color: var(--color-accent);
  }

  .setup-help p {
    font-size: 0.82rem;
    color: var(--color-text-muted);
    margin: 0 0 0.5rem 0;
    line-height: 1.5;
  }

  .setup-help pre {
    background: #0a0a0a;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: var(--radius-sm);
    padding: 0.75rem;
    overflow-x: auto;
    margin: 0.5rem 0;
  }

  .setup-help code {
    font-family: monospace;
    font-size: 0.78rem;
    color: #d4d4d4;
    line-height: 1.4;
  }

  .setup-help .note {
    font-size: 0.78rem;
    margin-top: 0.5rem;
    margin-bottom: 0;
  }

  .setup-help a {
    color: var(--color-accent);
    text-decoration: underline;
  }

  .entity-fields {
    display: flex;
    flex-direction: column;
  }

  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 1.5rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  footer .btn-text:only-child {
    margin-left: auto;
  }

  .btn-text {
    background: none;
    border: none;
    color: var(--color-text-secondary);
    font-weight: 600;
    cursor: pointer;
    transition: color 0.2s;
    padding: 0.5rem 0.75rem;
    border-radius: var(--radius-sm);
  }

  .btn-text:hover {
    color: #fff;
  }

  .primary {
    padding: 0.6rem 1.4rem;
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: all 0.15s;
  }

  .primary:hover:not(:disabled) {
    background: var(--color-accent-hover);
  }

  .primary:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

</style>
