<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import { colorToCss } from "../../../utils/color-utils";

  type RectangleComponent = Extract<Component, { type: "rectangle" }>;

  interface Props {
    component: RectangleComponent;
  }

  let { component }: Props = $props();
  const bgColor = $derived(colorToCss(component.backgroundColor, "rgb(64, 64, 64)"));
</script>

<Draggable {component}>
  <div class="rectangle" style:background-color={bgColor}></div>
</Draggable>

<style>
  .rectangle {
    width: 100%;
    height: 100%;
    border-radius: 6px;
  }
</style>
