<script lang="ts">
  import type { Component, EntityBinding } from "@esphome-designer/schema";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import type { Entity, Device } from "@esphome-designer/schema/homeassistant";

  interface DeviceSelection {
    deviceId: string;
    deviceName: string;
  }

  type PickerComponent = Component | {
    type?: string;
    textBinding?: EntityBinding;
    valueBinding?: EntityBinding;
    stateBinding?: EntityBinding;
    itemsBinding?: EntityBinding;
    targetDevice?: { deviceId?: string; deviceName?: string };
  };

  interface Props {
    component: PickerComponent;
    onUpdate?: (binding: EntityBinding | undefined) => void;
    onDeviceSelect?: (device: DeviceSelection | undefined) => void;
    numericOnly?: boolean;
    deviceOnly?: boolean;
  }

  let { component, onUpdate, onDeviceSelect, numericOnly = false, deviceOnly = false }: Props = $props();

  // Get current binding based on component type
  const currentBinding = $derived.by<EntityBinding | undefined>(() => {
    if (component.type === "text") {
      return component.textBinding;
    }
    if (component.type === "procedural_icon") {
      return component.stateBinding;
    }
    if (component.type === "todo_list") {
      return component.itemsBinding;
    }
    if (component.type === "slider" || component.type === "gauge") {
      return component.valueBinding;
    }
    return undefined;
  });

  let isModalOpen = $state(false);
  let searchQuery = $state("");
  let showAttributes = $state(false);
  let selectedEntity = $state<Entity | null>(null);
  let selectedDevice = $state<Device | null>(null);
  let selectedDomain = $state<string | null>(null);
  let selectedDeviceId = $state<string | null>(null);
  let browseMode = $state<"type" | "device" | "area">("type");

  $effect(() => {
    browseMode = deviceOnly ? "device" : "type";
  });

  // Sync state when binding changes
  $effect(() => {
    if (deviceOnly) {
      // For device mode, check if there's a device selection stored
      const deviceId = "targetDevice" in component ? component.targetDevice?.deviceId : undefined;
      if (deviceId) {
        const device = homeAssistantStore.getDeviceById(deviceId);
        if (device) {
          selectedDevice = device;
        }
      } else {
        selectedDevice = null;
      }
    } else if (currentBinding?.entityId) {
      const entity = homeAssistantStore.getEntity(currentBinding.entityId);
      if (entity) {
        selectedEntity = entity;
      }
    } else {
      selectedEntity = null;
    }
  });

  // Friendly domain labels
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
    sensor: "📊",
    binary_sensor: "🔘",
    switch: "🔌",
    light: "💡",
    climate: "🌡️",
    cover: "🪟",
    media_player: "🎵",
    camera: "📷",
    vacuum: "🧹",
    fan: "🌀",
    lock: "🔒",
    input_boolean: "✅",
    input_number: "🔢",
    input_select: "📋",
    person: "👤",
    weather: "⛅",
    sun: "☀️",
    automation: "⚙️",
    script: "📜",
    scene: "🎬",
    button: "🔘",
    update: "🔄",
    number: "🔢",
    select: "📋",
  };

  function getDomainLabel(domain: string): string {
    return domainLabels[domain] || domain.charAt(0).toUpperCase() + domain.slice(1).replace(/_/g, " ");
  }

  function getDomainIcon(domain: string): string {
    return domainIcons[domain] || "📦";
  }

  // Get all entities (filtered by numericOnly if needed)
  const allFilteredEntities = $derived.by(() => {
    if (!homeAssistantStore.isLoaded) return [];
    return numericOnly
      ? homeAssistantStore.entities.filter((e: Entity) => e.numeric_state !== undefined)
      : homeAssistantStore.entities;
  });

  // Available domains sorted by entity count
  const availableDomains = $derived.by(() => {
    if (!homeAssistantStore.isLoaded) return [];
    const domainCounts: Record<string, number> = {};
    for (const entity of allFilteredEntities) {
      domainCounts[entity.domain] = (domainCounts[entity.domain] || 0) + 1;
    }
    return Object.entries(domainCounts)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => ({ domain, count }));
  });

  // Available devices sorted by entity count (filtered for numeric entities if needed)
  const availableDevices = $derived.by(() => {
    if (!homeAssistantStore.isLoaded) return [];

    if (numericOnly) {
      // Count numeric entities per device
      const deviceEntityCounts: Record<string, number> = {};
      for (const entity of allFilteredEntities) {
        if (entity.device_id) {
          deviceEntityCounts[entity.device_id] = (deviceEntityCounts[entity.device_id] || 0) + 1;
        }
      }
      return homeAssistantStore.devices
        .filter((d: Device) => deviceEntityCounts[d.id] > 0)
        .map((d: Device) => ({ ...d, entity_ids: Array(deviceEntityCounts[d.id]).fill('') }))
        .sort((a: Device, b: Device) => (b.entity_ids?.length ?? 0) - (a.entity_ids?.length ?? 0));
    }

    return homeAssistantStore.devices
      .filter((d: Device) => d.entity_ids && d.entity_ids.length > 0)
      .sort((a: Device, b: Device) => (b.entity_ids?.length ?? 0) - (a.entity_ids?.length ?? 0));
  });

  // Available areas (filtered for numeric entities if needed)
  const availableAreas = $derived.by(() => {
    if (!homeAssistantStore.isLoaded) return [];

    if (numericOnly) {
      // Count numeric entities per area
      const areaCounts: Record<string, number> = {};
      for (const entity of allFilteredEntities) {
        if (entity.area) {
          areaCounts[entity.area] = (areaCounts[entity.area] || 0) + 1;
        }
      }
      return homeAssistantStore.areasList
        .filter(area => areaCounts[area.name] > 0)
        .map(area => ({ ...area, entity_count: areaCounts[area.name] }));
    }

    return homeAssistantStore.areasList;
  });

  // Check if a string looks like an ISO date
  function isIsoDate(str: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str);
  }

  // Check if an entity has a numeric value
  function isNumericEntity(entity: Entity): boolean {
    return entity.numeric_state !== undefined;
  }

  // Filter entities based on numericOnly prop
  function applyNumericFilter(entities: Entity[]): Entity[] {
    if (!numericOnly) return entities;
    return entities.filter(isNumericEntity);
  }

  // Search and filter entities
  const filteredEntities = $derived.by(() => {
    if (!homeAssistantStore.isLoaded) return [];

    let entities: Entity[];

    if (searchQuery) {
      entities = homeAssistantStore.searchEntities(searchQuery);
    } else if (browseMode === "type" && selectedDomain) {
      entities = homeAssistantStore.getEntitiesByDomain(selectedDomain);
    } else if (browseMode === "device" && selectedDeviceId) {
      entities = homeAssistantStore.getEntitiesByDevice(selectedDeviceId);
    } else if (browseMode === "area" && selectedDomain) {
      entities = homeAssistantStore.getEntitiesByArea(selectedDomain);
    } else {
      return [];
    }

    return applyNumericFilter(entities);
  });

  // Get display name for entity
  function getDisplayName(entity: Entity): string {
    if (entity.name && !isIsoDate(entity.name)) {
      return entity.name;
    }
    return entity.entity_id.split(".")[1].replace(/_/g, " ");
  }

  // Get state display
  function getStateDisplay(entity: Entity): string {
    if (entity.numeric_state !== undefined && entity.unit) {
      return `${entity.numeric_state}${entity.unit}`;
    }
    if (isIsoDate(entity.state)) {
      return "";
    }
    return entity.state;
  }

  // Common attributes to show
  const commonAttributes: Record<string, string[]> = {
    sensor: ["state", "unit_of_measurement", "device_class"],
    climate: ["temperature", "current_temperature", "hvac_action", "humidity"],
    media_player: ["media_title", "media_artist", "volume_level", "source"],
    weather: ["temperature", "humidity", "wind_speed", "forecast"],
    light: ["brightness", "color_temp", "rgb_color"],
    cover: ["current_position", "current_tilt_position"],
  };

  function getEntityAttributes(entity: Entity): string[] {
    const attrs = new Set<string>(entity.attributes || []);
    const domainAttrs = commonAttributes[entity.domain] || [];
    for (const attr of domainAttrs) {
      if (!attrs.has(attr)) attrs.add(attr);
    }
    return Array.from(attrs).sort();
  }

  function selectEntity(entity: Entity) {
    selectedEntity = entity;
    isModalOpen = false;
    resetFilters();

    onUpdate?.({
      entityId: entity.entity_id,
      attribute: currentBinding?.attribute,
    });
  }

  function selectDeviceItem(device: Device) {
    selectedDevice = device;
    isModalOpen = false;
    resetFilters();

    onDeviceSelect?.({
      deviceId: device.id,
      deviceName: device.friendly_name,
    });
  }

  function selectAttribute(attr: string | null) {
    if (!selectedEntity) return;

    onUpdate?.({
      entityId: selectedEntity.entity_id,
      attribute: attr || undefined,
    });
    showAttributes = false;
  }

  function clearSelection() {
    if (deviceOnly) {
      selectedDevice = null;
      onDeviceSelect?.(undefined);
    } else {
      selectedEntity = null;
      onUpdate?.(undefined);
      showAttributes = false;
    }
  }

  function openModal() {
    isModalOpen = true;
    searchQuery = "";
    resetFilters();
  }

  function closeModal() {
    isModalOpen = false;
    searchQuery = "";
    resetFilters();
  }

  function resetFilters() {
    selectedDomain = null;
    selectedDeviceId = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      closeModal();
    }
  }
</script>

<div class="entity-picker">
  {#if !homeAssistantStore.isLoaded}
    <div class="empty-state">
      <span class="empty-icon">📡</span>
      <span class="empty-text">No Home Assistant data loaded</span>
      <span class="empty-hint">Import your Home Assistant export to see available {deviceOnly ? 'devices' : 'entities'}</span>
    </div>
  {:else if deviceOnly}
    <!-- Device Only Mode -->
    {#if selectedDevice}
      <div class="selected-entity">
        <div class="selected-header">
          <div class="selected-info">
            <span class="selected-icon">🔧</span>
            <div class="selected-details">
              <span class="selected-name">{selectedDevice.friendly_name}</span>
              <span class="selected-meta">
                {#if selectedDevice.manufacturer}
                  <span class="selected-manufacturer">{selectedDevice.manufacturer}</span>
                {/if}
                {#if selectedDevice.area_name}
                  <span class="selected-area">📍 {selectedDevice.area_name}</span>
                {/if}
              </span>
            </div>
          </div>
          <button class="clear-btn" onclick={clearSelection} title="Remove">✕</button>
        </div>
        <button class="change-btn" onclick={openModal}>
          Change device
        </button>
      </div>
    {:else}
      <button class="select-btn" onclick={openModal}>
        <span class="select-icon">🔧</span>
        <span>Select a device...</span>
      </button>
    {/if}
  {:else}
    <!-- Entity Mode -->
    {#if selectedEntity}
      <div class="selected-entity">
        <div class="selected-header">
          <div class="selected-info">
            <span class="selected-icon">{getDomainIcon(selectedEntity.domain)}</span>
            <div class="selected-details">
              <span class="selected-name">{getDisplayName(selectedEntity)}</span>
              <span class="selected-meta">
                {#if getStateDisplay(selectedEntity)}
                  <span class="selected-state">{getStateDisplay(selectedEntity)}</span>
                {/if}
                {#if selectedEntity.area}
                  <span class="selected-area">📍 {selectedEntity.area}</span>
                {/if}
              </span>
            </div>
          </div>
          <button class="clear-btn" onclick={clearSelection} title="Remove">✕</button>
        </div>

        <!-- Attribute Selection -->
        <div class="attribute-section">
          <button
            class="attribute-toggle"
            onclick={() => showAttributes = !showAttributes}
          >
            <span class="attribute-label">
              {#if currentBinding?.attribute}
                Showing: <strong>{currentBinding.attribute}</strong>
              {:else}
                Showing: <strong>state</strong>
              {/if}
            </span>
            <span class="toggle-arrow">{showAttributes ? '▲' : '▼'}</span>
          </button>

          {#if showAttributes}
            <div class="attribute-list">
              <button
                class="attribute-item {!currentBinding?.attribute ? 'active' : ''}"
                onclick={() => selectAttribute(null)}
              >
                <span class="attr-name">state</span>
                <span class="attr-hint">Main value</span>
              </button>
              {#each getEntityAttributes(selectedEntity) as attr}
                <button
                  class="attribute-item {currentBinding?.attribute === attr ? 'active' : ''}"
                  onclick={() => selectAttribute(attr)}
                >
                  <span class="attr-name">{attr.replace(/_/g, ' ')}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <button class="change-btn" onclick={openModal}>
          Change entity
        </button>
      </div>
    {:else}
      <button class="select-btn" onclick={openModal}>
        <span class="select-icon">🔍</span>
        <span>Select an entity...</span>
      </button>
    {/if}
  {/if}
</div>

<!-- Modal -->
{#if isModalOpen}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="modal-backdrop" role="dialog" aria-modal="true" onclick={closeModal} onkeydown={handleKeydown}>
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>{deviceOnly ? 'Select Device' : 'Select Entity'}</h2>
        <button class="modal-close" onclick={closeModal}>✕</button>
      </div>

      <div class="modal-search">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          placeholder={deviceOnly ? "Search devices..." : "Search entities..."}
          bind:value={searchQuery}
          autofocus
        />
        {#if searchQuery}
          <button class="search-clear" onclick={() => searchQuery = ''}>✕</button>
        {/if}
      </div>

      <div class="modal-body">
        {#if deviceOnly}
          <!-- Device Only Mode -->
          {@const filteredDevices = searchQuery
            ? availableDevices.filter((d: Device) =>
                d.friendly_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.manufacturer?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                d.model?.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : availableDevices}
          <div class="results-panel">
            <div class="panel-header">
              <span>{searchQuery ? 'Search Results' : 'All Devices'}</span>
              <span class="result-count">{filteredDevices.length} devices</span>
            </div>
            <div class="entity-grid">
              {#each filteredDevices as device}
                <button class="entity-card" onclick={() => selectDeviceItem(device)}>
                  <span class="entity-icon">🔧</span>
                  <div class="entity-info">
                    <span class="entity-name">{device.friendly_name}</span>
                    <span class="entity-meta">
                      {#if device.manufacturer}
                        <span class="entity-manufacturer">{device.manufacturer}{device.model ? ` ${device.model}` : ''}</span>
                      {/if}
                      {#if device.area_name}
                        <span class="entity-area">{device.area_name}</span>
                      {/if}
                    </span>
                  </div>
                </button>
              {/each}
              {#if filteredDevices.length === 0}
                <div class="no-results">No devices found</div>
              {/if}
            </div>
          </div>
        {:else if searchQuery}
          <!-- Search Results -->
          <div class="results-panel">
            <div class="panel-header">
              <span>Search Results</span>
              <span class="result-count">{filteredEntities.length} found</span>
            </div>
            <div class="entity-grid">
              {#each filteredEntities as entity}
                <button class="entity-card" onclick={() => selectEntity(entity)}>
                  <span class="entity-icon">{getDomainIcon(entity.domain)}</span>
                  <div class="entity-info">
                    <span class="entity-name">{getDisplayName(entity)}</span>
                    <span class="entity-meta">
                      {#if entity.area}
                        <span class="entity-area">{entity.area}</span>
                      {/if}
                      {#if getStateDisplay(entity)}
                        <span class="entity-state">{getStateDisplay(entity)}</span>
                      {/if}
                    </span>
                  </div>
                </button>
              {/each}
              {#if filteredEntities.length === 0}
                <div class="no-results">No entities match your search</div>
              {/if}
            </div>
          </div>
        {:else}
          <!-- Browse Mode -->
          <div class="browse-layout">
            <!-- Sidebar -->
            <div class="browse-sidebar">
              <div class="browse-tabs">
                <button
                  class="browse-tab {browseMode === 'type' ? 'active' : ''}"
                  onclick={() => { browseMode = 'type'; resetFilters(); }}
                >
                  📦 Type
                </button>
                <button
                  class="browse-tab {browseMode === 'device' ? 'active' : ''}"
                  onclick={() => { browseMode = 'device'; resetFilters(); }}
                >
                  🔧 Device
                </button>
                <button
                  class="browse-tab {browseMode === 'area' ? 'active' : ''}"
                  onclick={() => { browseMode = 'area'; resetFilters(); }}
                >
                  🏠 Room
                </button>
              </div>

              <div class="filter-list">
                {#if browseMode === 'type'}
                  {#each availableDomains as { domain, count }}
                    <button
                      class="filter-item {selectedDomain === domain ? 'active' : ''}"
                      onclick={() => selectedDomain = domain}
                    >
                      <span class="filter-icon">{getDomainIcon(domain)}</span>
                      <span class="filter-name">{getDomainLabel(domain)}</span>
                      <span class="filter-count">{count}</span>
                    </button>
                  {/each}
                {:else if browseMode === 'device'}
                  {#each availableDevices as device}
                    <button
                      class="filter-item {selectedDeviceId === device.id ? 'active' : ''}"
                      onclick={() => selectedDeviceId = device.id}
                      title={device.manufacturer ? `${device.manufacturer} ${device.model || ''}` : ''}
                    >
                      <span class="filter-icon">🔧</span>
                      <div class="filter-details">
                        <span class="filter-name">{device.friendly_name}</span>
                        {#if device.manufacturer}
                          <span class="filter-subtitle">{device.manufacturer}</span>
                        {/if}
                      </div>
                      <span class="filter-count">{device.entity_ids?.length ?? 0}</span>
                    </button>
                  {/each}
                {:else if browseMode === 'area'}
                  {#each availableAreas as area}
                    <button
                      class="filter-item {selectedDomain === area.name ? 'active' : ''}"
                      onclick={() => selectedDomain = area.name}
                    >
                      <span class="filter-icon">{area.icon || '🏠'}</span>
                      <span class="filter-name">{area.name}</span>
                      {#if area.entity_count}
                        <span class="filter-count">{area.entity_count}</span>
                      {/if}
                    </button>
                  {/each}
                {/if}
              </div>
            </div>

            <!-- Entity List -->
            <div class="browse-content">
              {#if filteredEntities.length > 0}
                <div class="panel-header">
                  <span>
                    {#if browseMode === 'type' && selectedDomain}
                      {getDomainIcon(selectedDomain)} {getDomainLabel(selectedDomain)}
                    {:else if browseMode === 'device' && selectedDeviceId}
                      {availableDevices.find((d: Device) => d.id === selectedDeviceId)?.friendly_name}
                    {:else if browseMode === 'area' && selectedDomain}
                      🏠 {selectedDomain}
                    {/if}
                  </span>
                  <span class="result-count">{filteredEntities.length} entities</span>
                </div>
                <div class="entity-grid">
                  {#each filteredEntities as entity}
                    <button class="entity-card" onclick={() => selectEntity(entity)}>
                      <span class="entity-icon">{getDomainIcon(entity.domain)}</span>
                      <div class="entity-info">
                        <span class="entity-name">{getDisplayName(entity)}</span>
                        <span class="entity-meta">
                          {#if browseMode !== 'area' && entity.area}
                            <span class="entity-area">{entity.area}</span>
                          {/if}
                          {#if getStateDisplay(entity)}
                            <span class="entity-state">{getStateDisplay(entity)}</span>
                          {/if}
                        </span>
                      </div>
                    </button>
                  {/each}
                </div>
              {:else}
                <div class="browse-empty">
                  <span class="browse-empty-icon">👈</span>
                  <span class="browse-empty-text">Select a category to browse entities</span>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .entity-picker {
    font-size: 13px;
  }

  /* Empty State */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 24px 16px;
    text-align: center;
    background: var(--color-bg-primary);
    border-radius: 8px;
    border: 1px dashed var(--color-border);
  }

  .empty-icon {
    font-size: 32px;
    opacity: 0.6;
  }

  .empty-text {
    color: var(--color-text-secondary);
    font-weight: 500;
  }

  .empty-hint {
    color: var(--color-text-muted);
    font-size: 11px;
  }

  /* Select Button */
  .select-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 14px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all 0.2s;
    font-size: 13px;
  }

  .select-btn:hover {
    border-color: var(--color-primary, #0066cc);
    color: var(--color-text-primary);
  }

  .select-icon {
    font-size: 16px;
  }

  /* Selected Entity */
  .selected-entity {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    background: var(--color-bg-primary);
    border-radius: 8px;
    border: 1px solid var(--color-border);
  }

  .selected-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .selected-info {
    display: flex;
    gap: 10px;
    align-items: center;
    min-width: 0;
  }

  .selected-icon {
    font-size: 24px;
    flex-shrink: 0;
  }

  .selected-details {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
  }

  .selected-name {
    font-weight: 600;
    color: var(--color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .selected-meta {
    display: flex;
    gap: 8px;
    font-size: 11px;
    flex-wrap: wrap;
  }

  .selected-state {
    color: var(--color-accent, #4ec9b0);
    font-weight: 500;
  }

  .selected-area {
    color: var(--color-text-muted);
  }

  .clear-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px 8px;
    font-size: 14px;
    transition: color 0.2s;
    border-radius: 4px;
    flex-shrink: 0;
  }

  .clear-btn:hover {
    color: var(--color-text-secondary);
    background: var(--color-hover);
  }

  /* Attribute Section */
  .attribute-section {
    border-top: 1px solid var(--color-border);
    padding-top: 10px;
  }

  .attribute-toggle {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 8px 10px;
    background: var(--color-bg-secondary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .attribute-toggle:hover {
    background: var(--color-hover);
  }

  .attribute-label {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .attribute-label strong {
    color: var(--color-text-primary);
  }

  .toggle-arrow {
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .attribute-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-top: 8px;
    max-height: 120px;
    overflow-y: auto;
  }

  .attribute-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
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

  .change-btn {
    padding: 8px 12px;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-secondary);
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
  }

  .change-btn:hover {
    background: var(--color-hover);
    color: var(--color-text-primary);
    border-color: var(--color-text-muted);
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    padding: 20px;
  }

  .modal {
    background: var(--color-bg-secondary, #1e1e1e);
    border-radius: 12px;
    width: 100%;
    max-width: 800px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
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
    padding: 6px 10px;
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
    padding: 12px 20px;
    border-bottom: 1px solid var(--color-border);
  }

  .modal-search .search-icon {
    position: absolute;
    left: 32px;
    font-size: 14px;
    pointer-events: none;
  }

  .modal-search input {
    width: 100%;
    padding: 10px 36px 10px 36px;
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
  }

  /* Browse Layout */
  .browse-layout {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .browse-sidebar {
    width: 220px;
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }

  .browse-tabs {
    display: flex;
    padding: 8px;
    gap: 4px;
    border-bottom: 1px solid var(--color-border);
  }

  .browse-tab {
    flex: 1;
    padding: 8px 4px;
    font-size: 11px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--color-text-muted);
    transition: all 0.15s;
  }

  .browse-tab:hover {
    background: var(--color-hover);
    color: var(--color-text-primary);
  }

  .browse-tab.active {
    background: var(--color-primary, #0066cc);
    color: white;
  }

  .filter-list {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .filter-item {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
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
    font-size: 16px;
    flex-shrink: 0;
  }

  .filter-details {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  .filter-name {
    flex: 1;
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .filter-subtitle {
    font-size: 10px;
    opacity: 0.7;
  }

  .filter-count {
    font-size: 10px;
    padding: 2px 6px;
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
    gap: 12px;
    color: var(--color-text-muted);
  }

  .browse-empty-icon {
    font-size: 32px;
    opacity: 0.5;
  }

  .browse-empty-text {
    font-size: 13px;
  }

  /* Results Panel */
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
    padding: 12px 16px;
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

  .entity-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    padding: 12px 16px;
  }

  .entity-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
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

  .entity-icon {
    font-size: 20px;
    flex-shrink: 0;
  }

  .entity-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
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
    gap: 8px;
    font-size: 10px;
    flex-wrap: wrap;
  }

  .entity-area {
    color: var(--color-text-muted);
  }

  .entity-state {
    color: var(--color-accent, #4ec9b0);
    font-weight: 500;
  }

  .entity-manufacturer,
  .selected-manufacturer {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .no-results {
    grid-column: 1 / -1;
    text-align: center;
    padding: 40px 20px;
    color: var(--color-text-muted);
  }

  /* Scrollbar */
  .filter-list::-webkit-scrollbar,
  .browse-content::-webkit-scrollbar,
  .results-panel::-webkit-scrollbar,
  .attribute-list::-webkit-scrollbar {
    width: 6px;
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
