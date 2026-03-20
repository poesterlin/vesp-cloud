<script lang="ts">
  import type { Component } from "@esphome-designer/schema";
  import TextRenderer from "./TextRenderer.svelte";
  import ButtonRenderer from "./ButtonRenderer.svelte";
  import SliderRenderer from "./SliderRenderer.svelte";
  import GaugeRenderer from "./GaugeRenderer.svelte";
  import IconRenderer from "./IconRenderer.svelte";
  import ProceduralIconRenderer from "./ProceduralIconRenderer.svelte";
  import ContainerRenderer from "./ContainerRenderer.svelte";
  import ImageRenderer from "./ImageRenderer.svelte";
  import ConditionalAreaRenderer from "./ConditionalAreaRenderer.svelte";
  import TodoListRenderer from "./TodoListRenderer.svelte";

  interface Props {
    component: Component;
    parentOffset?: { x: number; y: number };
  }

  let { component, parentOffset = { x: 0, y: 0 } }: Props = $props();
</script>

{#if component.type === "text"}
  <TextRenderer {component} />
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
{:else if component.type === "image"}
  <ImageRenderer {component} />
{:else if component.type === "todo_list"}
  <TodoListRenderer {component} />
{:else if component.type === "conditional_area"}
  <ConditionalAreaRenderer {component} {parentOffset} />
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
