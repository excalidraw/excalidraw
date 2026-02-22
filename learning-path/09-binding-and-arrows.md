# Module 09 — Binding & Arrows

**Time:** 15-20 hours
**Goal:** Understand arrow-to-element binding, focus points, and the elbow arrow A* routing algorithm.
**Key files:** `packages/element/src/binding.ts`, `elbowArrow.ts`, `linearElementEditor.ts`

**This is the hardest module.** Take your time.

---

## Why This Is Complex

An arrow in Excalidraw isn't just two points with a line between them. It can:
- Bind to elements (start, end, or both)
- Auto-reroute when bound elements move
- Have draggable focus points (where it attaches on the element surface)
- Route around obstacles (elbow arrows use A* pathfinding)
- Have multiple control points (editable via the linear element editor)
- Carry text labels at the midpoint

Each of these features interacts with the others. That's why `binding.ts` is 2,800+ lines.

---

## Arrow Types

```typescript
// A linear element (arrow or line):
{
  type: "arrow" | "line",
  points: LocalPoint[],              // control points relative to (x, y)
  startBinding: PointBinding | null, // what the start is attached to
  endBinding: PointBinding | null,   // what the end is attached to
  startArrowhead: Arrowhead | null,  // visual arrowhead
  endArrowhead: Arrowhead | null,
  elbowed: boolean,                  // use orthogonal routing?
}
```

**Three routing modes:**

| Mode | Behavior | Visual |
|------|----------|--------|
| **Straight** | Direct line between points | `A ———→ B` |
| **Curved** | Smooth curve through points | `A ~~~→ B` |
| **Elbow** | Only horizontal/vertical segments | `A ─┐` then `└→ B` |

---

## Binding Model

### What is binding?

When an arrow endpoint is close to a bindable element (rectangle, ellipse, diamond, frame), it "binds" — attaching to that element. Moving the element automatically moves the arrow endpoint.

### PointBinding type

```typescript
type PointBinding = {
  elementId: string;       // ID of the element we're bound to
  focus: number;           // -1 to 1, where on the surface to attach
  gap: number;             // distance from element surface
  fixedPoint: FixedPoint;  // [x, y] normalized (0-1) position on element
};
```

### Binding modes

**File:** `binding.ts`

Two binding approaches:

| Mode | How attachment point is determined |
|------|-----------------------------------|
| **Elastic** | Arrow attaches to the nearest point on the element's surface. Moves as arrow direction changes. |
| **Fixed** | Arrow attaches to a specific point on the element's surface. User drags the focus point handle to set it. |

### The focus value

`focus` ranges from -1 to 1 and determines where on the element surface the arrow attaches:

```
focus = -1     focus = 0      focus = 1
    ┌───┐         ┌───┐         ┌───┐
    │   │←        │   │←        │   │←
    │   │         │   │         │   │
    └───┘         └───┘         └───┘
  (top edge)    (center)     (bottom edge)
```

For a rectangle, focus determines the vertical position on the edge. The edge itself is determined by the arrow's direction.

---

## Binding Lifecycle

### 1. Arrow approaches element

As you drag an arrow endpoint near a shape:

```
maybeSuggestBindingsForLinearElementAtCoords()
  → getSuggestedBindingsForArrows()
    → checks distance from endpoint to each bindable element
    → if within threshold: suggest binding (highlight shown)
```

The interactive canvas renders a blue highlight around the target element.

### 2. Arrow binds on pointer-up

```
maybeBindLinearElement()
  → bindLinearElement()
    → calculateFixedPointForNonElbowArrowBinding()
      → find intersection of arrow direction with element surface
      → calculate focus value
      → create PointBinding { elementId, focus, gap, fixedPoint }
    → mutateElement(arrow, { startBinding: binding })
    → add arrow to element's boundElements list
```

### 3. Bound element moves

```
updateBoundElements()
  → for each arrow bound to the moved element:
    → recalculate arrow endpoint position
    → for elbow arrows: run full A* routing
    → for regular arrows: update endpoint to maintain focus/gap
    → mutateElement(arrow, { points: newPoints })
```

### 4. Arrow unbinds

If you drag an arrow endpoint away from its bound element:

```
unbindLinearElement()
  → mutateElement(arrow, { startBinding: null })
  → remove arrow from element's boundElements list
```

---

## Focus Point Editor

**File:** `packages/element/src/arrows/focus.ts`

When you select a bound arrow, small draggable circles appear on the bound elements. Dragging these changes the focus point — where the arrow attaches.

```
┌──────────────┐
│              │
│    ●─────────────→   ← arrow
│  (focus      │
│   point)     │
└──────────────┘
```

The focus point handle is rendered by the interactive canvas. Dragging it updates `startBinding.fixedPoint` and `startBinding.focus`.

---

## Elbow Arrow Routing

**File:** `packages/element/src/elbowArrow.ts` (~2,300 lines)

**Prerequisite:** [A* pathfinding algorithm](https://www.redblobgames.com/pathfinding/a-star/introduction.html). Read this first if you haven't.

### What elbow arrows do

Elbow arrows only use horizontal and vertical segments:

```
Start ──────┐
            │
            │
            └────────── End
```

They must route around obstacles (other elements on the canvas).

### How it works

1. **Build a grid** around the start/end elements and obstacles
2. **Define start/end nodes** on the grid (edge of bound elements)
3. **Run A* search** to find shortest path avoiding obstacles
4. **Simplify path** — merge collinear segments
5. **Add gaps** — maintain distance from element surfaces

### Grid construction

The grid isn't a regular pixel grid. It's a sparse grid built from element bounding boxes:

```
┌─────────────────────────────┐
│                             │
│  ┌───────┐     ┌───────┐   │
│  │ Start │     │ End   │   │
│  │       │     │       │   │
│  └───────┘     └───────┘   │
│                             │
│     ┌───────────┐           │
│     │ Obstacle  │           │
│     └───────────┘           │
│                             │
└─────────────────────────────┘

Grid nodes are placed at:
- Element corners (with gap offset)
- Element edge midpoints
- Intersections of horizontal/vertical lines through these points
```

### A* implementation

```typescript
// Simplified from elbowArrow.ts:
function findPath(grid, start, end) {
  const openSet = new BinaryHeap();  // min-heap by f-score
  const closedSet = new Set();

  openSet.add({ node: start, g: 0, f: heuristic(start, end) });

  while (openSet.size > 0) {
    const current = openSet.pop();  // lowest f-score

    if (current.node === end) {
      return reconstructPath(current);
    }

    closedSet.add(current.node);

    for (const neighbor of getNeighbors(current.node, grid)) {
      if (closedSet.has(neighbor)) continue;

      const tentativeG = current.g + cost(current.node, neighbor);

      if (tentativeG < existingG(neighbor)) {
        update(neighbor, { parent: current, g: tentativeG });
        openSet.add(neighbor);
      }
    }
  }

  return null;  // no path found
}
```

**Heuristic:** Manhattan distance (since elbow arrows only go horizontal/vertical, Manhattan is admissible and consistent).

**Cost function:** Distance + penalties for:
- Changing direction (discourage zigzag)
- Passing too close to obstacles
- Too many turns

### Path simplification

A* returns a list of grid nodes. Many consecutive nodes are collinear:

```
Before: [(0,0), (1,0), (2,0), (3,0), (3,1), (3,2)]
After:  [(0,0), (3,0), (3,2)]   ← only direction changes kept
```

---

## Linear Element Editor

**File:** `packages/element/src/linearElementEditor.ts`

When you double-click an arrow or line, you enter "linear element editing" mode. This lets you:

1. **Drag existing control points** — reshape the path
2. **Add new control points** — click on the path to insert a point
3. **Delete control points** — select and delete

### State

```typescript
appState.editingLinearElement = {
  elementId: string;
  selectedPointsIndices: number[] | null;
  pointerDownState: { ... };
};
```

### Midpoint insertion

When hovering over an arrow segment, a translucent circle appears at the midpoint. Clicking it inserts a new control point:

```
Before: A ─────────────── B    (one segment)
Hover:  A ──────●──────── B    (midpoint shown)
Click:  A ──── C ──────── B    (new point C inserted)
```

For elbow arrows, dragging a midpoint moves the entire segment, maintaining orthogonality.

---

## Reading Strategy

This module is too large to read linearly. Use this approach:

### Pass 1: Understand the data (2 hours)
1. Read the `PointBinding` type in `types.ts`
2. Read `startBinding`/`endBinding` fields on `ExcalidrawLinearElement`
3. Draw an arrow between two rectangles in the app, inspect in console

### Pass 2: Binding flow (4 hours)
1. Search for `bindLinearElement` in `binding.ts` — trace the bind flow
2. Search for `updateBoundElements` — trace the update flow
3. Search for `unbindLinearElement` — trace the unbind flow

### Pass 3: Elbow arrows (6+ hours)
1. Read the A* tutorial linked above first
2. Open `elbowArrow.ts` — find the main routing function
3. Trace: grid construction → A* search → path simplification
4. Draw an elbow arrow in the app, add obstacles, watch it reroute

### Pass 4: Linear editor (3 hours)
1. Open `linearElementEditor.ts` — find `handlePointerDown` and `handlePointerMove`
2. Double-click an arrow in the app — enter editing mode
3. Drag points, add points, delete points — match behavior to code

---

## Exercises

1. Draw two rectangles and connect them with an arrow. Move one rectangle — watch the arrow follow. Inspect the arrow's `startBinding` and `endBinding` in the console.
2. Select the arrow. Find the focus point handle on one of the rectangles. Drag it to a different position. Re-inspect the binding in the console — what changed?
3. Create an elbow arrow between two rectangles. Place a third rectangle as an obstacle between them. Watch the elbow arrow route around it.
4. Search `binding.ts` for `BASE_BINDING_GAP`. Find where it's used — this is the minimum distance between arrow endpoint and element surface.
5. Open `elbowArrow.ts`. Find the `BinaryHeap` import — this is used for the A* open set. Find the heuristic function.
6. Double-click an arrow to enter editing mode. Add 2 new control points. In the console, check `element.points` — verify the points were added.

---

**Next:** [Module 10 — Collaboration](10-collaboration.md)
