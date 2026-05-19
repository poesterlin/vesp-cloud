/// <reference types="bun" />
/**
 * Tests for the MDI icon font codegen pipeline.
 */
import { describe, test, expect } from "bun:test";
import type { Project } from "@esphome-designer/schema";
import { collectProjectIconNames, normalizeIconName } from "../utils";
import {
  generateFontsYAML,
  getMdiUtf8CEscape,
  getMdiCodepoint,
  ICON_FONT_ID,
} from "../mdi-icons";
import { generateUIScreensHeader } from "../ui-screens";
import { generateESPHomeYAML } from "../esphome-yaml";

const BASE_FONTS_YAML = `font:
  - file: "gfonts://Share Tech Mono"
    id: font_tiny
    size: 12
    glyphs: 'ABC'
`;

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: "Test",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
    ...overrides,
  };
}

describe("normalizeIconName", () => {
  test("strips mdi: prefix and trims whitespace", () => {
    expect(normalizeIconName("mdi:lightbulb")).toBe("lightbulb");
    expect(normalizeIconName("  home  ")).toBe("home");
    expect(normalizeIconName(undefined)).toBe("");
    expect(normalizeIconName(null)).toBe("");
    expect(normalizeIconName("")).toBe("");
  });
});

describe("collectProjectIconNames", () => {
  test("collects icons from icon, button, and auto_layout_list components", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page 1",
          components: [
            {
              id: "i1",
              type: "icon",
              position: { x: 0, y: 0 },
              size: { width: 32, height: 32 },
              icon: "mdi:lightbulb",
            },
            {
              id: "b1",
              type: "button",
              position: { x: 0, y: 50 },
              size: { width: 80, height: 36 },
              icon: "home",
            },
            {
              id: "list",
              type: "auto_layout_list",
              position: { x: 0, y: 100 },
              size: { width: 200, height: 60 },
              items: [
                { id: "i", name: "Item", icon: "mdi:thermometer" },
                { id: "i2", name: "Item2", icon: "fan" },
              ],
            },
          ],
        },
      ],
    });

    const icons = collectProjectIconNames(project);
    expect(icons).toEqual(new Set(["lightbulb", "home", "thermometer", "fan"]));
  });

  test("traverses nested conditional and tab containers", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page 1",
          components: [
            {
              id: "ca",
              type: "conditional_area",
              position: { x: 0, y: 0 },
              variants: [
                {
                  id: "v1",
                  name: "On",
                  components: [
                    {
                      id: "ic",
                      type: "icon",
                      position: { x: 0, y: 0 },
                      size: { width: 32, height: 32 },
                      icon: "mdi:power",
                    },
                  ],
                },
              ],
            },
            {
              id: "tc",
              type: "tab_container",
              position: { x: 0, y: 100 },
              tabs: [
                {
                  id: "t1",
                  name: "Tab",
                  components: [
                    {
                      id: "ic2",
                      type: "icon",
                      position: { x: 0, y: 0 },
                      size: { width: 32, height: 32 },
                      icon: "wifi",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(collectProjectIconNames(project)).toEqual(new Set(["power", "wifi"]));
  });

  test("includes icons from detail views and page header", () => {
    const project = makeProject({
      detailViews: [
        {
          id: "DET",
          title: "Detail",
          height: 640,
          components: [
            {
              id: "i1",
              type: "icon",
              position: { x: 0, y: 0 },
              size: { width: 32, height: 32 },
              icon: "calendar",
            },
          ],
        },
      ],
      pageHeader: {
        height: 40,
        components: [
          {
            id: "h1",
            type: "icon",
            position: { x: 0, y: 0 },
            size: { width: 24, height: 24 },
            icon: "mdi:clock",
          },
        ],
      },
    });

    expect(collectProjectIconNames(project)).toEqual(new Set(["calendar", "clock"]));
  });

  test("deduplicates the same icon used multiple times", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "i1",
              type: "icon",
              position: { x: 0, y: 0 },
              size: { width: 32, height: 32 },
              icon: "mdi:lightbulb",
            },
            {
              id: "i2",
              type: "icon",
              position: { x: 0, y: 0 },
              size: { width: 32, height: 32 },
              icon: "lightbulb",
            },
          ],
        },
      ],
    });
    expect(collectProjectIconNames(project)).toEqual(new Set(["lightbulb"]));
  });
});

describe("getMdiCodepoint / getMdiUtf8CEscape", () => {
  test("known icon yields YAML escape and C UTF-8 bytes", () => {
    expect(getMdiCodepoint("mdi:lightbulb")).toBe("\\U000F0335");
    expect(getMdiCodepoint("lightbulb")).toBe("\\U000F0335");
    // F0335 in UTF-8: F3 B0 8C B5
    expect(getMdiUtf8CEscape("lightbulb")).toBe("\\xF3\\xB0\\x8C\\xB5");
  });

  test("covers icons outside the legacy curated subset", () => {
    // `flashlight` was not in the original hand-curated map but is in the
    // full Pictogrammers codepoint table.
    expect(getMdiCodepoint("flashlight")).toBe("\\U000F0244");
    expect(getMdiUtf8CEscape("flashlight")).not.toBeNull();
  });

  test("unknown icon returns null", () => {
    expect(getMdiCodepoint("not-a-real-icon")).toBeNull();
    expect(getMdiUtf8CEscape("not-a-real-icon")).toBeNull();
  });
});

describe("generateFontsYAML", () => {
  test("returns base unchanged when no icons are used", () => {
    const project = makeProject();
    expect(generateFontsYAML(project, BASE_FONTS_YAML)).toBe(BASE_FONTS_YAML);
  });

  test("appends MDI icon font block with referenced glyphs", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "ic",
              type: "icon",
              position: { x: 0, y: 0 },
              size: { width: 32, height: 32 },
              icon: "mdi:lightbulb",
            },
          ],
        },
      ],
    });

    const out = generateFontsYAML(project, BASE_FONTS_YAML);
    expect(out).toContain("font_tiny");
    expect(out).toContain(`id: ${ICON_FONT_ID}`);
    expect(out).toContain("materialdesignicons-webfont.ttf");
    expect(out).toContain("\\U000F0335");
  });

  test("silently skips unknown icons in glyph list", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "ic",
              type: "icon",
              position: { x: 0, y: 0 },
              size: { width: 32, height: 32 },
              icon: "not-a-real-icon",
            },
          ],
        },
      ],
    });
    expect(generateFontsYAML(project, BASE_FONTS_YAML)).toBe(BASE_FONTS_YAML);
  });
});

describe("generateUIScreensHeader icon emission", () => {
  test("emits IconWidget for icon components", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "ic1",
              type: "icon",
              position: { x: 10, y: 20 },
              size: { width: 32, height: 32 },
              icon: "mdi:lightbulb",
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).toContain("emplace_widget<IconWidget>");
    expect(out).toContain("g_theme.icon");
    expect(out).toContain("\\xF3\\xB0\\x8C\\xB5");
    expect(out).not.toContain("// TODO: component type 'icon'");
  });

  test("emits set_icon for button components with icons", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "b1",
              type: "button",
              position: { x: 0, y: 0 },
              size: { width: 80, height: 36 },
              label: "Toggle",
              icon: "mdi:lightbulb",
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).toContain("emplace_widget<ButtonWidget>");
    expect(out).toContain("->set_icon(\"\\xF3\\xB0\\x8C\\xB5\", &g_theme.icon)");
  });

  test("emits set_icon for button components inside tab containers", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "tc1",
              type: "tab_container",
              position: { x: 0, y: 0 },
              size: { width: 426, height: 306 },
              tabs: [
                {
                  id: "t1",
                  name: "Tab 1",
                  components: [
                    {
                      id: "btn1",
                      type: "button",
                      position: { x: 10, y: 10 },
                      size: { width: 148, height: 55 },
                      label: "Button",
                      icon: "flashlight",
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).toContain("emplace_child<ButtonWidget>");
    expect(out).toContain("set_icon(");
  });

  test("buttons without icons emit no set_icon call", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "b1",
              type: "button",
              position: { x: 0, y: 0 },
              size: { width: 80, height: 36 },
              label: "Toggle",
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).not.toContain("set_icon");
  });

  test("unknown icon yields a skip comment and no widget", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "ic1",
              type: "icon",
              position: { x: 0, y: 0 },
              size: { width: 32, height: 32 },
              icon: "not-a-real-icon",
            },
          ],
        },
      ],
    });
    const out = generateUIScreensHeader(project);
    expect(out).toContain("Unknown icon 'not-a-real-icon'");
    expect(out).not.toContain("emplace_widget<IconWidget>");
  });
});

describe("generateESPHomeYAML icon font assignment", () => {
  test("assigns icon font in on_boot when icons are present", () => {
    const project = makeProject({
      dashboardPages: [
        {
          id: "p1",
          name: "Page",
          components: [
            {
              id: "ic",
              type: "icon",
              position: { x: 0, y: 0 },
              size: { width: 32, height: 32 },
              icon: "home",
            },
          ],
        },
      ],
    });
    const yaml = generateESPHomeYAML(project);
    expect(yaml).toContain(`g_theme.icon.font = id(${ICON_FONT_ID})`);
  });

  test("omits icon font assignment when no icons are used", () => {
    const project = makeProject();
    const yaml = generateESPHomeYAML(project);
    expect(yaml).not.toContain("g_theme.icon.font");
  });
});
