<script lang="ts">
  import { SERVICE_PRESETS, getDomainLabel } from "$lib/data/service-presets";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";

  interface Props {
    onSelect: (service: string) => void;
    onClose: () => void;
  }

  let { onSelect, onClose }: Props = $props();

  let searchQuery = $state("");
  let customService = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);
  let customInputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (inputEl) inputEl.focus();
  });

  interface ServiceEntry {
    service: string;
    label: string;
    domain: string;
  }

  const groupedServices = $derived.by<Map<string, ServiceEntry[]>>(() => {
    const grouped = new Map<string, ServiceEntry[]>();
    const dumpServices = homeAssistantStore.services;

    if (Object.keys(dumpServices).length > 0) {
      for (const [domain, domainServices] of Object.entries(dumpServices)) {
        if (!domainServices) continue;
        const entries: ServiceEntry[] = [];
        for (const [svcName, svcInfo] of Object.entries(domainServices)) {
          const fieldKeys = svcInfo.fields ? Object.keys(svcInfo.fields) : [];
          if (fieldKeys.length > 0 && !fieldKeys.includes("entity_id")) continue;
          entries.push({
            domain,
            service: `${domain}.${svcName}`,
            label: svcInfo.friendly_name || svcName.replace(/_/g, " "),
          });
        }
        if (entries.length > 0) grouped.set(domain, entries.sort((a, b) => a.label.localeCompare(b.label)));
      }
    } else {
      for (const [service, preset] of Object.entries(SERVICE_PRESETS)) {
        if (!grouped.has(preset.domain)) grouped.set(preset.domain, []);
        grouped.get(preset.domain)!.push({
          domain: preset.domain,
          service,
          label: preset.label,
        });
      }
    }

    return grouped;
  });

  const filteredServices = $derived.by<{ domain: string; entries: ServiceEntry[] }[]>(() => {
    const q = searchQuery.toLowerCase().trim();
    const results: { domain: string; entries: ServiceEntry[] }[] = [];

    for (const [domain, entries] of groupedServices) {
      const matched = q
        ? entries.filter(
            (e) =>
              e.label.toLowerCase().includes(q) ||
              e.service.toLowerCase().includes(q),
          )
        : entries;
      if (matched.length > 0) results.push({ domain, entries: matched });
    }

    return results;
  });

  function handleSelect(service: string) {
    onSelect(service);
    onClose();
  }

  function handleCustomSubmit() {
    const trimmed = customService.trim();
    if (trimmed) {
      onSelect(trimmed);
      onClose();
    }
  }

  function handleCustomKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") handleCustomSubmit();
    if (e.key === "Escape") onClose();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") onClose();
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div class="modal-backdrop" role="dialog" aria-modal="true" tabindex="-1" onclick={onClose} onkeydown={handleKeydown}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div class="modal" onclick={(e) => e.stopPropagation()}>
    <div class="modal-header">
      <h2>Select Service</h2>
      <button class="modal-close" onclick={onClose} aria-label="Close">&times;</button>
    </div>

    <div class="modal-search">
      <input
        type="text"
        placeholder="Search services..."
        bind:value={searchQuery}
        bind:this={inputEl}
      />
    </div>

    <div class="modal-body">
      <div class="results-panel">
        {#each filteredServices as { domain, entries } (domain)}
          <div class="domain-section">
            <div class="domain-header">{getDomainLabel(domain)}</div>
            {#each entries as entry (entry.service)}
              <button class="service-item" onclick={() => handleSelect(entry.service)}>
                <span class="service-label">{entry.label}</span>
                <span class="service-id">{entry.service}</span>
              </button>
            {/each}
          </div>
        {/each}
        {#if filteredServices.length === 0 && searchQuery}
          <div class="no-results">No services match your search</div>
        {/if}

        <div class="custom-section">
          <div class="custom-label">Custom service</div>
          <div class="custom-row">
            <input
              class="custom-input"
              type="text"
              placeholder="domain.service_name"
              bind:value={customService}
              bind:this={customInputEl}
              onkeydown={handleCustomKeydown}
            />
            <button class="custom-submit" onclick={handleCustomSubmit} disabled={!customService.trim()}>
              Use
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal-footer">
      <button class="btn-cancel" onclick={onClose}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
    padding: 20px;
  }

  .modal {
    background: var(--color-bg-secondary, #1e1e1e);
    border-radius: 12px;
    width: 100%;
    max-width: 550px;
    max-height: 75vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .modal-close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 20px;
    border-radius: 4px;
    line-height: 1;
  }

  .modal-close:hover {
    background: var(--color-hover);
    color: var(--color-text-primary);
  }

  .modal-search {
    padding: 10px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-search input {
    width: 100%;
    padding: 9px 12px;
    font-size: 13px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    outline: none;
    box-sizing: border-box;
  }

  .modal-search input:focus {
    border-color: var(--color-primary, #0066cc);
  }

  .modal-search input::placeholder {
    color: var(--color-text-muted);
  }

  .modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    min-height: 250px;
  }

  .results-panel {
    flex: 1;
    overflow-y: auto;
    padding: 0 16px 8px;
  }

  .domain-header {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    color: var(--color-text-secondary);
    padding: 10px 0 6px 0;
    margin-top: 4px;
    border-top: 1px solid var(--color-border);
    position: sticky;
    top: 0;
    background: var(--color-bg-secondary, #1e1e1e);
    z-index: 1;
  }

  .domain-section:first-child .domain-header {
    border-top: none;
    margin-top: 0;
    padding-top: 4px;
  }

  .service-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-text-primary);
    transition: all 0.15s;
  }

  .service-item:hover {
    background: var(--color-hover);
  }

  .service-label {
    font-size: 12px;
    text-align: left;
  }

  .service-id {
    font-size: 10px;
    color: var(--color-text-muted);
    font-family: monospace;
    flex-shrink: 0;
    margin-left: 12px;
  }

  .no-results {
    text-align: center;
    padding: 30px 20px;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  .custom-section {
    border-top: 1px solid var(--color-border);
    margin-top: 8px;
    padding-top: 10px;
  }

  .custom-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-muted);
    margin-bottom: 6px;
  }

  .custom-row {
    display: flex;
    gap: 6px;
  }

  .custom-input {
    flex: 1;
    padding: 7px 10px;
    font-size: 12px;
    font-family: monospace;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    outline: none;
  }

  .custom-input:focus {
    border-color: var(--color-primary, #0066cc);
  }

  .custom-input::placeholder {
    color: var(--color-text-muted);
  }

  .custom-submit {
    padding: 6px 14px;
    font-size: 11px;
    font-weight: 600;
    background: var(--color-primary, #0066cc);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
  }

  .custom-submit:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .custom-submit:hover:not(:disabled) {
    filter: brightness(1.15);
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    padding: 10px 20px;
    border-top: 1px solid var(--color-border);
  }

  .btn-cancel {
    padding: 7px 16px;
    font-size: 12px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .btn-cancel:hover {
    background: var(--color-hover);
    color: var(--color-text-primary);
  }

  .results-panel::-webkit-scrollbar {
    width: 5px;
  }

  .results-panel::-webkit-scrollbar-track {
    background: transparent;
  }

  .results-panel::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }

  .results-panel::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-muted);
  }
</style>
