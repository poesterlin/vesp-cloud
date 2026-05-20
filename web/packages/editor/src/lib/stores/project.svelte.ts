import type {
  Project,
  Page,
  DetailView,
  Component,
  DisplayConfig,
  Theme,
  PageHeader,
} from "@esphome-designer/schema";
import { RETRO_THEME } from "../themes/retro";
import { assert, toUpperSnakeCase } from "$lib/utils";
import { selectionStore } from "./selection.svelte";
import { conditionalEditorStore } from "./conditional-editor.svelte";
import { browser } from "$app/environment";

const LATEST_VERSION = "1.0.0";
const PROJECTS_INDEX_KEY = "esphome-designer-projects-index";
const PROJECT_PREFIX = "esphome-designer-project-";
const TAB_HEADER_HEIGHT = 30;

const SAVE_DEBOUNCE_MS = 1500;

export type ProjectConfig = {
  display?: Partial<DisplayConfig>,
  theme?: Theme
};

export type ComponentLayoutBounds = {
  id: string;
  component: Component;
  x: number;
  y: number;
  width: number;
  height: number;
  ancestorIds: string[];
};

export type LayoutSurface = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function createProjectStore() {
  // Core project state
  let project = $state<Project | null>(null);
  let serverProjectId = $state<string | null>(null);
  let firmwareToken = $state<string | null>(null);

  // Current view tracking
  let currentDashboardPageId = $state<string | null>(null);
  let currentDetailViewId = $state<string | null>(null);
  let viewMode = $state<"dashboard" | "detail">("dashboard");

  // Debounced save
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let saving = $state(false);

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveToServer(), SAVE_DEBOUNCE_MS);
  }

  async function saveToServer() {
    if (!project || !serverProjectId) return;
    saving = true;
    try {
      await fetch(`/api/projects/${serverProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: project.name, data: project }),
      });
    } catch (e) {
      console.error('Failed to save project', e);
    } finally {
      saving = false;
    }
  }

  // localStorage helpers for migration
  function getProjectsIndex(): { id: string, name: string, updatedAt: string }[] {
    if (!browser) return [];
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
    get secrets() { return project?.secrets; },
    get pageHeader() { return project?.pageHeader; },
    get headerComponents() { return project?.pageHeader?.components ?? []; },

    isHeaderComponent(id: string): boolean {
      if (!project?.pageHeader) return false;
      const findInComponents = (components: Component[]): boolean => {
        for (const c of components) {
          if (c.id === id) return true;
          if (c.type === "conditional_area") {
            for (const v of c.variants) {
              if (findInComponents(v.components)) return true;
            }
          } else if (c.type === "tab_container") {
            for (const t of c.tabs) {
              if (findInComponents(t.components)) return true;
            }
          }
        }
        return false;
      };
      return findInComponents(project.pageHeader.components);
    },

    get serverProjectId() { return serverProjectId; },
    get firmwareToken() { return firmwareToken; },
    get saving() { return saving; },

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
      scheduleSave();
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
        scheduleSave();
      }
    },

    reorderDashboardPage(oldIndex: number, newIndex: number) {
      if (!project) return;
      if (newIndex < 0 || newIndex >= project.dashboardPages.length) return;

      const page = project.dashboardPages.splice(oldIndex, 1)[0];
      project.dashboardPages.splice(newIndex, 0, page);
      scheduleSave();
    },

    renameDashboardPage(id: string, newName: string) {
      if (!project) return;
      const page = project.dashboardPages.find(p => p.id === id);
      if (page) {
        page.name = newName;
        scheduleSave();
      }
    },

    // Detail View management
    addDetailView(view?: Partial<DetailView>) {
      if (!project) return;
      const title = view?.title ?? `Detail ${project.detailViews.length + 1}`;
      const newView: DetailView = {
        id: view?.id ?? toUpperSnakeCase(title),
        title: title,
        height: view?.height ?? 640,
        components: view?.components ?? [],
      };
      project.detailViews.push(newView);
      currentDetailViewId = newView.id;
      viewMode = "detail";
      scheduleSave();
      return newView;
    },

    updateDetailView(id: string, updates: Partial<DetailView>) {
      if (!project) return;
      const view = project.detailViews.find((v) => v.id === id);
      if (view) {
        Object.assign(view, updates);
        scheduleSave();
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
        scheduleSave();
      }
    },

    reorderDetailView(oldIndex: number, newIndex: number) {
      if (!project) return;
      if (newIndex < 0 || newIndex >= project.detailViews.length) return;

      const view = project.detailViews.splice(oldIndex, 1)[0];
      project.detailViews.splice(newIndex, 0, view);
      scheduleSave();
    },

    renameDetailView(id: string, newTitle: string) {
      if (!project) return;
      const view = project.detailViews.find(v => v.id === id);
      if (view) {
        view.title = newTitle;
        scheduleSave();
      }
    },

    // Page Header management
    enablePageHeader(height: number = 40) {
      if (!project) return;
      const defaultTimeComponent: Component = {
        id: `text-header-${Date.now()}`,
        type: "text",
        text: "12:00",
        fontSize: "large",
        align: "center",
        position: { x: 0, y: 4 },
        size: { width: project.display.width, height: height - 8 },
      } as Component;
      project.pageHeader = {
        height,
        components: [defaultTimeComponent],
      };
      scheduleSave();
    },

    disablePageHeader() {
      if (!project) return;
      delete project.pageHeader;
      scheduleSave();
    },

    updatePageHeader(updates: Partial<PageHeader>) {
      if (!project?.pageHeader) return;
      Object.assign(project.pageHeader, updates);
      scheduleSave();
    },

    // Component management
    addComponent(component: Component) {
      if (!project) return;
      if (viewMode === "dashboard" && currentDashboardPage) {
        currentDashboardPage.components.push(component);
      } else if (currentDetailView) {
        currentDetailView.components.push(component);
      }
      scheduleSave();
      return component;
    },

    addHeaderComponent(component: Component) {
      if (!project?.pageHeader) return;
      project.pageHeader.components.push(component);
      scheduleSave();
      return component;
    },

    addComponentToVariant(componentId: string, variantId: string, component: Component) {
      const parent = this.getComponent(componentId);
      if (parent?.type === "conditional_area") {
        const variant = parent.variants.find(v => v.id === variantId);
        if (variant) {
          variant.components.push(component);
          scheduleSave();
          return component;
        }
      }
    },

    addComponentToTab(componentId: string, tabId: string, component: Component) {
      const parent = this.getComponent(componentId);
      if (parent?.type === "tab_container") {
        const tab = parent.tabs.find((t) => t.id === tabId);
        if (tab) {
          tab.components.push(component);
          scheduleSave();
          return component;
        }
      }
    },

    updateComponent(id: string, updates: Partial<Component>) {
      if (!project) return;

      const updateInComponents = (components: Component[]): boolean => {
        const idx = components.findIndex((c) => c.id === id);
        if (idx !== -1) {
          components[idx] = { ...components[idx], ...updates } as Component;
          return true;
        }
        for (const comp of components) {
          if (comp.type === "conditional_area") {
            for (const variant of comp.variants) {
              if (updateInComponents(variant.components)) {
                return true;
              }
            }
          } else if (comp.type === "tab_container") {
            for (const tab of comp.tabs) {
              if (updateInComponents(tab.components)) {
                return true;
              }
            }
          }
        }
        return false;
      };

      const components = viewMode === "dashboard" ? currentDashboardPage?.components : currentDetailView?.components;
      if (components && updateInComponents(components)) {
        scheduleSave();
        return;
      }
      // Also search header components
      if (project.pageHeader && updateInComponents(project.pageHeader.components)) {
        scheduleSave();
      }
    },

    deleteComponent(id: string) {
      if (!project) return;
      // Search in page header
      if (project.pageHeader) {
        const idx = project.pageHeader.components.findIndex((c) => c.id === id);
        if (idx !== -1) {
          project.pageHeader.components.splice(idx, 1);
          scheduleSave();
          return;
        }
        for (const comp of project.pageHeader.components) {
          if (comp.type === "conditional_area") {
            for (const variant of comp.variants) {
              const cIdx = variant.components.findIndex(c => c.id === id);
              if (cIdx !== -1) {
                variant.components.splice(cIdx, 1);
                scheduleSave();
                return;
              }
            }
          } else if (comp.type === "tab_container") {
            for (const tab of comp.tabs) {
              const cIdx = tab.components.findIndex((c) => c.id === id);
              if (cIdx !== -1) {
                tab.components.splice(cIdx, 1);
                scheduleSave();
                return;
              }
            }
          }
        }
      }
      for (const page of project.dashboardPages) {
        const idx = page.components.findIndex((c) => c.id === id);
        if (idx !== -1) {
          page.components.splice(idx, 1);
          scheduleSave();
          return;
        }
        for (const comp of page.components) {
          if (comp.type === "conditional_area") {
            for (const variant of comp.variants) {
              const cIdx = variant.components.findIndex(c => c.id === id);
              if (cIdx !== -1) {
                variant.components.splice(cIdx, 1);
                scheduleSave();
                return;
              }
            }
          } else if (comp.type === "tab_container") {
            for (const tab of comp.tabs) {
              const cIdx = tab.components.findIndex((c) => c.id === id);
              if (cIdx !== -1) {
                tab.components.splice(cIdx, 1);
                scheduleSave();
                return;
              }
            }
          }
        }
      }
      for (const view of project.detailViews) {
        const idx = view.components.findIndex((c) => c.id === id);
        if (idx !== -1) {
          view.components.splice(idx, 1);
          scheduleSave();
          return;
        }
        for (const comp of view.components) {
          if (comp.type === "conditional_area") {
            for (const variant of comp.variants) {
              const cIdx = variant.components.findIndex(c => c.id === id);
              if (cIdx !== -1) {
                variant.components.splice(cIdx, 1);
                scheduleSave();
                return;
              }
            }
          } else if (comp.type === "tab_container") {
            for (const tab of comp.tabs) {
              const cIdx = tab.components.findIndex((c) => c.id === id);
              if (cIdx !== -1) {
                tab.components.splice(cIdx, 1);
                scheduleSave();
                return;
              }
            }
          }
        }
      }
    },

    getComponent(id: string): Component | undefined {
      const findInComponents = (components: Component[]): Component | undefined => {
        for (const c of components) {
          if (c.id === id) return c;
          if (c.type === "conditional_area") {
            for (const v of c.variants) {
              const found = findInComponents(v.components);
              if (found) return found;
            }
          } else if (c.type === "tab_container") {
            for (const t of c.tabs) {
              const found = findInComponents(t.components);
              if (found) return found;
            }
          }
        }
        return undefined;
      };

      if (!project) return undefined;
      // Search in page header
      if (project.pageHeader) {
        const found = findInComponents(project.pageHeader.components);
        if (found) return found;
      }
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

      const findParent = (
        components: Component[],
        targetId: string,
      ): { parent: Component; offsetY: number } | null => {
        for (const c of components) {
          if (c.type === "conditional_area") {
            for (const v of c.variants) {
              if (v.components.some(child => child.id === targetId)) return { parent: c, offsetY: 0 };
              const found = findParent(v.components, targetId);
              if (found) return found;
            }
          } else if (c.type === "tab_container") {
            for (const t of c.tabs) {
              if (t.components.some((child) => child.id === targetId)) {
                return { parent: c, offsetY: 22 };
              }
              const found = findParent(t.components, targetId);
              if (found) return found;
            }
          }
        }
        return null;
      };

      let parentInfo: { parent: Component; offsetY: number } | null = null;
      if (project) {
        // Search in page header
        if (project.pageHeader) {
          parentInfo = findParent(project.pageHeader.components, id);
        }
        if (!parentInfo) {
          for (const page of project.dashboardPages) {
            parentInfo = findParent(page.components, id);
            if (parentInfo) break;
          }
        }
        if (!parentInfo) {
          for (const view of project.detailViews) {
            parentInfo = findParent(view.components, id);
            if (parentInfo) break;
          }
        }
      }

      if (parentInfo) {
        const parentPos = this.getComponentAbsolutePosition(parentInfo.parent.id);
        x += parentPos.x;
        y += parentPos.y + parentInfo.offsetY;
      }

      return { x, y };
    },

    getVisibleComponentLayoutBounds(): ComponentLayoutBounds[] {
      if (!project) return [];

      const bounds: ComponentLayoutBounds[] = [];

      const visit = (
        components: Component[],
        origin: { x: number; y: number },
        ancestorIds: string[],
      ) => {
        for (const component of components) {
          const width = component.size?.width ?? 50;
          const height = component.size?.height ?? 20;
          const x = origin.x + component.position.x;
          const y = origin.y + component.position.y;

          bounds.push({
            id: component.id,
            component,
            x,
            y,
            width,
            height,
            ancestorIds,
          });

          const childAncestorIds = [...ancestorIds, component.id];
          if (component.type === "conditional_area") {
            const activeVariantId = conditionalEditorStore.getActiveVariant(
              component.id,
              component.variants[0]?.id,
            );
            const activeVariant =
              component.variants.find((variant) => variant.id === activeVariantId) ??
              component.variants[0];
            if (activeVariant) {
              visit(activeVariant.components, { x, y }, childAncestorIds);
            }
          } else if (component.type === "tab_container") {
            const activeTabId = conditionalEditorStore.getActiveTab(
              component.id,
              component.defaultTabId ?? component.tabs[0]?.id,
            );
            const activeTab =
              component.tabs.find((tab) => tab.id === activeTabId) ?? component.tabs[0];
            if (activeTab) {
              visit(
                activeTab.components,
                { x, y: y + TAB_HEADER_HEIGHT },
                childAncestorIds,
              );
            }
          }
        }
      };

      if (project.pageHeader) {
        visit(project.pageHeader.components, { x: 0, y: 0 }, []);
      }

      const contentY = viewMode === "dashboard" ? (project.pageHeader?.height ?? 0) : 0;
      visit(activeComponents, { x: 0, y: contentY }, []);

      return bounds;
    },

    getComponentLayoutBounds(id: string): ComponentLayoutBounds | undefined {
      return this.getVisibleComponentLayoutBounds().find((bounds) => bounds.id === id);
    },

    getComponentParentLayoutSurface(id: string): LayoutSurface | undefined {
      if (!project) return undefined;

      const displayWidth = project.display.width;
      const contentY = viewMode === "dashboard" ? (project.pageHeader?.height ?? 0) : 0;
      const contentHeight =
        viewMode === "dashboard"
          ? project.display.height - contentY
          : (currentDetailView?.height ?? project.display.height);

      const search = (
        components: Component[],
        surface: LayoutSurface,
      ): LayoutSurface | undefined => {
        for (const component of components) {
          if (component.id === id) return surface;

          const x = surface.x + component.position.x;
          const y = surface.y + component.position.y;

          if (component.type === "conditional_area") {
            const activeVariantId = conditionalEditorStore.getActiveVariant(
              component.id,
              component.variants[0]?.id,
            );
            const activeVariant =
              component.variants.find((variant) => variant.id === activeVariantId) ??
              component.variants[0];
            const found = activeVariant
              ? search(activeVariant.components, {
                  x,
                  y,
                  width: component.size?.width ?? 100,
                  height: component.size?.height ?? 100,
                })
              : undefined;
            if (found) return found;
          } else if (component.type === "tab_container") {
            const activeTabId = conditionalEditorStore.getActiveTab(
              component.id,
              component.defaultTabId ?? component.tabs[0]?.id,
            );
            const activeTab =
              component.tabs.find((tab) => tab.id === activeTabId) ?? component.tabs[0];
            const found = activeTab
              ? search(activeTab.components, {
                  x,
                  y: y + TAB_HEADER_HEIGHT,
                  width: component.size?.width ?? 150,
                  height: Math.max(0, (component.size?.height ?? 100) - TAB_HEADER_HEIGHT),
                })
              : undefined;
            if (found) return found;
          }
        }

        return undefined;
      };

      if (project.pageHeader) {
        const headerSurface = {
          x: 0,
          y: 0,
          width: displayWidth,
          height: project.pageHeader.height,
        };
        const found = search(project.pageHeader.components, headerSurface);
        if (found) return found;
      }

      return search(activeComponents, {
        x: 0,
        y: contentY,
        width: displayWidth,
        height: contentHeight,
      });
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
        scheduleSave();
        return newVariant;
      }
    },

    updateVariant(componentId: string, variantId: string, updates: any) {
      const component = this.getComponent(componentId);
      if (component?.type === "conditional_area") {
        const variant = component.variants.find(v => v.id === variantId);
        if (variant) {
          Object.assign(variant, updates);
          scheduleSave();
        }
      }
    },

    deleteVariant(componentId: string, variantId: string) {
      const component = this.getComponent(componentId);
      if (component?.type === "conditional_area" && component.variants.length > 1) {
        const idx = component.variants.findIndex(v => v.id === variantId);
        if (idx !== -1) {
          component.variants.splice(idx, 1);
          scheduleSave();
        }
      }
    },

    addTab(componentId: string) {
      const component = this.getComponent(componentId);
      if (component?.type === "tab_container") {
        const newTab = {
          id: `tab-${Date.now()}`,
          name: `Tab ${component.tabs.length + 1}`,
          components: [],
        };
        component.tabs.push(newTab);
        scheduleSave();
        return newTab;
      }
    },

    updateTab(componentId: string, tabId: string, updates: any) {
      const component = this.getComponent(componentId);
      if (component?.type === "tab_container") {
        const tab = component.tabs.find((t) => t.id === tabId);
        if (tab) {
          Object.assign(tab, updates);
          scheduleSave();
        }
      }
    },

    deleteTab(componentId: string, tabId: string) {
      const component = this.getComponent(componentId);
      if (component?.type === "tab_container" && component.tabs.length > 1) {
        const idx = component.tabs.findIndex((t) => t.id === tabId);
        if (idx !== -1) {
          component.tabs.splice(idx, 1);
          scheduleSave();
        }
      }
    },

    addAutoLayoutItem(componentId: string) {
      const component = this.getComponent(componentId) as any;
      if (component?.type !== "auto_layout_list") return;

      const newItem = {
        id: `auto-layout-item-${Date.now()}`,
        name: `Item ${component.items.length + 1}`,
        icon: "home",
        scale: 1,
      };

      component.items.push(newItem);
      scheduleSave();
      return newItem;
    },

    updateAutoLayoutItem(componentId: string, itemId: string, patch: Record<string, unknown>) {
      const component = this.getComponent(componentId) as any;
      if (component?.type !== "auto_layout_list") return;

      const index = component.items.findIndex((item: any) => item.id === itemId);
      if (index === -1) return;

      component.items[index] = {
        ...component.items[index],
        ...patch,
      };
      scheduleSave();
      return component.items[index];
    },

    deleteAutoLayoutItem(componentId: string, itemId: string) {
      const component = this.getComponent(componentId) as any;
      if (component?.type !== "auto_layout_list") return;
      if (component.items.length <= 1) return;

      const index = component.items.findIndex((item: any) => item.id === itemId);
      if (index === -1) return;

      component.items.splice(index, 1);
      scheduleSave();
    },

    reorderAutoLayoutItem(componentId: string, itemId: string, direction: "up" | "down") {
      const component = this.getComponent(componentId) as any;
      if (component?.type !== "auto_layout_list") return;

      const index = component.items.findIndex((item: any) => item.id === itemId);
      if (index === -1) return;

      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= component.items.length) return;

      const [item] = component.items.splice(index, 1);
      component.items.splice(targetIndex, 0, item);
      scheduleSave();
    },

    moveComponent(id: string, dx: number, dy: number) {
      if (!project) return;
      const components = viewMode === "dashboard" ? currentDashboardPage?.components : currentDetailView?.components;
      if (!components) return;
      const component = components.find((c) => c.id === id);
      if (component) {
        component.position.x = Math.max(0, Math.min(component.position.x + dx, project.display.width - 1));
        component.position.y = Math.max(0, Math.min(component.position.y + dy, project.display.height - 1));
        scheduleSave();
      }
    },

    // Project management
    updateProject(updates: Partial<Project>) {
      if (project) {
        Object.assign(project, updates);
        scheduleSave();
      }
    },

    async createNewProject(name: string, config?: ProjectConfig): Promise<Project> {
      const display = {
        width: config?.display?.width ?? 240,
        height: config?.display?.height ?? 320,
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

      // Save to server
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, data: newProject }),
      });
      const saved = await res.json();

      project = newProject;
      this.enablePageHeader();
      serverProjectId = saved.id;
      firmwareToken = saved.firmwareToken;
      currentDashboardPageId = newProject.dashboardPages[0].id;
      currentDetailViewId = null;
      viewMode = "dashboard";
      return newProject;
    },

    loadFromServer(serverProject: { id: string; name: string; data: any; firmwareToken: string }) {
      const parsed = serverProject.data as Project;
      project = parsed;
      serverProjectId = serverProject.id;
      firmwareToken = serverProject.firmwareToken;
      currentDashboardPageId = parsed.dashboardPages[0]?.id ?? "";
      currentDetailViewId = null;
      viewMode = "dashboard";
    },

    // Keep for backward compatibility during migration
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

    async deleteProject(id: string) {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
      if (serverProjectId === id) {
        project = null;
        serverProjectId = null;
        firmwareToken = null;
      }
    },

    async listProjects(): Promise<{ id: string; name: string; updatedAt: string }[]> {
      const res = await fetch('/api/projects');
      if (!res.ok) return [];
      return res.json();
    },

    // localStorage migration
    getLocalStorageProjects() {
      return getProjectsIndex();
    },

    clearLocalStorage() {
      if (!browser) return;
      const index = getProjectsIndex();
      for (const p of index) {
        localStorage.removeItem(`${PROJECT_PREFIX}${p.id}`);
      }
      localStorage.removeItem(PROJECTS_INDEX_KEY);
    },

    getLocalProjectData(id: string): Project | null {
      if (!browser) return null;
      const saved = localStorage.getItem(`${PROJECT_PREFIX}${id}`);
      return saved ? JSON.parse(saved) : null;
    },

    exportJSON(): string {
      return project ? JSON.stringify(project) : "";
    },

    importJSON(json: string): boolean {
      try {
        const parsed = JSON.parse(json);
        if (!parsed.id || !parsed.name || !parsed.display) return false;

        project = parsed;
        currentDashboardPageId = parsed.dashboardPages[0]?.id ?? "";
        currentDetailViewId = null;
        viewMode = "dashboard";
        scheduleSave();
        return true;
      } catch (e) {
        console.error("Failed to import project", e);
        return false;
      }
    },
  };
}

export const projectStore = createProjectStore();
