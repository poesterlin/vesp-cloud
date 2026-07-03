<script lang="ts">
  import type { Component } from "@esphome-designer/schema";
  import TextRenderer from "./TextRenderer.svelte";
  import DigitalClockRenderer from "./DigitalClockRenderer.svelte";
  import ButtonRenderer from "./ButtonRenderer.svelte";
  import SliderRenderer from "./SliderRenderer.svelte";
  import GaugeRenderer from "./GaugeRenderer.svelte";
  import IconRenderer from "./IconRenderer.svelte";
  import ProceduralIconRenderer from "./ProceduralIconRenderer.svelte";
  import ContainerRenderer from "./ContainerRenderer.svelte";
  import RectangleRenderer from "./RectangleRenderer.svelte";
  import ImageRenderer from "./ImageRenderer.svelte";
  import ConditionalAreaRenderer from "./ConditionalAreaRenderer.svelte";
  import TabContainerRenderer from "./TabContainerRenderer.svelte";
  import TodoListRenderer from "./TodoListRenderer.svelte";
  import AutoLayoutListRenderer from "./AutoLayoutListRenderer.svelte";
  import LightStateRenderer from "./LightStateRenderer.svelte";
  import HvacRenderer from "./HvacRenderer.svelte";
  import WeatherRenderer from "./WeatherRenderer.svelte";
  import CalendarRenderer from "./CalendarRenderer.svelte";

  interface Props {
    component: Component;
    parentOffset?: { x: number; y: number };
  }

  let { component, parentOffset = { x: 0, y: 0 } }: Props = $props();
</script>

{#if component.type === "text"}
  <TextRenderer {component} />
{:else if component.type === "digital_clock"}
  <DigitalClockRenderer {component} />
{:else if (component as any).type === "auto_layout_list"}
  <AutoLayoutListRenderer {component} />
{:else if component.type === "button"}
  <ButtonRenderer {component} />
{:else if component.type === "slider"}
  <SliderRenderer {component} />
{:else if component.type === "gauge"}
  <GaugeRenderer {component} />
{:else if component.type === "icon"}
  <IconRenderer {component} />
{:else if component.type === "procedural_icon"}
  <ProceduralIconRenderer {component} />
{:else if component.type === "container"}
  <ContainerRenderer {component} />
{:else if component.type === "rectangle"}
  <RectangleRenderer {component} />
{:else if component.type === "image"}
  <ImageRenderer {component} />
{:else if component.type === "todo_list"}
  <TodoListRenderer {component} />
{:else if component.type === "light_state"}
  <LightStateRenderer {component} />
{:else if component.type === "hvac"}
  <HvacRenderer {component} />
{:else if component.type === "weather"}
  <WeatherRenderer {component} />
{:else if component.type === "calendar"}
  <CalendarRenderer {component} />
{:else if component.type === "conditional_area"}
  <ConditionalAreaRenderer {component} {parentOffset} />
{:else if component.type === "tab_container"}
  <TabContainerRenderer {component} {parentOffset} />
{:else}
  <div class="unknown-component">
    Unknown component
  </div>
{/if}

<style>
  .unknown-component {
    position: absolute;
    background: #ff0000;
    color: white;
    padding: 4px 8px;
    font-size: 10px;
  }
</style>
