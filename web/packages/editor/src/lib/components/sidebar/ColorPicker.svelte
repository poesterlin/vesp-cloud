<script lang="ts">
  import type { Color } from "@vesp-cloud/schema";

  let { value, defaultValue, onUpdate, label } = $props<{
    value: Color | undefined;
    defaultValue?: Color;
    onUpdate: (value: Color | undefined) => void;
    label?: string;
  }>();

  const MERGED_PALETTE = [
    { name: "Ink Black", hex: "#001219" },
    { name: "Charcoal", hex: "#20232a" },
    { name: "Midnight Navy", hex: "#0b132b" },
    { name: "Deep Slate", hex: "#293b47" },
    { name: "Deep Cerulean", hex: "#164e63" },
    { name: "Deep Teal", hex: "#003b46" },
    { name: "Deep Seaweed", hex: "#24594a" },
    { name: "Blue Slate", hex: "#577590" },
    { name: "Cerulean", hex: "#277da1" },
    { name: "Dark Teal", hex: "#005f73" },
    { name: "Dark Cyan", hex: "#0a9396" },
    { name: "Seaweed", hex: "#43aa8b" },
    { name: "Willow Green", hex: "#90be6d" },
    { name: "Pearl Aqua", hex: "#94d2bd" },
    { name: "Wheat", hex: "#e9d8a6" },
    { name: "Tuscan Sun", hex: "#f9c74f" },
    { name: "Golden Orange", hex: "#ee9b00" },
    { name: "Pumpkin Spice", hex: "#f3722c" },
    { name: "Atomic Tangerine", hex: "#f9844a" },
    { name: "Burnt Caramel", hex: "#ca6702" },
    { name: "Rusty Spice", hex: "#bb3e03" },
    { name: "Oxidized Iron", hex: "#ae2012" },
    { name: "Brown Red", hex: "#9b2226" },
    { name: "Strawberry Red", hex: "#f94144" },
  ] as const;

  function colorToHex(c: Color): string {
    const r = c.r.toString(16).padStart(2, "0");
    const g = c.g.toString(16).padStart(2, "0");
    const b = c.b.toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }

  function hexToColor(hex: string): Color | null {
    const v = hex.replace(/^#/, "").trim();
    if (!/^[0-9a-fA-F]{6}$/.test(v)) return null;
    return {
      r: parseInt(v.slice(0, 2), 16),
      g: parseInt(v.slice(2, 4), 16),
      b: parseInt(v.slice(4, 6), 16),
    };
  }

  const displayHex = $derived(
    value ? colorToHex(value) : defaultValue ? colorToHex(defaultValue) : "inherit",
  );


  function handleColorInput(e: Event) {
    const hex = (e.target as HTMLInputElement).value;
    const c = hexToColor(hex);
    if (c) onUpdate(c);
  }

  function clear() {
    onUpdate(undefined);
  }

  function colorsEqual(a: Color, b: Color): boolean {
    return a.r === b.r && a.g === b.g && a.b === b.b;
  }

  const colorPresets = MERGED_PALETTE.map((p) => ({
    name: p.name,
    color: hexToColor(p.hex)!,
  }));

  const activePresetIndex = $derived.by(() => {
    if (!value) return -1;
    return colorPresets.findIndex((p) => colorsEqual(p.color, value));
  });
</script>

<div class="color-picker-container">
  {#if label}
    <span class="label">{label}</span>
  {/if}
  <div class="picker-row">
    <div class="input-wrapper" class:is-custom={!!value}>
      {#if value}
        <div class="color-preview" style:background-color={displayHex}></div>
      {:else}
        <div
          class="color-preview default-state"
          style:background-color={displayHex}
          title="Using theme default"
        ></div>
      {/if}
      <input
        type="color"
        value={displayHex === "inherit" ? "#000000" : displayHex}
        oninput={handleColorInput}
        title={value ? "Custom color" : "Theme default"}
      />
    </div>

    <div class="presets">
      {#each colorPresets as preset, i}
        <button
          class="preset-btn"
          class:active={i === activePresetIndex}
          style:background-color={colorToHex(preset.color)}
          title={preset.name}
          onclick={() => onUpdate(preset.color)}
        ></button>
      {/each}
    </div>

    <button
      class="clear-btn"
      class:hidden={!value}
      onclick={clear}
      disabled={!value}
      title="Reset to theme default"
    >
      &times;
    </button>
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
    gap: 6px;
  }

  .input-wrapper {
    position: relative;
    width: 38px;
    height: 32px;
    flex-shrink: 0;
  }

  .input-wrapper input[type="color"] {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
    width: 100%;
    height: 100%;
    padding: 0;
    border: none;
  }

  .color-preview {
    width: 100%;
    height: 100%;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    pointer-events: none;
  }

  .is-custom .color-preview {
    border-color: var(--color-accent);
  }

  .default-state {
    background-image: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 3px,
      rgba(255, 255, 255, 0.06) 3px,
      rgba(255, 255, 255, 0.06) 6px
    );
    opacity: 0.7;
  }

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    flex: 1;
  }

  .preset-btn {
    width: 22px;
    height: 22px;
    border-radius: 3px;
    border: 1px solid var(--color-border);
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
    transition: transform 0.1s, border-color 0.1s, box-shadow 0.1s;
  }

  .preset-btn:hover {
    transform: scale(1.15);
    border-color: var(--color-accent);
  }

  .preset-btn.active {
    transform: scale(1.18);
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-bg-primary), 0 0 0 3px var(--color-accent);
    z-index: 1;
  }

  .hex-input {
    width: 68px;
    height: 28px;
    padding: 2px 6px;
    font-size: 11px;
    font-family: monospace;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    flex-shrink: 0;
  }

  .hex-input::placeholder {
    color: var(--color-text-muted);
    opacity: 0.5;
  }

  .hex-input:focus {
    border-color: var(--color-accent);
    outline: none;
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
    flex-shrink: 0;
    transition: opacity 0.15s;
  }

  .clear-btn.hidden {
    opacity: 0;
    pointer-events: none;
  }

  .clear-btn:not(.hidden):hover {
    color: var(--color-error);
    border-color: var(--color-error);
  }
</style>
