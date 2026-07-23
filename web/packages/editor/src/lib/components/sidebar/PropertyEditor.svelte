<script lang="ts">
  import type {
    ButtonComponent,
    LightStateComponent,
    NavigationAction,
  } from "@vesp-cloud/schema";
  import { historyStore } from "$lib/stores/history.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { selectionStore } from "$lib/stores/selection.svelte";
  import { validationStore } from "$lib/stores/validation.svelte";
  import ActionEditor from "./ActionEditor.svelte";
  import BasicComponentProperties from "./property-editor/BasicComponentProperties.svelte";
  import ComponentLayoutProperties from "./property-editor/ComponentLayoutProperties.svelte";
  import ContainerProperties from "./property-editor/ContainerProperties.svelte";
  import DetailViewProperties from "./property-editor/DetailViewProperties.svelte";
  import EntityBindingProperties from "./property-editor/EntityBindingProperties.svelte";
  import HomeAssistantComponentProperties from "./property-editor/HomeAssistantComponentProperties.svelte";
  import ValidationErrors from "./property-editor/ValidationErrors.svelte";
  import { weatherHeightForMode } from "$lib/utils/weather-layout";
  import "./property-editor/property-editor.css";

  const NAV_ICONS: Partial<Record<NavigationAction["type"], string>> = {
    OPEN_DETAIL: "mdi:open-in-new",
    GO_BACK: "mdi:arrow-left",
    NEXT_PAGE: "mdi:chevron-right",
    PREV_PAGE: "mdi:chevron-left",
  };
  const NAV_ICON_NAMES = new Set([
    "open-in-new",
    "arrow-left",
    "chevron-right",
    "chevron-left",
  ]);

  const selectedComponent = $derived(
    selectionStore.firstSelectedId
      ? projectStore.getComponent(selectionStore.firstSelectedId)
      : null,
  );
  const componentValidationErrors = $derived(
    selectionStore.firstSelectedId
      ? validationStore.getErrorsForComponent(selectionStore.firstSelectedId)
      : [],
  );

  function isNavPresetIcon(icon: string | undefined): boolean {
    if (!icon) return false;
    return NAV_ICON_NAMES.has(icon.replace(/^mdi:/, ""));
  }

  function clearedGestureActions() {
    if (selectedComponent?.type === "button") {
      return { pressAction: undefined, holdAction: undefined };
    }
    return {};
  }

  function updateProperty(key: string, value: unknown) {
    if (!selectedComponent) return;
    historyStore.record(`Update ${key}`);
    const isListComponent =
      selectedComponent.type === "calendar" ||
      selectedComponent.type === "todo_list";

    if (selectedComponent.type === "weather" && key === "mode") {
      projectStore.updateComponent(selectedComponent.id, {
        mode: value as "today" | "today-mini" | "forecast",
        size: selectedComponent.size
          ? {
              ...selectedComponent.size,
              height: weatherHeightForMode(
                value as "today" | "today-mini" | "forecast",
              ),
            }
          : undefined,
      });
    } else if (isListComponent && key === "scrollable" && value === true) {
      projectStore.updateComponent(selectedComponent.id, {
        scrollable: true,
        maxItems: undefined,
      });
    } else if (isListComponent && key === "maxItems") {
      projectStore.updateComponent(selectedComponent.id, {
        maxItems: value as number,
        scrollable: false,
      });
    } else {
      projectStore.updateComponent(selectedComponent.id, { [key]: value });
    }

    if (key !== "onTap") return;
    if (value && typeof value === "object" && "type" in value) {
      if (value.type === "SERVICE_CALL") return;
      const action = value as NavigationAction;
      const component = selectedComponent as { id: string; icon?: string };
      if (selectedComponent.type === "button") {
        projectStore.updateComponent(selectedComponent.id, {
          confirmBeforeAction: undefined,
        });
      }
      if (!component.icon) {
        const icon = NAV_ICONS[action.type];
        if (icon) projectStore.updateComponent(component.id, { icon });
      }
      return;
    }
    if (value !== undefined) return;

    const component = selectedComponent as { id: string; icon?: string };
    if (isNavPresetIcon(component.icon)) {
      projectStore.updateComponent(component.id, { icon: undefined });
    }
    projectStore.updateComponent(selectedComponent.id, {
      onHold: undefined,
      onDragStart: undefined,
      onDragEnd: undefined,
      ...clearedGestureActions(),
    });
  }

  function convertButtonAndLight() {
    if (!selectedComponent) return;

    if (selectedComponent.type === "button") {
      const button = selectedComponent as ButtonComponent;
      const action = button.onTap ?? button.pressAction;
      const entityId =
        action?.type === "SERVICE_CALL" ? action.target?.entityId : undefined;
      historyStore.record("Convert button to light switch");
      projectStore.updateComponent(button.id, {
        type: "light_state",
        label: button.label ?? "Light",
        icon: button.icon ?? "lightbulb",
        stateBinding: entityId ? { entityId } : undefined,
        showIcon: true,
        showBrightnessControl: false,
        onText: "ON",
        offText: "OFF",
        confirmAction: button.confirmBeforeAction ? "both" : "none",
        onTap: undefined,
        onHold: undefined,
        onDragStart: undefined,
        onDragEnd: undefined,
        pressAction: undefined,
        holdAction: undefined,
        backgroundColor: undefined,
        foregroundColor: undefined,
        borderColor: undefined,
        checkedBackgroundColor: undefined,
        checkedForegroundColor: undefined,
        confirmBeforeAction: undefined,
      } as Partial<LightStateComponent>);
      return;
    }

    if (selectedComponent.type === "light_state") {
      const light = selectedComponent as LightStateComponent;
      const entityId = light.stateBinding?.entityId;
      historyStore.record("Convert light switch to button");
      projectStore.updateComponent(light.id, {
        type: "button",
        label: light.label ?? "Button",
        icon: light.icon,
        onTap: entityId
          ? {
              type: "SERVICE_CALL",
              service: "homeassistant.toggle",
              target: { entityId },
            }
          : undefined,
        confirmBeforeAction:
          light.confirmAction !== undefined && light.confirmAction !== "none",
        backgroundColor: light.offColor,
        checkedBackgroundColor: light.onColor,
        stateBinding: undefined,
        targetDevice: undefined,
        showBrightnessControl: undefined,
        onText: undefined,
        offText: undefined,
        showIcon: undefined,
        onColor: undefined,
        offColor: undefined,
        confirmAction: undefined,
      } as Partial<ButtonComponent>);
    }
  }
</script>

<div class="property-editor">
  {#if projectStore.viewMode === "detail" && !selectedComponent}
    <DetailViewProperties />
  {/if}

  {#if selectedComponent}
    <h3>{selectedComponent.type} Properties</h3>
    <ValidationErrors errors={componentValidationErrors} />
    <ComponentLayoutProperties component={selectedComponent} />
    <BasicComponentProperties
      component={selectedComponent}
      {updateProperty}
    />
    <HomeAssistantComponentProperties
      component={selectedComponent}
      {updateProperty}
    />
    <ContainerProperties component={selectedComponent} {updateProperty} />
    <EntityBindingProperties component={selectedComponent} {updateProperty} />

    {#if selectedComponent.type !== "light_state" && selectedComponent.type !== "hvac" && selectedComponent.type !== "text"}
      <div class="property-section">
        <label class="section-label">Actions</label>
        <ActionEditor
          label="On Tap"
          action={selectedComponent.onTap}
          onUpdate={(action) => updateProperty("onTap", action)}
        />
      </div>
    {/if}

    {#if selectedComponent.type === "button" || selectedComponent.type === "light_state"}
      <div class="property-section">
        <details class="advanced-details">
          <summary class="advanced-summary">Advanced</summary>
          <p class="advanced-note">
            Changes the component type while preserving compatible settings.
          </p>
          <button class="conversion-button" type="button" onclick={convertButtonAndLight}>
            Convert to {selectedComponent.type === "button"
              ? "Switch"
              : "Button"}
          </button>
        </details>
      </div>
    {/if}
  {:else}
    {#if projectStore.viewMode === "dashboard"}
      <div class="property-section">
        <label class="section-label">Page Name</label>
        <div class="field">
          <input
            type="text"
            value={projectStore.currentDashboardPage?.name ?? ""}
            oninput={(e) => {
              const page = projectStore.currentDashboardPage;
              if (page && e.currentTarget.value.trim()) {
                projectStore.renameDashboardPage(
                  page.id,
                  e.currentTarget.value.trim(),
                );
              }
            }}
          />
        </div>
      </div>
    {/if}
    <div class="no-selection">
      <p>Select a component to edit its properties</p>
    </div>
  {/if}
</div>
