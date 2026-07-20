<script lang="ts">
  import * as mdiIcons from "@mdi/js";
  import type { WeatherComponent } from "@vesp-cloud/schema";
  import Draggable from "../Draggable.svelte";
  import { projectStore } from "$lib/stores/project.svelte";
  import { colorToCss } from "$lib/utils/color-utils";
  import {
    getWeatherConditionColor,
    getWeatherConditionIcon,
    colorToCss as conditionColorToCss,
  } from "$lib/utils/weather-conditions";

  interface Props {
    component: WeatherComponent;
  }

  let { component }: Props = $props();

  const label = $derived(component.label?.trim() || "Weather");
  const mode = $derived(component.mode ?? "today");
  const theme = $derived(projectStore.theme);
  const isRetro = $derived(theme.id === "retro");
  const accentColor = $derived(colorToCss(theme.colors.accent));
  const foregroundColor = $derived(colorToCss(theme.colors.foreground));

  const textDim = "rgb(120, 128, 144)";
  const textWhite = "rgb(230, 240, 250)";

  function iconKey(name: string): string {
    return "mdi" +
      name
        .split(/[-_]/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join("");
  }

  function iconPath(name: string): unknown {
    return (mdiIcons as Record<string, unknown>)[iconKey(name)];
  }

  function clippedPolygonPoints(
    width: number,
    height: number,
    corner: number,
    inset: number,
  ): string {
    return `${corner},${inset} ${width - corner},${inset} ${width - inset},${corner} ${width - inset},${height - corner} ${width - corner},${height - inset} ${corner},${height - inset} ${inset},${height - corner} ${inset},${corner}`;
  }

  const defaultCondition = "partlycloudy";
  const defaultConditionCss = $derived(
    conditionColorToCss(getWeatherConditionColor(defaultCondition)),
  );

  const dayConditionCss = $derived((dayIndex: number) => {
    // In forecast mode, cycle through conditions for demo
    const demoConditions = ["sunny", "rainy", "partlycloudy"];
    const cond = dayIndex < 3 ? demoConditions[dayIndex] : defaultCondition;
    return conditionColorToCss(getWeatherConditionColor(cond));
  });

  const dayConditionIcon = $derived((dayIndex: number) => {
    const demoConditions = ["sunny", "rainy", "partlycloudy"];
    const cond = dayIndex < 3 ? demoConditions[dayIndex] : defaultCondition;
    return getWeatherConditionIcon(cond);
  });

</script>

<Draggable {component} widthOnly>
  {#if component.size}
    {@const w = component.size.width}
    {@const h = component.size.height}

    <div
      class="weather-wrap"
      class:retro={isRetro}
      class:mini-mode={mode === "today-mini"}
      style:width="100%"
      style:height="100%"
      style:--weather-accent={accentColor}
      style:--weather-foreground={foregroundColor}
    >
      {#if isRetro}
        <svg
          class="retro-frame"
          width="100%"
          height="100%"
          viewBox="0 0 {w} {h}"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            points={clippedPolygonPoints(w, h, 8, 0.5)}
            fill="#0c1320"
            stroke={accentColor}
            stroke-width="1"
          />
          <polygon
            points={clippedPolygonPoints(w, h, 8, 2.5)}
            fill="none"
            stroke="rgba(255, 255, 255, 0.06)"
            stroke-width="1"
          />
        </svg>
      {:else}
        <div class="frame"></div>
      {/if}

      <div class="top-row">
        <span class="top-label">{label}</span>
      </div>
      <div class="header-rule"><span></span></div>

      {#if mode === "forecast"}
        <div class="forecast-columns">
          {#each [0, 1, 2] as dayIndex}
            {@const dayLabels = ["MON", "TUE", "WED"]}
            {@const icons = [
              getWeatherConditionIcon("sunny"),
              getWeatherConditionIcon("rainy"),
              getWeatherConditionIcon("partlycloudy"),
            ]}
            {@const temps = ["22.1°", "18.6°", "14.9°"]}
            {@const rains = ["0.0 mm", "3.2 mm", "12.1 mm"]}
            {@const conds = ["sunny", "rainy", "partlycloudy"]}
            {@const icol = iconPath(icons[dayIndex])}
            {@const css = conditionColorToCss(getWeatherConditionColor(conds[dayIndex]))}

            <div class="day-col">
              <span class="col-day-label" style:color={textDim}>{dayLabels[dayIndex]}</span>
              {#if typeof icol === "string"}
                <svg viewBox="0 0 24 24" class="col-icon" style:color={css}>
                  <path d={icol} fill="currentColor" />
                </svg>
              {:else}
                <span class="col-icon-fallback" style:color={css}>?</span>
              {/if}
              <span class="col-temp" style:color={textWhite}>{temps[dayIndex]}</span>
              <div class="col-rain">
                <span class="col-rain-label" style:color={textDim}>RAIN</span>
                <span class="col-rain-val" style:color={textWhite}>{rains[dayIndex]}</span>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <!-- Today mode -->
        {@const iconName = getWeatherConditionIcon("partlycloudy")}
        {@const ikey = iconKey(iconName)}
        {@const icol = (mdiIcons as Record<string, unknown>)[ikey]}
        {@const css = defaultConditionCss}

        <div class="icon-area" class:mini={mode === "today-mini"}>
          {#if typeof icol === "string"}
            <svg viewBox="0 0 24 24" class="weather-icon" style:color={css}>
              <path d={icol} fill="currentColor" />
            </svg>
          {:else}
            <span class="icon-fallback" style:color={css}>?</span>
          {/if}
          <span class="temperature" style:color={textWhite}>21.4°</span>
        </div>

        {#if mode === "today"}
          <div class="bottom-row">
            <div class="attr">
              <span class="attr-label" style:color={textDim}>Humidity</span>
              <span class="attr-value" style:color={textWhite}>62%</span>
            </div>
            <div class="attr">
              <span class="attr-label" style:color={textDim}>Rain</span>
              <span class="attr-value" style:color={textWhite}>0.4 mm</span>
            </div>
            <div class="attr">
              <span class="attr-label" style:color={textDim}>Wind</span>
              <span class="attr-value" style:color={textWhite}>3.6 m/s</span>
            </div>
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</Draggable>

<style>
  .weather-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 120px;
    min-height: 200px;
    overflow: hidden;
    box-sizing: border-box;
    color: var(--weather-accent);
    background: #0c1320;
    border: 1px solid var(--weather-accent);
    border-radius: 9px;
    box-shadow:
      inset 0 0 0 1px rgba(0, 0, 0, 0.45),
      0 0 0 1px color-mix(in srgb, var(--weather-accent) 15%, transparent);
  }

  .weather-wrap.mini-mode {
    min-height: 110px;
  }

  .weather-wrap.retro {
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
  }

  .retro-frame {
    position: absolute;
    inset: 0;
    pointer-events: none;
    z-index: 0;
  }

  .frame {
    position: absolute;
    inset: 2px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 7px;
    pointer-events: none;
    z-index: 2;
  }

  .top-row {
    position: absolute;
    top: 0;
    left: 11px;
    right: 11px;
    display: flex;
    align-items: center;
    height: 30px;
  }

  .top-label {
    color: var(--weather-foreground);
    font-family: var(--display-font, monospace);
    font-size: var(--display-text-small, 16px);
    font-weight: 400;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }

  .header-rule {
    position: absolute;
    top: 29px;
    left: 10px;
    right: 10px;
    height: 1px;
    background: rgba(120, 128, 144, 0.22);
  }

  .header-rule span {
    display: block;
    width: min(38px, 22%);
    height: 1px;
    background: var(--weather-accent);
    box-shadow: 0 0 4px color-mix(in srgb, var(--weather-accent) 45%, transparent);
  }

  /* Today mode */
  .icon-area {
    position: absolute;
    top: 36px;
    bottom: 54px;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .icon-area.mini {
    top: 34px;
    bottom: 8px;
    flex-direction: row;
    gap: 14px;
  }

  .weather-icon {
    width: 52px;
    height: 52px;
    flex-shrink: 0;
  }

  .icon-fallback {
    font-family: var(--display-font, monospace);
    font-size: 36px;
    font-weight: 700;
    line-height: 1;
  }

  .temperature {
    font-family: var(--display-font, monospace);
    font-size: 28px;
    font-weight: 700;
    line-height: 1;
    margin-top: 2px;
  }

  .bottom-row {
    position: absolute;
    bottom: 9px;
    left: 0;
    right: 0;
    display: flex;
    gap: 4px;
    padding: 0 9px;
    height: 42px;
  }

  .attr {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    background: rgb(18, 22, 32);
    border: 0.75px solid rgb(35, 40, 55);
    border-radius: 4px;
    min-width: 0;
  }

  .attr-label {
    font-family: var(--display-font, monospace);
    font-size: 9px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1;
  }

  .attr-value {
    font-family: var(--display-font, monospace);
    font-size: 12px;
    font-weight: 600;
    line-height: 1;
  }

  .retro .attr {
    border-radius: 0;
    clip-path: polygon(4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px), 0 4px);
  }

  /* Forecast mode */
  .forecast-columns {
    position: absolute;
    top: 36px;
    bottom: 9px;
    left: 0;
    right: 0;
    display: flex;
    gap: 4px;
    padding: 0 9px;
  }

  .day-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    min-width: 0;
    background: rgb(14, 18, 28);
    border: 0.75px solid rgb(30, 35, 50);
    border-radius: 6px;
    padding: 6px 4px;
    justify-content: space-between;
  }

  .retro .forecast-columns {
    top: 42px;
  }

  .retro .day-col {
    justify-content: flex-start;
    gap: 0;
    padding: 0 4px;
    background: transparent;
    border: 0;
    border-radius: 0;
  }

  .retro .col-day-label {
    font-size: var(--display-text-small, 16px);
    font-weight: 400;
  }

  .retro .col-icon {
    width: 48px;
    height: 48px;
    margin-top: 8px;
  }

  .retro .col-temp {
    margin-top: 6px;
    font-size: var(--display-text-small, 16px);
    font-weight: 400;
  }

  .retro .col-rain {
    margin-top: 12px;
  }

  .retro .col-rain-label,
  .retro .col-rain-val {
    font-size: var(--display-text-small, 16px);
    font-weight: 400;
  }

  .col-day-label {
    font-family: var(--display-font, monospace);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    line-height: 1;
    white-space: nowrap;
  }

  .col-icon {
    width: 30px;
    height: 30px;
    flex-shrink: 0;
  }

  .col-icon-fallback {
    font-family: var(--display-font, monospace);
    font-size: 22px;
    font-weight: 700;
    line-height: 1;
  }

  .col-temp {
    font-family: var(--display-font, monospace);
    font-size: 14px;
    font-weight: 700;
    line-height: 1;
  }

  .col-rain {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0;
    line-height: 1;
  }

  .col-rain-label {
    font-family: var(--display-font, monospace);
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    line-height: 1;
  }

  .col-rain-val {
    font-family: var(--display-font, monospace);
    font-size: 11px;
    font-weight: 600;
    line-height: 1;
  }
</style>
