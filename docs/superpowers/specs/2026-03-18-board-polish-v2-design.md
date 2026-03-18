# Board Polish v2 — Design Spec

> Refinements to tooltips and highlighter based on testing feedback.

## 1. Tooltip refinements

### 1a. Smaller font

- Reduce tooltip font-size to 11px in `Tooltip.scss` (currently 13px at line 21)

### 1b. Appearance delay

- Add ~400ms delay before showing tooltip in `Tooltip.tsx`
- Use `useRef<number>` inside the Tooltip component to hold timer ID
- `onPointerEnter`: start `setTimeout(400ms)` that shows tooltip; store timer ID in ref
- `onPointerLeave`: `clearTimeout` from ref, hide tooltip immediately
- Cleanup: existing `useEffect` return (line 93) should also `clearTimeout`

### 1c. Missing tooltips

- **Stroke settings button** — the adjustments/properties trigger button in `Actions.tsx` (the `Popover.Trigger` button with `className="compact-action-button properties-trigger"`, around line 390). Wrap with `<Tooltip label={t("labels.stroke")}>`
- **Hamburger menu button** — the main menu trigger. Find the actual trigger component (likely in `packages/excalidraw/components/main-menu/MainMenu.tsx` or its default trigger). Add `<Tooltip>`
- **Extra tools button** — the dropdown trigger at line ~1507 in `Actions.tsx` with `title={t("toolBar.extraTools")}`. Replace native `title=` with `<Tooltip>`

### 1d. Hover effect on extra tools button

- Current `Toolbar.scss` has `&:hover { background-color: transparent; }` on `.App-toolbar__extra-tools-trigger` — **remove** this override
- Add same hover CSS (`background-color: var(--button-hover-bg)`) as other toolbar buttons

**Files:**

- `packages/excalidraw/components/Tooltip.tsx` — delay logic with useRef
- `packages/excalidraw/components/Tooltip.scss` — font-size: 11px
- `packages/excalidraw/components/Actions.tsx` — tooltips on stroke settings + extra tools
- `packages/excalidraw/components/main-menu/MainMenu.tsx` (or trigger) — tooltip on hamburger
- `packages/excalidraw/components/Toolbar.scss` — remove hover:transparent override on extra tools

## 2. Highlighter refinements

### 2a. Three independent settings sets

Replace the current two-state `toggleHighlighterMode` with a three-set settings manager.

**Data structure** (module-level in App.tsx):

```typescript
type ToolSettings = {
  strokeWidth: number;
  opacity: number;
  strokeColor: string;
};

const toolSettings: Record<"pencil" | "highlighter" | "shape", ToolSettings> = {
  pencil: { strokeWidth: 2, opacity: 100, strokeColor: "#000000" },
  highlighter: { strokeWidth: 12, opacity: 40, strokeColor: "#ffeb3b" },
  shape: { strokeWidth: 2, opacity: 100, strokeColor: "#000000" },
};

let activeSettingsKey: "pencil" | "highlighter" | "shape" = "shape";
```

**Remove:** `savedPencilSettings`, `HIGHLIGHTER_DEFAULTS`, `toggleHighlighterMode` method.

**Keep (repurpose):** `isHighlighterMode` as a simple boolean flag — tracks which freedraw mode is active. No longer tied to `toggleHighlighterMode`.

**New method on App class:**

```typescript
public applyToolSettings = (key: "pencil" | "highlighter" | "shape") => {
  activeSettingsKey = key;
  const s = toolSettings[key];
  this.setState({
    currentItemStrokeWidth: s.strokeWidth,
    currentItemOpacity: s.opacity,
    currentItemStrokeColor: s.strokeColor,
  });
};
```

**Integration point — `setActiveTool`** (lines 5566-5644 in App.tsx):

Add settings-switch logic at the end of `setActiveTool`. Simple rule: **settings are determined by the currently active tool type, applied on every `setActiveTool` call:**

- If new tool is `"freedraw"` and `isHighlighterMode` flag → `applyToolSettings("highlighter")`
- If new tool is `"freedraw"` and NOT highlighter → `applyToolSettings("pencil")`
- For all other tools → `applyToolSettings("shape")`

Note: keep a simple `isHighlighterMode` boolean (not the old function — just a flag) to track which freedraw mode is active.

**Save settings on property change** — intercept in `App.tsx`:

When `currentItemStrokeWidth`, `currentItemOpacity`, or `currentItemStrokeColor` change via actions, persist back to the active set. Add a `componentDidUpdate` check or a helper that runs after `setState`:

```typescript
private syncActiveSettings = () => {
  toolSettings[activeSettingsKey] = {
    strokeWidth: this.state.currentItemStrokeWidth,
    opacity: this.state.currentItemOpacity,
    strokeColor: this.state.currentItemStrokeColor,
  };
};
```

Call `syncActiveSettings()` after property-change actions update state. This can be done in `componentDidUpdate` by comparing prev/current `currentItemStrokeWidth`, `currentItemOpacity`, `currentItemStrokeColor`.

### 2b. Default highlighter color = yellow (#ffeb3b)

- Included in `toolSettings.highlighter` defaults above

### 2c. Mobile toolbar

- Import `ToolPopover` into `MobileToolBar.tsx`
- Replace the single freedraw `ToolButton` with a `ToolPopover` dropdown containing pencil and highlighter options
- Use same `FREEDRAW_TOOLS` options array (pencil icon + highlighter icon)
- `onSelect` callback: set active tool to "freedraw", set `isHighlighterMode`, call `applyToolSettings`

### 2d. Shapes always use shape settings

- Handled by the rule in 2a: any tool that is not "freedraw" applies `shapeSettings`
- This covers all transitions: shape→shape, freedraw→shape, shape→eraser→shape, etc.
- The `setActiveTool` hook applies the correct set every time, regardless of transition path

### 2e. Update Actions.tsx callbacks

- The freedraw ToolPopover `onSelect` in `Actions.tsx` (lines ~1426-1437) currently calls `app.toggleHighlighterMode()` — update to call `app.applyToolSettings("highlighter")` or `app.applyToolSettings("pencil")` and set the `isHighlighterMode` flag
- Update `AppClassProperties` type in `types.ts` to replace `toggleHighlighterMode` with `applyToolSettings`

**Files:**

- `packages/excalidraw/components/App.tsx` — toolSettings, applyToolSettings, syncActiveSettings, setActiveTool hook
- `packages/excalidraw/components/Actions.tsx` — update freedraw popover callbacks
- `packages/excalidraw/components/MobileToolBar.tsx` — add freedraw/highlighter dropdown
- `packages/excalidraw/types.ts` — update AppClassProperties (applyToolSettings replaces toggleHighlighterMode)
- `packages/excalidraw/components/ToolPopover.tsx` — may need import in MobileToolBar
