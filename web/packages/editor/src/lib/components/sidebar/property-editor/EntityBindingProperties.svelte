<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";
  import EntityPicker from "../EntityPicker.svelte";

  const ALLOWED_DOMAINS: Partial<Record<Component["type"], string[]>> = {
    todo_list: ["todo"],
    light_state: [
      "light",
      "switch",
      "fan",
      "input_boolean",
      "automation",
      "camera",
      "media_player",
    ],
    hvac: ["climate"],
    weather: ["weather"],
    calendar: ["calendar"],
  };

  const PRESELECTED_DOMAINS: Partial<Record<Component["type"], string>> = {
    todo_list: "todo",
    light_state: "light",
    hvac: "climate",
    weather: "weather",
    calendar: "calendar",
  };

  let { component, updateProperty } = $props<{
    component: Component;
    updateProperty: (key: string, value: unknown) => void;
  }>();

  function bindingProperty(type: Component["type"]): string {
    if (type === "todo_list") return "itemsBinding";
    if (type === "calendar") return "entityBinding";
    return "stateBinding";
  }

  function preselectedDomain(type: Component["type"]): string | undefined {
    return PRESELECTED_DOMAINS[type];
  }

  function allowedDomains(type: Component["type"]): string[] | undefined {
    return ALLOWED_DOMAINS[type];
  }
</script>

{#if component.type === "todo_list" || component.type === "light_state" || component.type === "hvac" || component.type === "weather" || component.type === "calendar"}
  <div class="property-section">
    <div class="section-label-row">
      <div class="section-label">Entity Binding</div>
      {#if !homeAssistantStore.isLoaded}
        <a
          class="entity-dump-info"
          href="/home-assistant-entity-export"
          target="_blank"
          rel="noopener"
          aria-label="Learn how to create a Home Assistant entity dump"
          title="Learn how to create a Home Assistant entity dump">i</a
        >
      {/if}
    </div>
    <EntityPicker
      preselectedDomain={preselectedDomain(component.type)}
      allowedDomains={allowedDomains(component.type)}
      {component}
      onUpdate={(binding) =>
        updateProperty(bindingProperty(component.type), binding)}
    />
  </div>
{/if}
