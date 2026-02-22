# binding.ts — Arrow-to-Element Binding System

**File:** `packages/element/src/binding.ts` (~2,880 lines)

This is the most complex single file in the Excalidraw codebase. It manages how arrows attach to shapes, stay attached when shapes move, and detach when dragged away.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Data Model](#data-model)
3. [Constants & Configuration](#constants--configuration)
4. [The Binding Lifecycle](#the-binding-lifecycle)
5. [Binding Strategy System](#binding-strategy-system)
6. [Creating & Breaking Bindings](#creating--breaking-bindings)
7. [Updating Bound Elements](#updating-bound-elements)
8. [Snapping to Element Outlines](#snapping-to-element-outlines)
9. [FixedPoint Calculation](#fixedpoint-calculation)
10. [Global FixedPoint Conversion](#global-fixedpoint-conversion)
11. [Side Detection & Midpoint Calculation](#side-detection--midpoint-calculation)
12. [Duplication & Deletion Cleanup](#duplication--deletion-cleanup)
13. [BoundElement & BindableElement Classes](#boundelement--bindableelement-classes)
14. [Function Reference](#function-reference)

---

## Core Concepts

### What is binding?

When an arrow endpoint is close to a "bindable" element (rectangle, ellipse, diamond, frame, etc.), it **binds** to it. This means:

1. Moving the shape automatically moves the arrow endpoint
2. The arrow endpoint snaps to the shape's outline
3. A `PointBinding` object records the relationship

### Two sides of every binding

Every binding involves two participants:

- **The arrow** — stores `startBinding` and `endBinding` (references to shapes)
- **The shape** — stores `boundElements` (list of arrows/text attached to it)

Both must stay in sync. If you bind an arrow's start to a rectangle, the arrow gets `startBinding = { elementId: "rect-id", ... }` AND the rectangle gets the arrow added to its `boundElements` array.

### Binding modes

There are two modes that determine where on the shape the arrow attaches:

| Mode | Behavior | When used |
|------|----------|-----------|
| **`"orbit"`** | Arrow endpoint is on the shape's **outline** (surface). As the arrow rotates, it slides along the edge. | Default when dragging arrow endpoint near a shape from outside |
| **`"inside"`** | Arrow endpoint can be **inside** the shape. The fixedPoint is exactly where the user placed it. | When endpoint is dragged inside a shape, or for inside-to-inside connections |

---

## Data Model

### PointBinding (on the arrow)

```typescript
type FixedPointBinding = {
  elementId: string;       // ID of the shape we're bound to
  focus: number;           // -1 to 1, legacy field for surface position
  gap: number;             // distance from element surface
  fixedPoint: FixedPoint;  // [x, y] normalized 0-1 position on element
  mode: "orbit" | "inside";
};
```

### boundElements (on the shape)

```typescript
// On ExcalidrawBindableElement:
boundElements: Array<{
  id: string;              // ID of the arrow or text element
  type: "arrow" | "text";  // what kind of element is bound
}>;
```

### FixedPoint — the normalized coordinate

`fixedPoint` is a `[number, number]` where both values are normalized to 0-1 relative to the element's bounding box:

```
fixedPoint = [0, 0]     → top-left corner of element
fixedPoint = [0.5, 0]   → center of top edge
fixedPoint = [1, 1]     → bottom-right corner
fixedPoint = [0.5, 0.5] → center of element
```

**Important:** The value `0.5` is intentionally nudged to `0.5001` by `normalizeFixedPoint()` to prevent floating-point ambiguity when calculating arrowhead direction. Without this, an arrow pointing exactly at the center of an edge would flicker between two headings.

### BindingStrategy — what to do with each end

```typescript
type BindingStrategy =
  | { mode: BindMode; element: ExcalidrawBindableElement; focusPoint: GlobalPoint }
    // Create/update binding with this mode and target
  | { mode: null }
    // Break the binding (unbind)
  | { mode: undefined }
    // Don't change anything (keep existing binding)
```

Every binding decision produces a `{ start: BindingStrategy, end: BindingStrategy }` pair — one for each arrow endpoint.

---

## Constants & Configuration

```typescript
BASE_BINDING_GAP = 5          // Minimum px gap between arrow and shape edge
BASE_BINDING_GAP_ELBOW = 5    // Same for elbow arrows
FOCUS_POINT_SIZE = 10 / 1.5   // Size of the draggable focus point handle
```

### getBindingGap()

Returns the actual gap considering the element's stroke width:
```
gap = BASE_BINDING_GAP + element.strokeWidth / 2
```

### maxBindingDistance_simple()

Returns the maximum distance from a shape at which an arrow endpoint will still trigger binding. Scales inversely with zoom (so at low zoom, the binding trigger area is larger):

```
Base: max(BASE_BINDING_GAP, 15) = 15px
Range: 15px to 30px
At zoom 1.0+: 15px
At zoom 0.5:  ~20px
At zoom 0.25: ~30px (capped)
```

### shouldEnableBindingForPointerEvent()

Returns `false` if Ctrl/Cmd is held. Holding Ctrl/Cmd disables binding — the arrow won't snap to shapes.

---

## The Binding Lifecycle

### Phase 1 — Arrow approaches element

As you drag an arrow endpoint, `App.tsx` continuously calls hit-testing to check if the endpoint is near a bindable element. If within `maxBindingDistance`, a blue highlight is shown on the target shape.

### Phase 2 — Determine binding strategy

When the arrow endpoint position changes (drag, creation, or pointer-up), the system determines what should happen to each end:

```
bindOrUnbindBindingElement()
  → getBindingStrategyForDraggingBindingElementEndpoints()
      → which variant?
          → _simple (for feature-flag "insideInsideBindingFix" disabled)
          → _complex (for feature-flag enabled — the modern path)
      → for elbow arrows: bindingStrategyForElbowArrowEndpointDragging()
      → for new arrows: bindingStrategyForNewSimpleArrowEndpointDragging()
      → for existing arrows: bindingStrategyForSimpleArrowEndpointDragging_complex()
  → for each end (start/end):
      → mode is BindMode? → bindBindingElement()
      → mode is null?     → unbindBindingElement()
      → mode is undefined? → do nothing (keep current)
```

### Phase 3 — Bind/unbind

**bindBindingElement()** (line 994):
1. Calculates the `fixedPoint` for the binding (where on the shape the arrow attaches)
2. Mutates the arrow: sets `startBinding` or `endBinding`
3. Mutates the shape: adds the arrow to `boundElements`

**unbindBindingElement()** (line 1046):
1. Mutates the arrow: sets `startBinding` or `endBinding` to `null`
2. Mutates the shape: removes the arrow from `boundElements`

### Phase 4 — Shape moves → arrow follows

When a shape is moved/resized, `updateBoundElements()` fires:

```
updateBoundElements(changedElement)
  → for each arrow in changedElement.boundElements:
      → updateBoundPoint() for start and/or end
      → LinearElementEditor.movePoints() to apply new positions
      → handleBindTextResize() if arrow has bound text
```

### Phase 5 — Arrow unbinds

If you drag an arrow endpoint away from its bound shape (beyond `maxBindingDistance`), the binding strategy returns `{ mode: null }` and `unbindBindingElement()` is called.

---

## Binding Strategy System

The strategy system is the brain of binding — it decides, for any given arrow state and pointer position, whether each endpoint should bind, unbind, or stay unchanged.

### Entry point: `getBindingStrategyForDraggingBindingElementEndpoints`

There are two implementations selected by feature flag:

1. **`_simple`** (lines 600-847) — Older path, handles basic cases
2. **`_complex`** (lines 849-975) — Newer path, dispatches to specialized handlers

The complex variant handles these cases in order:

| Condition | Action |
|-----------|--------|
| Neither endpoint dragged | Return `{ mode: undefined }` for both (no change) |
| Both endpoints dragged | Return `{ mode: null }` for both (break both bindings) |
| Binding disabled (Ctrl held) | Break the dragged endpoint's binding |
| Elbow arrow | Delegate to `bindingStrategyForElbowArrowEndpointDragging()` |
| New arrow being created | Delegate to `bindingStrategyForNewSimpleArrowEndpointDragging()` |
| Existing arrow, one end dragged | Delegate to `bindingStrategyForSimpleArrowEndpointDragging_complex()` |

### Elbow arrow strategy

Elbow arrows always use `"orbit"` mode (they always bind to the element's outline). The strategy is simple: if the endpoint is near a bindable element, bind to it; otherwise, break the binding.

### New arrow strategy

During arrow creation (drag to draw), the system handles several special cases:

- **Inside-inside binding**: Both start and end bind to the **same** element (arrow starts and ends inside one shape)
- **Nested shapes**: Arrow connects a shape that's inside another shape
- **Inside-outside**: Arrow starts inside a shape and ends outside (or vice versa)

### Existing arrow strategy (complex)

For dragging an endpoint of an existing arrow, the system considers:

- **Global bind mode** (`"orbit"`, `"inside"`, or `"skip"`) from AppState
- **Overlapping elements**: If dragged over the opposite binding's element
- **Nested elements**: If one bound element is inside another
- **Transparent backgrounds**: Affects which element "wins" when overlapping
- **Same-element binding**: Both ends on the same shape

---

## Creating & Breaking Bindings

### bindBindingElement() — line 994

Creates a binding between an arrow and a shape:

```typescript
bindBindingElement(arrow, bindableElement, mode, startOrEnd, scene, focusPoint?)
```

1. Calculates `fixedPoint` via `calculateFixedPointForElbowArrowBinding()` or `calculateFixedPointForNonElbowArrowBinding()`
2. Mutates the arrow with the new binding:
   ```typescript
   mutateElement(arrow, { [startOrEnd + "Binding"]: {
     elementId: bindableElement.id,
     fixedPoint,
     focus: 0,  // legacy, always 0 now
     gap: 0,    // legacy, always 0 now
     mode,
   }});
   ```
3. Adds the arrow to the shape's `boundElements` array

### unbindBindingElement() — line 1046

Breaks a binding:

```typescript
unbindBindingElement(arrow, startOrEnd, scene)
```

1. Gets the currently bound element
2. Mutates the arrow: sets the binding to `null`
3. Removes the arrow from the shape's `boundElements` list

---

## Updating Bound Elements

### updateBoundElements() — line 1080

**This is the function that makes arrows follow shapes when shapes move.**

Called whenever a bindable element changes (position, size, rotation). It:

1. Gets all arrows in the element's `boundElements`
2. For each arrow, checks if it's actually bound to this element via `doesNeedUpdate()`
3. Skips arrows that are being simultaneously updated (e.g., during multi-select drag)
4. Calls `updateBoundPoint()` for each endpoint bound to this element
5. Calls `LinearElementEditor.movePoints()` to apply the new positions
6. If the arrow has bound text, calls `handleBindTextResize()`

If `indirectArrowUpdate` is set, the visitor runs 3 times total. This handles cascading updates where moving element A updates arrow X, which might affect how arrow X connects to element B.

### updateBoundPoint() — line 1700

**The workhorse function that calculates where a bound arrow endpoint should be.**

Given an arrow, a binding, and the current state of the bound element:

1. Gets the global position from the `fixedPoint`:
   ```
   global = element.x + element.width * fixedPoint[0],
            element.y + element.height * fixedPoint[1]
   ```
   (with rotation applied)

2. Checks for **overlapping elements** — if the two shapes the arrow connects overlap
3. Detects **arrowTooShort** — if the visible part of the arrow (outside both shapes) is less than 40px, triggers special handling
4. Determines if shapes are **nested** (one inside the other)
5. For `"orbit"` mode: snaps the point to the element outline via `bindPointToSnapToElementOutline()`
6. For `"inside"` mode or nested: uses the raw `fixedPoint` position directly
7. Returns a `LocalPoint` (relative to the arrow's origin)

### updateBindings() — line 1250

A higher-level function that handles both cases:
- **Arrow was changed**: Re-evaluates both start and end bindings via `updateArrowBindings()`
- **Shape was changed**: Delegates to `updateBoundElements()`

---

## Snapping to Element Outlines

### bindPointToSnapToElementOutline() — line 1348

Finds where the arrow should attach on the element's outline. This is used for `"orbit"` mode bindings.

**For elbow arrows:**
1. Determines if the approach is horizontal or vertical
2. Tries `snapToMid()` to snap to edge midpoints
3. Creates a line from the element center (in the relevant axis) through the endpoint
4. Finds the intersection with the element's outline (including binding gap)

**For regular arrows:**
1. Creates a line from the adjacent control point through the endpoint
2. Extends the line far enough to definitely intersect the element
3. Finds the closest intersection point to the adjacent control point

### snapToMid() — line 1580

Magnetic snapping to edge midpoints. When dragging an arrow endpoint near the center of a shape's edge, it snaps to the exact midpoint.

The tolerance is adaptive to element size but clamped between 5px and 80px:
```
verticalThreshold = clamp(tolerance * height, 5, 80)
horizontalThreshold = clamp(tolerance * width, 5, 80)
```

Snapping regions:
```
         ┌─── snap zone ───┐
         │                  │
    ─────●──────────────────●─────   ← TOP: snaps to center of top edge
    │    │                  │    │
    │    └──────────────────┘    │
snap●                            ●snap  ← LEFT/RIGHT: snaps to center of side edge
zone│    ┌──────────────────┐    │zone
    │    │                  │    │
    ─────●──────────────────●─────   ← BOTTOM: snaps to center of bottom edge
         └─── snap zone ───┘
```

For diamonds, also snaps to the four diagonal midpoints (quarter-points of each edge).

### avoidRectangularCorner() — line 1489

Elbow arrows can't cleanly route to a corner (they'd need a diagonal). This function detects when an endpoint is near a rectangle corner and nudges it to the nearest edge midpoint.

---

## FixedPoint Calculation

### calculateFixedPointForNonElbowArrowBinding() — line 1909

For regular (straight/curved) arrows:

1. Gets the arrow endpoint (or focus point if provided) as a global coordinate
2. Reverse-rotates the point to the element's unrotated coordinate space
3. Calculates the ratio:
   ```
   fixedPointX = (point.x - element.x) / element.width
   fixedPointY = (point.y - element.y) / element.height
   ```
4. Normalizes via `normalizeFixedPoint()` (nudges 0.5 → 0.5001)

### calculateFixedPointForElbowArrowBinding() — line 1871

For elbow arrows:

1. Snaps the endpoint to the element outline via `bindPointToSnapToElementOutline()`
2. Reverse-rotates the snapped point
3. Calculates the same ratio as above

### normalizeFixedPoint() — line 2434

```typescript
// If either coordinate is within 0.0001 of 0.5, nudge it to 0.5001
fixedPoint.map(ratio =>
  Math.abs(ratio - 0.5) < 0.0001 ? 0.5001 : ratio
)
```

**Why?** When a fixedPoint is exactly `[0.5, 0]` (center of top edge), the arrowhead direction calculation involves `0.5 - 0.5 = 0.0`, which can flip between positive and negative due to floating-point imprecision. The nudge to `0.5001` gives a consistent, deterministic result.

---

## Global FixedPoint Conversion

### getGlobalFixedPointForBindableElement() — line 2365

Converts a normalized fixedPoint back to a global canvas coordinate:

```typescript
1. Scale: (element.x + element.width * fixedX, element.y + element.height * fixedY)
2. Rotate: apply element.angle rotation around element center
```

### getGlobalFixedPoints() — line 2382

Returns both the start and end global points for an arrow, accounting for bindings. If an endpoint is bound, uses the fixedPoint calculation. If unbound, uses the raw point coordinates.

### getArrowLocalFixedPoints() — line 2422

Same as above but returns points in the arrow's local coordinate space (relative to `arrow.x`, `arrow.y`).

---

## Side Detection & Midpoint Calculation

### Sector-based side detection (lines 2451-2583)

The system divides each shape into 8 angular sectors (top, top-right, right, bottom-right, bottom, bottom-left, left, top-left) to determine which "side" a fixedPoint is on.

Each shape type has different sector widths:

| Shape | Edge sectors | Corner sectors |
|-------|-------------|----------------|
| **Rectangle** | 75° wide | 15° wide |
| **Diamond** | 75° wide (diagonals) | 15° wide (cardinal) |
| **Ellipse** | 15° wide (cardinal) | 75° wide (diagonals) |

This is inverted for diamonds and ellipses compared to rectangles because their "edges" and "corners" are in different angular positions.

### getBindingSideMidPoint() — line 2585

Given a binding, determines which side of the shape the arrow is attached to and returns the midpoint of that side. Handles all three shape types (rectangle, diamond, ellipse) with proper geometry for rounded corners, diamond vertices, and ellipse arcs.

This is used to visualize binding midpoints on the canvas.

---

## Duplication & Deletion Cleanup

### fixDuplicatedBindingsAfterDuplication() — line 1944

When elements are duplicated (Ctrl+D or copy-paste), all binding references use the old element IDs. This function remaps them:

1. `boundElements[].id` → new IDs
2. `containerId` → new ID
3. `startBinding.elementId` → new ID
4. `endBinding.elementId` → new ID
5. For elbow arrows: re-routes with `updateElbowArrowPoints()`

### fixBindingsAfterDeletion() — line 2016

When elements are deleted, removes all binding references to them:

1. `BoundElement.unbindAffected()` — removes the deleted element from all shapes' `boundElements`
2. `BindableElement.unbindAffected()` — sets `startBinding`/`endBinding`/`containerId` to `null` for all elements that referenced the deleted shape

---

## BoundElement & BindableElement Classes

These two classes (lines 2142-2363) provide **unbind/rebind** operations used primarily by the undo/redo system and deletion.

### BoundElement (line 2142)

Represents an element that has bindings **to** other elements (arrows have `startBinding`/`endBinding`, text has `containerId`).

- **`unbindAffected()`**: For each bindable element this element references, remove this element from their `boundElements` list
- **`rebindAffected()`**: Re-add this element to each referenced bindable element's `boundElements` list. Handles edge cases like deleted targets and duplicate text bindings.

### BindableElement (line 2258)

Represents an element that has a `boundElements` list (shapes that arrows/text can bind to).

- **`unbindAffected()`**: For each bound element, set their reference back to `null` (`startBinding`, `endBinding`, or `containerId`)
- **`rebindAffected()`**: For each bound element, restore their reference. Handles text container conflicts (only one text per container).

---

## Function Reference

### Top-level Entry Points

| Function | Line | Purpose |
|----------|------|---------|
| `bindOrUnbindBindingElement()` | 155 | Main entry — determine and execute binding strategy for an arrow |
| `bindOrUnbindBindingElements()` | 977 | Batch version for multiple selected arrows |
| `updateBoundElements()` | 1080 | When a shape moves, update all arrows bound to it |
| `updateBindings()` | 1250 | Higher-level: handles both arrow and shape changes |
| `fixDuplicatedBindingsAfterDuplication()` | 1944 | Remap binding IDs after element duplication |
| `fixBindingsAfterDeletion()` | 2016 | Clean up bindings when elements are deleted |

### Binding Strategy Functions

| Function | Line | Purpose |
|----------|------|---------|
| `getBindingStrategyForDraggingBindingElementEndpoints_simple()` | 600 | Legacy strategy dispatcher |
| `getBindingStrategyForDraggingBindingElementEndpoints_complex()` | 849 | Modern strategy dispatcher |
| `bindingStrategyForElbowArrowEndpointDragging()` | 236 | Strategy for elbow arrow endpoints |
| `bindingStrategyForNewSimpleArrowEndpointDragging()` | 288 | Strategy during new arrow creation |
| `bindingStrategyForSimpleArrowEndpointDragging_complex()` | 446 | Strategy for dragging existing arrow endpoints |

### Bind/Unbind Operations

| Function | Line | Purpose |
|----------|------|---------|
| `bindBindingElement()` | 994 | Create a binding (mutates arrow + shape) |
| `unbindBindingElement()` | 1046 | Remove a binding (mutates arrow + shape) |

### Point Calculation

| Function | Line | Purpose |
|----------|------|---------|
| `updateBoundPoint()` | 1700 | Calculate where a bound arrow endpoint should be |
| `bindPointToSnapToElementOutline()` | 1348 | Find the intersection point on the element outline |
| `snapToMid()` | 1580 | Magnetic snap to edge midpoints |
| `avoidRectangularCorner()` | 1489 | Nudge elbow arrow points away from corners |
| `calculateFixedPointForNonElbowArrowBinding()` | 1909 | Compute normalized fixedPoint for regular arrows |
| `calculateFixedPointForElbowArrowBinding()` | 1871 | Compute normalized fixedPoint for elbow arrows |
| `normalizeFixedPoint()` | 2434 | Nudge 0.5 → 0.5001 to avoid arrowhead flicker |
| `getGlobalFixedPointForBindableElement()` | 2365 | Convert fixedPoint to canvas coordinates |
| `getGlobalFixedPoints()` | 2382 | Get both arrow endpoints as global coordinates |
| `getArrowLocalFixedPoints()` | 2422 | Get both arrow endpoints as local coordinates |

### Side/Midpoint Helpers

| Function | Line | Purpose |
|----------|------|---------|
| `getShapeSideAdaptive()` | 2532 | Determine which side of a shape a fixedPoint is on |
| `getBindingSideMidPoint()` | 2585 | Get the midpoint of the binding side |
| `getHeadingForElbowArrowSnap()` | 1305 | Get the heading direction for elbow arrow snapping |

### Configuration

| Function | Line | Purpose |
|----------|------|---------|
| `getBindingGap()` | 121 | Calculate gap including stroke width |
| `maxBindingDistance_simple()` | 131 | Max distance for binding trigger (zoom-aware) |
| `shouldEnableBindingForPointerEvent()` | 143 | Check if Ctrl/Cmd is disabling binding |
| `isBindingEnabled()` | 149 | Check AppState binding flag |

---

## How to Read This File

Don't read top-to-bottom. Follow these paths:

### Path 1: Understand the data (30 min)
1. Look at `FixedPointBinding` type and `BindingStrategy` type at the top
2. Draw two shapes with an arrow in the app
3. In console: inspect `h.elements.find(e => e.type === "arrow").startBinding`

### Path 2: Trace the bind flow (2 hours)
1. Start at `bindOrUnbindBindingElement()` (line 155)
2. Follow into the strategy functions — pick the `_complex` path
3. Follow into `bindBindingElement()` (line 994)
4. Follow into `calculateFixedPointForNonElbowArrowBinding()` (line 1909)

### Path 3: Trace the update flow (2 hours)
1. Start at `updateBoundElements()` (line 1080)
2. Follow into `updateBoundPoint()` (line 1700)
3. Follow into `bindPointToSnapToElementOutline()` (line 1348)
4. Follow into `snapToMid()` (line 1580)

### Path 4: Understand cleanup (1 hour)
1. Read `fixDuplicatedBindingsAfterDuplication()` (line 1944)
2. Read `fixBindingsAfterDeletion()` (line 2016)
3. Read the `BoundElement` and `BindableElement` classes (lines 2142-2363)
