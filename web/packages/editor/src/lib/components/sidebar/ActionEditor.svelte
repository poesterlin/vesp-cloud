<script lang="ts">
  import type {
    ActionBinding,
    ServiceAction,
    NavigationAction,
  } from "@esphome-designer/schema";
  import { projectStore } from "$lib/stores/project.svelte";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import { SERVICE_PRESETS } from "$lib/data/service-presets";
  import EntityPicker from "./EntityPicker.svelte";
  import ServicePicker from "./ServicePicker.svelte";

  type ActionType = "none" | "navigation" | "service";

  interface Props {
    action: ActionBinding | undefined;
    onUpdate: (action: ActionBinding | undefined) => void;
    label?: string;
  }

  let { action, onUpdate, label = "Action" }: Props = $props();

  const actionType = $derived.by<ActionType>(() => {
    if (!action) return "none";
    if (action.type === "SERVICE_CALL") return "service";
    return "navigation";
  });

  const navType = $derived(
    action && action.type !== "SERVICE_CALL" ? action.type : "OPEN_DETAIL",
  );
  const navTargetId = $derived(
    action && action.type !== "SERVICE_CALL"
      ? (action as NavigationAction).targetId
      : "",
  );

  const serviceAction = $derived(
    action?.type === "SERVICE_CALL" ? (action as ServiceAction) : null,
  );
  const serviceName = $derived(serviceAction?.service ?? "");
  const serviceTargetEntity = $derived(serviceAction?.target?.entityId ?? "");

  const serviceInfo = $derived.by(() => {
    if (!serviceName) return null;
    const [domain, svc] = serviceName.split(".");
    if (!domain || !svc) return null;
    return homeAssistantStore.services[domain]?.[svc] ?? null;
  });

  const serviceAllowedTargetDomains = $derived.by<string[]>(() => {
    if (!serviceInfo?.common_targets) return [];
    return serviceInfo.common_targets.filter(
      (target): target is string => typeof target === "string" && target.length > 0,
    );
  });

  const serviceNeedsEntityTarget = $derived.by(() => {
    if (serviceTargetEntity) return true;
    if (serviceAllowedTargetDomains.length > 0) return true;
    return !!serviceInfo?.fields && "entity_id" in serviceInfo.fields;
  });

  let customMode = $state(false);
  let showServicePicker = $state(false);

  const serviceKeys = $derived.by(() => {
    const keys: string[] = [];
    const dumpServices = homeAssistantStore.services;
    if (Object.keys(dumpServices).length > 0) {
      for (const [domain, domainServices] of Object.entries(dumpServices)) {
        if (!domainServices) continue;
        for (const svcName of Object.keys(domainServices)) {
          keys.push(`${domain}.${svcName}`);
        }
      }
    } else {
      for (const service of Object.keys(SERVICE_PRESETS)) {
        keys.push(service);
      }
    }
    return keys;
  });

  const isCustom = $derived(
    customMode || (!!serviceName && !serviceKeys.includes(serviceName)),
  );

  const displayName = $derived.by(() => {
    if (!serviceName) return "Select Action";
    return serviceName;
  });

  function buildServiceAction(
    service: string,
    target?: { entityId?: string },
  ): ServiceAction {
    const action: ServiceAction = { type: "SERVICE_CALL", service };
    if (target?.entityId) {
      action.target = {};
      if (target.entityId) action.target.entityId = target.entityId;
    }
    return action;
  }

  function handleActionTypeChange(type: ActionType) {
    if (type === "none") {
      onUpdate(undefined);
    } else if (type === "navigation") {
      onUpdate({ type: "OPEN_DETAIL", targetId: "" });
    } else {
      onUpdate({ type: "SERVICE_CALL", service: "" });
    }
  }

  function handleNavTypeChange(type: string) {
    onUpdate({ type: type as NavigationAction["type"], targetId: navTargetId });
  }

  function handleNavTargetChange(targetId: string) {
    onUpdate({ type: navType as NavigationAction["type"], targetId });
  }

  function handleServiceChange(service: string) {
    const target = serviceTargetEntity
      ? { entityId: serviceTargetEntity }
      : undefined;
    onUpdate(buildServiceAction(service, target));
  }

  function handleServicePickerSelect(service: string) {
    if (service === "") {
      customMode = true;
      handleServiceChange("");
    } else {
      customMode = false;
      handleServiceChange(service);
    }
  }

  function handleEntityTargetChange(entityId: string | undefined) {
    onUpdate(
      buildServiceAction(serviceName, entityId ? { entityId } : undefined),
    );
  }
</script>

<div class="action-editor">
  <div class="field">
    <span class="field-label">{label}</span>
    <select
      value={actionType}
      onchange={(e) =>
        handleActionTypeChange(e.currentTarget.value as ActionType)}
    >
      <option value="none">None</option>
      <option value="navigation">Navigation</option>
      <option value="service">Home Assistant Action</option>
    </select>
  </div>

  {#if actionType === "navigation"}
    <div class="field">
      <span class="field-label">Type</span>
      <select
        value={navType}
        onchange={(e) => handleNavTypeChange(e.currentTarget.value)}
      >
        <option value="OPEN_DETAIL">Open Detail</option>
        <option value="NEXT_PAGE" disabled={projectStore.dashboardPages.length <= 1}>Next Page</option>
        <option value="PREV_PAGE" disabled={projectStore.dashboardPages.length <= 1}>Previous Page</option>
        <option value="GO_BACK">Go to Home Screen</option>
      </select>
    </div>

    {#if navType === "OPEN_DETAIL"}
      {#if projectStore.detailViews.length === 0}
        <div class="hint">
          <p>No detail views exist yet. Create one to use as a navigation target.</p>
          <button class="create-dv-btn" onclick={() => projectStore.addDetailView()}>
            + Create Detail View
          </button>
        </div>
      {:else}
        <div class="field">
          <span class="field-label">Target</span>
          <select
            value={navTargetId}
            onchange={(e) => handleNavTargetChange(e.currentTarget.value)}
          >
            <option value="" disabled>Select Detail View</option>
            {#each projectStore.detailViews as view (view.id)}
              <option value={view.id}>{view.title}</option>
            {/each}
          </select>
        </div>
      {/if}
    {/if}
  {/if}

  {#if actionType === "service"}
    <div class="field">
      <span class="field-label">Action</span>
      <button
        class="service-pick-btn"
        class:has-value={!!serviceName}
        onclick={() => (showServicePicker = true)}
      >
        {displayName}
      </button>
    </div>

    <div class="target-section">
      <span class="field-label">Target (optional)</span>
      <EntityPicker
        allowedDomains={serviceAllowedTargetDomains.length > 0
          ? serviceAllowedTargetDomains
          : undefined}
        preselectedDomain={serviceAllowedTargetDomains.length === 1
          ? serviceAllowedTargetDomains[0]
          : undefined}
        component={{
          type: "light_state",
          stateBinding: serviceTargetEntity
            ? { entityId: serviceTargetEntity }
            : undefined,
        }}
        onUpdate={(binding) => handleEntityTargetChange(binding?.entityId)}
      />
    </div>
    {#if !serviceNeedsEntityTarget && serviceName}
      <div class="hint">
        <p>
          This action may work without a target. Add one if your service call
          should apply to a specific entity.
        </p>
      </div>
    {/if}
  {/if}
</div>

{#if showServicePicker}
  <ServicePicker
    onSelect={handleServicePickerSelect}
    onClose={() => (showServicePicker = false)}
  />
{/if}

<style>
  .action-editor {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .field-label {
    font-size: 12px;
    color: var(--color-text-secondary);
    min-width: 50px;
  }

  select {
    flex: 1;
    min-width: 0;
  }

  .service-pick-btn {
    flex: 1;
    padding: 8px 12px;
    font-size: 12px;
    text-align: left;
    border: 1px solid var(--color-border);
    border-radius: 4px;
    background: var(--color-input-bg, #1e1e1e);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: border-color 0.2s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .service-pick-btn:hover {
    border-color: var(--color-primary, #0066cc);
    color: var(--color-text-secondary);
  }

  .service-pick-btn.has-value {
    color: var(--color-text-primary);
  }

  .target-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
  }

  .target-section .field-label {
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 600;
    color: var(--color-text-muted);
  }

  .target-hint {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .hint {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 10px;
    background: var(--color-bg-secondary);
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 11px;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .hint p {
    margin: 0;
  }

  .create-dv-btn {
    align-self: flex-start;
    padding: 4px 10px;
    font-size: 11px;
    font-family: inherit;
    background: var(--color-accent);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: opacity var(--transition-fast);
  }

  .create-dv-btn:hover {
    opacity: 0.85;
  }
</style>
