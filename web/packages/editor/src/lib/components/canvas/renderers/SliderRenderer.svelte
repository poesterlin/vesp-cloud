<script lang="ts">
  import type { Component } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { colorToCss } from "$lib/utils/color-utils";

  type RangeSliderComponent = Extract<Component, { type: "range_slider" }>;

  interface Props {
    component: RangeSliderComponent;
  }

  let { component }: Props = $props();
  const theme = $derived(projectStore.theme);

  const label = $derived(component.label?.trim() || "RANGE");
  const unit = $derived(component.unit?.trim() || "");
  const minValue = $derived(component.min ?? 0);
  const maxValue = $derived(component.max ?? 100);
  const step = $derived(Math.max(0.01, component.step ?? 1));
  const valueDecimals = $derived(
    Math.max(0, Math.min(3, component.valueDecimals ?? (step < 1 ? 1 : 0))),
  );

  const isRetro = $derived(theme.id === "retro");

  const width = $derived(component.size?.width ?? 320);
  const height = $derived(component.size?.height ?? 96);

  const accent = $derived(
    colorToCss(
      component.color,
      isRetro ? "rgb(0, 220, 255)" : "rgb(80, 180, 255)",
    ),
  );
  const accentHi = $derived(isRetro ? "rgb(255, 180, 0)" : accent);

  let value = $state(
    clampToStep(component.value ?? (minValue + maxValue) / 2, {
      min: minValue,
      max: maxValue,
      step,
    }),
  );
  let dragging = $state(false);

  $effect(() => {
    const next = clampToStep(component.value ?? (minValue + maxValue) / 2, {
      min: minValue,
      max: maxValue,
      step,
    });
    if (!dragging) {
      value = next;
    }
  });

  const pad = 12;
  const thumbR = 12;
  const trackH = $derived(isRetro ? 10 : 8);
  const headerH = 22;

  const trackX = $derived(pad + thumbR);
  const trackW = $derived(Math.max(8, width - 2 * pad - 2 * thumbR));
  const trackY = $derived(
    Math.round(
      pad + headerH + 2 + (height - pad - headerH - 18 - pad - trackH) / 2,
    ),
  );
  const trackMid = $derived(trackY + trackH / 2);
  const valueY = $derived(height - pad - 14);

  function clamp(v: number, a: number, b: number) {
    return Math.min(b, Math.max(a, v));
  }

  function clampToStep(
    v: number,
    cfg: { min?: number; max?: number; step?: number },
  ) {
    const mn = cfg.min ?? 0;
    const mx = cfg.max ?? 100;
    const st = Math.max(0.01, cfg.step ?? 1);
    let x = clamp(v, mn, mx);
    x = Math.round((x - mn) / st) * st + mn;
    const decimals = st < 1 ? 4 : 0;
    x = Number(x.toFixed(decimals));
    return clamp(x, mn, mx);
  }

  function valueToX(v: number): number {
    const span = maxValue - minValue;
    if (span <= 0) return trackX;
    const t = clamp((v - minValue) / span, 0, 1);
    return trackX + Math.round(t * trackW);
  }

  function formatValue(v: number): string {
    const rounded =
      valueDecimals <= 0
        ? Math.round(v).toString()
        : Number.isInteger(v) || Math.floor(v) === v
          ? Math.round(v).toString()
          : v.toFixed(valueDecimals);
    return `${rounded}${unit}`;
  }

  const thumbX = $derived(valueToX(value));
  const formattedValue = $derived(formatValue(value));

  function clippedPolygonPoints(w: number, h: number, c: number): string {
    return `${c},0 ${w - c},0 ${w},${c} ${w},${h - c} ${w - c},${h} ${c},${h} 0,${h - c} 0,${c}`;
  }
</script>

<Draggable {component}>
  {#if component.size}
    <div
      class="range-slider"
      class:retro={isRetro}
      class:modern={!isRetro}
      style:width="100%"
      style:height="100%"
      style:--accent={accent}
      style:--accent-hi={accentHi}
      role="group"
      aria-label={label}
    >
      {#if isRetro}
        <svg class="shell" {width} {height} viewBox="0 0 {width} {height}">
          <polygon
            points={clippedPolygonPoints(width, height, 8)}
            fill="rgb(2, 8, 16)"
            stroke={accent}
            stroke-width="1.5"
          />
          <polygon
            points={clippedPolygonPoints(width - 4, height - 4, 7)}
            fill="none"
            stroke="rgb(40, 50, 65)"
            stroke-width="1"
            transform="translate(2, 2)"
          />
          {#each Array.from({ length: Math.floor(height / 4) }, (_, i) => i) as i (i)}
            <line
              x1="2"
              y1={2 + i * 4}
              x2={width - 2}
              y2={2 + i * 4}
              stroke="rgba(0, 40, 60, 0.35)"
              stroke-width="1"
            />
          {/each}
          <path
            d="M6,10 L6,6 L10,6"
            fill="none"
            stroke="rgb(0, 140, 160)"
            stroke-width="1"
          />
          <path
            d="M{width - 10},6 L{width - 6},6 L{width - 6},10"
            fill="none"
            stroke="rgb(0, 140, 160)"
            stroke-width="1"
          />
          <path
            d="M6,{height - 10} L6,{height - 6} L10,{height - 6}"
            fill="none"
            stroke="rgb(0, 140, 160)"
            stroke-width="1"
          />
          <path
            d="M{width - 10},{height - 6} L{width - 6},{height - 6} L{width -
              6},{height - 10}"
            fill="none"
            stroke="rgb(0, 140, 160)"
            stroke-width="1"
          />

          <line
            x1={pad}
            y1={pad + headerH}
            x2={width - pad}
            y2={pad + headerH}
            stroke="rgb(40, 50, 65)"
            stroke-width="1"
            stroke-dasharray="3 3"
          />

          <rect
            x={trackX - 1}
            y={trackY - 1}
            width={trackW + 2}
            height={trackH + 2}
            fill="none"
            stroke="rgb(45, 55, 70)"
          />
          <rect
            x={trackX}
            y={trackY}
            width={trackW}
            height={trackH}
            fill="rgb(35, 42, 52)"
          />

          {#if thumbX > trackX}
            <rect
              x={trackX}
              y={trackY}
              width={thumbX - trackX}
              height={trackH}
              fill={accent}
            />
            <line
              x1={trackX}
              y1={trackY + 1}
              x2={thumbX}
              y2={trackY + 1}
              stroke="rgb(0, 240, 255)"
              stroke-width="1"
            />
          {/if}

          {#if true}
            {@const half = dragging ? thumbR + 1 : thumbR}
            {@const side = half * 2}
            {@const tx = thumbX - half}
            {@const ty = trackMid - half}
            {@const bc = dragging ? accentHi : accent}
            <rect
              x={tx}
              y={ty}
              width={side}
              height={side}
              fill="rgb(2, 8, 16)"
              stroke={bc}
            />
            <rect
              x={tx + 1}
              y={ty + 1}
              width={side - 2}
              height={side - 2}
              fill="none"
              stroke={bc}
            />
            <rect
              x={tx + 3}
              y={ty + 3}
              width={side - 6}
              height={side - 6}
              fill={bc}
            />
          {/if}
        </svg>
      {:else}
        <div class="modern-shell">
          <div class="modern-frame"></div>
        </div>
        <svg
          class="track-layer"
          {width}
          {height}
          viewBox="0 0 {width} {height}"
        >
          <rect
            x={trackX}
            y={trackY}
            width={trackW}
            height={trackH}
            rx="4"
            fill="rgb(28, 34, 46)"
            stroke="rgb(42, 50, 66)"
          />
          {#if thumbX > trackX}
            <rect
              x={trackX}
              y={trackY + 1}
              width={thumbX - trackX}
              height={trackH - 2}
              rx="3"
              fill={accent}
            />
          {/if}

          {#if true}
            {@const rad = dragging ? thumbR + 2 : thumbR}
            <circle
              cx={thumbX}
              cy={trackMid}
              r={rad}
              fill="rgb(250, 252, 255)"
            />
            <circle
              cx={thumbX}
              cy={trackMid}
              r={rad}
              fill="none"
              stroke={accent}
              stroke-width="2"
            />
            <circle cx={thumbX} cy={trackMid} r="3" fill={accent} />
          {/if}
        </svg>
      {/if}

      <div class="header">
        <span class="label" title={label}>{label}</span>
        <span class="summary" title={formattedValue}>{formattedValue}</span>
      </div>
    </div>
  {/if}
</Draggable>

<style>
  .range-slider {
    position: relative;
    overflow: hidden;
    box-sizing: border-box;
    touch-action: none;
    user-select: none;
    cursor: default;
    color: rgb(230, 240, 250);
  }

  .range-slider.modern {
    background: rgb(12, 16, 24);
    border: 1px solid rgb(42, 50, 66);
    border-radius: 8px;
  }

  .range-slider.retro {
    background: transparent;
  }

  .shell,
  .track-layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .modern-shell {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .modern-frame {
    position: absolute;
    inset: 2px;
    border: 1px solid rgb(30, 36, 45);
    border-radius: 6px;
  }

  .header {
    position: absolute;
    top: 12px;
    left: 12px;
    right: 12px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    pointer-events: none;
    z-index: 1;
  }

  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--display-font, monospace);
    font-size: 12px;
    font-weight: 600;
    color: rgb(120, 130, 145);
  }

  .retro .label {
    color: rgb(130, 150, 170);
  }

  .summary {
    flex: 0 0 auto;
    font-family: var(--display-font, monospace);
    font-size: 12px;
    font-weight: 700;
    color: rgb(245, 248, 255);
    white-space: nowrap;
  }

  .retro .summary {
    color: var(--accent);
  }

  .values {
    position: absolute;
    left: 0;
    right: 0;
    height: 14px;
    pointer-events: none;
    z-index: 1;
  }

  .value {
    position: absolute;
    transform: translateX(-50%);
    font-family: var(--display-font, monospace);
    font-size: 10px;
    font-weight: 600;
    color: rgb(120, 130, 145);
    white-space: nowrap;
  }

  .value.active {
    color: var(--accent-hi);
  }

  .modern .value.active {
    color: var(--accent);
  }
</style>
