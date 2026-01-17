/**
 * Project Store - Central state management for the ESPHome Designer project
 *
 * Uses Svelte 5 runes for reactive state management.
 */

import type {
  Project,
  Page,
  DetailView,
  Component,
  DisplayConfig,
  FontDefinition,
} from "@esphome-designer/schema";
import { RETRO_THEME } from "../themes/retro";

const LATEST_VERSION = "1.0.0";
const STORAGE_KEY = "esphome-designer-project";

function createProjectStore() {
  // Core project state
  let project = $state<Project>({
    version: LATEST_VERSION,
    name: "New Project",
    theme: RETRO_THEME,
    display: {
      width: 240,
      height: 320,
      platform: "ili9xxx",
    },
    dashboardPages: [
      {
        id: "page-1",
        name: "Home",
        components: [],
      },
    ],
    detailViews: [],
    fonts: [],
  });

  // Load from localStorage on init (only if in browser)
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.version === LATEST_VERSION) {
          project = parsed;
        } else {
          console.warn(`Project version mismatch (${parsed.version} vs ${LATEST_VERSION}). Starting fresh.`);
        }
      } catch (e) {
        console.error("Failed to parse saved project", e);
      }
    }
  }

  // Current view tracking
  let currentDashboardPageId = $state(project.dashboardPages[0]?.id ?? "page-1");
  let currentDetailViewId = $state<string | null>(null);
  let viewMode = $state<"dashboard" | "detail">("dashboard");

  // Derived state
  const currentDashboardPage = $derived(
    project.dashboardPages.find((p) => p.id === currentDashboardPageId) ?? project.dashboardPages[0]
  );

  const currentDetailView = $derived(
    project.detailViews.find((v) => v.id === currentDetailViewId) ?? null
  );

  const activeComponents = $derived(
    viewMode === "dashboard" ? currentDashboardPage.components : (currentDetailView?.components ?? [])
  );

  return {
    // Getters
    get project() { return project; },
    get theme() { return project.theme ?? RETRO_THEME; },
    get viewMode() { return viewMode; },
    get currentDashboardPageId() { return currentDashboardPageId; },
    get currentDetailViewId() { return currentDetailViewId; },
    get currentDashboardPage() { return currentDashboardPage; },
    get currentDetailView() { return currentDetailView; },
    get activeComponents() { return activeComponents; },
    get display() { return project.display; },
    get dashboardPages() { return project.dashboardPages; },
    get detailViews() { return project.detailViews; },
    get fonts() { return project.fonts ?? []; },

    // Navigation
    setViewMode(mode: "dashboard" | "detail") {
      viewMode = mode;
    },
    setDashboardPage(id: string) {
      if (project.dashboardPages.some((p) => p.id === id)) {
        currentDashboardPageId = id;
        viewMode = "dashboard";
      }
    },
    setDetailView(id: string | null) {
      if (id === null || project.detailViews.some((v) => v.id === id)) {
        currentDetailViewId = id;
        if (id) viewMode = "detail";
      }
    },

    // Dashboard Page management
    addDashboardPage(page?: Partial<Page>) {
      const newPage: Page = {
        id: page?.id ?? `page-${Date.now()}`,
        name: page?.name ?? `Page ${project.dashboardPages.length + 1}`,
        components: page?.components ?? [],
        backgroundColor: page?.backgroundColor,
      };
      project.dashboardPages.push(newPage);
      currentDashboardPageId = newPage.id;
      viewMode = "dashboard";
      return newPage;
    },

    deleteDashboardPage(id: string) {
      if (project.dashboardPages.length <= 1) return;
      const idx = project.dashboardPages.findIndex((p) => p.id === id);
      if (idx !== -1) {
        project.dashboardPages.splice(idx, 1);
        if (currentDashboardPageId === id) {
          currentDashboardPageId = project.dashboardPages[0].id;
        }
      }
    },

    // Detail View management
    addDetailView(view?: Partial<DetailView>) {
      const newView: DetailView = {
        id: view?.id ?? `detail-${Date.now()}`,
        title: view?.title ?? `Detail ${project.detailViews.length + 1}`,
        height: view?.height ?? 640,
        components: view?.components ?? [],
        maxScrollY: view?.maxScrollY ?? 0,
      };
      project.detailViews.push(newView);
      currentDetailViewId = newView.id;
      viewMode = "detail";
      return newView;
    },

    updateDetailView(id: string, updates: Partial<DetailView>) {
      const view = project.detailViews.find((v) => v.id === id);
      if (view) {
        Object.assign(view, updates);
      }
    },

    deleteDetailView(id: string) {
      const idx = project.detailViews.findIndex((v) => v.id === id);
      if (idx !== -1) {
        project.detailViews.splice(idx, 1);
        if (currentDetailViewId === id) {
          currentDetailViewId = null;
          viewMode = "dashboard";
        }
      }
    },

    // Component management
    addComponent(component: Component) {
      if (viewMode === "dashboard") {
        currentDashboardPage.components.push(component);
      } else if (currentDetailView) {
        currentDetailView.components.push(component);
      }
      return component;
    },

    updateComponent(id: string, updates: Partial<Component>) {
      const components = viewMode === "dashboard" ? currentDashboardPage.components : currentDetailView?.components;
      if (!components) return;
      const idx = components.findIndex((c) => c.id === id);
      if (idx !== -1) {
        components[idx] = { ...components[idx], ...updates } as Component;
      }
    },

    deleteComponent(id: string) {
      const components = viewMode === "dashboard" ? currentDashboardPage.components : currentDetailView?.components;
      if (!components) return;
      const idx = components.findIndex((c) => c.id === id);
      if (idx !== -1) {
        components.splice(idx, 1);
      }
    },

    getComponent(id: string): Component | undefined {
      return activeComponents.find((c) => c.id === id);
    },

    moveComponent(id: string, dx: number, dy: number) {
      const components = viewMode === "dashboard" ? currentDashboardPage.components : currentDetailView?.components;
      if (!components) return;
      const component = components.find((c) => c.id === id);
      if (component) {
        component.position.x = Math.max(0, Math.min(component.position.x + dx, project.display.width - 1));
        component.position.y = Math.max(0, Math.min(component.position.y + dy, project.display.height - 1));
      }
    },

    // Project management
    loadProject(p: Project) {
      project = p;
      currentDashboardPageId = p.dashboardPages[0]?.id ?? "";
      currentDetailViewId = null;
      viewMode = "dashboard";
    },

    exportJSON(): string {
      return JSON.stringify(project, null, 2);
    },
  };
}

export const projectStore = createProjectStore();
