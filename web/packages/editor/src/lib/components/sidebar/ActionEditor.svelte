<script lang="ts">
  import type { ActionBinding, ServiceAction, NavigationAction } from "@esphome-designer/schema";
  import { projectStore } from "$lib/stores/project.svelte";
  import { SERVICE_PRESETS, getServicesByDomain, DOMAIN_LABELS } from "$lib/data/service-presets";
  import EntityPicker from "./EntityPicker.svelte";

  type ActionType = "none" | "navigation" | "service";

  interface Props {
    action: ActionBinding | undefined;
    onUpdate: (action: ActionBinding | undefined) => void;
    label?: string;
  }

  let { action, onUpdate, label = "Action" }: Props = $props();

  // Derive the current action type
  const actionType = $derived.by<ActionType>(() => {
    if (!action) return "none";
    if (action.type === "SERVICE_CALL") return "service";
    return "navigation";
  });

  // For navigation actions
  const navType = $derived(
    action && action.type !== "SERVICE_CALL" ? action.type : "OPEN_DETAIL"
  );
  const navTargetId = $derived(
    action && action.type !== "SERVICE_CALL" ? (action as NavigationAction).targetId : ""
  );

  // For service actions
  const serviceAction = $derived(
    action?.type === "SERVICE_CALL" ? (action as ServiceAction) : null
  );
  const serviceName = $derived(serviceAction?.service ?? "");
  const serviceTargetEntity = $derived(serviceAction?.target?.entityId ?? "");
  const serviceTargetDevice = $derived(serviceAction?.target?.deviceId ?? "");

  // Build a clean service action, only including optional fields when populated
  function buildServiceAction(
    service: string,
    target?: { entityId?: string; deviceId?: string }
  ): ServiceAction {
    const action: ServiceAction = { type: "SERVICE_CALL", service };
    if (target?.entityId || target?.deviceId) {
      action.target = {};
      if (target.entityId) action.target.entityId = target.entityId;
      if (target.deviceId) action.target.deviceId = target.deviceId;
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
    const target = serviceTargetEntity ? { entityId: serviceTargetEntity } : serviceTargetDevice ? { deviceId: serviceTargetDevice } : undefined;
    onUpdate(buildServiceAction(service, target));
  }

  function handleEntityTargetChange(entityId: string | undefined) {
    onUpdate(buildServiceAction(serviceName, entityId ? { entityId } : undefined));
  }

  function handleDeviceTargetChange(device: { deviceId: string; deviceName: string } | undefined) {
    onUpdate(buildServiceAction(serviceName, device ? { deviceId: device.deviceId } : undefined));
  }

  // Get services grouped by domain
  const groupedServices = $derived(getServicesByDomain());
</script>

<div class="action-editor">
  <div class="field">
    <span class="field-label">{label}</span>
    <select
      value={actionType}
      onchange={(e) => handleActionTypeChange(e.currentTarget.value as ActionType)}
    >
      <option value="none">None</option>
      <option value="navigation">Navigation</option>
      <option value="service">Service Call</option>
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
        <option value="NEXT_PAGE">Next Page</option>
        <option value="PREV_PAGE">Previous Page</option>
        <option value="GO_BACK">Go Back</option>
      </select>
    </div>

    {#if navType === "OPEN_DETAIL"}
      <div class="field">
        <span class="field-label">Target</span>
        <select
          value={navTargetId}
          onchange={(e) => handleNavTargetChange(e.currentTarget.value)}
        >
          <option value="" disabled>Select Detail View</option>
          {#each projectStore.detailViews as view}
            <option value={view.id}>{view.title}</option>
          {/each}
        </select>
      </div>
    {/if}
  {/if}

  {#if actionType === "service"}
    <div class="field">
      <span class="field-label">Service</span>
      <select
        value={serviceName}
        onchange={(e) => handleServiceChange(e.currentTarget.value)}
      >
        <option value="">Select Service</option>
        {#each [...groupedServices.entries()] as [domain, services]}
          <optgroup label={DOMAIN_LABELS[domain] ?? domain}>
            {#each services as { service, preset }}
              <option value={service}>{preset.label}</option>
            {/each}
          </optgroup>
        {/each}
        <optgroup label="Custom">
          <option value="__custom__">Enter Custom Service...</option>
        </optgroup>
      </select>
    </div>

    {#if serviceName === "__custom__" || (serviceName && !SERVICE_PRESETS[serviceName])}
      <div class="field">
        <span class="field-label">Service ID</span>
        <input
          type="text"
          placeholder="domain.service_name"
          value={serviceName === "__custom__" ? "" : serviceName}
          oninput={(e) => handleServiceChange(e.currentTarget.value)}
        />
      </div>
    {/if}

    <div class="target-section">
      <span class="field-label">Target</span>
      <EntityPicker
        component={{} as any}
        deviceOnly={true}
        onDeviceSelect={handleDeviceTargetChange}
      />
    </div>

    {#if serviceName && serviceTargetDevice}
      <div class="preview">
        <span class="preview-title">Preview:</span>
        <code class="preview-service">{serviceName}</code>
        <span class="preview-arrow">→</span>
        <code class="preview-target">device</code>
      </div>
    {/if}
  {/if}
</div>

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

  select,
  input {
    flex: 1;
    min-width: 0;
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

  .preview {
    font-size: 11px;
    color: var(--color-text-muted);
    padding: var(--spacing-xs) var(--spacing-sm);
    background: var(--color-bg-primary);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }

  .preview-title {
    font-weight: 500;
  }

  .preview-service {
    color: var(--color-accent);
  }

  .preview-arrow {
    color: var(--color-text-muted);
  }

  .preview-target {
    color: var(--color-success, #27ae60);
  }
</style>
