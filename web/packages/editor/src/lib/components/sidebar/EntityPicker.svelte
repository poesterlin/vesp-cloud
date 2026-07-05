<script lang="ts">
  import type { Component, EntityBinding } from "@vesp-cloud/schema";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import type { Entity } from "@vesp-cloud/schema/homeassistant";
  import {
    mdiAccessPointOff,
    mdiAccountOutline,
    mdiAlertCircle,
    mdiArrowLeft,
    mdiCameraOutline,
    mdiCalendarMonth,
    mdiCheckCircle,
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
    mdiUpload,
  } from "@mdi/js";

  type PickerComponent =
    | Component
    | {
        type?: string;
        textBinding?: EntityBinding;
        valueBinding?: EntityBinding;
        stateBinding?: EntityBinding;
        entityBinding?: EntityBinding;
        itemsBinding?: EntityBinding;
        imageBinding?: EntityBinding;
        targetDevice?: { deviceId?: string; deviceName?: string };
      };

  interface Props {
    component: PickerComponent;
    binding?: EntityBinding;
    onUpdate?: (binding: EntityBinding | undefined) => void;
    numericOnly?: boolean;
    preselectedDomain?: string;
    allowedDomains?: string[];
    requiredAttribute?: string;
    autoAttribute?: string;
  }

  let {
    component,
    binding = undefined,
    onUpdate,
    numericOnly = false,
    preselectedDomain = undefined,
    allowedDomains = undefined,
    requiredAttribute = undefined,
    autoAttribute = undefined,
  }: Props = $props();

  const allowedDomainSet = $derived.by<Set<string> | null>(() => {
    if (!allowedDomains || allowedDomains.length === 0) return null;
    return new Set(allowedDomains);
  });

  // Get current binding based on component type
  const currentBinding = $derived.by<EntityBinding | undefined>(() => {
    if (binding) {
      return binding;
    }
    if (component.type === "text") {
      return component.textBinding;
    }
    if (
      component.type === "procedural_icon" ||
      component.type === "light_state" ||
      component.type === "hvac" ||
      component.type === "weather"
    ) {
      return component.stateBinding;
    }
    if (component.type === "calendar") {
      return component.entityBinding;
    }
    if (component.type === "todo_list") {
      return component.itemsBinding;
    }
    if (component.type === "image") {
      return component.imageBinding;
    }
    if (component.type === "slider" || component.type === "gauge") {
      return component.valueBinding;
    }
    return undefined;
  });

  let isModalOpen = $state(false);
  let searchQuery = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);
  let showAttributes = $state(false);
  let selectedEntity = $state<Entity | null>(null);
  let selectedDomain = $state<string | null>(null);
  let selectedAreaFilter = $state("");
  let manualEntityId = $state("");
  let manualAttribute = $state("");
  let showManualInputs = $state(false);
  let haDumpInput = $state<HTMLInputElement | null>(null);
  let isDropActive = $state(false);
  let uploadError = $state<string | null>(null);
  let uploadSuccess = $state(false);

  $effect(() => {
    if (isModalOpen && inputEl) {
      inputEl.focus();
    }
  });

  // Sync state when binding changes
  $effect(() => {
    manualEntityId = currentBinding?.entityId ?? "";
    manualAttribute = currentBinding?.attribute ?? "";

    if (currentBinding?.entityId) {
      const entity = homeAssistantStore.getEntity(currentBinding.entityId);
      if (entity) {
        selectedEntity = entity;
      } else {
        selectedEntity = null;
      }
    } else {
      selectedEntity = null;
    }
  });

  // Friendly domain labels
  const domainLabels: Record<string, string> = {
    sensor: "Sensors",
    binary_sensor: "Binary Sensors",
    switch: "Switches",
    light: "Lights",
    climate: "Climate",
    cover: "Covers & Blinds",
    media_player: "Media Players",
    camera: "Cameras",
    image: "Images",
    vacuum: "Vacuums",
    fan: "Fans",
    lock: "Locks",
    input_boolean: "Toggles",
    input_number: "Numbers",
    input_select: "Selections",
    person: "People",
    weather: "Weather",
    calendar: "Calendar",
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
    image: mdiImageOutline,
    vacuum: mdiRobotVacuum,
    fan: mdiFan,
    lock: mdiLockOutline,
    input_boolean: mdiCheckCircleOutline,
    input_number: mdiNumeric,
    input_select: mdiFormatListBulleted,
    person: mdiAccountOutline,
    weather: mdiWeatherPartlyCloudy,
    calendar: mdiCalendarMonth,
    sun: mdiWhiteBalanceSunny,
    automation: mdiRobot,
    script: mdiScriptTextOutline,
    scene: mdiMovieOpenOutline,
    button: mdiGestureTapButton,
    update: mdiUpdate,
    number: mdiNumeric,
    select: mdiFormatListBulleted,
  };

  function getDomainLabel(domain: string): string {
    return (
      domainLabels[domain] ||
      domain.charAt(0).toUpperCase() + domain.slice(1).replace(/_/g, " ")
    );
  }

  function getDomainIcon(domain: string): string {
    return domainIcons[domain] || mdiCubeOutline;
  }

  const uiIcons = {
    empty: mdiAccessPointOff,
    error: mdiAlertCircle,
    success: mdiCheckCircle,
    search: mdiMagnify,
    location: mdiMapMarker,
    emptyBrowse: mdiArrowLeft,
    close: mdiClose,
    chevronUp: mdiChevronUp,
    chevronDown: mdiChevronDown,
    upload: mdiUpload,
  };

  const hasManualBinding = $derived.by(
    () => !!currentBinding?.entityId && selectedEntity === null,
  );

  function normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/[_\-]+/g, " ")
      .replace(/\s+/g, " ");
  }

  // Get all entities (filtered by numericOnly if needed)
  const allFilteredEntities = $derived.by(() => {
    if (!homeAssistantStore.isLoaded) return [];
    let entities = allowedDomainSet
      ? homeAssistantStore.entities.filter((e: Entity) =>
          allowedDomainSet.has(e.domain),
        )
      : homeAssistantStore.entities;
    if (numericOnly)
      entities = entities.filter((e: Entity) => e.numeric_state !== undefined);
    if (requiredAttribute)
      entities = entities.filter((e: Entity) =>
        e.attributes.includes(requiredAttribute),
      );
    return entities;
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

  const selectedDomainEntities = $derived.by(() => {
    if (!homeAssistantStore.isLoaded || !selectedDomain) return [];
    if (allowedDomainSet && !allowedDomainSet.has(selectedDomain)) return [];
    let entities = applyNumericFilter(homeAssistantStore.getEntitiesByDomain(selectedDomain));
    if (requiredAttribute)
      entities = entities.filter((e: Entity) =>
        e.attributes.includes(requiredAttribute),
      );
    return entities;
  });

  const availableAreasForSelectedDomain = $derived.by(() => {
    const areas = new Set<string>();
    for (const entity of selectedDomainEntities) {
      if (entity.area) {
        areas.add(entity.area);
      }
    }
    return Array.from(areas).sort((a, b) => a.localeCompare(b));
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

    if (searchQuery) {
      let searched = applyNumericFilter(homeAssistantStore.searchEntities(searchQuery));
      if (allowedDomainSet)
        searched = searched.filter((entity) => allowedDomainSet.has(entity.domain));
      if (requiredAttribute)
        searched = searched.filter((e: Entity) =>
          e.attributes.includes(requiredAttribute),
        );
      return searched;
    } else if (selectedDomain) {
      if (selectedAreaFilter) {
        return selectedDomainEntities.filter(
          (entity) => entity.area === selectedAreaFilter,
        );
      }
      return selectedDomainEntities;
    } else {
      return [];
    }
  });

  // Group search results by device
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

    return Array.from(groupMap.entries())
      .map(([key, group]) => {
        const primaryEntity = group.entities.find(
          (entity) =>
            normalizeName(getDisplayName(entity)) ===
            normalizeName(group.deviceName),
        );
        const entity = primaryEntity || group.entities[0];

        return {
          key,
          ...group,
          entity,
          hasMultiple: group.entities.length > 1,
          entityCount: group.entities.length,
        };
      })
      .sort((a, b) => {
        const aHasDevice = !!a.entity.device_id;
        const bHasDevice = !!b.entity.device_id;
        if (aHasDevice && !bHasDevice) return -1;
        if (!aHasDevice && bHasDevice) return 1;
        return 0;
      });
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
    const normalizedState = entity.state.trim().toLowerCase();
    if (
      isIsoDate(entity.state) ||
      normalizedState === "unknown" ||
      normalizedState === "unavailable" ||
      normalizedState === "unavaliable"
    ) {
      return "";
    }
    return entity.state;
  }

  // Common attributes to show
  const commonAttributes: Record<string, string[]> = {
    sensor: ["state", "unit_of_measurement", "device_class"],
    climate: ["temperature", "current_temperature", "hvac_action", "humidity"],
    media_player: ["media_title", "media_artist", "volume_level", "source"],
    weather: [
      "temperature",
      "dew_point",
      "humidity",
      "cloud_coverage",
      "uv_index",
      "pressure",
      "wind_bearing",
      "wind_speed",
      "forecast",
    ],
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
      attribute: currentBinding?.attribute ?? autoAttribute,
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
    selectedEntity = null;
    manualEntityId = "";
    manualAttribute = "";
    onUpdate?.(undefined);
    showAttributes = false;
  }

  function applyManualBinding() {
    const entityId = manualEntityId.trim();
    const attribute = manualAttribute.trim();

    if (!entityId) {
      onUpdate?.(undefined);
      selectedEntity = null;
      showAttributes = false;
      return;
    }

    onUpdate?.({
      entityId,
      attribute: attribute || undefined,
    });

    selectedEntity = homeAssistantStore.getEntity(entityId) ?? null;
  }

  function confirmManualBinding() {
    applyManualBinding();
    isModalOpen = false;
    resetFilters();
  }

  async function importDumpFile(file: File): Promise<void> {
    uploadError = null;
    uploadSuccess = false;

    try {
      const text = await file.text();
      const success = homeAssistantStore.importFromJson(text);
      if (!success) {
        uploadError = "Invalid Home Assistant dump format";
        return;
      }
      uploadSuccess = true;
      showManualInputs = false;
      setTimeout(() => {
        uploadSuccess = false;
      }, 3000);
      if (manualEntityId.trim()) {
        selectedEntity = homeAssistantStore.getEntity(manualEntityId.trim()) ?? null;
      }
    } catch {
      uploadError = "Failed to read file";
    }
  }

  async function handleDumpFileSelect(event: Event): Promise<void> {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await importDumpFile(file);
    input.value = "";
  }

  function handleDropZoneDragOver(event: DragEvent) {
    event.preventDefault();
    isDropActive = true;
  }

  function handleDropZoneDragLeave(event: DragEvent) {
    event.preventDefault();
    isDropActive = false;
  }

  async function handleDropZoneDrop(event: DragEvent): Promise<void> {
    event.preventDefault();
    isDropActive = false;

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      uploadError = "Please drop a .json dump file";
      uploadSuccess = false;
      return;
    }

    await importDumpFile(file);
  }

  function handleDropZoneKeydown(event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    haDumpInput?.click();
  }

  function openModal() {
    isModalOpen = true;
    searchQuery = "";
    selectedDomain = preselectedDomain ?? null;
    selectedAreaFilter = "";
    showManualInputs = !homeAssistantStore.isLoaded;
  }

  function closeModal() {
    isModalOpen = false;
    searchQuery = "";
    resetFilters();
  }

  function resetFilters() {
    selectedDomain = null;
    selectedAreaFilter = "";
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      closeModal();
    }
  }
</script>

<div class="entity-picker">
  {#if selectedEntity || hasManualBinding}
    <!-- Entity Mode -->
    {#if selectedEntity}
      <div class="selected-entity">
        <div class="selected-header">
          <div class="selected-info">
            <svg
              class="icon selected-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d={getDomainIcon(selectedEntity.domain)}></path>
            </svg>
            <div class="selected-details">
              <span class="selected-name">{getDisplayName(selectedEntity)}</span
              >
              <span class="selected-meta">
                {#if getStateDisplay(selectedEntity)}
                  <span class="selected-state"
                    >{getStateDisplay(selectedEntity)}</span
                  >
                {/if}
                {#if selectedEntity.area}
                  <span class="selected-area">
                    <svg
                      class="icon inline-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d={uiIcons.location}></path>
                    </svg>
                    {selectedEntity.area}
                  </span>
                {/if}
              </span>
            </div>
          </div>
          <button class="clear-btn" onclick={clearSelection} title="Remove">
            <svg
              class="icon button-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d={uiIcons.close}></path>
            </svg>
          </button>
        </div>

        <!-- Attribute Selection -->
        <div class="attribute-section">
          <button
            class="attribute-toggle"
            onclick={() => (showAttributes = !showAttributes)}
          >
            <span class="attribute-label">
              {#if currentBinding?.attribute}
                Showing: <strong>{currentBinding.attribute}</strong>
              {:else}
                Showing: <strong>state</strong>
              {/if}
            </span>
            <span class="toggle-arrow">
              <svg
                class="icon inline-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d={showAttributes ? uiIcons.chevronUp : uiIcons.chevronDown}
                ></path>
              </svg>
            </span>
          </button>

          {#if showAttributes}
            <div class="attribute-list">
              <button
                class="attribute-item {!currentBinding?.attribute
                  ? 'active'
                  : ''}"
                onclick={() => selectAttribute(null)}
              >
                <span class="attr-name">state</span>
                <span class="attr-hint">Main value</span>
              </button>
              {#each getEntityAttributes(selectedEntity) as attr}
                <button
                  class="attribute-item {currentBinding?.attribute === attr
                    ? 'active'
                    : ''}"
                  onclick={() => selectAttribute(attr)}
                >
                  <span class="attr-name">{attr.replace(/_/g, " ")}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <button class="change-btn" onclick={openModal}> Change entity </button>
      </div>
    {:else}
      <div class="selected-entity manual-selected">
        <div class="selected-header">
          <div class="selected-info">
            <svg
              class="icon selected-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d={uiIcons.search}></path>
            </svg>
            <div class="selected-details">
              <span class="selected-name">{currentBinding?.entityId}</span>
              <span class="selected-meta">
                <span class="selected-area">
                  Manual entity ID
                  {#if currentBinding?.attribute}
                    ({currentBinding.attribute})
                  {/if}
                </span>
              </span>
            </div>
          </div>
          <button class="clear-btn" onclick={clearSelection} title="Remove">
            <svg
              class="icon button-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d={uiIcons.close}></path>
            </svg>
          </button>
        </div>
        <button class="change-btn" onclick={openModal}> Change entity </button>
      </div>
    {/if}
  {:else if !homeAssistantStore.isLoaded}
    <div class="empty-state">
      <div class="empty-copy">
        <svg class="icon empty-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d={uiIcons.empty}></path>
        </svg>
        <span class="empty-text">No Home Assistant data loaded</span>
        <span class="empty-hint"
          >Import your Home Assistant export to browse entities, or add one manually in the picker</span
        >
      </div>
      <button class="change-btn" onclick={openModal}>Open entity picker</button>
    </div>
  {:else}
    <button class="select-btn" onclick={openModal}>
      <svg class="icon select-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d={uiIcons.search}></path>
      </svg>
      <span>Select an entity...</span>
    </button>
  {/if}
</div>

<!-- Modal -->
{#if isModalOpen}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="modal-backdrop"
    role="dialog"
    aria-modal="true"
    tabindex="-1"
    onclick={closeModal}
    onkeydown={handleKeydown}
  >
    <div class="modal" onclick={(e) => e.stopPropagation()}>
      <div class="modal-header">
        <h2>Select Entity</h2>
        <button class="modal-close" onclick={closeModal} aria-label="Close entity picker">
          <svg class="icon button-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d={uiIcons.close}></path>
          </svg>
        </button>
      </div>

      <div class="modal-search">
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
            aria-label="Clear search"
            onclick={() => {
              searchQuery = "";
            }}
          >
            <svg
              class="icon button-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d={uiIcons.close}></path>
            </svg>
          </button>
        {/if}
      </div>

      <div class="modal-body">
        <div
          class="manual-overlay-entry {showManualInputs || !homeAssistantStore.isLoaded
            ? 'expanded'
            : 'collapsed'}"
        >
          {#if showManualInputs || !homeAssistantStore.isLoaded}
            <div class="manual-overlay-header">
              <span>Manual entry</span>
              {#if homeAssistantStore.isLoaded}
                <button
                  type="button"
                  class="manual-toggle"
                  onclick={() => {
                    showManualInputs = false;
                  }}
                >
                  Hide
                </button>
              {:else}
                <span class="result-count">No dump loaded</span>
              {/if}
            </div>
            <div class="manual-entry-grid">
              <input
                type="text"
                value={manualEntityId}
                placeholder="Entity ID (e.g. light.living_room)"
                oninput={(e) => {
                  manualEntityId = e.currentTarget.value;
                }}
              />
              <input
                type="text"
                value={manualAttribute}
                placeholder="Attribute path if needed (e.g. brightness)"
                oninput={(e) => {
                  manualAttribute = e.currentTarget.value;
                }}
              />
            </div>
            <div class="manual-actions">
              <button
                type="button"
                class="manual-confirm"
                disabled={!manualEntityId.trim()}
                onclick={confirmManualBinding}
              >
                Use manual entity ID
              </button>
            </div>
          {/if}
          {#if homeAssistantStore.isLoaded && !showManualInputs}
            <button
              type="button"
              class="manual-collapsed-toggle"
              onclick={() => {
                showManualInputs = true;
              }}
            >
              Missing entity from dump? Enter manually
            </button>
          {/if}
        </div>

        {#if homeAssistantStore.isLoaded}
          {#if searchQuery}
            <!-- Search Results (Grouped by Device) -->
            <div class="results-panel">
              <div class="panel-header">
                <span>Search Results</span>
                <span class="result-count">{filteredEntities.length} found</span>
              </div>
              <div class="entity-grid">
                {#each searchResultGroups as group}
                  <button
                    class="entity-card {group.hasMultiple
                      ? 'primary-entity'
                      : ''}"
                    onclick={() => selectEntity(group.entity)}
                  >
                    <svg
                      class="icon entity-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d={getDomainIcon(group.entity.domain)}></path>
                    </svg>
                    <div class="entity-info">
                      <span class="entity-name"
                        >{getDisplayName(group.entity)}</span
                      >
                      <span class="entity-meta">
                        {#if group.area}
                          <span class="entity-area">{group.area}</span>
                        {/if}
                        {#if getStateDisplay(group.entity)}
                          <span class="entity-state"
                            >{getStateDisplay(group.entity)}</span
                          >
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
            <!-- Browse Mode -->
            <div class="browse-layout">
              <!-- Sidebar -->
              <div class="browse-sidebar">
                <div class="filter-list">
                  {#each availableDomains as { domain, count }}
                    <button
                      class="filter-item {selectedDomain === domain
                        ? 'active'
                        : ''}"
                      onclick={() => {
                        selectedDomain = domain;
                        selectedAreaFilter = "";
                      }}
                    >
                      <svg
                        class="icon filter-icon"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path d={getDomainIcon(domain)}></path>
                      </svg>
                      <span class="filter-name">{getDomainLabel(domain)}</span>
                      <span class="filter-count">{count}</span>
                    </button>
                  {/each}
                </div>
              </div>

              <!-- Entity List -->
              <div class="browse-content">
                {#if filteredEntities.length > 0}
                  <div class="panel-header">
                    <span class="icon-label-group">
                      {#if selectedDomain}
                        <svg
                          class="icon inline-icon"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d={getDomainIcon(selectedDomain)}></path>
                        </svg>
                        {getDomainLabel(selectedDomain)}
                      {/if}
                    </span>
                    <div class="panel-controls">
                      <label class="room-filter">
                        <svg class="icon inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                          <path d={uiIcons.location}></path>
                        </svg>
                        <select bind:value={selectedAreaFilter}>
                          <option value="">All rooms</option>
                          {#each availableAreasForSelectedDomain as area}
                            <option value={area}>{area}</option>
                          {/each}
                        </select>
                      </label>
                      <span class="result-count"
                        >{filteredEntities.length} entities</span
                      >
                    </div>
                  </div>
                  <div class="entity-grid">
                    {#each filteredEntities as entity}
                      <button
                        class="entity-card"
                        onclick={() => selectEntity(entity)}
                      >
                        <svg
                          class="icon entity-icon"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d={getDomainIcon(entity.domain)}></path>
                        </svg>
                        <div class="entity-info">
                          <span class="entity-name">{getDisplayName(entity)}</span
                          >
                          <span class="entity-meta">
                            {#if entity.area}
                              <span class="entity-area">{entity.area}</span>
                            {/if}
                            {#if getStateDisplay(entity)}
                              <span class="entity-state"
                                >{getStateDisplay(entity)}</span
                              >
                            {/if}
                          </span>
                        </div>
                      </button>
                    {/each}
                  </div>
                {:else}
                  <div class="browse-empty">
                    <svg
                      class="icon browse-empty-icon"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d={uiIcons.emptyBrowse}></path>
                    </svg>
                    <span class="browse-empty-text"
                      >Select a type to browse entities</span
                    >
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        {:else}
          <div class="no-dump-panel">
            <div
              class="dump-dropzone {isDropActive ? 'is-active' : ''}"
              role="button"
              tabindex="0"
              aria-label="Drop Home Assistant dump JSON"
              ondragover={handleDropZoneDragOver}
              ondragleave={handleDropZoneDragLeave}
              ondrop={handleDropZoneDrop}
              onkeydown={handleDropZoneKeydown}
            >
              <svg class="icon browse-empty-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d={uiIcons.upload}></path>
              </svg>
              <span class="browse-empty-text">Drop Home Assistant dump JSON here</span>
              <button
                type="button"
                class="manual-toggle"
                onclick={() => haDumpInput?.click()}
              >
                Choose JSON file
              </button>
              <input
                type="file"
                accept=".json"
                bind:this={haDumpInput}
                onchange={handleDumpFileSelect}
                style="display: none"
              />
            </div>

            {#if uploadError}
              <div class="upload-message error">
                <svg class="icon inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={uiIcons.error}></path>
                </svg>
                <span>{uploadError}</span>
              </div>
            {/if}
            {#if uploadSuccess}
              <div class="upload-message success">
                <svg class="icon inline-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d={uiIcons.success}></path>
                </svg>
                <span>Home Assistant dump imported</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

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

  .empty-copy {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
  }

  .empty-icon {
    width: 32px;
    height: 32px;
    color: var(--color-text-muted);
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

  .manual-overlay-entry {
    background: color-mix(in srgb, var(--color-bg-primary) 75%, transparent);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .manual-overlay-entry.expanded {
    padding: 12px 16px;
    border-bottom: 1px solid var(--color-border);
  }

  .manual-overlay-entry.collapsed {
    padding: 6px 16px;
    border-bottom: 1px solid color-mix(in srgb, var(--color-border) 50%, transparent);
  }

  .manual-overlay-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .manual-toggle {
    border: 1px solid var(--color-border);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
  }

  .manual-toggle:hover {
    color: var(--color-text-primary);
    border-color: var(--color-text-muted);
  }

  .manual-collapsed-toggle {
    align-self: flex-end;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 11px;
    padding: 2px 0;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .manual-collapsed-toggle:hover {
    color: var(--color-text-secondary);
  }

  .manual-entry-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .manual-entry-grid input {
    width: 100%;
    padding: 8px 10px;
    font-size: 12px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg-secondary);
    color: var(--color-text-primary);
    outline: none;
  }

  .manual-entry-grid input:focus {
    border-color: var(--color-primary, #0066cc);
  }

  .manual-actions {
    display: flex;
    justify-content: flex-end;
  }

  .manual-confirm {
    border: 1px solid var(--color-primary, #0066cc);
    background: color-mix(in srgb, var(--color-primary, #0066cc) 22%, transparent);
    color: var(--color-text-primary);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 11px;
    cursor: pointer;
  }

  .manual-confirm:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .manual-confirm:not(:disabled):hover {
    background: color-mix(in srgb, var(--color-primary, #0066cc) 30%, transparent);
  }

  @media (max-width: 700px) {
    .manual-entry-grid {
      grid-template-columns: 1fr;
    }
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
    width: 16px;
    height: 16px;
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
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    color: var(--color-text-secondary);
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
    display: inline-flex;
    align-items: center;
    gap: 4px;
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
    display: inline-flex;
    align-items: center;
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
    min-height: 720px;
    height: 720px;
    max-height: 720px;
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
    width: 14px;
    height: 14px;
    color: var(--color-text-muted);
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
    width: 16px;
    height: 16px;
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
    width: 32px;
    height: 32px;
    opacity: 0.5;
  }

  .browse-empty-text {
    font-size: 13px;
  }

  .manual-selected {
    border-style: dashed;
  }

  .no-dump-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 12px;
    padding: 20px;
  }

  .dump-dropzone {
    border: 1px dashed var(--color-border);
    border-radius: 10px;
    padding: 28px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    background: color-mix(in srgb, var(--color-bg-primary) 80%, transparent);
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .dump-dropzone.is-active {
    border-color: var(--color-primary, #0066cc);
    background: color-mix(in srgb, var(--color-primary, #0066cc) 10%, var(--color-bg-primary));
  }

  .upload-message {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: center;
    font-size: 12px;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid var(--color-border);
  }

  .upload-message.error {
    color: #ff9393;
    border-color: color-mix(in srgb, #ff9393 50%, var(--color-border));
  }

  .upload-message.success {
    color: #7ee0a8;
    border-color: color-mix(in srgb, #7ee0a8 50%, var(--color-border));
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

  .icon-label-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .result-count {
    font-size: 11px;
    font-weight: normal;
    color: var(--color-text-muted);
  }

  .panel-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .room-filter {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: var(--color-text-muted);
    font-size: 11px;
  }

  .room-filter select {
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    color: var(--color-text-secondary);
    font-size: 11px;
    padding: 4px 8px;
    min-width: 110px;
    outline: none;
  }

  .room-filter select:focus {
    border-color: var(--color-primary, #0066cc);
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

  .primary-entity {
    border-color: var(--color-primary, #0066cc);
    background: var(--color-hover);
    box-shadow:
      -2px 0 0 0 var(--color-primary, #0066cc),
      0 0 0 1px var(--color-primary, #0066cc);
    opacity: 1;
  }

  .entity-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
    color: var(--color-text-secondary);
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
    min-height: 1.2em;
  }

  .entity-area {
    color: var(--color-text-secondary);
  }

  .entity-state {
    color: var(--color-text-muted);
    font-weight: 400;
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
