<script lang="ts">
  import type { ButtonComponent } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "../../../stores/project.svelte";
  import { colorToCss } from "../../../utils/color-utils";
  import * as mdiIcons from "@mdi/js";

  interface Props {
    component: ButtonComponent;
  }

  let { component }: Props = $props();
  const theme = $derived(projectStore.theme);

  const bgColor = $derived(
    colorToCss(
      component.backgroundColor,
      colorToCss(theme.colors.backgroundSecondary),
    ),
  );
  const accentColor = $derived(
    colorToCss(component.borderColor, colorToCss(theme.colors.accent)),
  );
  const foregroundColor = $derived(
    colorToCss(component.foregroundColor, colorToCss(theme.colors.foreground)),
  );
  const shadowColor = $derived(colorToCss(theme.colors.background, "black"));

  // Retro style constants
  const shadowOffset = $derived(theme.values?.shadowOffset ?? 3);
  const cornerSize = $derived(theme.values?.cornerSize ?? 10);

  // Get MDI icon path
  const iconPath = $derived.by(() => {
    if (!component.icon) return null;

    // Remove mdi: prefix if present
    const iconName = component.icon.replace(/^mdi:/, "");

    // Convert icon name to @mdi/js format (e.g., "home" -> "mdiHome", "lightbulb-outline" -> "mdiLightbulbOutline")
    const iconKey =
      "mdi" +
      iconName
        .split(/[-_]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");

    const path = (mdiIcons as Record<string, unknown>)[iconKey];
    return typeof path === "string" ? path : null;
  });

  // Layout calculations for icon and label
  const iconSize = 20;
  const hasIcon = $derived(iconPath !== null);
  const hasLabel = $derived(
    component.label !== undefined && component.label.length > 0,
  );
  const buttonWidth = $derived(
    (component.size?.width ?? 100) -
      (theme.style?.buttonShadow ? shadowOffset : 0),
  );
  const buttonHeight = $derived(
    (component.size?.height ?? 40) -
      (theme.style?.buttonShadow ? shadowOffset : 0),
  );

  // Choose icon-next-to-label when the button is narrow/short; stack
  // vertically only when there is clearly room for two legible lines.
  // The width estimate mirrors what the device-side ButtonWidget does
  // (icon width + gap + truncated label fits in the inner width), using
  // ~7px per character for the monospace label as a coarse proxy.
  const horizontalLayout = $derived.by(() => {
    if (!hasIcon || !hasLabel) return false;
    if (buttonHeight >= 56) return false; // tall enough to comfortably stack
    const sidePad = 8;
    const gap = 6;
    const horizBudget = buttonWidth - 2 * sidePad - iconSize - gap;
    // Need room for at least ~3 chars + ellipsis ("W..." ≈ 28px).
    return horizBudget >= 28;
  });
</script>

<Draggable {component}>
  {#if component.size}
    {@const width = component.size.width}
    {@const height = component.size.height}
    {@const innerW = width - (theme.style?.buttonShadow ? shadowOffset : 0)}
    {@const innerH = height - (theme.style?.buttonShadow ? shadowOffset : 0)}
    <div class="button-wrapper" style:width="100%" style:height="100%">
      <svg
        class="button-bg"
        width="100%"
        height="100%"
        viewBox="0 0 {width} {height}"
        preserveAspectRatio="none"
      >
        <rect
          x="0"
          y="0"
          width={innerW}
          height={innerH}
          fill={bgColor}
          stroke={accentColor}
          stroke-width="1"
        />
      </svg>

      <div
        class="button-content"
        class:horizontal={horizontalLayout}
        style:width="{(innerW / width) * 100}%"
        style:height="{(innerH / height) * 100}%"
        style:color={foregroundColor}
      >
        {#if hasIcon && iconPath}
          <svg
            class="button-icon"
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
          >
            <path d={iconPath} fill="currentColor" />
          </svg>
        {/if}
        {#if hasLabel}
          <span
            class="button-label"
            class:with-icon={hasIcon}
            class:inline={horizontalLayout}
            title={component.label}
          >
            {component.label}
          </span>
        {/if}
      </div>
    </div>
  {/if}
</Draggable>

<style>
  .button-wrapper {
    position: relative;
    overflow: hidden;
  }

  .button-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .button-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 4px 6px;
    box-sizing: border-box;
    min-width: 0;
    overflow: hidden;
    pointer-events: none;
  }

  .button-content.horizontal {
    flex-direction: row;
    gap: 6px;
    padding: 4px 8px;
  }

  .button-icon {
    flex: 0 0 auto;
  }

  .button-label {
    max-width: 100%;
    min-width: 0;
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 18px);
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .button-label.with-icon {
    font-size: var(--display-text-tiny, 14px);
  }

  /* When laid out side-by-side, the label can use the normal size --
     we are no longer trying to fit two lines in the same vertical
     space, so it should match an icon-less button's text. */
  .button-label.inline {
    flex: 1 1 auto;
    text-align: left;
    font-size: var(--display-text-small, 18px);
  }
</style>
