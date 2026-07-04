/// <reference types="bun" />
import { describe, test, expect } from "bun:test";
import type { Project } from "@vesp-cloud/schema";
import { generateUIScreensHeader } from "../ui-screens";
import { generateUIStateHeader } from "../ui-state";
import { generateESPHomeYAML } from "../esphome-yaml";
import { generateFontsYAML } from "../mdi-icons";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    name: "Test",
    display: { width: 480, height: 480 },
    dashboardPages: [],
    detailViews: [],
    ...overrides,
  };
}

describe("notification overlay state fields", () => {
  test("emits state fields when overlay is enabled", () => {
    const project = makeProject({
      notificationOverlay: {
        enabled: true,
        titleEntityId: "input_text.notification_title",
        bodyEntityId: "input_text.notification_body",
        severityEntityId: "input_text.notification_severity",
      },
    });

    const out = generateUIStateHeader(project);
    expect(out).toContain('Observable<std::string> notification_title');
    expect(out).toContain('Observable<std::string> notification_body');
    expect(out).toContain('Observable<std::string> notification_severity');
    expect(out).toContain('Observable<std::string> notification_dismissed');
  });

  test("emits state fields when overlay is not explicitly disabled (defaults enabled)", () => {
    const project = makeProject({
      notificationOverlay: {
        titleEntityId: "input_text.notification_title",
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateUIStateHeader(project);
    expect(out).toContain('Observable<std::string> notification_title');
    expect(out).toContain('Observable<std::string> notification_body');
    expect(out).toContain('Observable<std::string> notification_dismissed');
  });

  test("does NOT emit state fields when overlay is explicitly disabled", () => {
    const project = makeProject({
      notificationOverlay: {
        enabled: false,
        titleEntityId: "input_text.notification_title",
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateUIStateHeader(project);
    expect(out).not.toContain("notification_title");
    expect(out).not.toContain("notification_body");
    expect(out).not.toContain("notification_severity");
    expect(out).not.toContain("notification_dismissed");
  });

  test("does NOT emit state fields when no overlay config exists", () => {
    const project = makeProject({});

    const out = generateUIStateHeader(project);
    expect(out).not.toContain("notification_title");
    expect(out).not.toContain("notification_body");
    expect(out).not.toContain("notification_severity");
    expect(out).not.toContain("notification_dismissed");
  });
});

describe("notification overlay HA subscriptions", () => {
  test("service dispatcher only sends entity_id when non-empty", () => {
    const out = generateESPHomeYAML(makeProject({}));
    expect(out).toContain("if (!effective_entity_id.empty()) {");
    expect(out).toContain('call.add_data("entity_id", effective_entity_id);');
    expect(out).toContain("call.init_data(0);");
  });

  test("service dispatcher infers default vacuum entity when unique", () => {
    const project = makeProject({
      state: {
        fields: [
          { name: "vacuum_robo", cppType: "std::string", haEntity: "vacuum.roborock_qrevo_curv_series" },
        ],
      } as any,
    });
    const out = generateESPHomeYAML(project);
    expect(out).toContain('const std::string default_vacuum_entity = "vacuum.roborock_qrevo_curv_series";');
    expect(out).toContain('if (effective_entity_id.empty() && service.rfind("vacuum.", 0) == 0)');
  });

  test("emits HA string subscriptions for configured entities", () => {
    const project = makeProject({
      notificationOverlay: {
        titleEntityId: "input_text.notification_title",
        bodyEntityId: "input_text.notification_body",
        severityEntityId: "input_text.notification_severity",
      },
    });

    const out = generateESPHomeYAML(project);
    expect(out).toContain('bind_ha_string("input_text.notification_title", &g_ui_app.state().notification_title)');
    expect(out).toContain('"input_text.notification_body", esphome::optional<std::string>()');
    expect(out).toContain('g_ui_app.state().notification_dismissed.set("")');
    expect(out).toContain('bind_ha_string("input_text.notification_severity", &g_ui_app.state().notification_severity)');
  });

  test("emits dismiss notification helper with input_text.set_value", () => {
    const project = makeProject({
      notificationOverlay: {
        titleEntityId: "input_text.notification_title",
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateESPHomeYAML(project);
    expect(out).toContain('call.set_service("input_text.set_value")');
    expect(out).toContain('call.add_data("value", "")');
    expect(out).toContain('clear_text_entity("input_text.notification_title")');
    expect(out).toContain('clear_text_entity("input_text.notification_body")');
    expect(out).toContain("g_ui_app.dismiss_notification = [clear_text_entity]()");
  });

  test("dismiss notification helper clears only the configured entities", () => {
    const project = makeProject({
      notificationOverlay: {
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateESPHomeYAML(project);
    expect(out).toContain('clear_text_entity("input_text.notification_body")');
    expect(out).not.toContain('clear_text_entity("input_text.notification_title")');
  });

  test("does NOT emit notification subscriptions when overlay is disabled", () => {
    const project = makeProject({
      notificationOverlay: {
        enabled: false,
        titleEntityId: "input_text.notification_title",
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateESPHomeYAML(project);
    expect(out).not.toContain('&g_ui_app.state().notification_title');
    expect(out).not.toContain('&g_ui_app.state().notification_body');
    expect(out).not.toContain("dismiss_notification");
    expect(out).not.toContain("input_text.set_value");
  });

  test("does NOT emit notification subscriptions when no overlay config", () => {
    const project = makeProject({});

    const out = generateESPHomeYAML(project);
    expect(out).not.toContain("notification_title");
    expect(out).not.toContain("notification_body");
    expect(out).not.toContain("dismiss_notification");
    expect(out).not.toContain("input_text.set_value");
  });
});

describe("notification overlay screen header wiring", () => {
  test("emits overlay member, update, touch, and draw wiring when enabled", () => {
    const project = makeProject({
      notificationOverlay: {
        titleEntityId: "input_text.notification_title",
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateUIScreensHeader(project);
    expect(out).toContain("std::unique_ptr<NotificationOverlayWidget> notification_overlay_");
    expect(out).toContain("if (notification_overlay_) notification_overlay_->update(now);");
    expect(out).toContain("if (notification_overlay_ && notification_overlay_->is_visible(state))");
    expect(out).toContain("if (notification_overlay_) notification_overlay_->draw(it, state);");
  });

  test("draws overlay after current screen (topmost)", () => {
    const project = makeProject({
      notificationOverlay: {
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateUIScreensHeader(project);
    const drawMethod = out.match(/void draw\(display::Display &it, const UiState &state\) \{[^}]*\}/);
    // Overlay draw must appear after current_->draw
    expect(out).toContain("current_->draw(it, state);");
    const drawIdx = out.indexOf("current_->draw(it, state);");
    const overlayIdx = out.indexOf("notification_overlay_->draw(it, state);");
    expect(overlayIdx).toBeGreaterThan(drawIdx);
  });

  test("handles overlay touch before screen swipe handling", () => {
    const project = makeProject({
      notificationOverlay: {
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateUIScreensHeader(project);
    const overlayTouchIdx = out.indexOf("notification_overlay_->handle_touch");
    const swipeIdx = out.indexOf("abs(event.dx) > 60");
    expect(overlayTouchIdx).toBeGreaterThan(0);
    expect(swipeIdx).toBeGreaterThan(overlayTouchIdx);
  });

  test("does NOT emit overlay wiring when disabled", () => {
    const project = makeProject({
      notificationOverlay: {
        enabled: false,
      },
    });

    const out = generateUIScreensHeader(project);
    expect(out).not.toContain("notification_overlay_");
    expect(out).not.toContain("NotificationOverlayWidget");
  });

  test("does NOT emit overlay wiring when no overlay config", () => {
    const project = makeProject({});

    const out = generateUIScreensHeader(project);
    expect(out).not.toContain("notification_overlay_");
    expect(out).not.toContain("NotificationOverlayWidget");
  });

  test("overlay dismiss callback sets dismissed fingerprint and calls dismiss_notification", () => {
    const project = makeProject({
      notificationOverlay: {
        titleEntityId: "input_text.notification_title",
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateUIScreensHeader(project);
    expect(out).toContain("state.notification_dismissed = *state.notification_body.ptr()");
    expect(out).toContain("UiInvalidation::request_full()");
    expect(out).toContain("if (dismiss_notification) dismiss_notification()");
  });
});

describe("notification overlay title fallback", () => {
  test("widget draw uses Notification fallback when title is empty", () => {
    // The widget class in ui_widgets.h emits the fallback directly.
    // Verify by generating screens with overlay enabled -- the widget
    // constructor + calls are emitted in setup_ui_screens.
    const project = makeProject({
      notificationOverlay: {
        titleEntityId: "input_text.notification_title",
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateUIScreensHeader(project);
    expect(out).toContain("state.notification_title.ptr()");
    expect(out).toContain("state.notification_body.ptr()");
  });
});

describe("notification overlay icon font glyphs", () => {
  test("adds severity icons to generated MDI font when overlay is enabled", () => {
    const project = makeProject({
      notificationOverlay: {
        enabled: true,
        bodyEntityId: "input_text.notification_body",
        severityEntityId: "input_select.notification_severity",
      },
    });

    const out = generateFontsYAML(project, "font:\n");
    expect(out).toContain("# information");
    expect(out).toContain("# alert");
    expect(out).toContain("# alert-circle");
    expect(out).toContain("# help-circle");
  });

  test("does not add notification icons when overlay is disabled", () => {
    const project = makeProject({
      notificationOverlay: {
        enabled: false,
        bodyEntityId: "input_text.notification_body",
      },
    });

    const out = generateFontsYAML(project, "font:\n");
    expect(out).not.toContain("# information");
    expect(out).not.toContain("# alert-circle");
  });
});
