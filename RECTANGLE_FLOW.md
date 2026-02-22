# Rectangle Creation Flow — End to End

The complete lifecycle of drawing a rectangle: from clicking the tool button, through click-and-drag on the canvas, to clicking elsewhere to deselect.

---

## Phase 1: Tool Selection

**You click the rectangle button in the toolbar.**

```
ShapesSwitcher (components/shapes.tsx)
  → app.setActiveTool({ type: "rectangle" })
    → updateActiveTool()                        [common/src/utils.ts:384]
      → setState({ activeTool: { type: "rectangle", locked: false, ... } })
        → setCursorForShape()                   [App.tsx:5231]
        → clear selection, snap lines           [App.tsx:5246-5290]
```

The rectangle tool is defined as an entry in the `SHAPES` array (`components/shapes.tsx:26`):

```typescript
{ icon: RectangleIcon, value: "rectangle", key: KEYS.R, numericKey: KEYS["2"], fillable: true }
```

When clicked, the toolbar calls `app.setActiveTool({ type: "rectangle" })` (`App.tsx:5213`), which:

1. Validates the tool is supported
2. Calls `updateActiveTool(this.state, { type: "rectangle" })` — builds a new `activeTool` object
3. Calls `setCursorForShape()` — switches the canvas cursor to crosshair
4. Clears current selection (`selectedElementIds = {}`, `selectedGroupIds = {}`)
5. Clears any active snap lines

**State after this phase:**
```
activeTool.type = "rectangle"
selectedElementIds = {}
cursor = crosshair
```

---

## Phase 2: Pointer Down (Starting the Rectangle)

**You click on the canvas.**

```
handleCanvasPointerDown()                      [App.tsx:7004]
  → viewportCoordsToSceneCoords()              — convert screen → scene coords
  → initialPointerDownState(event)             [App.tsx:7691]
  → clearSelectionIfNotUsingSelection()        [App.tsx:7226]
  → createGenericElementOnPointerDown()        [App.tsx:8824]
    → newElement({ type: "rectangle", ... })   [element/src/newElement.ts:158]
      → _newElementBase()                      [element/src/newElement.ts:78]
    → scene.insertElement(element)             [element/src/Scene.ts:381]
    → setState({ newElement: element })
  → register onPointerMove, onPointerUp        [App.tsx:7415-7437]
```

### 2a. Capture pointer state

`initialPointerDownState()` (`App.tsx:7691`) builds an immutable snapshot:

| Field | Value |
|-------|-------|
| `origin` | Scene coords where you clicked |
| `originInGrid` | Grid-snapped origin (respects Ctrl to bypass grid) |
| `lastCoords` | Tracks current pointer position (updated during drag) |
| `originalElements` | Deep copy of all elements (for undo) |
| `drag.hasOccurred` | `false` (not yet) |

### 2b. Create the element

`createGenericElementOnPointerDown()` (`App.tsx:8824`) gathers styling from current AppState:

```typescript
element = newElement({
  type: "rectangle",
  x: gridX,
  y: gridY,
  strokeColor:      this.state.currentItemStrokeColor,
  backgroundColor:  this.state.currentItemBackgroundColor,
  fillStyle:        this.state.currentItemFillStyle,
  strokeWidth:      this.state.currentItemStrokeWidth,
  strokeStyle:      this.state.currentItemStrokeStyle,
  roughness:        this.state.currentItemRoughness,
  opacity:          this.state.currentItemOpacity,
  roundness:        this.getCurrentItemRoundness("rectangle"),
  locked:           false,
  frameId:          topLayerFrame?.id ?? null,
})
```

`newElement()` (`element/src/newElement.ts:158`) delegates to `_newElementBase()` which assigns:

- `id` — random via `randomId()`
- `width: 0, height: 0` — zero initially, resized during drag
- `version: 1, versionNonce: 0` — versioning for collaboration
- `seed` — random integer for RoughJS deterministic rendering
- `isDeleted: false`

### 2c. Insert into scene

`scene.insertElement(element)` (`Scene.ts:381`) adds the rectangle to the elements array immediately. It is part of the scene from this moment, though it has zero width/height.

### 2d. Register drag listeners

Window-level listeners are attached for `pointermove`, `pointerup`, `keydown`, and `keyup` — these drive Phase 3 and 4.

**State after this phase:**
```
appState.newElement = { type: "rectangle", x, y, width: 0, height: 0, ... }
scene.elements = [...existingElements, newRectangle]
// Rectangle exists in scene but is invisible (0×0)
```

---

## Phase 3: Dragging (Sizing the Rectangle)

**You hold the button and drag.**

```
onPointerMoveFromPointerDownHandler()          [App.tsx:8987]
  → viewportCoordsToSceneCoords()
  → pointerDownState.lastCoords = current pos
  → maybeDragNewGenericElement()               [App.tsx:11643]
    → getGridPoint()                           — snap to grid
    → snapNewElement()                         — snap to guidelines
    → dragNewElement()                         [element/src/dragElements.ts:231]
      → getPerfectElementSize()                — if Shift held (aspect ratio)
      → scene.mutateElement(el, { x, y, width, height })
        → mutateElement()                      [element/src/mutateElement.ts]
          → version++, versionNonce = random
    → setState({ snapLines })
```

Each pointer move (throttled to ~60fps via `withBatchedUpdatesThrottled`) triggers:

### 3a. Calculate dimensions

`maybeDragNewGenericElement()` (`App.tsx:11643`) computes:

```typescript
width  = distance(origin.x, gridSnappedCurrentX)
height = distance(origin.y, gridSnappedCurrentY)
```

### 3b. Apply modifiers

`dragNewElement()` (`element/src/dragElements.ts:231`) handles keyboard modifiers:

| Key held | Effect |
|----------|--------|
| **Shift** | Maintain aspect ratio — `getPerfectElementSize()` constrains to square |
| **Alt** | Resize from center — doubles dimensions, offsets origin |
| *Neither* | Free-form — width/height follow mouse directly |

Position is calculated to allow dragging in any direction from origin:

```typescript
newX = currentX < originX ? originX - width : originX
newY = currentY < originY ? originY - height : originY
```

### 3c. Mutate the element

`scene.mutateElement()` (`Scene.ts:435`) applies `{ x, y, width, height }` and:

- Increments `element.version` (for sync/collaboration)
- Regenerates `element.versionNonce`
- Updates `element.updated` timestamp
- Calls `this.triggerUpdate()` → causes canvas re-render

### 3d. Canvas re-renders

The scene update triggers the renderer pipeline:

```
triggerUpdate()
  → staticScene.ts   — redraws background elements
  → interactiveScene.ts — redraws selection handles, snap lines
  → renderNewElementScene.ts — renders the element being drawn
```

RoughJS generates the hand-drawn rectangle shape using the element's `seed` for deterministic randomness (same seed = same wobble pattern).

**State during this phase (continuously updating):**
```
appState.newElement = { ..., width: 150, height: 100, version: N }
appState.snapLines = [...]   // visual guides if near other elements
canvas = re-rendered each frame with growing rectangle
```

---

## Phase 4: Pointer Up (Committing the Rectangle)

**You release the mouse button.**

```
onPointerUpFromPointerDownHandler()            [App.tsx:9894]
  → setState({ isResizing: false, snapLines: [], cursorButton: "up", ... })
  → remove pointermove/pointerup/key listeners [App.tsx:10109-10124]
  → isInvisiblySmallElement() check
  → actionManager.executeAction(actionFinalize) [App.tsx:10226]
    → actionFinalize.perform()                 [actions/actionFinalize.tsx:52]
      → updateActiveTool({ type: "selection" })
      → return {
          appState: {
            activeTool: "selection",
            newElement: null,
            selectedElementIds: { [rect.id]: true },
          },
          captureUpdate: IMMEDIATELY            — records undo point
        }
  → resetCursor()
```

### 4a. Clean up transient state

Pointer up clears drag/resize/snap state:

```typescript
setState({
  isResizing: false,
  isRotating: false,
  selectionElement: null,
  cursorButton: "up",
  snapLines: [],
})
```

### 4b. Validate the element

If the rectangle is too small (`isInvisiblySmallElement()` — essentially zero area), it gets marked `isDeleted: true` and discarded.

### 4c. Finalize via actionFinalize

`actionFinalize` (`actions/actionFinalize.tsx:52`) is the key transition:

1. Sets `appState.newElement = null` — the rectangle is no longer "being drawn"
2. Switches tool back to selection: `updateActiveTool({ type: "selection" })`
   - **Exception:** if the tool is **locked** (double-clicked in toolbar), it stays as rectangle
3. Selects the new rectangle: `selectedElementIds: { [rect.id]: true }`
4. Returns `captureUpdate: CaptureUpdateAction.IMMEDIATELY` — this tells the Store to snapshot the current state for undo/redo

### 4d. The rectangle is now a committed element

It already lives in `scene.elements` (since Phase 2). The only change is that `appState.newElement` becomes `null` — the element transitions from "being drawn" to "just another element in the scene."

**State after this phase:**
```
activeTool.type = "selection"   // tool reverted (unless locked)
appState.newElement = null       // no longer drawing
selectedElementIds = { [rect.id]: true }  // rectangle is selected
scene.elements = [..., rectangle]         // rectangle persists
// undo stack now has a snapshot of this state
```

---

## Phase 5: Click Elsewhere (Deselection)

**You click on empty canvas space.**

```
handleCanvasPointerDown()                      [App.tsx:7004]
  → activeTool.type === "selection"
  → handleSelectionOnPointerDown()             [App.tsx:7815]
    → getElementAtPosition() → null            — nothing under cursor
    → setState({
        selectedElementIds: {},
        selectedGroupIds: {},
        editingGroupId: null,
      })
```

Since the tool is now "selection" and there's no element under the click point, the selection is cleared. The rectangle remains in the scene but is no longer highlighted.

**Final state:**
```
activeTool.type = "selection"
selectedElementIds = {}          // nothing selected
scene.elements = [..., rectangle] // rectangle still in scene, unselected
```

---

## Summary: Key Files in the Chain

| Step | File | Function |
|------|------|----------|
| Tool button | `packages/excalidraw/components/shapes.tsx` | `SHAPES` array definition |
| Tool activation | `packages/excalidraw/components/App.tsx:5213` | `setActiveTool()` |
| Tool state | `packages/common/src/utils.ts:384` | `updateActiveTool()` |
| Pointer down | `packages/excalidraw/components/App.tsx:7004` | `handleCanvasPointerDown()` |
| Init pointer state | `packages/excalidraw/components/App.tsx:7691` | `initialPointerDownState()` |
| Element creation | `packages/excalidraw/components/App.tsx:8824` | `createGenericElementOnPointerDown()` |
| Element factory | `packages/element/src/newElement.ts:158` | `newElement()` → `_newElementBase()` |
| Scene insertion | `packages/element/src/Scene.ts:381` | `insertElement()` |
| Drag handling | `packages/excalidraw/components/App.tsx:11643` | `maybeDragNewGenericElement()` |
| Drag math | `packages/element/src/dragElements.ts:231` | `dragNewElement()` |
| Element mutation | `packages/element/src/Scene.ts:435` | `mutateElement()` |
| Pointer up | `packages/excalidraw/components/App.tsx:9894` | `onPointerUpFromPointerDownHandler()` |
| Finalization | `packages/excalidraw/actions/actionFinalize.tsx:52` | `actionFinalize.perform()` |
| Deselection | `packages/excalidraw/components/App.tsx:7815` | `handleSelectionOnPointerDown()` |

---

## Key Architectural Observations

1. **Element exists in scene from pointerDown** — it's inserted immediately with 0×0 size, not created on finalize. This means the renderer draws it every frame during drag.

2. **Dual state tracking** — `appState.newElement` marks "currently being drawn" while `scene.elements` holds the actual element. Finalization just nulls the former.

3. **Immutable mutation pattern** — elements are never directly assigned to. `scene.mutateElement()` bumps `version` and `versionNonce` on every change, which is critical for real-time collaboration conflict resolution.

4. **Tool auto-reverts** — after finalization the tool switches back to selection, unless it was "locked" (double-click the tool to lock it, letting you draw multiple rectangles without re-selecting).

5. **Undo capture** — `actionFinalize` returns `captureUpdate: IMMEDIATELY`, snapshotting state for undo. Intermediate drag states are not individually undoable — undo reverts the entire rectangle creation.

6. **Grid + snap** — coordinates are grid-snapped at every stage (origin, drag position, final position). Snap guidelines to other elements are computed during drag and rendered as overlay lines.
