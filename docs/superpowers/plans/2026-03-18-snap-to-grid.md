# Snap-to-Grid Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a separate toggle for grid snapping independent of grid visibility, so the grid remains visible for orientation while elements move freely.

**Architecture:** New `gridSnapEnabled` boolean in appState, a 1-line change in `getEffectiveGridSize()` to gate snapping, a new action + menu item in the hamburger preferences. Default: OFF.

**Tech Stack:** React, TypeScript. Yarn monorepo. Use `/tmp/yarn.sh` instead of `yarn`.

**Spec:** `docs/superpowers/specs/2026-03-18-board-features-design.md` (section 1)

---

### Task 1: Add gridSnapEnabled flag and gate snapping

**Files:**

- Modify: `packages/excalidraw/types.ts:440` (AppState type)
- Modify: `packages/excalidraw/appState.ts:70,192` (default + persistence)
- Modify: `packages/excalidraw/components/App.tsx:1311` (getEffectiveGridSize)

- [ ] **Step 1: Add `gridSnapEnabled` to AppState type**

In `packages/excalidraw/types.ts`, find `gridModeEnabled: boolean;` (line 440). Add after it:

```typescript
gridSnapEnabled: boolean;
```

Also find the optional props interface (line ~646, `gridModeEnabled?: boolean;`). Add after it:

```typescript
gridSnapEnabled?: boolean;
```

- [ ] **Step 2: Add default and persistence config**

In `packages/excalidraw/appState.ts`, find `gridModeEnabled: false,` (line 70). Add after it:

```typescript
gridSnapEnabled: false,
```

Find the persistence config for `gridModeEnabled` (line 192). Add after it:

```typescript
gridSnapEnabled: { browser: true, export: true, server: true },
```

- [ ] **Step 3: Gate snapping in getEffectiveGridSize**

In `packages/excalidraw/components/App.tsx`, find `getEffectiveGridSize` (line ~1311):

```typescript
public getEffectiveGridSize = () => {
  return (isGridModeEnabled(this) ? this.state.gridSize : null) as NullableGridSize;
};
```

Replace with:

```typescript
public getEffectiveGridSize = () => {
  return (isGridModeEnabled(this) && this.state.gridSnapEnabled
    ? this.state.gridSize
    : null) as NullableGridSize;
};
```

- [ ] **Step 4: Verify and commit**

```bash
cd H:/excalidraw && /tmp/yarn.sh test:typecheck && /tmp/yarn.sh fix
cd packages/excalidraw && /tmp/yarn.sh build:esm
git add packages/excalidraw/types.ts packages/excalidraw/appState.ts packages/excalidraw/components/App.tsx
git commit -m "feat: add gridSnapEnabled flag (default off, decoupled from grid visibility)"
```

---

### Task 2: Add toggle action and menu item

**Files:**

- Create: `packages/excalidraw/actions/actionToggleGridSnap.tsx`
- Modify: `packages/excalidraw/components/main-menu/DefaultItems.tsx:482-499`
- Modify: `packages/excalidraw/locales/en.json`
- Modify: `packages/excalidraw/locales/ru-RU.json`

- [ ] **Step 1: Create the action**

Create `packages/excalidraw/actions/actionToggleGridSnap.tsx`:

```typescript
import { CaptureUpdateAction } from "@excalidraw/element";

import { register } from "./register";

import type { AppState } from "../types";

export const actionToggleGridSnap = register({
  name: "gridSnap",
  keywords: ["snap", "grid", "привязка"],
  label: "labels.gridSnap",
  viewMode: false,
  trackEvent: {
    category: "canvas",
    predicate: (appState) => appState.gridSnapEnabled,
  },
  perform(elements, appState) {
    return {
      appState: {
        ...appState,
        gridSnapEnabled: !this.checked!(appState),
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: AppState) => appState.gridSnapEnabled,
  predicate: (element, appState) => {
    // Only show when grid is visible — snapping without grid makes no sense
    return appState.gridModeEnabled;
  },
});
```

- [ ] **Step 2: Register the action**

In `packages/excalidraw/actions/index.ts`, find line 79:

```typescript
export { actionToggleGridMode } from "./actionToggleGridMode";
```

Add after it:

```typescript
export { actionToggleGridSnap } from "./actionToggleGridSnap";
```

- [ ] **Step 3: Add menu item in DefaultItems.tsx**

In `packages/excalidraw/components/main-menu/DefaultItems.tsx`, find `PreferencesToggleGridModeItem` (line 482). Add a new component after it:

```typescript
export const PreferencesToggleGridSnapItem = () => {
  const { t } = useI18n();
  const actionManager = useExcalidrawActionManager();
  const appState = useUIAppState();

  // Only show when grid is enabled
  if (!appState.gridModeEnabled) {
    return null;
  }

  return (
    <DropdownMenuItemCheckbox
      checked={appState.gridSnapEnabled}
      onSelect={(event) => {
        actionManager.executeAction(actionToggleGridSnap);
        event.preventDefault();
      }}
    >
      {t("labels.gridSnap")}
    </DropdownMenuItemCheckbox>
  );
};
```

Import `actionToggleGridSnap` at the top of the file.

- [ ] **Step 4: Add menu item to hamburger preferences**

In the same file `packages/excalidraw/components/main-menu/DefaultItems.tsx`, find the `Preferences` component's default children (line ~573):

```typescript
<PreferencesToggleGridModeItem />
```

Add after it:

```typescript
<PreferencesToggleGridSnapItem />
```

Also add the compound property assignment near line ~591 (where other `Preferences.Toggle*` assignments are):

```typescript
Preferences.ToggleGridSnap = PreferencesToggleGridSnapItem;
```

- [ ] **Step 5: Add translations**

In `packages/excalidraw/locales/en.json`, in the `"labels"` section, add:

```json
"gridSnap": "Grid snapping"
```

In `packages/excalidraw/locales/ru-RU.json`, in the `"labels"` section, add:

```json
"gridSnap": "Привязка к сетке"
```

- [ ] **Step 6: Verify and commit**

```bash
cd H:/excalidraw && /tmp/yarn.sh test:typecheck && /tmp/yarn.sh fix
cd packages/excalidraw && /tmp/yarn.sh build:esm
git add packages/excalidraw/actions/actionToggleGridSnap.tsx packages/excalidraw/actions/index.ts packages/excalidraw/components/main-menu/DefaultItems.tsx packages/excalidraw/locales/en.json packages/excalidraw/locales/ru-RU.json
git commit -m "feat: grid snap toggle in hamburger menu preferences"
```

---

### Task 3: Consumer default and version bump

**Files:**

- Modify: `h:/billion-dollars/apps/frontend/features/whiteboard/components/excalidraw-canvas.tsx`
- Modify: `packages/excalidraw/package.json`

- [ ] **Step 1: Add consumer default**

In `h:/billion-dollars/apps/frontend/features/whiteboard/components/excalidraw-canvas.tsx`, find the `defaultAppState` object (line ~88). Add:

```typescript
gridSnapEnabled: false,
```

- [ ] **Step 2: Bump version**

In `packages/excalidraw/package.json`, change `"version": "0.26.41"` to `"version": "0.26.42"`.

- [ ] **Step 3: Full verify, build, publish, install**

```bash
cd H:/excalidraw && /tmp/yarn.sh fix && /tmp/yarn.sh test:typecheck
cd packages/excalidraw && /tmp/yarn.sh build:esm
git add packages/excalidraw/package.json
git commit -m "chore: bump version to 0.26.42"
/tmp/yarn.sh publish --non-interactive
```

Then install in billion-dollars:

```bash
cd h:/billion-dollars/apps/frontend
NPM_TOKEN=<from .npmrc> npm install @emevart/excalidraw@0.26.42
git add apps/frontend/package.json apps/frontend/package-lock.json apps/frontend/features/whiteboard/components/excalidraw-canvas.tsx
git commit -m "fix: excalidraw 0.26.42 (grid snap toggle, default off)"
```
