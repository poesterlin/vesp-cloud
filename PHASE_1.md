# Phase 1 Implementation Plan: Full Navigation Model + Pixel-Perfect Rendering

**Created:** 2026-01-17  
**Status:** In Progress  
**Goal:** Implement dual-mode navigation (Dashboard Carousel + Detail Views) with pixel-perfect rendering matching the hand-coded ESP reference.

---

## Current State Summary

### Already Implemented

| Feature | Status | Location |
|---------|--------|----------|
| Monorepo scaffolding (bun workspaces) | Done | `web/` |
| JSON Schema (basic components) | Done | `web/packages/schema/components.json` |
| TypeScript type generation | Done | `web/packages/schema/generate-types.ts` |
| Project store (Svelte 5 runes) | Done | `web/packages/editor/src/lib/stores/project.svelte.ts` |
| Selection store | Done | `web/packages/editor/src/lib/stores/selection.svelte.ts` |
| History store (undo/redo) | Done | `web/packages/editor/src/lib/stores/history.svelte.ts` |
| Basic canvas with drag-and-drop | Done | `web/packages/editor/src/lib/components/canvas/DesignCanvas.svelte` |
| Component renderers (basic) | Done | `web/packages/editor/src/lib/components/canvas/renderers/` |
| C++ code generator (basic) | Done | `web/packages/editor/src/lib/codegen/cpp.ts` |
| YAML code generator (basic) | Done | `web/packages/editor/src/lib/codegen/esphome.ts` |
| Editor layout (3-column) | Done | `web/packages/editor/src/routes/+page.svelte` |

### Reference Implementation (Hand-Coded ESP)

| File | Purpose | Key Patterns |
|------|---------|--------------|
| `state_manager.h` | Central state, ViewState enum, navigation | Loading triplet, volatile flags |
| `touch_handler.h` | Touch/swipe/scroll detection | Gesture thresholds, hit-testing |
| `button.h` | Button with loading animation | Shadow, corner accents, spinner |
| `render_helpers.h` | Shared drawing utilities | RetroBox, icons, headers |
| `render_pages.h` | Dashboard carousel pages | Fixed layout, 4 pages |
| `render_details.h` | Detail view dispatcher | Scroll offset pattern |
| `render_detail_*.h` | Individual detail views | Vertical scroll, back button |
| `colors.h` | Color palette | C_CYAN, C_AMBER, etc. |

---

## Phase 1 Scope

### Features to Implement

1. **Schema Extensions** - ViewMode, DetailView, NavigationAction, variant, loadingBinding
2. **Pixel-Perfect Renderers** - SVG renderers matching ESP rendering exactly
3. **Editor UI** - Separate tabs for Dashboard/Detail views, static preview
4. **C++ Codegen** - Generate state_manager.h, touch_handler.h, full rendering code

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Edit mode for views | Separate tabs | Matches runtime separation (Dashboard vs Detail) |
| Preview interactivity | Static preview | Simplifies initial implementation |
| Rendering approach | SVG-based | Easier to match exact pixel coordinates |
| Navigation state | Separate store | Keep project data separate from runtime state |
| Theme system | Project-level setting | Themes affect colors/decorations, not component structure |

### Theme System Architecture

**Key Principle:** Themes are a **project-level setting** that affects rendering style (colors, shadows, decorations) but **never** changes component structure (size, position, type).

**Theme affects:**
- Color palette (background, accent, text colors)
- Decorative elements (shadows, corner accents, borders)
- Loading animations style
- Header/footer styling

**Theme does NOT affect:**
- Component dimensions (width, height)
- Component positions (x, y)
- Component types or properties
- Touch zones / hit areas

**Implementation approach:**
- `Theme` definition in schema with color palette and style flags
- `ThemeProvider` pattern - renderers receive theme context
- Single "retro" theme implemented now, structure supports future themes
- C++ codegen generates theme-aware rendering functions

---

## Task Checklist

### Legend

| State | Meaning |
|-------|---------|
| `[ ]` | Todo |
| `[~]` | In Progress |
| `[?]` | Help Required |
| `[x]` | Done |

---

### 1. Schema Extensions

| Status | Task | Description |
|--------|------|-------------|
| `[x]` | 1.1 Add Theme definition | Color palette, style flags (shadows, corners, etc.) |
| `[x]` | 1.2 Add ViewMode enum | `DASHBOARD`, `DETAIL` |
| `[x]` | 1.3 Add NavigationAction | `OPEN_DETAIL`, `GO_BACK`, `NEXT_PAGE`, `PREV_PAGE` with targetId |
| `[x]` | 1.4 Add DetailView definition | `id`, `title`, `components`, `maxScrollY` |
| `[x]` | 1.5 Add loadingBinding to BaseComponent | EntityBinding for loading state |
| `[x]` | 1.6 Add onTap to BaseComponent | ActionBinding or NavigationAction |
| `[x]` | 1.7 Add ContainerComponent | Generic box/container (theme controls decoration) |
| `[x]` | 1.8 Add ProceduralIconComponent | `iconType`: bulb, window, vacuum, climate |
| `[x]` | 1.9 Update Project structure | Add `theme`, `dashboardPages` and `detailViews` |
| `[x]` | 1.10 Regenerate TypeScript types | Run `bun run generate:types` and verify |

---

### 2. Theme System & Drawing Utilities

| Status | Task | Description |
|--------|------|-------------|
| `[x]` | 2.1 Create themes/index.ts | Theme registry and types |
| `[x]` | 2.2 Create themes/retro.ts | Retro theme definition (colors, style flags) |
| `[ ]` | 2.3 Create theme-context.svelte.ts | Svelte context for theme access |
| `[ ]` | 2.4 Create themed-drawing.ts | SVG generators that accept theme parameter |
| `[x]` | 2.5 Implement themedBox() | Box drawing based on theme style |
| `[x]` | 2.6 Implement themedButton() | Button decorations based on theme |
| `[ ]` | 2.7 Create esp-fonts.ts | Font size mappings (small/medium/large) |

---

### 3. Theme-Aware Renderers

| Status | Task | Description |
|--------|------|-------------|
| `[x]` | 3.1 Create ContainerRenderer.svelte | Generic container, theme controls decoration |
| `[x]` | 3.2 Update ButtonRenderer.svelte | Theme-aware rendering (shadow, corners, loading) |
| `[x]` | 3.3 Create ProceduralIconRenderer.svelte | Bulb, window, vacuum, climate icons |
| `[x]` | 3.4 Implement bulb icon | Circle with 8 radiating lines when on |
| `[x]` | 3.5 Implement window icon | Rectangle with cross pattern |
| `[x]` | 3.6 Implement vacuum icon | Simple robot shape |
| `[x]` | 3.7 Implement climate icon | Thermometer or similar |
| `[ ]` | 3.8 Create PageIndicator.svelte | Horizontal dots, colors from theme |
| `[ ]` | 3.9 Create DetailHeader.svelte | Back button + centered title, themed |
| `[ ]` | 3.10 Create CommonHeader.svelte | Time/date display, themed borders |

---

### 4. Navigation Store & Editor UI

| Status | Task | Description |
|--------|------|-------------|
| `[x]` | 4.1 Create navigation.svelte.ts | viewMode, currentPageId, currentDetailId |
| `[x]` | 4.2 Add setDashboardPage() | Switch dashboard page |
| `[x]` | 4.3 Add openDetailView() | Open a detail view |
| `[x]` | 4.4 Add goBack() | Return to dashboard |
| `[x]` | 4.5 Update project.svelte.ts | Add dashboardPages and detailViews management |
| `[x]` | 4.6 Create ViewTypeSelector.svelte | Tab switcher: Dashboard / Detail Views |
| `[x]` | 4.7 Create DashboardPageList.svelte | List/tabs for dashboard pages |
| `[x]` | 4.8 Create DetailViewList.svelte | List/tabs for detail views |
| `[x]` | 4.9 Update DesignCanvas.svelte | Render based on navigation state |
| `[x]` | 4.10 Update +page.svelte | Integrate view type selector |

---

### 5. C++ Code Generation

| Status | Task | Description |
|--------|------|-------------|
| `[x]` | 5.1 Create state-manager.ts | Generate state_manager.h |
| `[x]` | 5.2 Generate ViewState enum | From detailViews[].id |
| `[x]` | 5.3 Generate DisplayState struct | All entity bindings as state variables |
| `[x]` | 5.4 Generate gState global | Inline DisplayState instance |
| `[x]` | 5.5 Generate navigation functions | nextPage(), prevPage(), openView(), goBack() |
| `[x]` | 5.6 Generate Button definitions | From components with onTap |
| `[x]` | 5.7 Create touch-handler.ts | Generate touch_handler.h |
| `[x]` | 5.8 Generate handleTouch() | Swipe detection, scroll handling |
| `[x]` | 5.9 Generate handleTap() | Hit-test components, trigger actions |
| `[x]` | 5.10 Generate scroll bounds | Calculate maxScrollY per detail view |
| `[x]` | 5.11 Create render-helpers.ts | Theme-aware C++ helper generators |
| `[x]` | 5.12 Generate drawThemedBox() | C++ function using theme colors/style |
| `[x]` | 5.13 Generate drawCommonHeader() | Time/date header with theme |
| `[x]` | 5.14 Generate drawDetailHeader() | Back button + title with theme |
| `[x]` | 5.15 Generate drawPageIndicator() | Navigation dots with theme colors |
| `[x]` | 5.16 Update cpp.ts - renderDisplay() | Main dispatcher (dashboard vs detail) |
| `[x]` | 5.17 Update cpp.ts - page renderers | Theme-aware styling |
| `[x]` | 5.18 Update cpp.ts - detail renderers | Scroll offset + theme |
| `[x]` | 5.19 Update cpp.ts - button rendering | Theme-aware with loading |
| `[ ]` | 5.20 Update esphome.ts | Add touch polling, scroll globals |

**Files to create:**
- `web/packages/editor/src/lib/codegen/state-manager.ts`
- `web/packages/editor/src/lib/codegen/touch-handler.ts`
- `web/packages/editor/src/lib/codegen/render-helpers.ts`

**Files to modify:**
- `web/packages/editor/src/lib/codegen/cpp.ts`
- `web/packages/editor/src/lib/codegen/esphome.ts`

---

### 6. Integration & Testing

| Status | Task | Description |
|--------|------|-------------|
| `[ ]` | 6.1 Create sample project JSON | 2 dashboard pages, 2 detail views |
| `[ ]` | 6.2 Test type generation | Verify all new types work |
| `[ ]` | 6.3 Test web renderers | Visual comparison with ESP screenshots |
| `[ ]` | 6.4 Test C++ compilation | `esphome compile` succeeds |
| `[ ]` | 6.5 Compare generated code | Structure matches hand-coded reference |
| `[ ]` | 6.6 Fix rendering discrepancies | Iterate until pixel-perfect |
| `[ ]` | 6.7 Document any schema changes | Update WEB_ARCHITECTURE.md if needed |

---

## Technical Reference

### Theme Structure

```typescript
interface Theme {
  id: string;
  name: string;
  
  // Color palette
  colors: {
    background: Color;
    backgroundSecondary: Color;
    foreground: Color;
    foregroundMuted: Color;
    accent: Color;
    accentSecondary: Color;
    success: Color;
    warning: Color;
    error: Color;
  };
  
  // Style flags - what decorations to apply
  style: {
    buttonShadow: boolean;      // 3px offset shadow
    buttonCornerAccents: boolean; // White corner highlights
    containerCorners: boolean;  // Double-line corner decoration
    headerBorders: boolean;     // Vertical edge lines
  };
  
  // Numeric style values
  values: {
    shadowOffset: number;       // Shadow offset in pixels (e.g., 3)
    cornerSize: number;         // Corner accent size (e.g., 10)
    borderRadius: number;       // Border radius (0 for sharp corners)
  };
}
```

### Retro Theme (default)

```typescript
const retroTheme: Theme = {
  id: "retro",
  name: "Retro",
  colors: {
    background: { r: 0, g: 0, b: 0 },
    backgroundSecondary: { r: 26, g: 26, b: 26 },
    foreground: { r: 255, g: 255, b: 255 },
    foregroundMuted: { r: 128, g: 128, b: 128 },
    accent: { r: 0, g: 255, b: 255 },       // Cyan
    accentSecondary: { r: 255, g: 191, b: 0 }, // Amber
    success: { r: 0, g: 255, b: 0 },
    warning: { r: 255, g: 191, b: 0 },
    error: { r: 255, g: 0, b: 0 },
  },
  style: {
    buttonShadow: true,
    buttonCornerAccents: true,
    containerCorners: true,
    headerBorders: true,
  },
  values: {
    shadowOffset: 3,
    cornerSize: 10,
    borderRadius: 0,
  },
};
```

### Legacy Color Constants (from colors.h)

```typescript
// These map to theme.colors for backward compatibility
const COLORS = {
  C_BLACK:   { r: 0,   g: 0,   b: 0   },    // background
  C_WHITE:   { r: 255, g: 255, b: 255 },    // foreground
  C_CYAN:    { r: 0,   g: 255, b: 255 },    // accent
  C_AMBER:   { r: 255, g: 191, b: 0   },    // accentSecondary
  C_GREEN:   { r: 0,   g: 255, b: 0   },    // success
  C_RED:     { r: 255, g: 0,   b: 0   },    // error
  C_BLUE:    { r: 0,   g: 0,   b: 255 },
  C_MAGENTA: { r: 255, g: 0,   b: 255 },
  C_DIM:     { r: 128, g: 128, b: 128 },    // foregroundMuted
  C_DIMMER:  { r: 64,  g: 64,  b: 64  },    // backgroundSecondary
};
```

### Themed Box Drawing (based on render_helpers.h)

```
Corner pattern (10px segments, double lines):
┌──        ──┐
│            │
             
│            │
└──        ──┘
```

### Button Retro Style (from button.h)

- Shadow: 3px offset, dark color
- Border: 1px highlight
- Corner accents: White, 10px from corners
- Loading: Rotating line animation at center

### Gesture Thresholds (from touch_handler.h)

- Dashboard swipe: |dx| > 30px
- Tap detection: |dx| < 10px && |dy| < 20px (dashboard)
- Tap detection: |dx| < 20px && |dy| < 20px (detail)
- Scroll: Any vertical drag in detail mode

### Scroll Offset Pattern (from render_detail_*.h)

```cpp
int ly = 45;  // Logical Y starting point
auto getSY = [&](int logicalY) { return logicalY + gState.scrollY; };

// Use getSY(ly) for all Y coordinates
// At end: gState.maxScrollY = max(0, totalHeight - 280);
```

---

## File Structure After Phase 1

```
web/packages/
├── schema/
│   ├── components.json          # Extended with navigation + theme
│   ├── generate-types.ts
│   └── dist/
│       └── types.ts             # Regenerated
│
└── editor/src/lib/
    ├── components/
    │   ├── canvas/
    │   │   ├── DesignCanvas.svelte      # Modified
    │   │   ├── CommonHeader.svelte      # NEW
    │   │   ├── DetailHeader.svelte      # NEW
    │   │   ├── PageIndicator.svelte     # NEW
    │   │   └── renderers/
    │   │       ├── ButtonRenderer.svelte      # Modified (theme-aware)
    │   │       ├── ContainerRenderer.svelte   # NEW
    │   │       ├── ProceduralIconRenderer.svelte # NEW
    │   │       └── ComponentRenderer.svelte   # Modified
    │   └── sidebar/
    │       ├── ViewTypeSelector.svelte  # NEW
    │       ├── DashboardPageList.svelte # NEW
    │       └── DetailViewList.svelte    # NEW
    ├── stores/
    │   ├── project.svelte.ts    # Modified
    │   └── navigation.svelte.ts # NEW
    ├── themes/                  # NEW directory
    │   ├── index.ts             # Theme registry
    │   ├── retro.ts             # Retro theme definition
    │   └── theme-context.svelte.ts # Svelte context
    ├── codegen/
    │   ├── cpp.ts               # Modified
    │   ├── esphome.ts           # Modified
    │   ├── state-manager.ts     # NEW
    │   ├── touch-handler.ts     # NEW
    │   └── render-helpers.ts    # NEW (theme-aware)
    └── utils/
        ├── themed-drawing.ts    # NEW
        └── esp-fonts.ts         # NEW
```

---

## Progress Summary

| Section | Total | Done | In Progress | Help Required | Todo |
|---------|-------|------|-------------|---------------|------|
| 1. Schema Extensions | 10 | 0 | 0 | 0 | 10 |
| 2. Theme System & Utils | 7 | 0 | 0 | 0 | 7 |
| 3. Theme-Aware Renderers | 10 | 0 | 0 | 0 | 10 |
| 4. Navigation Store & UI | 10 | 0 | 0 | 0 | 10 |
| 5. C++ Code Generation | 20 | 0 | 0 | 0 | 20 |
| 6. Integration & Testing | 7 | 0 | 0 | 0 | 7 |
| **Total** | **64** | **0** | **0** | **0** | **64** |

---

## Notes & Blockers

_Add notes here as implementation progresses_

- 

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-17 | Initial plan created |
