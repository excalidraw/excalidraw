---
name: draggable-top-toolbar
description: Guides implementing a movable Excalidraw top toolbar or top nav bar. Use when making the top toolbar, top nav, shapes toolbar, or main toolbar draggable, repositionable, or movable around the canvas.
---

# Draggable Top Toolbar

## Goal

Make the desktop top toolbar movable without changing drawing tools, canvas pointer handling, mobile toolbar behavior, or persisted scene data unless the task explicitly asks for persistence.

## Scope (default recipe)

- **Draggable target**: the desktop `Stack.Row` with class `App-toolbar-container` inside `renderFixedSideContainer()` → `Section` with `className="shapes-section"`
- **Drag handle**: dedicated left-edge grip inside the `Island` with class `App-toolbar`
- **State**: local React state in `LayerUI` only — not `appState`, not localStorage, not scene data
- **Files to change**: exactly 3
  1. `packages/excalidraw/components/LayerUI.tsx`
  2. `packages/excalidraw/components/Toolbar.scss`
  3. `packages/excalidraw/tests/toolbar.test.tsx`
- **Do not change**: `LayerUI.scss`, `Actions.tsx`, `Island.tsx`, mobile toolbar files

## Recipe checklist

```
- [ ] Step 1: Add module-level helpers in LayerUI.tsx
- [ ] Step 2: Add drag state and handlers in LayerUI component
- [ ] Step 3: Wire ref, transform, and drag handle in renderFixedSideContainer()
- [ ] Step 4: Add drag-handle styles in Toolbar.scss
- [ ] Step 5: Add toolbar.test.tsx
- [ ] Step 6: Run verification commands
```

---

## Step 1 — Module-level helpers (`LayerUI.tsx`)

Add these **above** `interface LayerUIProps`:

```ts
const TOOLBAR_DRAG_HANDLE_LABEL = "Drag toolbar";

const clamp = (value: number, min: number, max: number) => {
  if (min > max) {
    return (min + max) / 2;
  }

  return Math.min(Math.max(value, min), max);
};
```

---

## Step 2 — Drag state and handlers (`LayerUI.tsx`)

Inside the `LayerUI` component, **after** the `eyeDropperState` line, add:

### 2a. Refs and state

```ts
const toolbarContainerRef = React.useRef<HTMLDivElement | null>(null);
const toolbarOffsetRef = React.useRef({ x: 0, y: 0 });
const toolbarDragStateRef = React.useRef<{
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startOffsetX: number;
  startOffsetY: number;
} | null>(null);
const [toolbarOffset, setToolbarOffset] = React.useState({ x: 0, y: 0 });
const [isToolbarDragging, setIsToolbarDragging] = React.useState(false);
```

### 2b. Clamp offset to canvas bounds

```ts
const clampToolbarOffset = React.useCallback(
  (nextOffset: { x: number; y: number }) => {
    const toolbarContainer = toolbarContainerRef.current;

    if (!toolbarContainer) {
      return nextOffset;
    }

    const canvasRect = canvas.getBoundingClientRect();
    const toolbarRect = toolbarContainer.getBoundingClientRect();
    const currentOffset = toolbarOffsetRef.current;

    const minX = currentOffset.x + canvasRect.left - toolbarRect.left;
    const maxX = currentOffset.x + canvasRect.right - toolbarRect.right;
    const minY = currentOffset.y + canvasRect.top - toolbarRect.top;
    const maxY = currentOffset.y + canvasRect.bottom - toolbarRect.bottom;

    return {
      x: clamp(nextOffset.x, minX, maxX),
      y: clamp(nextOffset.y, minY, maxY),
    };
  },
  [canvas],
);
```

### 2c. Update offset (ref + state)

```ts
const updateToolbarOffset = React.useCallback(
  (nextOffset: { x: number; y: number }) => {
    const clampedOffset = clampToolbarOffset(nextOffset);
    const currentOffset = toolbarOffsetRef.current;

    if (
      currentOffset.x === clampedOffset.x &&
      currentOffset.y === clampedOffset.y
    ) {
      return;
    }

    toolbarOffsetRef.current = clampedOffset;
    setToolbarOffset(clampedOffset);
  },
  [clampToolbarOffset],
);
```

### 2d. Pointer handlers (handle only — not tool buttons)

```ts
const handleToolbarDragPointerDown = React.useCallback(
  (event: React.PointerEvent<HTMLButtonElement>) => {
    if (
      appState.zenModeEnabled ||
      (event.button !== 0 && event.pointerType !== "touch")
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentOffset = toolbarOffsetRef.current;
    toolbarDragStateRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startOffsetX: currentOffset.x,
      startOffsetY: currentOffset.y,
    };

    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    setIsToolbarDragging(true);
  },
  [appState.zenModeEnabled],
);

const handleToolbarDragPointerMove = React.useCallback(
  (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = toolbarDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    updateToolbarOffset({
      x: dragState.startOffsetX + event.clientX - dragState.startClientX,
      y: dragState.startOffsetY + event.clientY - dragState.startClientY,
    });
  },
  [updateToolbarOffset],
);

const handleToolbarDragPointerEnd = React.useCallback(
  (event: React.PointerEvent<HTMLButtonElement>) => {
    const dragState = toolbarDragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    toolbarDragStateRef.current = null;
    setIsToolbarDragging(false);

    if (
      event.currentTarget.hasPointerCapture?.(event.pointerId) &&
      event.currentTarget.releasePointerCapture
    ) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  },
  [],
);
```

### 2e. Re-clamp on layout changes

```ts
React.useEffect(() => {
  updateToolbarOffset(toolbarOffsetRef.current);
}, [
  appState.height,
  appState.openSidebar,
  appState.width,
  appState.zenModeEnabled,
  editorInterface.canFitSidebar,
  isCompactStylesPanel,
  updateToolbarOffset,
]);
```

---

## Step 3 — Wire JSX in `renderFixedSideContainer()` (`LayerUI.tsx`)

Find the `Stack.Row` with `className="App-toolbar-container"` inside the `shapes-section` render. Apply these three changes:

### 3a. Add ref, dragging class, and transform to `App-toolbar-container`

```tsx
<Stack.Row
  ref={toolbarContainerRef}
  gap={spacing.toolbarRowGap}
  className={clsx("App-toolbar-container", {
    "zen-mode": appState.zenModeEnabled,
    "App-toolbar-container--dragging": isToolbarDragging,
  })}
  style={{
    transform: `translate(${toolbarOffset.x}px, ${toolbarOffset.y}px)`,
  }}
>
```

`Stack.Row` already forwards refs — no change to `Stack.tsx` needed.

### 3b. Add drag handle as first child inside `Island.App-toolbar`

Insert **before** `<HintViewer>`:

```tsx
<button
  type="button"
  className="App-toolbar__drag-handle"
  aria-label={TOOLBAR_DRAG_HANDLE_LABEL}
  title={TOOLBAR_DRAG_HANDLE_LABEL}
  tabIndex={-1}
  disabled={appState.zenModeEnabled}
  onPointerDown={handleToolbarDragPointerDown}
  onPointerMove={handleToolbarDragPointerMove}
  onPointerUp={handleToolbarDragPointerEnd}
  onPointerCancel={handleToolbarDragPointerEnd}
/>
```

### 3c. Add `App-toolbar__content` class to the inner tool row

Change the `Stack.Row` wrapping `PenModeButton`, `LockButton`, and `ShapesSwitcher`:

```tsx
<Stack.Row
  className="App-toolbar__content"
  gap={spacing.toolbarInnerRowGap}
>
```

The collab laser `Island` stays a sibling inside `App-toolbar-container` and moves with the toolbar automatically.

---

## Step 4 — Styles (`Toolbar.scss`)

Add at the top of the `.excalidraw` block (before existing `.App-toolbar` rules):

```scss
.App-toolbar-container {
  will-change: transform;

  &--dragging {
    .App-toolbar__drag-handle {
      cursor: grabbing;
    }
  }
}

.App-toolbar {
  &__content {
    margin-inline-start: 0.75rem;
  }

  &__drag-handle {
    align-items: center;
    background: transparent;
    border: 0;
    border-radius: var(--border-radius-md);
    color: var(--icon-fill-color);
    cursor: grab;
    display: flex;
    height: calc(100% - calc(var(--padding) * var(--space-factor)));
    inset-inline-start: calc(var(--padding) * var(--space-factor));
    justify-content: center;
    min-height: 1.5rem;
    padding: 0;
    position: absolute;
    top: 50%;
    touch-action: none;
    transform: translateY(-50%);
    user-select: none;
    width: 0.75rem;

    &::before {
      background: currentColor;
      border-radius: 2px;
      box-shadow: 4px 0 0 currentColor;
      content: "";
      height: 1rem;
      opacity: 0.45;
      width: 2px;
    }

    &:hover,
    &:focus-visible {
      background: var(--button-hover-bg);
    }

    &:disabled {
      cursor: default;
      opacity: 0.35;
    }
  }
```

Inside the existing `.App-toolbar--compact` block, add:

```scss
.App-toolbar__content {
  margin-inline-start: 0.5rem;
}
```

No changes to `LayerUI.scss` were needed — existing `pointer-events: none` on `.layer-ui__wrapper` and `.shapes-section` already allow the toolbar to stay interactive.

---

## Step 5 — Tests (`packages/excalidraw/tests/toolbar.test.tsx`)

Create a new test file with two cases:

1. **Dragging the handle** moves `.App-toolbar-container` via `style.transform`
2. **Dragging a tool button** does not move the toolbar; clicking still selects the tool

Key test patterns:

- Mock `HTMLCanvasElement.prototype.getBoundingClientRect` for clamp bounds
- Override `.App-toolbar-container` `getBoundingClientRect` with a fixed rect
- Find handle via `screen.getByLabelText("Drag toolbar")`
- Use `fireEvent.pointerDown/Move/Up` with matching `pointerId`
- Assert `toolbar.style.transform === "translate(50px, 30px)"` after drag
- Assert `toolbar.style.transform === "translate(0px, 0px)"` after dragging a tool button
- Assert `h.state.activeTool.type` after `fireEvent.click(getByToolName("rectangle"))`

---

## Step 6 — Verification

```bash
yarn test:typecheck
yarn test packages/excalidraw/tests/toolbar.test.tsx --watch=false
```

Manual checks:

- Drag the left grip on the top toolbar — it moves
- Tool buttons, dropdowns, and popovers still work
- Canvas interaction outside the toolbar is unchanged
- Toolbar cannot be dragged off-screen
- Position resets on reload (local state only)

---

## What not to do

- Do not attach drag handlers to `ShapesSwitcher`, tool buttons, or the whole `Island`
- Do not store offset in `appState`, scene JSON, or localStorage unless explicitly requested
- Do not modify `MobileToolBar.tsx` unless mobile dragging is requested
- Do not change `Actions.tsx` — separating the handle from buttons avoids pointer conflicts

## Optional extensions (not in default recipe)

- **Persist position**: store offset in `localStorage` or `appState` and restore on mount
- **Reset button**: add a control that calls `updateToolbarOffset({ x: 0, y: 0 })`
- **Drag empty toolbar space**: only if handle is removed; requires `closest()` checks on interactive descendants
- **Keyboard repositioning**: remove `tabIndex={-1}` and add arrow-key handlers on the handle
