<script lang="ts">
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import type { EntityBinding } from "@vesp-cloud/schema";
  import type { Entity } from "@vesp-cloud/schema/homeassistant";
  import ManualBindingForm from "./entity-picker/ManualBindingForm.svelte";
  import DumpImport from "./entity-picker/DumpImport.svelte";
  import {
    mdiAccountOutline,
    mdiCameraOutline,
    mdiCheckCircleOutline,
    mdiChevronDown,
    mdiChevronUp,
    mdiClose,
    mdiCubeOutline,
    mdiFan,
    mdiFormatListBulleted,
    mdiGestureTapButton,
    mdiImageOutline,
    mdiLightbulbOutline,
    mdiLockOutline,
    mdiMagnify,
    mdiMapMarker,
    mdiMovieOpenOutline,
    mdiNumeric,
    mdiPowerPlug,
    mdiRobot,
    mdiRobotVacuum,
    mdiScriptTextOutline,
    mdiSpeaker,
    mdiThermometer,
    mdiToggleSwitchOffOutline,
    mdiUpdate,
    mdiWeatherPartlyCloudy,
    mdiWhiteBalanceSunny,
    mdiWindowShutter,
    mdiChartBoxOutline,
  } from "@mdi/js";

  interface Props {
    onInsert: (binding: { entityId: string; attribute?: string }) => void;
    onClose: () => void;
    initialBinding?: EntityBinding | undefined;
  }

  let { onInsert, onClose, initialBinding }: Props = $props();

  let searchQuery = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);
  let selectedEntity = $state<Entity | null>(null);
  let selectedAttribute = $state<string>("state");
  let showAttributes = $state(false);
  let selectedDomain = $state<string | null>(null);
  let selectedAreaFilter = $state("");

  $effect(() => {
    if (initialBinding && !selectedEntity) {
      const entity = homeAssistantStore.getEntity(initialBinding.entityId);
      if (entity) {
        selectedEntity = entity;
        selectedAttribute = initialBinding.attribute || "state";
        selectedDomain = entity.domain;
      }
    }
  });

  const domainLabels: Record<string, string> = {
    sensor: "Sensors",
    binary_sensor: "On/Off Sensors",
    switch: "Switches",
    light: "Lights",
    climate: "Climate",
    cover: "Covers & Blinds",
    media_player: "Media Players",
    camera: "Cameras",
    vacuum: "Vacuums",
    fan: "Fans",
    lock: "Locks",
    input_boolean: "Toggles",
    input_number: "Numbers",
    input_select: "Selections",
    person: "People",
    weather: "Weather",
    sun: "Sun",
    automation: "Automations",
    script: "Scripts",
    scene: "Scenes",
    button: "Buttons",
    update: "Updates",
    number: "Numbers",
    select: "Selects",
  };

  const domainIcons: Record<string, string> = {
    sensor: mdiChartBoxOutline,
    binary_sensor: mdiToggleSwitchOffOutline,
    switch: mdiPowerPlug,
    light: mdiLightbulbOutline,
    climate: mdiThermometer,
    cover: mdiWindowShutter,
    media_player: mdiSpeaker,
    camera: mdiCameraOutline,
    vacuum: mdiRobotVacuum,
    fan: mdiFan,
    lock: mdiLockOutline,
    input_boolean: mdiCheckCircleOutline,
    input_number: mdiNumeric,
    input_select: mdiFormatListBulleted,
    person: mdiAccountOutline,
    weather: mdiWeatherPartlyCloudy,
    sun: mdiWhiteBalanceSunny,
    automation: mdiRobot,
    script: mdiScriptTextOutline,
    scene: mdiMovieOpenOutline,
    button: mdiGestureTapButton,
    update: mdiUpdate,
    number: mdiNumeric,
    select: mdiFormatListBulleted,
  };

  const uiIcons = {
    close: mdiClose,
    search: mdiMagnify,
    location: mdiMapMarker,
    chevronUp: mdiChevronUp,
    chevronDown: mdiChevronDown,
    emptyBrowse: mdiImageOutline,
  };

  const commonAttributes: Record<string, string[]> = {
    sensor: ["state", "unit_of_measurement", "device_class"],
    climate: ["temperature", "current_temperature", "hvac_action", "humidity"],
    media_player: ["media_title", "media_artist", "volume_level", "source"],
    weather: ["temperature", "humidity", "wind_speed", "forecast"],
    light: ["brightness", "color_temp", "rgb_color"],
    cover: ["current_position", "current_tilt_position"],
  };

  $effect(() => {
    if (inputEl) inputEl.focus();
  });

  function getDomainLabel(domain: string): string {
    return domainLabels[domain] || domain.charAt(0).toUpperCase() + domain.slice(1).replace(/_/g, " ");
  }

  function getDomainIcon(domain: string): string {
    return domainIcons[domain] || mdiCubeOutline;
  }

  function normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function isIsoDate(str: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str);
  }

  function getDisplayName(entity: Entity): string {
    if (entity.name && !isIsoDate(entity.name)) return entity.name;
    return entity.entity_id.split(".")[1].replace(/_/g, " ");
  }

  function getStateDisplay(entity: Entity): string {
    if (entity.numeric_state !== undefined) return `${entity.numeric_state}`;
    const normalizedState = entity.state.trim().toLowerCase();
    if (
      isIsoDate(entity.state) ||
      normalizedState === "unknown" ||
      normalizedState === "unavailable" ||
      normalizedState === "unavaliable"
    ) return "";
    return entity.state;
  }

  function truncateNumericValue(value: string, maxDecimals = 1): string {
    const match = value.match(/^(-?\d+)\.(\d+)(.*)$/);
    if (!match) return value;
    const [, integerPart, decimals, suffix] = match;
    const truncated = decimals.slice(0, maxDecimals);
    if (truncated.length === 0 || /^0+$/.test(truncated)) {
      return `${integerPart}${suffix}`;
    }
    return `${integerPart}.${truncated}${suffix}`;
  }

  function getEntityAttributes(entity: Entity): string[] {
    const attrs = new Set<string>(entity.attributes || []);
    const domainAttrs = commonAttributes[entity.domain] || [];
    for (const attr of domainAttrs) {
      if (!attrs.has(attr)) attrs.add(attr);
    }
    return Array.from(attrs).sort();
  }

  const allEntities = $derived(homeAssistantStore.entities);

  const availableDomains = $derived.by(() => {
    const domainCounts: Record<string, number> = {};
    for (const entity of allEntities) {
      domainCounts[entity.domain] = (domainCounts[entity.domain] || 0) + 1;
    }
    return Object.entries(domainCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => ({ domain, count }));
  });

  const availableTypeAreas = $derived.by(() => {
    if (!selectedDomain) return [];
    const areas = new Set<string>();
    for (const entity of homeAssistantStore.getEntitiesByDomain(selectedDomain)) {
      if (entity.area) areas.add(entity.area);
    }
    return Array.from(areas).sort((a, b) => a.localeCompare(b));
  });

  const filteredEntities = $derived.by(() => {
    if (searchQuery) return homeAssistantStore.searchEntities(searchQuery);
    if (selectedDomain) {
      const entities = homeAssistantStore.getEntitiesByDomain(selectedDomain);
      if (!selectedAreaFilter) return entities;
      return entities.filter((entity) => entity.area === selectedAreaFilter);
    }
    return [];
  });

  const searchResultGroups = $derived.by(() => {
    if (!searchQuery) return [];

    const groupMap: Map<
      string,
      { deviceName: string; area: string | undefined; entities: Entity[] }
    > = new Map();

    for (const entity of filteredEntities) {
      const key = entity.device_id || entity.entity_id;
      if (!groupMap.has(key)) {
        const device = entity.device_id
          ? homeAssistantStore.getDeviceById(entity.device_id)
          : null;
        groupMap.set(key, {
          deviceName: device?.friendly_name || getDisplayName(entity),
          area: entity.area,
          entities: [],
        });
      }
      groupMap.get(key)!.entities.push(entity);
    }

    return Array.from(groupMap.entries()).map(([key, group]) => {
      const primaryEntity = group.entities.find(
        (entity) =>
          normalizeName(getDisplayName(entity)) ===
          normalizeName(group.deviceName),
      );
      return {
        key,
        area: group.area,
        entity: primaryEntity || group.entities[0],
      };
    });
  });

  const resolvedValue = $derived.by(() => {
    if (!selectedEntity) return "";
    if (selectedAttribute === "state") {
      const stateValue = getStateDisplay(selectedEntity) || selectedEntity.state;
      return truncateNumericValue(stateValue);
    }
    return selectedAttribute.replace(/_/g, " ");
  });

  function selectEntity(entity: Entity) {
    selectedEntity = entity;
    selectedAttribute = "state";
    showAttributes = false;
  }

  function insertValue() {
    if (!selectedEntity) return;
    onInsert({
      entityId: selectedEntity.entity_id,
      attribute: selectedAttribute !== "state" ? selectedAttribute : undefined,
    });
  }

  function insertManualBinding(binding: EntityBinding) {
    onInsert({
      entityId: binding.entityId,
      attribute: binding.attribute ?? undefined,
    });
  }

  function resetFilters() {
    selectedDomain = null;
    selectedAreaFilter = "";
    searchQuery = "";
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
      <h2>Insert Entity Value</h2>
      <button class="modal-close" onclick={onClose} aria-label="Close modal">
        <svg class="icon button-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d={uiIcons.close}></path>
        </svg>
      </button>
    </div>

    {#if homeAssistantStore.isLoaded}<div class="modal-search">
      <svg class="icon search-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d={uiIcons.search}></path>
      </svg>
      <input
        type="text"
        placeholder="Search entities..."
        bind:value={searchQuery}
        bind:this={inputEl}
      />
      {#if searchQuery}
        <button
          class="search-clear"
          onclick={() => (searchQuery = "")}
          aria-label="Clear search"
        >
          <svg class="icon button-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d={uiIcons.close}></path>
          </svg>
        </button>
      {/if}
    </div>{/if}

    <div class="modal-body">
      {#if !homeAssistantStore.isLoaded}
        <div class="manual-binding-panel">
          <div class="manual-copy">
            <strong>Enter an entity manually</strong>
            <span>A Home Assistant dump is optional. Attributes can also be entered by name.</span>
          </div>
          <ManualBindingForm binding={initialBinding} onConfirm={insertManualBinding} />
          <DumpImport />
        </div>
      {:else if searchQuery}
        <div class="results-panel">
          <div class="panel-header">
            <span>Search Results</span>
            <span class="result-count">{searchResultGroups.length} found</span>
          </div>
          <div class="entity-grid">
            {#each searchResultGroups as group (group.entity.entity_id)}
              <button
                class="entity-card"
                class:selected={selectedEntity?.entity_id === group.entity.entity_id}
                onclick={() => selectEntity(group.entity)}
              >
                <svg class="icon entity-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={getDomainIcon(group.entity.domain)}></path>
                </svg>
                <div class="entity-info">
                  <span class="entity-name">{getDisplayName(group.entity)}</span>
                  <span class="entity-meta">
                    {#if getStateDisplay(group.entity)}
                      <span class="entity-state"
                        >{truncateNumericValue(getStateDisplay(group.entity))}</span
                      >
                    {/if}
                    {#if group.area}
                      <span class="entity-area">
                        <svg class="icon inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d={uiIcons.location}></path>
                        </svg>
                        {group.area}
                      </span>
                    {/if}
                  </span>
                </div>
              </button>
            {/each}
            {#if searchResultGroups.length === 0}
              <div class="no-results">No entities match your search</div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="browse-layout">
          <div class="browse-sidebar">
            <div class="filter-list">
              {#each availableDomains as { domain, count } (domain)}
                <button
                  class="filter-item"
                  class:active={selectedDomain === domain}
                  onclick={() => {
                    selectedDomain = domain;
                    selectedAreaFilter = "";
                  }}
                >
                  <svg class="icon filter-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d={getDomainIcon(domain)}></path>
                  </svg>
                  <span class="filter-name">{getDomainLabel(domain)}</span>
                  <span class="filter-count">{count}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="browse-content">
            {#if filteredEntities.length > 0}
              <div class="panel-header">
                <span class="icon-label-group">
                  {#if selectedDomain}
                    <svg class="icon inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={getDomainIcon(selectedDomain)}></path>
                    </svg>
                    {getDomainLabel(selectedDomain)}
                  {/if}
                </span>
                <div class="panel-controls">
                  {#if selectedDomain}
                    <label class="room-filter">
                      <svg class="icon inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d={uiIcons.location}></path>
                      </svg>
                      <select bind:value={selectedAreaFilter}>
                        <option value="">All rooms</option>
                        {#each availableTypeAreas as area}
                          <option value={area}>{area}</option>
                        {/each}
                      </select>
                    </label>
                  {/if}
                  <span class="result-count">{filteredEntities.length} entities</span>
                </div>
              </div>
              <div class="entity-grid">
                {#each filteredEntities as entity (entity.entity_id)}
                  <button
                    class="entity-card"
                    class:selected={selectedEntity?.entity_id === entity.entity_id}
                    onclick={() => selectEntity(entity)}
                  >
                    <svg class="icon entity-icon" viewBox="0 0 24 24" aria-hidden="true">
                      <path d={getDomainIcon(entity.domain)}></path>
                    </svg>
                    <div class="entity-info">
                      <span class="entity-name">{getDisplayName(entity)}</span>
                      <span class="entity-meta">
                        {#if getStateDisplay(entity)}
                          <span class="entity-state"
                            >{truncateNumericValue(getStateDisplay(entity))}</span
                          >
                        {/if}
                        {#if entity.area}
                          <span class="entity-area">
                            <svg class="icon inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                              <path d={uiIcons.location}></path>
                            </svg>
                            {entity.area}
                          </span>
                        {/if}
                      </span>
                    </div>
                  </button>
                {/each}
              </div>
            {:else}
              <div class="browse-empty">
                <svg class="icon browse-empty-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={uiIcons.emptyBrowse}></path>
                </svg>
                <span class="browse-empty-text">Select a type to browse entities</span>
              </div>
            {/if}
          </div>
        </div>
      {/if}
    </div>

    {#if selectedEntity}
      <div class="modal-footer">
        <div class="selection-preview">
          <div class="selected-entity-row">
            <svg class="icon sel-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={getDomainIcon(selectedEntity.domain)}></path>
            </svg>
            <div class="sel-info">
              <span class="sel-name">{getDisplayName(selectedEntity)}</span>
              <span class="sel-id">{selectedEntity.entity_id}</span>
            </div>
            <div class="sel-current-value">
              <span class="current-label">current</span>
              <span class="current-value"
                >{truncateNumericValue(getStateDisplay(selectedEntity)) || "—"}</span
              >
            </div>
          </div>

          <div class="attribute-picker">
            <button class="attribute-toggle" onclick={() => (showAttributes = !showAttributes)}>
              <span class="attribute-label">
                Showing: <strong>{selectedAttribute === "state" ? "state (main value)" : selectedAttribute.replace(/_/g, " ")}</strong>
              </span>
              <span class="toggle-arrow">
                <svg class="icon inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={showAttributes ? uiIcons.chevronUp : uiIcons.chevronDown}></path>
                </svg>
              </span>
            </button>
            {#if showAttributes}
              <div class="attribute-list">
                <button
                  class="attribute-item"
                  class:active={selectedAttribute === "state"}
                  onclick={() => { selectedAttribute = "state"; showAttributes = false; }}
                >
                  <span class="attr-name">state</span>
                  <span class="attr-hint">Main value</span>
                </button>
                {#each getEntityAttributes(selectedEntity) as attr (attr)}
                  <button
                    class="attribute-item"
                    class:active={selectedAttribute === attr}
                    onclick={() => { selectedAttribute = attr; showAttributes = false; }}
                  >
                    <span class="attr-name">{attr.replace(/_/g, " ")}</span>
                  </button>
                {/each}
              </div>
            {/if}
          </div>

          <div class="value-preview-box">
            <span class="preview-label">Will insert:</span>
            <code class="preview-code">{resolvedValue || "—"}</code>
            <span class="preview-hint">from {selectedEntity.entity_id}</span>
          </div>
        </div>

        <div class="footer-actions">
          <button class="btn-cancel" onclick={onClose}>Cancel</button>
          <button class="btn-insert" onclick={insertValue} disabled={!selectedEntity}>Add Binding</button>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .icon {
    display: block;
    fill: currentColor;
  }

  .inline-icon {
    width: 12px;
    height: 12px;
    flex-shrink: 0;
  }

  .button-icon {
    width: 14px;
    height: 14px;
  }

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
    max-width: 750px;
    max-height: 85vh;
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
    font-size: 16px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .modal-close {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 16px;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .modal-close:hover {
    background: var(--color-hover);
    color: var(--color-text-primary);
  }

  .modal-search {
    position: relative;
    display: flex;
    align-items: center;
    padding: 10px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-search .search-icon {
    position: absolute;
    left: 32px;
    width: 13px;
    height: 13px;
    color: var(--color-text-muted);
    pointer-events: none;
  }

  .modal-search input {
    width: 100%;
    padding: 9px 32px 9px 34px;
    font-size: 14px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-primary);
    color: var(--color-text-primary);
    outline: none;
    transition: border-color 0.2s;
  }

  .modal-search input:focus {
    border-color: var(--color-primary, #0066cc);
  }

  .modal-search input::placeholder {
    color: var(--color-text-muted);
  }

  .search-clear {
    position: absolute;
    right: 32px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 12px;
  }

  .search-clear:hover {
    color: var(--color-text-primary);
  }

  .modal-body {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 200px;
  }

  .manual-binding-panel {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 20px;
    overflow-y: auto;
  }

  .manual-copy {
    display: flex;
    flex-direction: column;
    gap: 4px;
    color: var(--color-text-secondary);
  }

  .manual-copy strong {
    color: var(--color-text-primary);
    font-size: 13px;
  }

  .manual-copy span {
    color: var(--color-text-muted);
    font-size: 11px;
  }

  .browse-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .browse-sidebar {
    width: 200px;
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .filter-list {
    flex: 1;
    overflow-y: auto;
    padding: 6px;
  }

  .filter-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 10px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
    color: var(--color-text-secondary);
  }

  .filter-item:hover {
    background: var(--color-hover);
    color: var(--color-text-primary);
  }

  .filter-item.active {
    background: var(--color-primary, #0066cc);
    color: white;
  }

  .filter-icon {
    width: 14px;
    height: 14px;
    flex-shrink: 0;
  }

  .filter-name {
    flex: 1;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filter-count {
    font-size: 10px;
    padding: 1px 6px;
    background: var(--color-bg-primary);
    border-radius: 10px;
    flex-shrink: 0;
  }

  .filter-item.active .filter-count {
    background: rgba(255, 255, 255, 0.2);
  }

  .browse-content {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .browse-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    color: var(--color-text-muted);
  }

  .browse-empty-icon {
    width: 28px;
    height: 28px;
    opacity: 0.5;
  }

  .browse-empty-text {
    font-size: 13px;
  }

  .results-panel {
    flex: 1;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    border-bottom: 1px solid var(--color-border);
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-primary);
    position: sticky;
    top: 0;
    background: var(--color-bg-secondary, #1e1e1e);
    z-index: 1;
  }

  .result-count {
    font-size: 11px;
    font-weight: normal;
    color: var(--color-text-muted);
  }

  .panel-controls {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .room-filter {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--color-text-muted);
  }

  .room-filter select {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 5px;
    color: var(--color-text-secondary);
    font-size: 11px;
    padding: 3px 6px;
    min-width: 98px;
    outline: none;
  }

  .room-filter select:focus {
    border-color: var(--color-primary, #0066cc);
  }

  .icon-label-group {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .entity-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 6px;
    padding: 10px 16px;
  }

  .entity-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    cursor: pointer;
    text-align: left;
    transition: all 0.15s;
  }

  .entity-card:hover {
    border-color: var(--color-primary, #0066cc);
    background: var(--color-hover);
  }

  .entity-card.selected {
    border-color: var(--color-accent, #4ec9b0);
    background: color-mix(in srgb, var(--color-accent, #4ec9b0) 12%, var(--color-bg-primary));
  }

  .entity-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: var(--color-text-secondary);
  }

  .entity-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .entity-name {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .entity-meta {
    display: flex;
    gap: 6px;
    font-size: 10px;
    flex-wrap: wrap;
    min-height: 1.2em;
  }

  .entity-state {
    color: var(--color-text-muted);
    font-weight: 400;
  }

  .entity-area {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    color: var(--color-text-secondary);
    font-weight: 600;
  }

  .no-results {
    grid-column: 1 / -1;
    text-align: center;
    padding: 30px 20px;
    color: var(--color-text-muted);
  }

  .modal-footer {
    border-top: 1px solid var(--color-border);
    padding: 12px 20px;
  }

  .selection-preview {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .selected-entity-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: var(--color-bg-primary);
    border-radius: 6px;
    border: 1px solid var(--color-border);
  }

  .sel-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    color: var(--color-text-secondary);
  }

  .sel-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .sel-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-text-primary);
  }

  .sel-id {
    font-size: 11px;
    color: var(--color-text-muted);
    font-family: monospace;
  }

  .sel-current-value {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 1px;
    flex-shrink: 0;
  }

  .current-label {
    font-size: 10px;
    text-transform: uppercase;
    color: var(--color-text-muted);
    letter-spacing: 0.5px;
  }

  .current-value {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-accent, #4ec9b0);
  }

  .attribute-picker {
    position: relative;
  }

  .attribute-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 7px 10px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: var(--color-text-secondary);
    transition: background 0.2s;
  }

  .attribute-toggle:hover {
    background: var(--color-hover);
  }

  .attribute-label strong {
    color: var(--color-text-primary);
  }

  .toggle-arrow {
    display: inline-flex;
    align-items: center;
    color: var(--color-text-muted);
  }

  .attribute-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
    margin-top: 6px;
    max-height: 130px;
    overflow-y: auto;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 4px;
  }

  .attribute-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 7px 10px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s;
  }

  .attribute-item:hover {
    background: var(--color-hover);
  }

  .attribute-item.active {
    background: var(--color-primary, #0066cc);
  }

  .attr-name {
    font-size: 12px;
    color: var(--color-text-primary);
    text-transform: capitalize;
  }

  .attr-hint {
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .attribute-item.active .attr-name,
  .attribute-item.active .attr-hint {
    color: white;
  }

  .value-preview-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
  }

  .preview-label {
    font-size: 12px;
    color: var(--color-text-muted);
    flex-shrink: 0;
  }

  .preview-code {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-accent, #4ec9b0);
    font-family: monospace;
  }

  .preview-hint {
    font-size: 10px;
    color: var(--color-text-muted);
    margin-left: auto;
  }

  .footer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 12px;
  }

  .btn-cancel {
    padding: 8px 16px;
    font-size: 12px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .btn-cancel:hover {
    background: var(--color-hover);
    color: var(--color-text-primary);
  }

  .btn-insert {
    padding: 8px 16px;
    font-size: 12px;
    background: var(--color-primary, #0066cc);
    border: none;
    border-radius: 6px;
    color: white;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.15s;
  }

  .btn-insert:hover:not(:disabled) {
    filter: brightness(1.15);
  }

  .btn-insert:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .filter-list::-webkit-scrollbar,
  .browse-content::-webkit-scrollbar,
  .results-panel::-webkit-scrollbar,
  .attribute-list::-webkit-scrollbar {
    width: 5px;
  }

  .filter-list::-webkit-scrollbar-track,
  .browse-content::-webkit-scrollbar-track,
  .results-panel::-webkit-scrollbar-track,
  .attribute-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .filter-list::-webkit-scrollbar-thumb,
  .browse-content::-webkit-scrollbar-thumb,
  .results-panel::-webkit-scrollbar-thumb,
  .attribute-list::-webkit-scrollbar-thumb {
    background: var(--color-border);
    border-radius: 3px;
  }

  .filter-list::-webkit-scrollbar-thumb:hover,
  .browse-content::-webkit-scrollbar-thumb:hover,
  .results-panel::-webkit-scrollbar-thumb:hover,
  .attribute-list::-webkit-scrollbar-thumb:hover {
    background: var(--color-text-muted);
  }
</style>
