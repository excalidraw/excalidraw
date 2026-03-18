# Board Polish v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine tooltips (delay, font, missing buttons) and rework highlighter to use three independent settings sets (pencil/highlighter/shape) with yellow default and mobile support.

**Architecture:** Two independent task groups: tooltip polish (Tasks 1-2) and highlighter settings refactor (Task 3, single atomic task). Tasks 1-2 are simple, Task 3 is the big one.

**Tech Stack:** React, TypeScript, SCSS. Yarn monorepo. Use `/tmp/yarn.sh` instead of `yarn`.

**Spec:** `docs/superpowers/specs/2026-03-18-board-polish-v2-design.md`

---

### Task 1: Tooltip delay and font size

**Files:**

- Modify: `packages/excalidraw/components/Tooltip.tsx`
- Modify: `packages/excalidraw/components/Tooltip.scss`

- [ ] **Step 1: Add delay to Tooltip component**

In `packages/excalidraw/components/Tooltip.tsx`, add a `useRef` for the timer and modify the pointer handlers.

Current code (lines 86-119):

```typescript
export const Tooltip = ({
  children,
  label,
  long = false,
  style,
  disabled,
}: TooltipProps) => {
  useEffect(() => {
    return () =>
      getTooltipDiv().classList.remove("excalidraw-tooltip--visible");
  }, []);
  if (disabled) {
    return null;
  }
  return (
    <div
      className="excalidraw-tooltip-wrapper"
      onPointerEnter={(event) =>
        updateTooltip(
          event.currentTarget as HTMLDivElement,
          getTooltipDiv(),
          label,
          long,
        )
      }
      onPointerLeave={() =>
        getTooltipDiv().classList.remove("excalidraw-tooltip--visible")
      }
      style={style}
    >
      {children}
    </div>
  );
};
```

Replace with:

```typescript
const TOOLTIP_DELAY = 400;

export const Tooltip = ({
  children,
  label,
  long = false,
  style,
  disabled,
}: TooltipProps) => {
  const timerRef = useRef<number>(0);

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      getTooltipDiv().classList.remove("excalidraw-tooltip--visible");
    };
  }, []);

  if (disabled) {
    return null;
  }
  return (
    <div
      className="excalidraw-tooltip-wrapper"
      onPointerEnter={(event) => {
        const target = event.currentTarget as HTMLDivElement;
        clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          updateTooltip(target, getTooltipDiv(), label, long);
        }, TOOLTIP_DELAY);
      }}
      onPointerLeave={() => {
        clearTimeout(timerRef.current);
        getTooltipDiv().classList.remove("excalidraw-tooltip--visible");
      }}
      style={style}
    >
      {children}
    </div>
  );
};
```

Add `useRef` to the React import at the top of the file if not already there.

- [ ] **Step 2: Reduce font size**

In `packages/excalidraw/components/Tooltip.scss`, change line 21:

From: `font-size: 13px;` To: `font-size: 11px;`

- [ ] **Step 3: Verify and commit**

```bash
cd H:/excalidraw && /tmp/yarn.sh test:typecheck && /tmp/yarn.sh fix
cd packages/excalidraw && /tmp/yarn.sh build:esm
git add packages/excalidraw/components/Tooltip.tsx packages/excalidraw/components/Tooltip.scss
git commit -m "fix: tooltip delay 400ms and smaller font (11px)"
```

---

### Task 2: Missing tooltips and extra tools hover

**Files:**

- Modify: `packages/excalidraw/components/Actions.tsx`
- Modify: `packages/excalidraw/components/main-menu/MainMenu.tsx`
- Modify: `packages/excalidraw/components/Toolbar.scss`

- [ ] **Step 1: Add tooltip to stroke settings buttons**

In `packages/excalidraw/components/Actions.tsx`, there are 4 instances of `compact-action-button properties-trigger` (lines ~389, ~481, ~578, ~689). Each is a `<button>` with a `title=` attribute, rendered inside `<Popover.Trigger asChild>`.

**IMPORTANT:** These buttons are children of `<Popover.Trigger asChild>`, which uses Radix's Slot pattern. Wrapping with `<Tooltip>` (a `<div>`) would break ref forwarding. Instead, place the `<Tooltip>` **outside** the `<Popover.Root>`, wrapping the entire popover trigger. OR, since ToolButton already handles tooltips, simply keep the native `title=` attribute on these specific buttons (they already have it). If the native `title=` was already replaced with `<Tooltip>` in v1, verify that it works. If it breaks Radix, revert to native `title=` for these buttons only.

Alternatively, the cleanest approach: wrap the `<Popover.Trigger>` itself (not its child) with `<Tooltip>`:

```tsx
<Tooltip label={t("labels.stroke")}>
  <Popover.Trigger asChild>
    <button className={clsx("compact-action-button properties-trigger", { active: isOpen })}
      onClick={...}>
      {adjustmentsIcon}
    </button>
  </Popover.Trigger>
</Tooltip>
```

Test that this doesn't break the popover. If it does, fall back to native `title=`.

- [ ] **Step 2: Add tooltip to extra tools trigger**

In `Actions.tsx`, find the extra tools `DropdownMenu.Trigger` (line ~1491-1518) with `title={t("toolBar.extraTools")}`. Remove `title=` and wrap with `<Tooltip>`:

```tsx
<Tooltip label={t("toolBar.extraTools")}>
  <DropdownMenu.Trigger className={...} onToggle={...}>
    {/* existing content */}
  </DropdownMenu.Trigger>
</Tooltip>
```

If wrapping DropdownMenu.Trigger doesn't work with Radix, wrap the content inside instead.

- [ ] **Step 3: Add tooltip to hamburger menu**

In `packages/excalidraw/components/main-menu/MainMenu.tsx`, the trigger is `DropdownMenu.Trigger` at lines 38-50. Import `Tooltip` from `"../Tooltip"`. Add tooltip outside the trigger:

```tsx
<Tooltip label={t("buttons.menu")}>
  <DropdownMenu.Trigger
    onToggle={...}
    data-testid="main-menu-trigger"
    className="main-menu-trigger"
  >
    {HamburgerMenuIcon}
  </DropdownMenu.Trigger>
</Tooltip>
```

- [ ] **Step 4: Fix extra tools hover effect**

In `packages/excalidraw/components/Toolbar.scss`, find lines 46-48:

```scss
&:hover {
  background-color: transparent;
}
```

Replace with:

```scss
&:hover {
  background-color: var(--button-hover-bg);
}
```

- [ ] **Step 5: Verify and commit**

```bash
cd H:/excalidraw && /tmp/yarn.sh test:typecheck && /tmp/yarn.sh fix
cd packages/excalidraw && /tmp/yarn.sh build:esm
git add packages/excalidraw/components/Actions.tsx packages/excalidraw/components/main-menu/MainMenu.tsx packages/excalidraw/components/Toolbar.scss
git commit -m "fix: add tooltips to stroke settings, hamburger, extra tools + hover"
```

---

### Task 3: Three settings sets + Actions/MobileToolBar update (atomic)

This is one atomic task because changing the settings API in App.tsx requires updating all consumers (Actions.tsx, MobileToolBar.tsx, types.ts) in the same commit to pass typecheck.

**Files:**

- Modify: `packages/excalidraw/components/App.tsx`
- Modify: `packages/excalidraw/types.ts`
- Modify: `packages/excalidraw/components/Actions.tsx`
- Modify: `packages/excalidraw/components/MobileToolBar.tsx`

- [ ] **Step 1: Replace highlighter state with three settings sets in App.tsx**

Find module-level variables (lines 617-626):

```typescript
let isHighlighterMode = false;
let savedPencilSettings: {
  strokeWidth: number;
  opacity: number;
} | null = null;

const HIGHLIGHTER_DEFAULTS = {
  strokeWidth: 12,
  opacity: 40,
};
```

Replace with:

```typescript
// Three independent settings sets for pencil, highlighter, and shapes
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
let isHighlighterMode = false;
```

- [ ] **Step 2: Delete `toggleHighlighterMode` method (lines 5646-5669), replace with new methods**

Delete the entire `toggleHighlighterMode` method body. Add in its place:

```typescript
setHighlighterMode = (enabled: boolean) => {
  isHighlighterMode = enabled;
};

applyToolSettings = (key: "pencil" | "highlighter" | "shape") => {
  activeSettingsKey = key;
  const s = toolSettings[key];
  this.setState({
    currentItemStrokeWidth: s.strokeWidth,
    currentItemOpacity: s.opacity,
    currentItemStrokeColor: s.strokeColor,
  });
};

private syncActiveSettings = () => {
  toolSettings[activeSettingsKey] = {
    strokeWidth: this.state.currentItemStrokeWidth,
    opacity: this.state.currentItemOpacity,
    strokeColor: this.state.currentItemStrokeColor,
  };
};
```

- [ ] **Step 3: Hook syncActiveSettings into componentDidUpdate**

In `componentDidUpdate` (line 3376), add before the method's closing `}`:

```typescript
// Sync property changes back to the active settings set
if (
  prevState.currentItemStrokeWidth !== this.state.currentItemStrokeWidth ||
  prevState.currentItemOpacity !== this.state.currentItemOpacity ||
  prevState.currentItemStrokeColor !== this.state.currentItemStrokeColor
) {
  this.syncActiveSettings();
}
```

- [ ] **Step 4: Add settings switch to setActiveTool**

In `setActiveTool` method (ends at line 5644), add before the closing `};`:

```typescript
// Apply settings based on tool type
// hand/eraser/laser don't create elements — skip to avoid overwriting settings
if (tool.type === "freedraw") {
  this.applyToolSettings(isHighlighterMode ? "highlighter" : "pencil");
} else if (
  tool.type !== "hand" &&
  tool.type !== "eraser" &&
  tool.type !== "laser"
) {
  this.applyToolSettings("shape");
}
```

- [ ] **Step 5: Update types.ts**

In `packages/excalidraw/types.ts`, find line 851:

```typescript
toggleHighlighterMode: App["toggleHighlighterMode"];
```

Replace with:

```typescript
setHighlighterMode: App["setHighlighterMode"];
applyToolSettings: App["applyToolSettings"];
```

- [ ] **Step 6: Update freedraw ToolPopover callbacks in Actions.tsx**

Find the freedraw ToolPopover block (lines ~1405-1445). Update both `onToolChange` and `onSelect` — replace `app.toggleHighlighterMode(isHighlighter)` with:

```typescript
onToolChange={(type: string) => {
  const isHighlighter = type === "highlighter";
  app.setHighlighterMode(isHighlighter);
  app.setActiveTool({ type: "freedraw" });
  setPreferredFreedraw(type);
}}
onSelect={(type: string) => {
  trackEvent("toolbar", type, "ui");
  const isHighlighter = type === "highlighter";
  app.setHighlighterMode(isHighlighter);
  app.setActiveTool({ type: "freedraw" });
  setPreferredFreedraw(type);
}}
```

Call `setHighlighterMode` BEFORE `setActiveTool` so the flag is set when `setActiveTool` reads it.

- [ ] **Step 7: Add freedraw/highlighter dropdown to MobileToolBar**

In `packages/excalidraw/components/MobileToolBar.tsx`, find the freedraw ToolButton (lines 355-368).

Add imports at top:

```typescript
import { ToolPopover } from "./ToolPopover";
import { HighlighterIcon } from "./icons";
import { capitalizeString } from "@excalidraw/common";
```

Add local state for preferred freedraw type (inside the component, near other state):

```typescript
const [preferredFreedraw, setPreferredFreedraw] = useState<string>("freedraw");
```

Define the options:

```typescript
const MOBILE_FREEDRAW_TOOLS = [
  {
    type: "freedraw" as const,
    icon: FreedrawIcon,
    title: capitalizeString(t("toolBar.freedraw")),
  },
  {
    type: "highlighter" as const,
    icon: HighlighterIcon,
    title: capitalizeString(t("toolBar.highlighter")),
  },
];
```

Replace the single freedraw `ToolButton` with:

```typescript
{
  /* Free Draw / Highlighter */
}
<ToolPopover
  key="mobile-freedraw-popover"
  app={app}
  options={MOBILE_FREEDRAW_TOOLS}
  activeTool={{
    type: activeTool.type === "freedraw" ? preferredFreedraw : activeTool.type,
  }}
  defaultOption={preferredFreedraw}
  namePrefix="mobileFreedrawType"
  title={capitalizeString(t("toolBar.freedraw"))}
  data-testid="mobile-toolbar-freedraw"
  onToolChange={(type: string) => {
    const isHighlighter = type === "highlighter";
    app.setHighlighterMode(isHighlighter);
    app.setActiveTool({ type: "freedraw" });
    setPreferredFreedraw(type);
  }}
  onSelect={(type: string) => {
    const isHighlighter = type === "highlighter";
    app.setHighlighterMode(isHighlighter);
    app.setActiveTool({ type: "freedraw" });
    setPreferredFreedraw(type);
  }}
  displayedOption={
    MOBILE_FREEDRAW_TOOLS.find((t) => t.type === preferredFreedraw) ||
    MOBILE_FREEDRAW_TOOLS[0]
  }
/>;
```

IMPORTANT: Read `ToolPopover.tsx` to verify ALL required props are provided. Key required props: `app`, `options`, `activeTool`, `defaultOption`, `namePrefix`, `title`, `onToolChange`, `displayedOption`. Also `onSelect` is optional.

- [ ] **Step 8: Verify and commit**

```bash
cd H:/excalidraw && /tmp/yarn.sh test:typecheck && /tmp/yarn.sh fix
cd packages/excalidraw && /tmp/yarn.sh build:esm
git add packages/excalidraw/components/App.tsx packages/excalidraw/types.ts packages/excalidraw/components/Actions.tsx packages/excalidraw/components/MobileToolBar.tsx
git commit -m "refactor: three independent settings sets + highlighter in mobile toolbar"
```

---

### Task 4: Version bump and final verification

- [ ] **Step 1: Bump version**

In `packages/excalidraw/package.json`, change `"version": "0.26.39"` to `"version": "0.26.40"`.

- [ ] **Step 2: Full verification**

```bash
cd H:/excalidraw && /tmp/yarn.sh fix && /tmp/yarn.sh test:typecheck
cd packages/excalidraw && /tmp/yarn.sh build:esm
```

- [ ] **Step 3: Commit**

```bash
git add packages/excalidraw/package.json
git commit -m "chore: bump version to 0.26.40"
```
