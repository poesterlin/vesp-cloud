import { browser } from "$app/environment";
import { toUpperSnakeCase } from "$lib/utils";
import type {
  Component,
  DetailView,
  DisplayConfig,
  Page,
  PageHeader,
  Project,
  Theme,
} from "@vesp-cloud/schema";
import { RETRO_THEME } from "../themes/retro";
import { conditionalEditorStore } from "./conditional-editor.svelte";
import { selectionStore } from "./selection.svelte";

const LATEST_VERSION = "1.0.0";
const PROJECTS_INDEX_KEY = "vesp-cloud-projects-index";
const PROJECT_PREFIX = "vesp-cloud-project-";
const TAB_HEADER_HEIGHT = 36;
const HEADER_RENDER_HEIGHT = 49;

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
      const res = await fetch(`/api/projects/${serverProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: project.name, data: project }),
      });
      if (!res.ok) throw new Error(`Save failed: ${res.status} ${res.statusText}`);
    } catch (e) {
      console.error('Failed to save project', e);
      throw e;
    } finally {
      saving = false;
    }
  }

  async function immediateSave() {
    if (saveTimer) clearTimeout(saveTimer);
    await saveToServer();
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

  const effectiveHeaderHeight = (height?: number) =>
    Math.max(height ?? 0, HEADER_RENDER_HEIGHT);

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
      selectionStore.clear();
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
          selectionStore.clear();
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
        height: view?.height ?? 480,
        components: view?.components ?? [],
      };
      project.detailViews.push(newView);
      currentDetailViewId = newView.id;
      viewMode = "detail";
      selectionStore.clear();
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
          selectionStore.clear();
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
    enablePageHeader(height: number = HEADER_RENDER_HEIGHT) {
      if (!project) return;
      const safeHeight = effectiveHeaderHeight(height);
      const defaultTimeComponent: Component = {
        id: `text-header-${Date.now()}`,
        type: "text",
        text: "12:00",
        fontSize: "large",
        align: "center",
        position: { x: 0, y: 4 },
        size: { width: project.display.width, height: safeHeight - 8 },
      } as Component;
      project.pageHeader = {
        height: safeHeight,
        components: [defaultTimeComponent],
      };
      scheduleSave();
    },

    updatePageHeader(updates: Partial<PageHeader>) {
      if (!project?.pageHeader) return;
      const next: Partial<PageHeader> = { ...updates };
      if (typeof next.height === "number") {
        next.height = effectiveHeaderHeight(next.height);
      }
      Object.assign(project.pageHeader, next);
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

    isComponentNested(id: string): boolean {
      if (!project) return false;

      const containsNested = (components: Component[], depth: number): boolean => {
        for (const component of components) {
          if (component.id === id) return depth > 0;
          if (component.type === "conditional_area") {
            for (const variant of component.variants) {
              if (containsNested(variant.components, depth + 1)) return true;
            }
          } else if (component.type === "tab_container") {
            for (const tab of component.tabs) {
              if (containsNested(tab.components, depth + 1)) return true;
            }
          }
        }
        return false;
      };

      if (project.pageHeader && containsNested(project.pageHeader.components, 0)) return true;
      for (const page of project.dashboardPages) {
        if (containsNested(page.components, 0)) return true;
      }
      for (const view of project.detailViews) {
        if (containsNested(view.components, 0)) return true;
      }
      return false;
    },

    moveComponentToRoot(id: string): boolean {
      if (!project) return false;

      // Reparent atomically. Replacing the project model ensures every derived
      // canvas value observes the new root array; mutating the source and
      // destination arrays in place can leave a derived array cached.
      const nextProject = JSON.parse(JSON.stringify(project)) as Project;

      const moveFromRoot = (root: Component[]): boolean => {
        // Root component positions and nested component positions use different
        // coordinate spaces. Accumulate the container offsets while finding the
        // child so it remains in the same visual location after reparenting.
        const removeNested = (
          components: Component[],
          origin: { x: number; y: number },
          depth: number,
        ): Component | undefined => {
          for (let index = 0; index < components.length; index += 1) {
            const component = components[index];
            if (component.id === id) {
              if (depth === 0) return undefined;
              components.splice(index, 1);
              component.position = {
                x: origin.x + component.position.x,
                y: origin.y + component.position.y,
              };
              return component;
            }

            const componentOrigin = {
              x: origin.x + component.position.x,
              y: origin.y + component.position.y,
            };
            if (component.type === "conditional_area") {
              for (const variant of component.variants) {
                const found = removeNested(variant.components, componentOrigin, depth + 1);
                if (found) return found;
              }
            } else if (component.type === "tab_container") {
              const tabOrigin = {
                x: componentOrigin.x,
                y: componentOrigin.y + TAB_HEADER_HEIGHT,
              };
              for (const tab of component.tabs) {
                const found = removeNested(tab.components, tabOrigin, depth + 1);
                if (found) return found;
              }
            }
          }
          return undefined;
        };

        const component = removeNested(root, { x: 0, y: 0 }, 0);
        if (!component) return false;
        root.push(component);
        return true;
      };

      let moved = false;
      if (nextProject.pageHeader) {
        moved = moveFromRoot(nextProject.pageHeader.components);
      }
      if (!moved) {
        for (const page of nextProject.dashboardPages) {
          if (moveFromRoot(page.components)) {
            moved = true;
            break;
          }
        }
      }
      if (!moved) {
        for (const view of nextProject.detailViews) {
          if (moveFromRoot(view.components)) {
            moved = true;
            break;
          }
        }
      }
      if (!moved) return false;

      project = nextProject;
      scheduleSave();
      return true;
    },

    moveComponentIntoContainer(id: string, parentId: string): boolean {
      if (!project || id === parentId || this.isComponentNested(id)) return false;

      const parent = this.getComponent(parentId);
      if (parent?.type !== "conditional_area" && parent?.type !== "tab_container") {
        return false;
      }

      const parentPosition = this.getComponentAbsolutePosition(parentId);
      const targetOffsetY = parent.type === "tab_container" ? TAB_HEADER_HEIGHT : 0;
      const nextProject = JSON.parse(JSON.stringify(project)) as Project;

      const findInComponents = (components: Component[]): Component | undefined => {
        for (const component of components) {
          if (component.id === parentId) return component;
          if (component.type === "conditional_area") {
            for (const variant of component.variants) {
              const found = findInComponents(variant.components);
              if (found) return found;
            }
          } else if (component.type === "tab_container") {
            for (const tab of component.tabs) {
              const found = findInComponents(tab.components);
              if (found) return found;
            }
          }
        }
        return undefined;
      };

      const moveWithinRoot = (root: Component[]): boolean => {
        const sourceIndex = root.findIndex((component) => component.id === id);
        if (sourceIndex === -1) return false;
        const target = findInComponents(root);
        if (!target || (target.type !== "conditional_area" && target.type !== "tab_container")) {
          return false;
        }

        const [component] = root.splice(sourceIndex, 1);
        component.position = {
          x: component.position.x - parentPosition.x,
          y: component.position.y - parentPosition.y - targetOffsetY,
        };

        if (target.type === "conditional_area") {
          const variantId = conditionalEditorStore.getActiveVariant(
            target.id,
            target.defaultVariantId ?? target.variants[0]?.id,
          );
          const variant = target.variants.find((item) => item.id === variantId) ?? target.variants[0];
          if (!variant) return false;
          variant.components.push(component);
        } else {
          const tabId = conditionalEditorStore.getActiveTab(
            target.id,
            target.defaultTabId ?? target.tabs[0]?.id,
          );
          const tab = target.tabs.find((item) => item.id === tabId) ?? target.tabs[0];
          if (!tab) return false;
          tab.components.push(component);
        }
        return true;
      };

      let moved = false;
      if (nextProject.pageHeader) moved = moveWithinRoot(nextProject.pageHeader.components);
      if (!moved) {
        for (const page of nextProject.dashboardPages) {
          if (moveWithinRoot(page.components)) {
            moved = true;
            break;
          }
        }
      }
      if (!moved) {
        for (const view of nextProject.detailViews) {
          if (moveWithinRoot(view.components)) {
            moved = true;
            break;
          }
        }
      }
      if (!moved) return false;

      project = nextProject;
      scheduleSave();
      return true;
    },

    updateComponent(id: string, updates: Partial<Component>, skipSave?: boolean) {
      if (!project) return;

      const updateInComponents = (components: Component[]): boolean => {
        const idx = components.findIndex((c) => c.id === id);
        if (idx !== -1) {
          const merged: any = { ...components[idx], ...updates };
          for (const key of Object.keys(updates)) {
            if (merged[key] === undefined) {
              delete merged[key];
            }
          }
          components[idx] = merged as Component;
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
        if (!skipSave) scheduleSave();
        return;
      }
      // Also search header components
      if (project.pageHeader && updateInComponents(project.pageHeader.components)) {
        if (!skipSave) scheduleSave();
      }
    },

    batchUpdateComponents(updates: Array<{ id: string; updates: Partial<Component> }>) {
      if (!project) return;
      for (const { id, updates: u } of updates) {
        this.updateComponent(id, u, true);
      }
      scheduleSave();
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
                return { parent: c, offsetY: TAB_HEADER_HEIGHT };
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

      const contentY =
        viewMode === "dashboard"
          ? (project.pageHeader ? effectiveHeaderHeight(project.pageHeader.height) : 0)
          : 0;
      visit(activeComponents, { x: 0, y: contentY }, []);

      return bounds;
    },

    getComponentLayoutBounds(id: string): ComponentLayoutBounds | undefined {
      return this.getVisibleComponentLayoutBounds().find((bounds) => bounds.id === id);
    },

    getComponentParentLayoutSurface(id: string): LayoutSurface | undefined {
      if (!project) return undefined;

      const displayWidth = project.display.width;
      const contentY =
        viewMode === "dashboard"
          ? (project.pageHeader ? effectiveHeaderHeight(project.pageHeader.height) : 0)
          : 0;
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
          height: effectiveHeaderHeight(project.pageHeader.height),
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

    async saveNow() { await immediateSave(); },

    async createNewProject(name: string, config?: ProjectConfig): Promise<Project> {
      const display = {
        width: config?.display?.width ?? 480,
        height: config?.display?.height ?? 480,
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
        body: JSON.stringify({ id: newProject.id, name, data: newProject }),
      });
      const saved = await res.json();

      project = newProject;
      this.enablePageHeader();
      serverProjectId = saved.id;
      currentDashboardPageId = newProject.dashboardPages[0].id;
      currentDetailViewId = null;
      viewMode = "dashboard";
      selectionStore.clear();
      return newProject;
    },

    loadFromServer(serverProject: { id: string; name: string; data: any }) {
      const parsed = serverProject.data as Project;
      project = parsed;
      serverProjectId = serverProject.id;
      currentDashboardPageId = parsed.dashboardPages[0]?.id ?? "";
      currentDetailViewId = null;
      viewMode = "dashboard";
      selectionStore.clear();
      if (!project.pageHeader) {
        this.enablePageHeader();
      }
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
          selectionStore.clear();
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
        selectionStore.clear();
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
        selectionStore.clear();
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
