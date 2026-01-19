import type {
  Project,
  Page,
  DetailView,
  Component,
  DisplayConfig,
  Theme,
} from "@esphome-designer/schema";
import { RETRO_THEME } from "../themes/retro";
import { assert, toUpperSnakeCase } from "$lib/utils";
import { selectionStore } from "./selection.svelte";
import { browser } from "$app/environment";

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
    get currentPageIndex() {
      if (!project) return 0;
      return project.dashboardPages.findIndex(p => p.id === currentDashboardPageId);
    },
    get detailViews() { return project?.detailViews ?? []; },
    get fonts() { return project?.fonts ?? []; },

    // Navigation
    setViewMode(mode: "dashboard" | "detail") {
      viewMode = mode;
      selectionStore.clear();

      if (mode === "dashboard" && project) {
        currentDashboardPageId = project.dashboardPages[0]?.id ?? null;
      }

      if (mode === "detail" && project) {
        currentDetailViewId = project.detailViews[0]?.id ?? null;
      }
    },
    setDashboardPage(id: string) {
      if (project?.dashboardPages.some((p) => p.id === id)) {
        currentDashboardPageId = id;
        viewMode = "dashboard";
        selectionStore.clear();
      }
    },
    setDetailView(id: string | null) {
      if (id === null || project?.detailViews.some((v) => v.id === id)) {
        currentDetailViewId = id;
        if (id) viewMode = "detail";
        selectionStore.clear();
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

    reorderDashboardPage(oldIndex: number, newIndex: number) {
      if (!project) return;
      if (newIndex < 0 || newIndex >= project.dashboardPages.length) return;
      
      const page = project.dashboardPages.splice(oldIndex, 1)[0];
      project.dashboardPages.splice(newIndex, 0, page);
      saveToLocalStorage();
    },

    renameDashboardPage(id: string, newName: string) {
      if (!project) return;
      const page = project.dashboardPages.find(p => p.id === id);
      if (page) {
        page.name = newName;
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

    reorderDetailView(oldIndex: number, newIndex: number) {
      if (!project) return;
      if (newIndex < 0 || newIndex >= project.detailViews.length) return;
      
      const view = project.detailViews.splice(oldIndex, 1)[0];
      project.detailViews.splice(newIndex, 0, view);
      saveToLocalStorage();
    },

    renameDetailView(id: string, newTitle: string) {
      if (!project) return;
      const view = project.detailViews.find(v => v.id === id);
      if (view) {
        view.title = newTitle;
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

    addComponentToVariant(componentId: string, variantId: string, component: Component) {
      const parent = this.getComponent(componentId);
      if (parent?.type === "conditional_area") {
        const variant = parent.variants.find(v => v.id === variantId);
        if (variant) {
          variant.components.push(component);
          saveToLocalStorage();
          return component;
        }
      }
    },

    updateComponent(id: string, updates: Partial<Component>) {
      if (!project) return;

      // Helper to update component in an array, including nested conditional areas
      const updateInComponents = (components: Component[]): boolean => {
        const idx = components.findIndex((c) => c.id === id);
        if (idx !== -1) {
          components[idx] = { ...components[idx], ...updates } as Component;
          return true;
        }
        // Search in conditional areas
        for (const comp of components) {
          if (comp.type === "conditional_area") {
            for (const variant of comp.variants) {
              if (updateInComponents(variant.components)) {
                return true;
              }
            }
          }
        }
        return false;
      };

      // Search in current view
      const components = viewMode === "dashboard" ? currentDashboardPage?.components : currentDetailView?.components;
      if (components && updateInComponents(components)) {
        saveToLocalStorage();
      }
    },

    deleteComponent(id: string) {
      if (!project) return;
      // Search in pages
      for (const page of project.dashboardPages) {
        const idx = page.components.findIndex((c) => c.id === id);
        if (idx !== -1) {
          page.components.splice(idx, 1);
          saveToLocalStorage();
          return;
        }
        // Search in conditional areas
        for (const comp of page.components) {
          if (comp.type === "conditional_area") {
            for (const variant of comp.variants) {
              const cIdx = variant.components.findIndex(c => c.id === id);
              if (cIdx !== -1) {
                variant.components.splice(cIdx, 1);
                saveToLocalStorage();
                return;
              }
            }
          }
        }
      }
      // Search in detail views
      for (const view of project.detailViews) {
        const idx = view.components.findIndex((c) => c.id === id);
        if (idx !== -1) {
          view.components.splice(idx, 1);
          saveToLocalStorage();
          return;
        }
        // Search in conditional areas
        for (const comp of view.components) {
          if (comp.type === "conditional_area") {
            for (const variant of comp.variants) {
              const cIdx = variant.components.findIndex(c => c.id === id);
              if (cIdx !== -1) {
                variant.components.splice(cIdx, 1);
                saveToLocalStorage();
                return;
              }
            }
          }
        }
      }
    },

    getComponent(id: string): Component | undefined {
      // Helper to search recursively
      const findInComponents = (components: Component[]): Component | undefined => {
        for (const c of components) {
          if (c.id === id) return c;
          if (c.type === "conditional_area") {
            for (const v of c.variants) {
              const found = findInComponents(v.components);
              if (found) return found;
            }
          }
        }
        return undefined;
      };

      if (!project) return undefined;
      for (const page of project.dashboardPages) {
        const found = findInComponents(page.components);
        if (found) return found;
      }
      for (const view of project.detailViews) {
        const found = findInComponents(view.components);
        if (found) return found;
      }
      return undefined;
    },

    getComponentAbsolutePosition(id: string): { x: number; y: number } {
      const component = this.getComponent(id);
      if (!component) return { x: 0, y: 0 };

      let x = component.position.x;
      let y = component.position.y;

      // Find if this component is inside a conditional area
      const findParent = (components: Component[], targetId: string): Component | null => {
        for (const c of components) {
          if (c.type === "conditional_area") {
            for (const v of c.variants) {
              if (v.components.some(child => child.id === targetId)) return c;
              const found = findParent(v.components, targetId);
              if (found) return found;
            }
          }
        }
        return null;
      };

      let parent: Component | null = null;
      if (project) {
        for (const page of project.dashboardPages) {
          parent = findParent(page.components, id);
          if (parent) break;
        }
        if (!parent) {
          for (const view of project.detailViews) {
            parent = findParent(view.components, id);
            if (parent) break;
          }
        }
      }

      if (parent) {
        const parentPos = this.getComponentAbsolutePosition(parent.id);
        x += parentPos.x;
        y += parentPos.y;
      }

      return { x, y };
    },

    addVariant(componentId: string) {
      const component = this.getComponent(componentId);
      if (component?.type === "conditional_area") {
        const newVariant = {
          id: `variant-${Date.now()}`,
          name: `Variant ${component.variants.length + 1}`,
          components: [],
          priority: 0,
        };
        component.variants.push(newVariant);
        saveToLocalStorage();
        return newVariant;
      }
    },

    updateVariant(componentId: string, variantId: string, updates: any) {
      const component = this.getComponent(componentId);
      if (component?.type === "conditional_area") {
        const variant = component.variants.find(v => v.id === variantId);
        if (variant) {
          Object.assign(variant, updates);
          saveToLocalStorage();
        }
      }
    },

    deleteVariant(componentId: string, variantId: string) {
      const component = this.getComponent(componentId);
      if (component?.type === "conditional_area" && component.variants.length > 1) {
        const idx = component.variants.findIndex(v => v.id === variantId);
        if (idx !== -1) {
          component.variants.splice(idx, 1);
          saveToLocalStorage();
        }
      }
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
      if (!browser) return false;
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
      if (!browser) return;
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

    importJSON(json: string): boolean {
      try {
        const parsed = JSON.parse(json);
        // Simple validation
        if (!parsed.id || !parsed.name || !parsed.display) return false;

        project = parsed;
        currentDashboardPageId = parsed.dashboardPages[0]?.id ?? "";
        currentDetailViewId = null;
        viewMode = "dashboard";
        saveToLocalStorage();
        return true;
      } catch (e) {
        console.error("Failed to import project", e);
        return false;
      }
    },
  };
}

export const projectStore = createProjectStore();