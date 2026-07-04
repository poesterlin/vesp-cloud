import type { Component, Project } from '@vesp-cloud/schema';

interface ChangeItem {
  message: string;
}

export interface ProjectChanges {
  items: ChangeItem[];
}

function getComponentName(c: any): string {
  return c?.label || c?.text || c?.title || c?.name || c?.id || 'component';
}

function describeComponentChange(oldC: any, newC: any): string | null {
  if (JSON.stringify(oldC) === JSON.stringify(newC)) return null;

  const name = getComponentName(newC);
  const changes: string[] = [];

  if (oldC.position?.x !== newC.position?.x || oldC.position?.y !== newC.position?.y) {
    changes.push('moved');
  }
  if (oldC.size?.width !== newC.size?.width || oldC.size?.height !== newC.size?.height) {
    changes.push('resized');
  }

  const textFields = ['text', 'label', 'title', 'onText', 'offText'];
  for (const f of textFields) {
    if (f in oldC && oldC[f] !== newC[f]) {
      changes.push(`changed ${f}`);
      break;
    }
  }

  const bindingFields = ['entityBinding', 'stateBinding', 'valueBinding', 'loadingBinding'];
  for (const f of bindingFields) {
    if (oldC[f]?.entityId !== newC[f]?.entityId) {
      changes.push('changed binding');
      break;
    }
  }

  if (oldC.icon !== newC.icon) {
    changes.push('changed icon');
  }

  const oldTabs = oldC.tabs?.length ?? 0;
  const newTabs = newC.tabs?.length ?? 0;
  if (newTabs > oldTabs) {
    changes.push(`added ${newTabs - oldTabs} tab${newTabs - oldTabs > 1 ? 's' : ''}`);
  } else if (newTabs < oldTabs) {
    changes.push(`removed ${oldTabs - newTabs} tab${oldTabs - newTabs > 1 ? 's' : ''}`);
  }

  const oldItems = oldC.items?.length ?? 0;
  const newItems = newC.items?.length ?? 0;
  if (newItems > oldItems) {
    changes.push(`added ${newItems - oldItems} item${newItems - oldItems > 1 ? 's' : ''}`);
  } else if (newItems < oldItems) {
    changes.push(`removed ${oldItems - newItems} item${oldItems - newItems > 1 ? 's' : ''}`);
  }

  const oldVariants = oldC.variants?.length ?? 0;
  const newVariants = newC.variants?.length ?? 0;
  if (newVariants > oldVariants) {
    changes.push(`added ${newVariants - oldVariants} condition variant${newVariants - oldVariants > 1 ? 's' : ''}`);
  } else if (newVariants < oldVariants) {
    changes.push(`removed ${oldVariants - newVariants} condition variant${oldVariants - newVariants > 1 ? 's' : ''}`);
  }

  if (oldC.visible !== newC.visible) {
    changes.push(newC.visible === false ? 'hidden' : 'shown');
  }

  if (oldC.variant !== newC.variant) {
    changes.push(`changed style to "${newC.variant ?? 'default'}"`);
  }

  if (oldC.min !== newC.min || oldC.max !== newC.max) {
    changes.push('changed range');
  }

  if (oldC.action?.type !== newC.action?.type || oldC.action?.service !== newC.action?.service) {
    changes.push('changed action');
  }

  if (changes.length === 0) {
    return `Modified "${name}"`;
  }
  return `Modified "${name}" (${changes.join(', ')})`;
}

function buildComponentMap(components: Component[]) {
  const map = new Map<string, Component>();
  for (const c of components) {
    map.set(c.id, c);
  }
  return map;
}

function diffComponents(
  context: string,
  prevComponents: Component[],
  currComponents: Component[],
): ChangeItem[] {
  const items: ChangeItem[] = [];
  const prevMap = buildComponentMap(prevComponents);
  const currMap = buildComponentMap(currComponents);

  const added: string[] = [];
  for (const c of currComponents) {
    if (!prevMap.has(c.id)) {
      added.push(getComponentName(c));
    }
  }
  if (added.length === 1) {
    items.push({ message: `Added "${added[0]}" ${context}` });
  } else if (added.length > 1) {
    items.push({ message: `Added ${added.length} components ${context}` });
  }

  const removed: string[] = [];
  for (const c of prevComponents) {
    if (!currMap.has(c.id)) {
      removed.push(getComponentName(c));
    }
  }
  if (removed.length === 1) {
    items.push({ message: `Removed "${removed[0]}" ${context}` });
  } else if (removed.length > 1) {
    items.push({ message: `Removed ${removed.length} components ${context}` });
  }

  const modified: string[] = [];
  for (const c of currComponents) {
    const prev = prevMap.get(c.id);
    if (prev) {
      const desc = describeComponentChange(prev, c);
      if (desc) modified.push(desc);
    }
  }

  if (modified.length <= 3) {
    for (const m of modified) {
      items.push({ message: `${m} ${context}` });
    }
  } else {
    items.push({ message: `Modified ${modified.length} components ${context}` });
  }

  return items;
}

export function diffProject(current: Project, previous: Project): ProjectChanges {
  const items: ChangeItem[] = [];

  const prevPageMap = new Map(previous.dashboardPages.map((p) => [p.id, p]));
  const currPageMap = new Map(current.dashboardPages.map((p) => [p.id, p]));

  for (const page of current.dashboardPages) {
    const prev = prevPageMap.get(page.id);
    if (!prev) {
      items.push({ message: `Added page "${page.name}"` });
    } else {
      items.push(...diffComponents(`on page "${page.name}"`, prev.components, page.components));
    }
  }

  for (const page of previous.dashboardPages) {
    if (!currPageMap.has(page.id)) {
      items.push({ message: `Removed page "${page.name}"` });
    }
  }

  const prevDvMap = new Map(previous.detailViews.map((d) => [d.id, d]));
  const currDvMap = new Map(current.detailViews.map((d) => [d.id, d]));

  for (const dv of current.detailViews) {
    const prev = prevDvMap.get(dv.id);
    if (!prev) {
      items.push({ message: `Added detail view "${dv.title}"` });
    } else {
      items.push(...diffComponents(`on detail view "${dv.title}"`, prev.components, dv.components));
    }
  }

  for (const dv of previous.detailViews) {
    if (!currDvMap.has(dv.id)) {
      items.push({ message: `Removed detail view "${dv.title}"` });
    }
  }

  const prevDisplay = previous.display;
  const currDisplay = current.display;
  if (prevDisplay && currDisplay) {
    if (prevDisplay.width !== currDisplay.width || prevDisplay.height !== currDisplay.height) {
      items.push({
        message: `Display size changed from ${prevDisplay.width}×${prevDisplay.height} to ${currDisplay.width}×${currDisplay.height}`,
      });
    }
  }

  if (current.theme && previous.theme) {
    if (current.theme.id !== previous.theme.id) {
      items.push({ message: `Theme changed from "${previous.theme.name}" to "${current.theme.name}"` });
    }
  } else if (current.theme && !previous.theme) {
    items.push({ message: 'Added a theme' });
  } else if (!current.theme && previous.theme) {
    items.push({ message: 'Removed the theme' });
  }

  const prevFonts = previous.fonts ?? [];
  const currFonts = current.fonts ?? [];
  const addedFonts = currFonts.filter((f) => !prevFonts.find((pf) => pf.id === f.id));
  const removedFonts = prevFonts.filter((f) => !currFonts.find((cf) => cf.id === f.id));
  for (const f of addedFonts) {
    items.push({ message: `Added font "${f.id}"` });
  }
  for (const f of removedFonts) {
    items.push({ message: `Removed font "${f.id}"` });
  }

  if (current.pageHeader && !previous.pageHeader) {
    items.push({ message: 'Added page header' });
  } else if (!current.pageHeader && previous.pageHeader) {
    items.push({ message: 'Removed page header' });
  } else if (current.pageHeader && previous.pageHeader) {
    items.push(
      ...diffComponents(
        'on page header',
        previous.pageHeader.components ?? [],
        current.pageHeader.components ?? [],
      ),
    );
  }

  const prevOverlay = previous.notificationOverlay;
  const currOverlay = current.notificationOverlay;
  if (currOverlay?.enabled && !prevOverlay?.enabled) {
    items.push({ message: 'Enabled notification overlay' });
  } else if (!currOverlay?.enabled && prevOverlay?.enabled) {
    items.push({ message: 'Disabled notification overlay' });
  }

  if (current.timezone && current.timezone !== previous.timezone) {
    items.push({ message: `Timezone changed to "${current.timezone}"` });
  } else if (previous.timezone && !current.timezone) {
    items.push({ message: 'Timezone removed' });
  }

  const prevPages = previous.dashboardPages.length;
  const currPages = current.dashboardPages.length;
  if (items.length === 0 && currPages !== prevPages) {
    items.push({ message: 'Pages reorganized' });
  }

  return { items };
}
