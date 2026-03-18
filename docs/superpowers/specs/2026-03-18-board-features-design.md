# Board Features — Design Spec

> Four independent features for the excalidraw whiteboard, ordered by implementation priority.

## 1. Snap-to-grid toggle

**New appState flag:** `gridSnapEnabled: boolean` (default: `false`)

**UI:** Hamburger menu → settings section, new toggle "Привязка к сетке" / "Grid snapping", placed next to the existing grid visibility toggle ("Переключить сетку").

**Behavior when `gridSnapEnabled === false`:**

- Drawing lines/freedraw — no snap
- Creating/resizing shapes — no snap
- Moving elements — no snap
- Moving vertices/points — no snap
- Grid remains visible (controlled separately by `gridModeEnabled`)

**Implementation approach:** Grid snapping is already coupled to grid visibility via `getEffectiveGridSize()` in `App.tsx`:

```typescript
public getEffectiveGridSize = () => {
  return (isGridModeEnabled(this) ? this.state.gridSize : null) as NullableGridSize;
};
```

When this returns `null`, `getGridPoint()` returns input unchanged (no snap). The simplest fix: modify `getEffectiveGridSize()` to also check `gridSnapEnabled`:

```typescript
public getEffectiveGridSize = () => {
  return (isGridModeEnabled(this) && this.state.gridSnapEnabled
    ? this.state.gridSize
    : null) as NullableGridSize;
};
```

This is a 1-line change — no need to touch ~20 call sites.

**i18n:**

- `labels.gridSnap` → "Привязка к сетке" (ru-RU)
- `labels.gridSnap` → "Grid snapping" (en)

**Consumer (`excalidraw-canvas.tsx`):** Add `gridSnapEnabled: false` to `defaultAppState`.

**Files:**

- `packages/excalidraw/appState.ts` — new flag with default
- `packages/excalidraw/types.ts` — add `gridSnapEnabled` to `AppState` type
- `packages/excalidraw/components/App.tsx` — modify `getEffectiveGridSize()` (1-line change)
- `packages/excalidraw/components/LayerUI.tsx` or hamburger menu component — toggle UI
- `packages/excalidraw/locales/ru-RU.json`, `en.json` — translation
- `h:/billion-dollars/.../excalidraw-canvas.tsx` — consumer default

## 2. Line straightening (hold-to-straighten, Procreate-style)

**Trigger:** While drawing a freedraw line, user stops moving (< 3px movement for 500ms) while still holding the pointer down.

**Stillness detection mechanism:** Use a `setTimeout` approach inside the freedraw pointer-move handler:

- On each `pointerMove` during freedraw, clear the previous timeout and start a new 500ms timeout
- When the timeout fires (no movement for 500ms), check pointer is still down → trigger straightening
- On `pointerUp`, clear the timeout (don't straighten on release)

**Detection constants:**

- `STRAIGHTEN_HOLD_TIME = 500` ms
- `STRAIGHTEN_MOVE_THRESHOLD = 3` px
- `STRAIGHTEN_MIN_LENGTH = 20` px (don't straighten very short strokes)
- `STRAIGHTEN_DEVIATION_THRESHOLD = 0.1` (10% of line length — below this, straighten to line; above, smooth to curve)

**Straightening logic:**

- Calculate max deviation of all drawn points from the straight line connecting start → end
- If `maxDeviation / lineLength < 0.1` → straighten to a perfect straight line (two points: start, end)
- Otherwise → smooth into a Bézier curve (fit a smooth curve through simplified points)
- If line length < 20px → do not straighten

**Animation:** Smooth transition ~200-300ms using `requestAnimationFrame` loop. The element is still `state.newElement` (not yet finalized) during freedraw. Interpolate each point position from original to target on each frame. Since the scene re-renders on every `mutateElement` call, progressively mutating points will create the animation.

**Undo behavior:** Straightening is part of the drawing gesture (happens before pointerUp finalizes the element). Ctrl+Z undoes the entire stroke, not just the straightening. This is the simplest approach and matches Procreate behavior.

**Files:**

- `packages/excalidraw/components/App.tsx` — stillness detection timer in freedraw pointer handling, animation on trigger
- `packages/excalidraw/utils/straighten.ts` — new file: straightening/smoothing math (deviation calculation, Bézier fitting)
- `packages/common/src/constants.ts` — straightening constants

## 3. Drag & drop image from problem card to inline whiteboard

**Source (billion-dollars):** `<img>` tags in `ProblemCardFullTabContent` that render `content_images` and `solution_images`. Add `draggable="true"` and `onDragStart` handler:

```typescript
onDragStart={(e) => {
  e.dataTransfer.setData("text/uri-list", imageUrl);
  e.dataTransfer.setData("text/plain", imageUrl);
  e.dataTransfer.effectAllowed = "copy";
}}
```

**Receiver (excalidraw):** Excalidraw does NOT currently handle `text/uri-list` or image URL drops. The existing `handleAppOnDrop` (App.tsx line ~12339) only handles file drops and library items. Text/plain goes to embeddable URL validation which rejects image URLs.

**New code path needed in `handleAppOnDrop`:**

1. Check `dataTransfer` for `text/uri-list` or `text/plain`
2. If the value looks like an image URL (ends with `.png`, `.jpg`, `.svg`, etc., or matches known CDN pattern)
3. Fetch the image as a blob (`fetch(url).then(r => r.blob())`)
4. Create a `File` object from the blob
5. Call the existing `insertImages()` flow with the file

**CORS consideration:** `content_images` and `solution_images` URLs are served from the same CDN (Supabase storage) that the app uses. They should be same-origin or have CORS headers allowing the app's origin. If CORS is an issue, the fetch can go through the app's API proxy. Verify during implementation.

**Scope:** Works only in inline mode (whiteboard and problem card on same page).

**Files:**

- `h:/billion-dollars/.../ProblemCardFullTabContent.tsx` — make images draggable
- `packages/excalidraw/components/App.tsx` — add URL drop handling in `handleAppOnDrop`

## 4. Minimap for navigation

**UI:**

- Map icon button next to zoom controls (bottom-left, inside footer)
- Click toggles minimap open/closed
- Default: closed
- Minimap size: ~150×100px
- Hidden in zen mode (follows existing footer zen-mode-transition behavior)

**Minimap content:**

- Simplified render of all canvas elements (bounding boxes / outlines, no detail)
- Viewport rectangle (current visible area) shown as a highlighted frame
- Click on minimap → move viewport center to that point
- Drag viewport rectangle → pan the canvas in real-time

**Implementation:**

- New component `Minimap.tsx` rendered inside `Footer.tsx` next to `ZoomActions`
- Separate `<canvas>` element for minimap rendering
- Scene access: pass `app` prop from Footer (Footer receives `appState` and `actionManager`; Minimap needs scene access via `app.scene.getNonDeletedElements()`)
- Read element bounding boxes, compute total bounds, scale to minimap size
- Draw simplified rectangles for each element
- Draw viewport rectangle from `scrollX`, `scrollY`, `zoom`, canvas dimensions
- **Performance:** Debounce updates with `requestAnimationFrame` — don't re-render minimap on every scroll tick. Batch updates to at most 1 per frame.

**i18n:**

- `labels.minimap` → "Миникарта" (ru-RU)
- `labels.minimap` → "Minimap" (en)

**Files:**

- `packages/excalidraw/components/Minimap.tsx` — new component
- `packages/excalidraw/components/Minimap.scss` — styles
- `packages/excalidraw/components/footer/Footer.tsx` — render Minimap, pass app/scene
- `packages/excalidraw/components/icons.tsx` — map icon
- `packages/excalidraw/locales/ru-RU.json`, `en.json` — translation
