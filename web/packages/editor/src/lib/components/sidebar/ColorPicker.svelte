<script lang="ts">
  import { projectStore } from "$lib/stores/project.svelte";
  import type { Color } from "@esphome-designer/schema";

  let { value, onUpdate, label } = $props<{
    value: Color | undefined;
    onUpdate: (value: Color | undefined) => void;
    label?: string;
  }>();

  // Convert Color object to hex string for the input
  const hexValue = $derived.by(() => {
    if (!value) return "#000000";
    return `#${value.r.toString(16).padStart(2, "0")}${value.g.toString(16).padStart(2, "0")}${value.b.toString(16).padStart(2, "0")}`;
  });

  function fromHex(hex: string): Color {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
  }

  function handleInput(e: Event) {
    const hex = (e.target as HTMLInputElement).value;
    onUpdate(fromHex(hex));
  }

  function clear() {
    onUpdate(undefined);
  }

  const themeColors = $derived(projectStore.theme.colors);
</script>

<div class="color-picker-container">
  {#if label}
    <span class="label">{label}</span>
  {/if}
  <div class="picker-row">
    <div class="input-wrapper" class:is-custom={!!value}>
      <input
        type="color"
        value={hexValue}
        oninput={handleInput}
        title={value ? "Custom color set" : "Using theme default"}
      />
      {#if !value}
        <div class="default-indicator" title="Theme default">D</div>
      {/if}
    </div>
    
    <div class="presets">
      {#each Object.entries(themeColors) as [name, color]}
        <button
          class="preset-btn"
          style="background-color: rgb({color.r}, {color.g}, {color.b})"
          title={name}
          onclick={() => onUpdate(color)}
        ></button>
      {/each}
    </div>

    {#if value}
      <button class="clear-btn" onclick={clear} title="Reset to theme default">
        ×
      </button>
    {/if}
  </div>
</div>

<style>
  .color-picker-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    margin-bottom: var(--spacing-sm);
  }

  .label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .picker-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .input-wrapper {
    position: relative;
    width: 32px;
    height: 28px;
  }

  input[type="color"] {
    appearance: none;
    -webkit-appearance: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    width: 100%;
    height: 100%;
    padding: 0;
    cursor: pointer;
    background: var(--color-bg-tertiary);
  }

  input[type="color"]::-webkit-color-swatch-wrapper {
    padding: 2px;
  }

  input[type="color"]::-webkit-color-swatch {
    border: none;
    border-radius: 2px;
  }

  .is-custom input[type="color"] {
    border-color: var(--color-accent);
  }

  .default-indicator {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 10px;
    font-weight: bold;
    color: white;
    text-shadow: 0 0 2px black;
    pointer-events: none;
    opacity: 0.7;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
  }

  .preset-btn {
    width: 18px;
    height: 18px;
    border-radius: 2px;
    border: 1px solid var(--color-border);
    padding: 0;
    cursor: pointer;
  }

  .preset-btn:hover {
    transform: scale(1.1);
    border-color: var(--color-accent);
  }

  .clear-btn {
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    padding: 0;
  }

  .clear-btn:hover {
    color: var(--color-error);
    border-color: var(--color-error);
  }
</style>
