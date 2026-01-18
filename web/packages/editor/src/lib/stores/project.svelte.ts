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
import { assert, toUpperSnakeCase } from "$lib/utils";

const LATEST_VERSION = "1.0.0";
const PROJECTS_INDEX_KEY = "esphome-designer-projects-index";
const PROJECT_PREFIX = "esphome-designer-project-";

export type ProjectConfig = { 
  display?: Partial<DisplayConfig>, 
  theme?: Theme
};

function createProjectStore() {
  // Core project state
  let project = $state<Project | null>(null);

  // Current view tracking
  let currentDashboardPageId = $state<string | null>(null);
  let currentDetailViewId = $state<string | null>(null);
  let viewMode = $state<"dashboard" | "detail">("dashboard");

  function saveToLocalStorage() {
    if (typeof window === "undefined" || !project) return;

    assert(project.id, "Project must have an ID to be saved");

    // Save project data
    localStorage.setItem(`${PROJECT_PREFIX}${project.id}`, JSON.stringify(project));

    // Update index
    const index = getProjectsIndex();
    const existing = index.find(p => p.id === project!.id);
    if (existing) {
      existing.name = project.name;
      existing.updatedAt = new Date().toISOString();
    } else {
      index.push({
        id: project.id,
        name: project.name,
        updatedAt: new Date().toISOString()
      });
    }
    localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(index));
  }

  function getProjectsIndex(): { id: string, name: string, updatedAt: string }[] {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(PROJECTS_INDEX_KEY);
    return saved ? JSON.parse(saved) : [];
  }

  // Derived state
  const currentDashboardPage = $derived(
    project?.dashboardPages.find((p) => p.id === currentDashboardPageId) ?? project?.dashboardPages[0]
  );

  const currentDetailView = $derived(
    project?.detailViews.find((v) => v.id === currentDetailViewId) ?? null
  );

  const activeComponents = $derived(
    viewMode === "dashboard" ? (currentDashboardPage?.components ?? []) : (currentDetailView?.components ?? [])
  );

  return {
    // Getters
    get project() { return project; },
    get theme() { return project?.theme ?? RETRO_THEME; },
    get viewMode() { return viewMode; },
    get currentDashboardPageId() { return currentDashboardPageId; },
    get currentDetailViewId() { return currentDetailViewId; },
    get currentDashboardPage() { return currentDashboardPage; },
    get currentDetailView() { return currentDetailView; },
    get activeComponents() { return activeComponents; },
    get display() { return project?.display; },
    get dashboardPages() { return project?.dashboardPages ?? []; },
    get detailViews() { return project?.detailViews ?? []; },
    get fonts() { return project?.fonts ?? []; },

    // Navigation
    setViewMode(mode: "dashboard" | "detail") {
      viewMode = mode;
    },
    setDashboardPage(id: string) {
      if (project?.dashboardPages.some((p) => p.id === id)) {
        currentDashboardPageId = id;
        viewMode = "dashboard";
      }
    },
    setDetailView(id: string | null) {
      if (id === null || project?.detailViews.some((v) => v.id === id)) {
        currentDetailViewId = id;
        if (id) viewMode = "detail";
      }
    },

    // Dashboard Page management
    addDashboardPage(page?: Partial<Page>) {
      if (!project) return;
      const newPage: Page = {
        id: page?.id ?? `page-${Date.now()}`,
        name: page?.name ?? `Page ${project.dashboardPages.length + 1}`,
        components: page?.components ?? [],
        backgroundColor: page?.backgroundColor,
      };
      project.dashboardPages.push(newPage);
      currentDashboardPageId = newPage.id;
      viewMode = "dashboard";
      saveToLocalStorage();
      return newPage;
    },

    deleteDashboardPage(id: string) {
      if (!project || project.dashboardPages.length <= 1) return;
      const idx = project.dashboardPages.findIndex((p) => p.id === id);
      if (idx !== -1) {
        project.dashboardPages.splice(idx, 1);
        if (currentDashboardPageId === id) {
          currentDashboardPageId = project.dashboardPages[0].id;
        }
        saveToLocalStorage();
      }
    },

    // Detail View management
    addDetailView(view?: Partial<DetailView>) {
      if (!project) return;
      const title = view?.title ?? `Detail ${project.detailViews.length + 1}`;
      const newView: DetailView = {
        id: view?.id ?? toUpperSnakeCase(title), // Use toUpperSnakeCase for the ID
        title: title,
        height: view?.height ?? 640,
        components: view?.components ?? [],
      };
      project.detailViews.push(newView);
      currentDetailViewId = newView.id;
      viewMode = "detail";
      saveToLocalStorage();
      return newView;
    },

    updateDetailView(id: string, updates: Partial<DetailView>) {
      if (!project) return;
      const view = project.detailViews.find((v) => v.id === id);
      if (view) {
        Object.assign(view, updates);
        saveToLocalStorage();
      }
    },

    deleteDetailView(id: string) {
      if (!project) return;
      const idx = project.detailViews.findIndex((v) => v.id === id);
      if (idx !== -1) {
        project.detailViews.splice(idx, 1);
        if (currentDetailViewId === id) {
          currentDetailViewId = null;
          viewMode = "dashboard";
        }
        saveToLocalStorage();
      }
    },

    // Component management
    addComponent(component: Component) {
      if (!project) return;
      if (viewMode === "dashboard" && currentDashboardPage) {
        currentDashboardPage.components.push(component);
      } else if (currentDetailView) {
        currentDetailView.components.push(component);
      }
      saveToLocalStorage();
      return component;
    },

    updateComponent(id: string, updates: Partial<Component>) {
      if (!project) return;
      const components = viewMode === "dashboard" ? currentDashboardPage?.components : currentDetailView?.components;
      if (!components) return;
      const idx = components.findIndex((c) => c.id === id);
      if (idx !== -1) {
        components[idx] = { ...components[idx], ...updates } as Component;
        saveToLocalStorage();
      }
    },

    deleteComponent(id: string) {
      if (!project) return;
      const components = viewMode === "dashboard" ? currentDashboardPage?.components : currentDetailView?.components;
      if (!components) return;
      const idx = components.findIndex((c) => c.id === id);
      if (idx !== -1) {
        components.splice(idx, 1);
        saveToLocalStorage();
      }
    },

    getComponent(id: string): Component | undefined {
      return activeComponents.find((c) => c.id === id);
    },

    moveComponent(id: string, dx: number, dy: number) {
      if (!project) return;
      const components = viewMode === "dashboard" ? currentDashboardPage?.components : currentDetailView?.components;
      if (!components) return;
      const component = components.find((c) => c.id === id);
      if (component) {
        component.position.x = Math.max(0, Math.min(component.position.x + dx, project.display.width - 1));
        component.position.y = Math.max(0, Math.min(component.position.y + dy, project.display.height - 1));
        saveToLocalStorage();
      }
    },

    // Project management
    updateProject(updates: Partial<Project>) {
      if (project) {
        Object.assign(project, updates);
        saveToLocalStorage();
      }
    },

    createNewProject(name: string, config?: ProjectConfig): Project {
      const display = { 
        width: config?.display?.width ?? 240, 
        height: config?.display?.height ?? 320, 
        platform: config?.display?.platform ?? "ili9xxx" 
      } as DisplayConfig;

      const newProject: Project = {
        id: crypto.randomUUID(),
        version: LATEST_VERSION,
        name,
        theme: config?.theme ?? RETRO_THEME,
        display,
        dashboardPages: [{ id: "page-1", name: "Home", components: [] }],
        detailViews: [],
        fonts: [],
      };
      project = newProject;
      currentDashboardPageId = newProject.dashboardPages[0].id;
      currentDetailViewId = null;
      viewMode = "dashboard";
      saveToLocalStorage();
      return newProject;
    },

    loadProjectById(id: string): boolean {
      if (typeof window === "undefined") return false;
      const saved = localStorage.getItem(`${PROJECT_PREFIX}${id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          project = parsed;
          currentDashboardPageId = parsed.dashboardPages[0]?.id ?? "";
          currentDetailViewId = null;
          viewMode = "dashboard";
          return true;
        } catch (e) {
          console.error("Failed to parse project", e);
        }
      }
      return false;
    },

    deleteProject(id: string) {
      if (typeof window === "undefined") return;
      localStorage.removeItem(`${PROJECT_PREFIX}${id}`);
      const index = getProjectsIndex().filter(p => p.id !== id);
      localStorage.setItem(PROJECTS_INDEX_KEY, JSON.stringify(index));
      if (project?.id === id) {
        project = null;
      }
    },

    listProjects() {
      return getProjectsIndex();
    },

    exportJSON(): string {
      return project ? JSON.stringify(project) : "";
    },
  };
}

export const projectStore = createProjectStore();
