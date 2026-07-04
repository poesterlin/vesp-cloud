<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import * as mdiIcons from "@mdi/js";
  import Draggable from "../Draggable.svelte";
  import { homeAssistantStore } from "$lib/stores/homeassistant.svelte";

  interface Props {
    component: Component;
  }

  let { component }: Props = $props();

  const autoLayoutComponent = $derived(component as any);

  const width = $derived(component.size?.width ?? 140);
  const height = $derived(component.size?.height ?? 32);

  const gap = $derived(Math.max(0, autoLayoutComponent.gap ?? 6));
  const padding = $derived(Math.max(0, autoLayoutComponent.padding ?? 0));
  const direction = $derived(autoLayoutComponent.direction ?? "horizontal");
  const crossAxisAlign = $derived(autoLayoutComponent.crossAxisAlign ?? "center");
  const mainAxisJustify = $derived(autoLayoutComponent.mainAxisJustify ?? "start");

  const visibleItems = $derived(autoLayoutComponent.items.filter((item: any) => isItemVisible(item)));

  const contentMainSize = $derived(
    direction === "horizontal"
      ? Math.max(0, width - padding * 2)
      : Math.max(0, height - padding * 2)
  );

  const contentCrossSize = $derived(
    direction === "horizontal"
      ? Math.max(0, height - padding * 2)
      : Math.max(0, width - padding * 2)
  );

  const itemRects = $derived.by(() => {
    const sizeMode = autoLayoutComponent.itemSizeMode ?? "content";
    const fixedMain = direction === "horizontal"
      ? Math.max(1, autoLayoutComponent.itemWidth ?? 24)
      : Math.max(1, autoLayoutComponent.itemHeight ?? 24);
    const fixedCross = direction === "horizontal"
      ? Math.max(1, autoLayoutComponent.itemHeight ?? 24)
      : Math.max(1, autoLayoutComponent.itemWidth ?? 24);

    const sizes = visibleItems.map((item: any) => {
      if (sizeMode === "fixed") {
        return { main: fixedMain, cross: fixedCross };
      }
      const scale = Math.max(0.1, item.scale ?? 1);
      return {
        main: Math.max(1, Math.round(24 * scale)),
        cross: Math.max(1, Math.round(24 * scale)),
      };
    });

    const totalItemsMain = sizes.reduce((sum: number, size: { main: number }) => sum + size.main, 0);
    const totalGap = visibleItems.length > 1 ? gap * (visibleItems.length - 1) : 0;
    const occupiedMain = totalItemsMain + totalGap;
    const availableMain = Math.max(0, contentMainSize - occupiedMain);

    let cursor = padding;
    let spacing = gap;

    if (mainAxisJustify === "center") {
      cursor += availableMain / 2;
    } else if (mainAxisJustify === "end") {
      cursor += availableMain;
    } else if (mainAxisJustify === "space_between" && visibleItems.length > 1) {
      spacing = gap + availableMain / (visibleItems.length - 1);
    }

    const rects: {
      item: any;
      x: number;
      y: number;
      width: number;
      height: number;
      iconPath: string | null;
    }[] = [];

    for (let index = 0; index < visibleItems.length; index++) {
      const item = visibleItems[index];
      const size = sizes[index];

      let crossStart = padding;
      if (crossAxisAlign === "center") {
        crossStart = padding + Math.max(0, (contentCrossSize - size.cross) / 2);
      } else if (crossAxisAlign === "end") {
        crossStart = padding + Math.max(0, contentCrossSize - size.cross);
      } else if (crossAxisAlign === "stretch") {
        crossStart = padding;
        size.cross = contentCrossSize;
      }

      const x = direction === "horizontal" ? cursor : crossStart;
      const y = direction === "horizontal" ? crossStart : cursor;
      const w = direction === "horizontal" ? size.main : size.cross;
      const h = direction === "horizontal" ? size.cross : size.main;

      rects.push({ item, x, y, width: w, height: h, iconPath: getIconPath(item.icon) });
      cursor += size.main + (index < visibleItems.length - 1 ? spacing : 0);
    }

    return rects;
  });

  function compareValues(left: unknown, operator: string, right: unknown): boolean {
    if (operator === "eq") return left === right;
    if (operator === "neq") return left !== right;
    if (operator === "gt") return Number(left) > Number(right);
    if (operator === "gte") return Number(left) >= Number(right);
    if (operator === "lt") return Number(left) < Number(right);
    if (operator === "lte") return Number(left) <= Number(right);
    const leftText = String(left ?? "");
    const rightText = String(right ?? "");
    if (operator === "contains") return leftText.includes(rightText);
    if (operator === "not_contains") return !leftText.includes(rightText);
    if (operator === "matches") {
      try {
        return new RegExp(rightText).test(leftText);
      } catch {
        return false;
      }
    }
    return false;
  }

  function evaluateCondition(condition: any): boolean {
    if (!condition) return true;
    if (condition.type === "entity") {
      const entity = homeAssistantStore.getEntity(condition.entityId);
      const candidate = condition.attribute && entity
        ? (entity as any)[condition.attribute] ?? entity.state
        : entity?.state;
      const normalizedCandidate = candidate === "on" ? true : candidate === "off" ? false : candidate;
      return compareValues(normalizedCandidate, condition.operator, condition.value);
    }
    if (condition.type === "compound") {
      if (condition.operator === "and") {
        return condition.conditions.every((entry: any) => evaluateCondition(entry));
      }
      return condition.conditions.some((entry: any) => evaluateCondition(entry));
    }
    if (condition.type === "not") {
      return !evaluateCondition(condition.condition);
    }
    return true;
  }

  function isItemVisible(item: any): boolean {
    return evaluateCondition(item.condition);
  }

  function getIconPath(iconName?: string): string | null {
    if (!iconName) return null;
    const iconKey =
      "mdi" +
      iconName
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
    const path = (mdiIcons as Record<string, unknown>)[iconKey];
    return typeof path === "string" ? path : null;
  }

  function colorStyle(item: any): string {
    if (!item.color) return "#ffffff";
    return `rgb(${item.color.r}, ${item.color.g}, ${item.color.b})`;
  }
</script>

<Draggable {component}>
  <div class="auto-layout-list" style:width="{width}px" style:height="{height}px">
    {#each itemRects as layout (layout.item.id)}
      <div
        class="layout-item"
        style:left="{layout.x}px"
        style:top="{layout.y}px"
        style:width="{layout.width}px"
        style:height="{layout.height}px"
        style:color={colorStyle(layout.item)}
        title={layout.item.name}
      >
        {#if layout.iconPath}
          <svg viewBox="0 0 24 24" class="icon-svg">
            <path d={layout.iconPath} fill="currentColor" />
          </svg>
        {:else}
          <span class="icon-placeholder">{layout.item.icon ?? "?"}</span>
        {/if}
      </div>
    {/each}
  </div>
</Draggable>

<style>
  .auto-layout-list {
    position: relative;
    border: 1px dashed #4d6178;
    border-radius: 4px;
    background: rgba(29, 39, 50, 0.45);
    overflow: hidden;
    pointer-events: none;
  }

  .layout-item {
    position: absolute;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-svg {
    width: min(24px, 100%);
    height: min(24px, 100%);
  }

  .icon-placeholder {
    font-size: 9px;
    font-family: monospace;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
</style>
