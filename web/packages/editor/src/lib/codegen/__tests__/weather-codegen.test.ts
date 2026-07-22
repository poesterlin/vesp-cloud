/// <reference types="bun" />
import { describe, test, expect } from "bun:test";
import { validateProject } from "../validations";
import { generateUIStateHeader } from "../ui-state";
import { generateUIScreensHeader } from "../ui-screens";
import { generateESPHomeYAML } from "../esphome-yaml";
import type { Project } from "@vesp-cloud/schema";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: "Weather Test",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
    ...overrides,
  };
}

describe("Weather validation", () => {
  test("passes when weather has entity binding", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "w1",
              type: "weather",
              position: { x: 10, y: 10 },
              size: { width: 225, height: 200 },
              stateBinding: { entityId: "weather.home" },
            },
          ],
        },
      ],
    });
    expect(validateProject(project)).toEqual([]);
  });

  test("fails when weather has no entity binding", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "w1",
              type: "weather",
              position: { x: 10, y: 10 },
              size: { width: 225, height: 200 },
            },
          ],
        },
      ],
    });
    const errors = validateProject(project);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.type).toBe("error");
  });
});

describe("Weather codegen - ui-state", () => {
  test("generates 5 Observable fields for weather forecast", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "w1",
              type: "weather",
              position: { x: 10, y: 10 },
              size: { width: 225, height: 200 },
              stateBinding: { entityId: "weather.home" },
            },
          ],
        },
      ],
    });
    const header = generateUIStateHeader(project);
    expect(header).toContain('Observable<std::string> weather_home_condition{""};');
    expect(header).toContain("weather_home_temperature");
    expect(header).toContain("weather_home_humidity");
    expect(header).toContain("weather_home_wind_speed");
    expect(header).toContain("weather_home_precipitation");
    expect(header).toContain('Observable<float> weather_home_temperature{0.0f};');
    expect(header).toContain('Observable<float> weather_home_humidity{0.0f};');
    // Should NOT contain the old attributes
    expect(header).not.toContain("weather_home_dew_point");
    expect(header).not.toContain("weather_home_cloud_coverage");
    expect(header).not.toContain("weather_home_wind_bearing");
    expect(header).not.toContain("weather_home_pressure");
    expect(header).not.toContain("weather_home_uv_index");
  });
});

describe("Weather codegen - ui-screens", () => {
  test("generates WeatherWidget with 5 pointers on dashboard page", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "w1",
              type: "weather",
              label: "Outside",
              position: { x: 10, y: 10 },
              size: { width: 225, height: 200 },
              stateBinding: { entityId: "weather.home" },
            },
          ],
        },
      ],
    });
    const header = generateUIScreensHeader(project);
    expect(header).toContain("WeatherWidget");
    expect(header).toContain("Outside");
    expect(header).toContain("state.weather_home_condition.ptr()");
    expect(header).toContain("state.weather_home_temperature.ptr()");
    expect(header).toContain("state.weather_home_humidity.ptr()");
    expect(header).toContain("state.weather_home_wind_speed.ptr()");
    expect(header).toContain("state.weather_home_precipitation.ptr()");
    expect(header).toContain('"weather.home"');
    expect(header).toContain("UiRect{10, 10, 225, 200}");
    expect(header).toContain("WeatherMode::Today");
  });

  test("generates the mini today mode with its fixed height", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "w1",
              type: "weather",
              mode: "today-mini",
              position: { x: 10, y: 10 },
              // Codegen owns the vertical height for fixed-height weather modes.
              size: { width: 225, height: 200 },
              stateBinding: { entityId: "weather.home" },
            },
          ],
        },
      ],
    });

    const header = generateUIScreensHeader(project);
    expect(header).toContain("UiRect{10, 10, 225, 110}");
    expect(header).toContain("WeatherMode::TodayMini");
    expect(header).toContain("state.weather_home_condition.ptr()");
    expect(header).not.toContain("weather_home_day1_condition.ptr()");
  });
});

describe("Weather codegen - esphome-yaml", () => {
  test("generates weather.get_forecasts interval instead of bind_ha_*", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "w1",
              type: "weather",
              label: "Outside",
              position: { x: 10, y: 10 },
              size: { width: 225, height: 200 },
              stateBinding: { entityId: "weather.home" },
            },
          ],
        },
      ],
    });
    const yaml = generateESPHomeYAML(project);
    // Service call
    expect(yaml).toContain("weather.get_forecasts");
    expect(yaml).toContain("type: hourly");
    expect(yaml).toContain("entity_id: \"weather.home\"");
    expect(yaml).toContain("capture_response: true");
    expect(yaml).toContain("on_success:");
    // Response JSON parsing with ArduinoJson 7.x API
    expect(yaml).toContain("is<JsonArrayConst>()");
    expect(yaml).toContain("\"condition\"].is<std::string>()");
    expect(yaml).toContain("weather_home_condition");
    expect(yaml).toContain("weather_home_temperature");
    expect(yaml).toContain("weather_home_humidity");
    expect(yaml).toContain("weather_home_wind_speed");
    expect(yaml).toContain("weather_home_precipitation");
    // Should NOT contain old bind_ha_* calls
    expect(yaml).not.toContain("bind_ha_string(\"weather.home\"");
    expect(yaml).not.toContain("bind_ha_float_attr(\"weather.home\"");
  });

  test("uses an ESPHome-safe script ID for today-mini mode", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "w1",
              type: "weather",
              mode: "today-mini",
              position: { x: 10, y: 10 },
              size: { width: 225, height: 110 },
              stateBinding: { entityId: "weather.home" },
            },
          ],
        },
      ],
    });

    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain("id: _weather_fetch_weather_home_today_mini");
    expect(yaml).toContain("script.execute: _weather_fetch_weather_home_today_mini");
    expect(yaml).not.toContain("_weather_fetch_weather_home_today-mini");
  });

  test("generates 3-day forecast parsing for forecast mode", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "w1",
              type: "weather",
              label: "Forecast",
              mode: "forecast",
              position: { x: 10, y: 10 },
              size: { width: 225, height: 200 },
              stateBinding: { entityId: "weather.home" },
            },
          ],
        },
      ],
    });
    const yaml = generateESPHomeYAML(project);
    // Service call
    expect(yaml).toContain("weather.get_forecasts");
    expect(yaml).toContain("type: daily");
    // Should parse 3 days
    expect(yaml).toContain("weather_home_day1_condition");
    expect(yaml).toContain("weather_home_day1_temperature");
    expect(yaml).toContain("weather_home_day2_condition");
    expect(yaml).toContain("weather_home_day2_temperature");
    expect(yaml).toContain("weather_home_day3_condition");
    expect(yaml).toContain("weather_home_day3_temperature");
    expect(yaml).toContain("weather_home_day3_precipitation");
    // Should use size guards for day2/day3
    expect(yaml).toContain("fc.size() >= 2");
    expect(yaml).toContain("fc.size() >= 3");
    // Should NOT contain old single-day fields
    expect(yaml).not.toContain("weather_home_condition.set");
    expect(yaml).not.toContain("weather_home_temperature.set");
  });
});

describe("Weather codegen - forecast mode state", () => {
  test("generates 15 Observable fields for forecast mode", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Home",
          components: [
            {
              id: "w1",
              type: "weather",
              mode: "forecast",
              position: { x: 10, y: 10 },
              size: { width: 225, height: 200 },
              stateBinding: { entityId: "weather.home" },
            },
          ],
        },
      ],
    });
    const header = generateUIStateHeader(project);
    expect(header).toContain("weather_home_day1_condition");
    expect(header).toContain("weather_home_day1_temperature");
    expect(header).toContain("weather_home_day1_humidity");
    expect(header).toContain("weather_home_day1_wind_speed");
    expect(header).toContain("weather_home_day1_precipitation");
    expect(header).toContain("weather_home_day2_condition");
    expect(header).toContain("weather_home_day2_temperature");
    expect(header).toContain("weather_home_day3_condition");
    expect(header).toContain("weather_home_day3_precipitation");
  });
});
