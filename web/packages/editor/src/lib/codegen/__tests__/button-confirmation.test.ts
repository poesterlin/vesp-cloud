import { describe, expect, test } from "bun:test";
import type { Project } from "@vesp-cloud/schema";
import { generateESPHomeYAML } from "../esphome-yaml";
import { generateUIScreensHeader } from "../ui-screens";

function project(confirmBeforeAction?: boolean): Project {
  return {
    name: "Confirmation test",
    display: { width: 480, height: 480 },
    dashboardPages: [{
      id: "home",
      name: "Home",
      components: [{
        id: "danger-button",
        type: "button",
        position: { x: 20, y: 20 },
        size: { width: 120, height: 44 },
        label: "Turn off",
        confirmBeforeAction,
        onTap: { type: "SERVICE_CALL", service: "homeassistant.turn_off" },
      }],
    }],
    detailViews: [],
  };
}

describe("button action confirmation", () => {
  test("enables confirmation and wires the modal above screen content", () => {
    const output = generateUIScreensHeader(project(true));
    expect(output).toContain("danger_button->set_confirm_before_action(true);");
    expect(output).toContain("if (g_confirmation_popup.visible())");
    expect(output).toContain("g_confirmation_popup.draw(it)");
  });

  test("leaves confirmation disabled by default", () => {
    expect(generateUIScreensHeader(project())).not.toContain("set_confirm_before_action");
  });

  test("includes the confirmation popup firmware header", () => {
    expect(generateESPHomeYAML(project(true))).toContain("includes/ui_confirmation_popup.h");
  });
});
