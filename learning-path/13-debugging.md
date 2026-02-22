# Module 13 — Debugging

**Time:** 2-3 hours
**Goal:** Learn the tools and techniques for debugging Excalidraw.

---

## Debug Globals

Open Chrome DevTools console on the running app:

### `window.h` — The test handle

```javascript
h.elements                    // all elements (including deleted)
h.elements.length             // element count
h.state                       // current AppState
h.state.activeTool            // which tool is active
h.state.selectedElementIds    // what's selected
h.state.zoom                  // current zoom level

h.setState({ zoom: { value: 0.5 } })  // change state from console
h.app                         // the App component instance
```

### Inspect a specific element

```javascript
// Last drawn element:
h.elements[h.elements.length - 1]

// Find by type:
h.elements.filter(e => e.type === "arrow")

// Find selected:
h.elements.filter(e => h.state.selectedElementIds[e.id])

// Check bindings:
const arrow = h.elements.find(e => e.type === "arrow");
arrow.startBinding   // what it's bound to
arrow.endBinding
arrow.points         // control points
```

### `window.DEBUG_FRACTIONAL_INDICES`

```javascript
window.DEBUG_FRACTIONAL_INDICES = true;
// Now every z-order operation validates fractional indices
// Throws errors if indices are out of order
```

---

## Visual Debugging

### Canvas bounds overlay

Add temporary debug rendering in `renderElement.ts`:

```typescript
// At the end of renderElement(), add:
context.save();
context.strokeStyle = "red";
context.lineWidth = 1;
context.setLineDash([4, 4]);
const [x1, y1, x2, y2] = getElementAbsoluteCoords(element);
context.strokeRect(x1, y1, x2 - x1, y2 - y1);
context.restore();
```

This draws red dashed outlines around every element's bounding box.

### Visual debug module

**File:** `packages/element/src/visualdebug.ts`

The codebase has a built-in visual debug system:

```typescript
import { debugDrawPoint, debugDrawLine, debugDrawBounds } from "./visualdebug";

// In any element code:
debugDrawPoint(point, { color: "red", size: 5 });
debugDrawLine(line, { color: "blue" });
debugDrawBounds(bounds, { color: "green" });
```

These render debug markers on the canvas. Useful for visualizing collision detection, binding points, and arrow routing.

---

## Common Bugs and How to Diagnose

### Element not updating after mutation

**Symptom:** You call `mutateElement()` but the canvas doesn't change.

**Diagnosis:**
```javascript
// Check if mutation happened:
const el = h.elements.find(e => e.id === "...");
console.log(el.version);  // should have incremented

// Check if render was triggered:
// Add console.log in _renderStaticScene() temporarily
```

**Common cause:** Missing `informMutation: true` in the mutation options, or the element is on a different canvas layer.

### Z-order is wrong

**Symptom:** Elements appear in the wrong order.

**Diagnosis:**
```javascript
h.elements.map(e => ({ id: e.id.slice(0, 6), index: e.index, type: e.type }))
// Check that index values are in ascending order
```

**Common cause:** Invalid fractional indices after a complex reorder operation.

### Arrow not binding

**Symptom:** Arrow endpoint doesn't snap to an element.

**Diagnosis:**
```javascript
const arrow = h.elements.find(e => e.type === "arrow");
console.log(arrow.startBinding, arrow.endBinding);
// null means not bound

// Check distance:
// The endpoint must be within binding threshold of the element
```

**Common cause:** Binding gap too large (BASE_BINDING_GAP = 5px), or element type isn't bindable.

### Text overflows container

**Symptom:** Text extends past rectangle bounds.

**Diagnosis:**
```javascript
const text = h.elements.find(e => e.type === "text" && e.containerId);
const container = h.elements.find(e => e.id === text.containerId);
console.log({
  textWidth: text.width,
  containerWidth: container.width,
  padding: BOUND_TEXT_PADDING,
  maxWidth: container.width - 2 * BOUND_TEXT_PADDING,
});
```

**Common cause:** Text measurement differs between fonts, or wrapping didn't trigger after container resize.

### Undo doesn't restore expected state

**Symptom:** Ctrl+Z doesn't undo what you expected.

**Diagnosis:**
```javascript
// Check what was captured:
// The issue is usually captureUpdate: NEVER instead of IMMEDIATELY
```

**Common cause:** The action returned `captureUpdate: CaptureUpdateAction.NEVER` or `EVENTUALLY`, so the change wasn't recorded as a separate undo point.

---

## Performance Debugging

### Chrome DevTools Performance tab

1. Open DevTools → Performance
2. Click Record
3. Perform the slow action (draw, drag, zoom)
4. Stop recording
5. Look at the flame chart:
   - `renderStaticScene` — how long per frame?
   - `ShapeCache.generateElementShape` — cache misses?
   - `drawElementOnCanvas` — which elements are slow?

### Common performance issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Laggy drawing | Static canvas re-rendering on every frame | Check if sceneNonce is changing unnecessarily |
| Slow zoom | All element canvases regenerating | Check cache invalidation — zoom shouldn't bust shape cache |
| Memory growth | Element canvas cache growing | Check WeakMap — should GC deleted elements |
| Slow arrow drag | Elbow arrow A* on every move | Check grid size — too fine a grid = slow pathfinding |

### Measure render time

```javascript
// In renderer/staticScene.ts, wrap _renderStaticScene():
const start = performance.now();
_renderStaticScene(params);
console.log(`Static render: ${(performance.now() - start).toFixed(1)}ms`);
```

Target: < 16ms for 60fps, < 8ms for comfortable headroom.

---

## Network Debugging (Collaboration)

### WebSocket messages

1. Open DevTools → Network → WS
2. Find the Socket.io connection
3. Click it → Messages tab
4. Watch messages flow in real-time

Message types to look for:
- `SCENE_UPDATE` — element changes
- `MOUSE_LOCATION` — cursor position
- `IDLE_STATE` — user status

### Firebase

1. Open DevTools → Application → IndexedDB
2. Or check the Firebase console if you have access
3. Look for encrypted scene data blobs

---

## Logging Strategy

For temporary debugging, add logs at these strategic points:

| Location | What to log | Why |
|----------|------------|-----|
| `App.tsx` event handlers | `event.type`, `pointerDownState` | Understand input flow |
| `actionManager.executeAction()` | `action.name`, result | Track action execution |
| `Scene.mutateElement()` | `element.id`, `updates` | Track all mutations |
| `renderStaticScene()` | `visibleElements.length`, timing | Track render performance |
| `reconcileElements()` | `local.version vs remote.version` | Debug sync issues |

Remember to remove all debug logging before committing.

---

## Exercises

1. Open the running app console. Explore `h.elements` and `h.state`. Find the zoom level, active tool, and selected elements.
2. Draw a rectangle. Find it in `h.elements`. Read every field. Change its color via `h.app.scene.mutateElement()` and watch the canvas update.
3. Enable `window.DEBUG_FRACTIONAL_INDICES = true`. Reorder some elements. Check if any errors are thrown.
4. Open DevTools Performance tab. Record while dragging an element across the canvas. Find `renderStaticScene` in the flame chart — how long does it take?
5. If you have collaboration set up: open the Network WS tab, watch messages flow while another user draws.

---

## You're Done

You've completed the learning path. You now have:
- A geometric foundation (math, canvas, coordinates)
- Understanding of the data model (elements, types, mutation, versioning)
- Knowledge of state flow (AppState, actions, undo)
- Rendering pipeline knowledge (3-layer canvas, RoughJS, caching)
- Awareness of complex subsystems (text, binding, arrows, collaboration)
- Practical debugging skills

**What to do next:** Pick a real bug or feature from the issue tracker. Trace the relevant code path end-to-end. The best way to solidify understanding is to make actual changes and see them work.
