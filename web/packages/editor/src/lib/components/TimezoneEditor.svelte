<script lang="ts">
  import { tick } from "svelte";

  interface Props {
    value: string;
    onChange: (timezone: string) => void;
    hint?: string;
    initialMode?: "read" | "edit";
  }

  let {
    value,
    onChange,
    hint = "",
    initialMode = "read",
  }: Props = $props();

  let editModeOverride = $state<boolean | null>(null);
  const isEditing = $derived(editModeOverride ?? initialMode === "edit");
  let tzSearch = $state("");
  let searchInputEl = $state<HTMLInputElement | null>(null);

  function getBrowserTimezone(): string {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }

  function getOffsetLabel(tz: string): string {
    try {
      const now = new Date();
      const tzFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
      });
      const parts = tzFormatter.formatToParts(now);
      const offsetPart = parts.find((p) => p.type === "timeZoneName");
      return offsetPart?.value ?? "";
    } catch {
      return "";
    }
  }

  function formatTimezoneLabel(tz: string): string {
    return tz.replace(/_/g, " ");
  }

  const browserTz = getBrowserTimezone();
  const browserOffset = $derived(getOffsetLabel(browserTz));

  const allTimezones: string[] = (() => {
    try {
      if ("supportedValuesOf" in Intl) {
        return (Intl as any).supportedValuesOf("timeZone") as string[];
      }
    } catch {}

    return [
      "UTC",
      "Pacific/Midway",
      "Pacific/Honolulu",
      "America/Anchorage",
      "America/Los_Angeles",
      "America/Phoenix",
      "America/Denver",
      "America/Chicago",
      "America/New_York",
      "America/Halifax",
      "America/Argentina/Buenos_Aires",
      "America/Sao_Paulo",
      "Atlantic/South_Georgia",
      "Atlantic/Azores",
      "Europe/London",
      "Europe/Dublin",
      "Europe/Paris",
      "Europe/Berlin",
      "Europe/Zurich",
      "Europe/Stockholm",
      "Europe/Warsaw",
      "Europe/Bucharest",
      "Europe/Helsinki",
      "Europe/Moscow",
      "Europe/Istanbul",
      "Africa/Cairo",
      "Africa/Johannesburg",
      "Africa/Lagos",
      "Asia/Dubai",
      "Asia/Karachi",
      "Asia/Kolkata",
      "Asia/Dhaka",
      "Asia/Jakarta",
      "Asia/Shanghai",
      "Asia/Singapore",
      "Asia/Tokyo",
      "Asia/Seoul",
      "Australia/Sydney",
      "Australia/Adelaide",
      "Pacific/Auckland",
      "Pacific/Fiji",
    ];
  })();

  const filteredTimezones = $derived(
    tzSearch.trim()
      ? allTimezones.filter((tz) => tz.toLowerCase().includes(tzSearch.toLowerCase()))
      : allTimezones
  );

  function selectTimezone(tz: string) {
    onChange(tz);
    tzSearch = "";
    editModeOverride = false;
  }

  async function enterEditMode() {
    editModeOverride = true;
    await tick();
    searchInputEl?.focus();
  }

  function exitEditMode() {
    editModeOverride = false;
    tzSearch = "";
  }
</script>

<div class="timezone-editor">
  {#if hint}
    <p class="section-hint">{hint}</p>
  {/if}

  {#if !isEditing}
    <div class="selected-timezone">
      <div class="selected-timezone-text">
        <span class="selected-timezone-label">Timezone</span>
        {#if value}
          <span class="selected-timezone-value">{formatTimezoneLabel(value)} <span class="selected-timezone-offset">{getOffsetLabel(value)}</span></span>
        {:else}
          <span class="selected-timezone-value is-empty">Not set</span>
        {/if}
      </div>
      <button class="edit-toggle" onclick={enterEditMode}>
        Edit
      </button>
    </div>
  {/if}

  {#if isEditing}
    {#if value !== browserTz}
      <button
        class="browser-tz-pick"
        onclick={() => selectTimezone(browserTz)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" class="browser-tz-icon">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.5" />
          <path d="M12 7V12L15 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
        <div class="browser-tz-text">
          <span class="browser-tz-label">Use browser timezone</span>
          <span class="browser-tz-value">{formatTimezoneLabel(browserTz)} <span class="browser-tz-offset">{browserOffset}</span></span>
        </div>
      </button>
    {/if}

    <div class="tz-search-wrapper">
      <input
        type="text"
        placeholder="Search timezones..."
        bind:value={tzSearch}
        bind:this={searchInputEl}
        class="tz-search"
      />
    </div>

    <div class="tz-list">
      {#each filteredTimezones as tz (tz)}
        <button
          class="tz-option"
          class:selected={tz === value}
          onclick={() => selectTimezone(tz)}
        >
          <span class="tz-name">{formatTimezoneLabel(tz)}</span>
          <span class="tz-offset">{getOffsetLabel(tz)}</span>
          {#if tz === value}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" class="tz-check">
              <path d="M3 8L6.5 11.5L13 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .timezone-editor {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 0.5rem);
  }

  .section-hint {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    margin: 0 0 var(--spacing-xs, 0.25rem) 0;
    line-height: 1.4;
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

  .selected-timezone {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--spacing-sm, 0.5rem);
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    background: var(--color-bg-secondary, #1e1e1e);
    border-radius: var(--radius-sm, 0.375rem);
    padding: 0.55rem 0.7rem;
  }

  .selected-timezone-text {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    min-width: 0;
  }

  .selected-timezone-label {
    font-size: 0.72rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .selected-timezone-value {
    font-size: 0.87rem;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .selected-timezone-value.is-empty {
    color: var(--color-text-muted);
  }

  .selected-timezone-offset {
    margin-left: 0.25rem;
    color: var(--color-text-muted);
    font-size: 0.8rem;
  }

  .edit-toggle {
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.12));
    background: transparent;
    color: var(--color-text-secondary);
    border-radius: var(--radius-sm, 0.375rem);
    padding: 0.35rem 0.6rem;
    font-size: 0.78rem;
    cursor: pointer;
    font-family: inherit;
    flex-shrink: 0;
  }

  .edit-toggle:hover {
    color: var(--color-text-primary);
    border-color: var(--color-accent);
  }

  .tz-search-wrapper {
    margin-top: 0.1rem;
  }

  .tz-search {
    width: 100%;
    padding: var(--spacing-sm, 0.5rem);
    background: var(--color-bg-secondary, #1e1e1e);
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
    border-radius: var(--radius-sm, 0.375rem);
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
    max-height: 220px;
    overflow-y: auto;
    border: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
    border-radius: var(--radius-sm, 0.375rem);
    background: var(--color-bg-secondary, #1a1a1a);
  }

  .tz-option {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.56rem 0.7rem;
    background: none;
    border: none;
    border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.06));
    color: var(--color-text-secondary);
    font-size: 0.86rem;
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
</style>
