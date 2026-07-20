import type { Component, Project, WeatherComponent } from "@vesp-cloud/schema";

export const WEATHER_TODAY_HEIGHT = 200;
export const WEATHER_TODAY_MINI_HEIGHT = 110;
export const WEATHER_FORECAST_HEIGHT = 200;

export function weatherHeightForMode(
  mode: WeatherComponent["mode"] | undefined,
): number {
  if (mode === "today-mini") return WEATHER_TODAY_MINI_HEIGHT;
  return mode === "forecast" ? WEATHER_FORECAST_HEIGHT : WEATHER_TODAY_HEIGHT;
}

export function normalizeWeatherComponentHeights(component: Component): void {
  if (component.type === "weather" && component.size) {
    component.size = {
      ...component.size,
      height: weatherHeightForMode(component.mode),
    };
    return;
  }

  if (component.type === "conditional_area") {
    for (const variant of component.variants) {
      for (const child of variant.components) normalizeWeatherComponentHeights(child);
    }
  } else if (component.type === "tab_container") {
    for (const tab of component.tabs) {
      for (const child of tab.components) normalizeWeatherComponentHeights(child);
    }
  }
}

export function normalizeProjectWeatherHeights(project: Project): void {
  if (project.pageHeader) {
    for (const component of project.pageHeader.components) {
      normalizeWeatherComponentHeights(component);
    }
  }
  for (const page of project.dashboardPages) {
    for (const component of page.components) normalizeWeatherComponentHeights(component);
  }
  for (const view of project.detailViews) {
    for (const component of view.components) normalizeWeatherComponentHeights(component);
  }
}
