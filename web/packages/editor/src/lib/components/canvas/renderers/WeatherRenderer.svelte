<script lang="ts">
  import * as mdiIcons from "@mdi/js";
  import type { WeatherComponent } from "@esphome-designer/schema";
  import Draggable from "../Draggable.svelte";
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

  const dimFill = "rgb(10, 14, 22)";
  const dimBorder = "rgb(25, 30, 40)";
  const textDim = "rgb(120, 128, 144)";
  const textWhite = "rgb(230, 240, 250)";
  const cornerSize = 9;

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

  function clippedPolygonPoints(w: number, h: number, c: number): string {
    return `${c},0 ${w - c},0 ${w},${c} ${w},${h - c} ${w - c},${h} ${c},${h} 0,${h - c} 0,${c}`;
  }

  function glowColor(cssColor: string): string {
    return cssColor.replace(
      /rgb\((\d+),\s*(\d+),\s*(\d+)\)/,
      (_, r, g, b) =>
        `rgb(${Math.floor(+r / 4)}, ${Math.floor(+g / 4)}, ${Math.floor(+b / 4)})`,
    );
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

    <div class="weather-wrap" style:width="100%" style:height="100%">
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 {w} {h}"
        preserveAspectRatio="none"
        style:position="absolute"
        style:inset="0"
        style:pointer-events="none"
      >
        <polygon
          points={clippedPolygonPoints(w + 6, h + 6, cornerSize + 3)}
          fill="none"
          stroke={glowColor(defaultConditionCss)}
          stroke-width="3"
          transform="translate(-3, -3)"
        />
        <polygon
          points={clippedPolygonPoints(w, h, cornerSize)}
          fill={dimFill}
          stroke={dimBorder}
          stroke-width="1.5"
        />
        <polygon
          points={clippedPolygonPoints(w - 6, h - 6, cornerSize - 3)}
          fill="none"
          stroke={dimBorder}
          stroke-width="0.75"
          transform="translate(3, 3)"
        />
      </svg>

      <div class="top-row">
        <span class="top-label" style:color={textDim}>{label}</span>
      </div>

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

        <div class="icon-area">
          {#if typeof icol === "string"}
            <svg viewBox="0 0 24 24" class="weather-icon" style:color={css}>
              <path d={icol} fill="currentColor" />
            </svg>
          {:else}
            <span class="icon-fallback" style:color={css}>?</span>
          {/if}
          <span class="temperature" style:color={textWhite}>21.4°</span>
        </div>

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
    </div>
  {/if}
</Draggable>

<style>
  .weather-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    min-width: 120px;
    min-height: 140px;
    overflow: hidden;
  }

  .top-row {
    position: absolute;
    top: 12px;
    left: 15px;
    right: 15px;
    display: flex;
    align-items: center;
    height: 18px;
  }

  .top-label {
    font-family: var(--display-font, monospace);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
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
