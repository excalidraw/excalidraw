# renderFixedSideContainer — LayerUI Top Bar

`renderFixedSideContainer()` is defined at `packages/excalidraw/components/LayerUI.tsx:288` and called at line 610. It builds the entire **top bar overlay** of the editor (desktop only — phone uses a separate `MobileMenu`).

---

## The Wrapper: FixedSideContainer

`FixedSideContainer` (`components/FixedSideContainer.tsx`) is a thin positioning div:

```tsx
<div className="FixedSideContainer FixedSideContainer_side_top">
  {children}
</div>
```

The CSS (`FixedSideContainer.scss`) pins it over the canvas:

```scss
.FixedSideContainer {
  position: absolute;
  pointer-events: none;          // clicks pass through to canvas
}

.FixedSideContainer > * {
  pointer-events: var(--ui-pointerEvents);  // re-enabled on children
}

.FixedSideContainer_side_top {
  left:   var(--editor-container-padding);
  top:    var(--editor-container-padding);
  right:  var(--editor-container-padding);
  bottom: var(--editor-container-padding);
}
```

This makes the UI float above the canvas. Gaps between buttons are transparent and clickable through to the drawing surface.

---

## Layout Structure

The container renders a single `App-menu App-menu_top` div with three zones:

```
┌──────────────────────────────────────────────────────────┐
│ ┌──────────┐  ┌──────────────────────┐  ┌─────────────┐ │
│ │  ≡ Menu  │  │  Style panel         │  │ Collaborators│ │
│ │          │  │  (stroke, fill,      │  │ Top-right UI │ │
│ │          │  │   font, opacity...)  │  │ Sidebar btn  │ │
│ │          │  │                      │  │ Stats        │ │
│ └──────────┘  └──────────────────────┘  └─────────────┘ │
│          ┌────────────────────────────┐                  │
│          │ 🖊 🔒 │ ✋ □ ◇ ○ → ╱ ~ T 📷 │                  │
│          │      shapes toolbar       │                  │
│          └────────────────────────────┘                  │
│                                                          │
│                     (canvas below)                       │
└──────────────────────────────────────────────────────────┘
```

---

## Zone 1 — Left Column (`App-menu_top__left`)

### renderCanvasActions() — line 229

The hamburger menu button area:

```tsx
<tunnels.MainMenuTunnel.Out />           // main menu (injected via tunnel from app layer)
<tunnels.WelcomeScreenMenuHintTunnel.Out />  // welcome screen hint (if active)
```

Uses React tunnels so the consuming app (e.g. `excalidraw-app`) can inject custom menu content into the library's UI slot.

### renderSelectedShapeActions() — line 238

The **style/properties panel** that appears when you have elements selected or a drawing tool active.

**Visibility decision** — `showSelectedShapeActions()` (`packages/element/src/showSelectedShapeActions.ts`):

```typescript
Boolean(
  !appState.viewModeEnabled &&
  appState.openDialog?.name !== "elementLinkSelector" &&
  (
    // A drawing tool is active (not selection/hand/eraser/laser/lasso)
    (appState.activeTool.type !== "custom" &&
      (appState.editingTextElement ||
        (appState.activeTool.type !== "selection" &&
         appState.activeTool.type !== "lasso" &&
         appState.activeTool.type !== "eraser" &&
         appState.activeTool.type !== "hand" &&
         appState.activeTool.type !== "laser")))
    ||
    // Or at least one element is selected
    getSelectedElements(elements, appState).length
  )
)
```

**Rendering** — two modes based on available width:

| Mode | Component | When |
|------|-----------|------|
| Compact | `CompactShapeActions` | `isCompactStylesPanel` is true (narrow viewport) |
| Full | `SelectedShapeActions` | Default |

Both are wrapped in an `Island` (rounded card) with a max-height of `appState.height - 166` to prevent overflow past the footer.

---

## Zone 2 — Center: Shapes Toolbar (line 317)

Hidden in view mode and when the element link selector dialog is open.

Wrapped in a `Section` with heading `"shapes"`, containing an `Island` card with:

| Component | Purpose |
|-----------|---------|
| `HintViewer` | Contextual keyboard shortcut hints |
| `PenModeButton` | Toggle pen/touch input mode |
| `LockButton` | Lock active tool (prevents revert to selection after drawing) |
| Divider | Visual separator |
| `HandButton` | Pan/hand tool |
| `ShapesSwitcher` | The shape buttons — selection, rectangle, diamond, ellipse, arrow, line, freedraw, text, image, eraser |

When `isCollaborating` is true, a second `Island` appears beside the toolbar with:

| Component | Purpose |
|-----------|---------|
| `LaserPointerButton` | Activate laser pointer for presentations |

The toolbar collapses in **zen mode** via the CSS class `zen-mode`.

---

## Zone 3 — Right Column (`layer-ui__wrapper__top-right`)

Positioned to the right, slides off-screen in zen mode via `transition-right`.

| Component | Condition | Purpose |
|-----------|-----------|---------|
| `UserList` | `collaborators.size > 0` | Avatar list of connected users |
| `renderTopRightUI` | Prop provided by consumer | Extension slot for custom UI |
| `DefaultSidebarTriggerTunnel.Out` | Not in view mode, sidebar not already docked | Button to open the properties sidebar |
| `Stats` | `appState.stats.open` and not in zen/view mode | Element statistics panel |

---

## Where It Sits in the Render Tree

```
LayerUI (components/LayerUI.tsx)
  └── div.layer-ui__wrapper
       ├── WelcomeScreenCenterTunnel.Out
       ├── renderFixedSideContainer()        ← this function
       │    └── FixedSideContainer side="top"
       │         └── div.App-menu.App-menu_top
       │              ├── Stack.Col (left: menu + style panel)
       │              ├── Section "shapes" (center: toolbar)
       │              └── div.top-right (collaborators, sidebar btn, stats)
       ├── Footer
       └── "Scroll back to content" button
```

---

## Key Design Decisions

1. **Pointer events passthrough** — the container itself is `pointer-events: none`. Only direct children get events. This lets users click/drag on the canvas through gaps between UI elements.

2. **Tunnel pattern** — the main menu and sidebar trigger use React tunnels (`tunnels.MainMenuTunnel`, `tunnels.DefaultSidebarTriggerTunnel`). This lets the consuming app inject content into the library's UI without prop drilling.

3. **Responsive modes** — the style panel switches between `SelectedShapeActions` (full) and `CompactShapeActions` (narrow) based on viewport width. The toolbar collapses in zen mode.

4. **Conditional rendering** — almost every piece is gated: view mode hides the toolbar and style panel, zen mode slides things off-screen, collaboration mode shows laser pointer and user list, stats panel is togglable.
