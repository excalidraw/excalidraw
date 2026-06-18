---
name: draggable-top-toolbar
description: Guides implementing a movable Excalidraw top toolbar or top nav bar. Use when making the top toolbar, top nav, shapes toolbar, or main toolbar draggable, repositionable, or movable around the canvas.
---

# Draggable Top Toolbar

## Goal

Make the desktop top toolbar movable without changing drawing tools, canvas pointer handling, mobile toolbar behavior, or persisted scene data unless the task explicitly asks for persistence.

## Before Editing

Confirm:

- Whether the draggable target is the full top toolbar island, only the shapes toolbar, or a separate top nav wrapper
- Whether the toolbar position should reset on reload, persist locally, or be stored in `appState`
- Whether dragging should be enabled on desktop only
- What should happen when the viewport resizes or a right sidebar is docked
- Whether there should be a visible drag handle, or whether empty toolbar space is the drag target

Prefer desktop-only local UI state for the first implementation. Do not store toolbar coordinates in scene data or collaborative state unless persistence is explicitly required.

## Primary Insertion Points

Use these files first:

- `packages/excalidraw/components/LayerUI.tsx`: the desktop toolbar is rendered in `renderFixedSideContainer()` inside the `Section` with `className="shapes-section"`; wrap or augment the `Island` that contains `PenModeButton`, `LockButton`, and `ShapesSwitcher`
- `packages/excalidraw/components/Toolbar.scss`: add toolbar-specific draggable styles, handle affordance, and cursor styles
- `packages/excalidraw/components/LayerUI.scss`: adjust absolute positioning and pointer events only when the wrapper needs to move independently of the existing layer UI container
- `packages/excalidraw/components/Actions.tsx`: inspect `ShapesSwitcher` only if pointer handling conflicts with tool buttons, dropdowns, or popovers
- `packages/excalidraw/components/Island.tsx`: avoid changing this generic component unless the draggable wrapper truly needs a forwarded ref or style prop not already supported

Do not modify mobile toolbar files unless the request explicitly includes mobile.

## Implementation Guidance

Keep the drag behavior close to the toolbar render site:

- Track the toolbar offset with `useState` or `useRef` in `LayerUI`
- Use pointer events with pointer capture for drag start, move, and end
- Start dragging only from a dedicated handle or from non-interactive toolbar space
- Ignore drags that start on buttons, dropdown triggers, popover content, or inputs
- Clamp the toolbar position to the visible editor container so it cannot be lost off-screen
- Recalculate or clamp when `appState.width`, `appState.height`, compact mode, zen mode, or docked sidebar layout changes

Respect existing `pointer-events: none` on `.layer-ui__wrapper`; the draggable toolbar itself must keep `pointer-events: var(--ui-pointerEvents)` so canvas interaction remains unchanged outside the toolbar.

## Interaction Rules

Dragging the toolbar must not:

- Select a drawing tool
- Trigger the main menu or extra tools dropdown
- Start canvas panning, selection, or element creation
- Break keyboard shortcuts or tool button focus
- Move the toolbar during view mode, zen transitions, or mobile layout unless explicitly required

If a visible drag handle is added, give it an accessible label and keep it keyboard-focusable only if keyboard repositioning is implemented.

## Tests

Add focused tests only when implementation code is changed:

- Verify pointer-dragging the toolbar changes its position
- Verify clicking `data-testid="toolbar-selection"` and other tool buttons still selects tools
- Verify dragging from an interactive toolbar button does not reposition the toolbar
- Verify the toolbar remains within bounds after resize or sidebar docking if those cases are supported

Prefer existing Excalidraw React test helpers and pointer events. Avoid broad snapshot updates unless an existing nearby test already relies on snapshots.

## Verification

Run the smallest useful checks first:

```bash
yarn test:typecheck
yarn test packages/excalidraw/tests
```

Before finishing, manually verify that the toolbar can be moved, tool buttons still work, dropdowns still open, the canvas remains interactive outside the toolbar, and the toolbar cannot be dragged out of reach.
