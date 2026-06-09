import type { Project } from '@esphome-designer/schema';

interface ChangeItem {
  message: string;
}

export interface ProjectChanges {
  items: ChangeItem[];
}

function countComponents(project: Project): number {
  let count = 0;
  for (const page of project.dashboardPages) {
    count += page.components.length;
  }
  for (const dv of project.detailViews) {
    count += dv.components.length;
  }
  if (project.pageHeader?.components) {
    count += project.pageHeader.components.length;
  }
  return count;
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
      const compDiff = page.components.length - prev.components.length;
      if (compDiff > 0) {
        items.push({ message: `Added ${compDiff} component${compDiff > 1 ? 's' : ''} to page "${page.name}"` });
      } else if (compDiff < 0) {
        items.push({ message: `Removed ${Math.abs(compDiff)} component${Math.abs(compDiff) > 1 ? 's' : ''} from page "${page.name}"` });
      }
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
      const compDiff = dv.components.length - prev.components.length;
      if (compDiff > 0) {
        items.push({ message: `Added ${compDiff} component${compDiff > 1 ? 's' : ''} to detail view "${dv.title}"` });
      } else if (compDiff < 0) {
        items.push({ message: `Removed ${Math.abs(compDiff)} component${Math.abs(compDiff) > 1 ? 's' : ''} from detail view "${dv.title}"` });
      }
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
    const newCount = current.pageHeader.components?.length ?? 0;
    const oldCount = previous.pageHeader.components?.length ?? 0;
    const diff = newCount - oldCount;
    if (diff > 0) {
      items.push({ message: `Added ${diff} component${diff > 1 ? 's' : ''} to page header` });
    } else if (diff < 0) {
      items.push({ message: `Removed ${Math.abs(diff)} component${Math.abs(diff) > 1 ? 's' : ''} from page header` });
    }
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
