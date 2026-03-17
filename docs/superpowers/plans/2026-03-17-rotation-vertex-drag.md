# Rotation-Aware Wireframe Vertex Drag — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix vertex drag on rotated wireframe groups so the dragged vertex follows the cursor and all other vertices remain visually stationary.

**Architecture:** Use a **delta-based** approach: compute pointer delta in canvas space, rotate to local space (no center needed → no center-shift problem), add to current local point, and feed to excalidraw's `movePoints` pipeline. Fix `_propagateSharedVertices` to account for point-0 normalization offset. Remove all inline sibling propagation from App.tsx.

**Tech Stack:** TypeScript, excalidraw coordinate internals

---

## Root Cause Analysis

### Bug 1: Wrong local coord conversion (App.tsx:9277)

```typescript
// CURRENT — ignores rotation entirely
const newLocalX = pointerCoords.x - element.x;
const newLocalY = pointerCoords.y - element.y;
```

`element.x/y` is the **pre-rotation** origin. `pointerCoords` is in **canvas (post-rotation) space**. Simple subtraction only works when `angle === 0`.

**Why not use `pointFromAbsoluteCoords`?** It reverse-rotates around the bounding box center. But after mutation, the bounding box center shifts, so the dragged point doesn't land exactly on the cursor. Verified numerically: a 2-point line at 45° has ~6px error per frame. This doesn't converge.

**Correct approach — delta-based:** Compute canvas delta (no center needed), rotate by `-angle` to get local delta, add to current local point. Deltas are center-independent.

```
canvasDelta = pointer - prevPointer
localDelta = rotate(canvasDelta, -element.angle)   // rotation around origin, no center
newLocal = element.points[idx] + localDelta
```

### Bug 2: Wrong delta in `_propagateSharedVertices` for point-0 drags

When point-0 is dragged, `movePoints` normalizes all points:

```
offset = points[0]  // e.g. [10, 10]
nextPoints[i] = points[i] - offset  // ALL points shift
element.x/y += rotatedOffset(offset)   // compensates visually
```

But `_propagateSharedVertices` computes local deltas:

```
ldx = nextPoints[i] - prevPoints[i]  // NON-ZERO for ALL points!
```

For a non-dragged point: `nextPoints[1] = prevPoints[1] - offset`, so `ldx = -offset`. This incorrectly reports movement for all vertices and propagates them to siblings.

**Fix:** Add offset back to delta: `ldx = (nextPoints[i] - prevPoints[i]) + offset`

- Non-dragged point: `(-offset) + offset = 0` — correctly zero
- Dragged point-0: `(0 - 0) + offset = offset` — correctly equals drag delta

### Bug 3: Inline sibling propagation ignores rotation (App.tsx:9333)

```typescript
// CURRENT — same rotation-blind conversion for siblings
newPts[idx] = [pointerCoords.x - sibEl.x, pointerCoords.y - sibEl.y];
```

Eliminated entirely by using `movePoints` → `_updatePoints` → `_propagateSharedVertices`.

---

## Coordinate System Reference

```
LOCAL space              PRE-ROTATION global       CANVAS (global)
points[i] = [lx, ly]  → [elem.x + lx,           → pointRotateRads(
points[0] ≡ [0, 0]       elem.y + ly]                preRotGlobal,
                                                      [cx, cy],
                                                      elem.angle)

Canvas → Local (absolute, has center-shift problem):
  1. unrotated = pointRotateRads(canvas, center, -angle)
  2. local = unrotated - [element.x, element.y]

Canvas → Local (delta-based, no center needed):
  1. canvasDelta = pointer - prevPointer
  2. localDelta = rotate(canvasDelta, -angle)  // around origin
  3. newLocal = currentPoints[idx] + localDelta

Point-0 invariant:
  points[0] must always be [0, 0].
  When it moves by [dx, dy]:
    - all points -= [dx, dy]
    - element.x/y += rotatedOffset([dx,dy], [dCenter], angle)

Center-shift compensation in _updatePoints:
  rotatedOffset = pointRotateRads([offsetX, offsetY], [dX, dY], angle)
  where dX/dY = prevCenter - nextCenter (local bounding box centers)
  This ensures non-dragged points stay visually fixed despite center shift.
```

---

## Task 1: Fix `_propagateSharedVertices` offset handling

**Files:**

- Modify: `packages/element/src/linearElementEditor.ts:1866` (signature)
- Modify: `packages/element/src/linearElementEditor.ts:1902` (delta computation)
- Modify: `packages/element/src/linearElementEditor.ts:1799` (call site in `_updatePoints`)

- [ ] **Step 1: Add offset parameters to `_propagateSharedVertices`**

Change signature at line 1866 from:

```typescript
private static _propagateSharedVertices(
    element: ExcalidrawLinearElement & {
      sharedVertices: Record<number, string>;
      groupIds: string[];
    },
    scene: Scene,
    sv: Record<number, string>,
    prevGlobal: Map<string, { x: number; y: number }>,
    prevPoints: readonly LocalPoint[],
    nextPoints: readonly LocalPoint[],
  ): void {
```

to:

```typescript
private static _propagateSharedVertices(
    element: ExcalidrawLinearElement & {
      sharedVertices: Record<number, string>;
      groupIds: string[];
    },
    scene: Scene,
    sv: Record<number, string>,
    prevGlobal: Map<string, { x: number; y: number }>,
    prevPoints: readonly LocalPoint[],
    nextPoints: readonly LocalPoint[],
    offsetX: number,
    offsetY: number,
  ): void {
```

- [ ] **Step 2: Fix local delta computation**

Change lines 1902-1903 from:

```typescript
const ldx = nextPoints[idx][0] - prevPoints[prevIdx][0];
const ldy = nextPoints[idx][1] - prevPoints[prevIdx][1];
```

to:

```typescript
// Add offset to compensate for point-0 normalization:
// movePoints subtracts offset from ALL points, so raw local delta
// includes the normalization shift. Adding offset back isolates
// the actual vertex movement.
const ldx = nextPoints[idx][0] - prevPoints[prevIdx][0] + offsetX;
const ldy = nextPoints[idx][1] - prevPoints[prevIdx][1] + offsetY;
```

- [ ] **Step 3: Update call site in `_updatePoints`**

Change lines 1799-1806 from:

```typescript
LinearElementEditor._propagateSharedVertices(
  element as any,
  scene,
  sv,
  prevGlobal,
  prevPoints,
  nextPoints,
);
```

to:

```typescript
LinearElementEditor._propagateSharedVertices(
  element as any,
  scene,
  sv,
  prevGlobal,
  prevPoints,
  nextPoints,
  offsetX,
  offsetY,
);
```

- [ ] **Step 4: Verify typecheck**

Run: `yarn test:typecheck` Expected: PASS

---

## Task 2: Add `prevPointer` to wireframeDragVertex

**Files:**

- Modify: `packages/excalidraw/components/App.tsx:722-726` (type definition)
- Modify: `packages/excalidraw/components/App.tsx:9836-9840` (initialization)

- [ ] **Step 1: Expand type definition**

Change lines 722-726 from:

```typescript
private wireframeDragVertex: {
    elementId: string;
    pointIndex: number;
    vertexId: string;
  } | null = null;
```

to:

```typescript
private wireframeDragVertex: {
    elementId: string;
    pointIndex: number;
    vertexId: string;
    prevPointerX: number;
    prevPointerY: number;
  } | null = null;
```

- [ ] **Step 2: Set prevPointer on drag start**

Change lines 9836-9840 from:

```typescript
this.wireframeDragVertex = {
  elementId: hitVertex.elementId,
  pointIndex: hitVertex.pointIndex,
  vertexId: hitVertex.vertexId,
};
```

to:

```typescript
this.wireframeDragVertex = {
  elementId: hitVertex.elementId,
  pointIndex: hitVertex.pointIndex,
  vertexId: hitVertex.vertexId,
  prevPointerX: pointerDownState.origin.x,
  prevPointerY: pointerDownState.origin.y,
};
```

---

## Task 3: Rewrite `_handleWireframeVertexDrag` with delta-based approach

**Files:**

- Modify: `packages/excalidraw/components/App.tsx:9262-9355` (replace entire method body)

- [ ] **Step 1: Replace method body**

Replace the entire `_handleWireframeVertexDrag` method (lines 9262-9355) with:

```typescript
private _handleWireframeVertexDrag = (pointerCoords: {
    x: number;
    y: number;
  }): void => {
    if (!this.wireframeDragVertex) {
      return;
    }
    const { elementId, pointIndex, prevPointerX, prevPointerY } =
      this.wireframeDragVertex;
    const element = this.scene.getElement(elementId);
    if (!element || !isLinearElement(element)) {
      this.wireframeDragVertex = null;
      return;
    }

    // Canvas-space delta since last frame
    const cdx = pointerCoords.x - prevPointerX;
    const cdy = pointerCoords.y - prevPointerY;

    // Rotate canvas delta to local space (around origin — no center needed,
    // which avoids the center-shift problem of pointFromAbsoluteCoords)
    const cos = Math.cos(element.angle);
    const sin = Math.sin(element.angle);
    const ldx = cdx * cos + cdy * sin; // rotate by -angle
    const ldy = -cdx * sin + cdy * cos;

    // New local = current local + delta
    const current = element.points[pointIndex];
    const localPoint = pointFrom<LocalPoint>(
      current[0] + ldx,
      current[1] + ldy,
    );

    // movePoints handles:
    // 1. point-0 normalization (keeps points[0] at [0,0])
    // 2. center-shift compensation via rotatedOffset on element.x/y
    // 3. _propagateSharedVertices for sibling wireframe edges
    const pointUpdates = new Map() as Map<
      number,
      { point: LocalPoint; isDragging: boolean }
    >;
    pointUpdates.set(pointIndex, {
      point: localPoint,
      isDragging: true, // required: triggers shared vertex propagation
    });
    LinearElementEditor.movePoints(element, this.scene, pointUpdates);

    // Update prevPointer for next frame
    this.wireframeDragVertex = {
      ...this.wireframeDragVertex,
      prevPointerX: pointerCoords.x,
      prevPointerY: pointerCoords.y,
    };
  };
```

**Why delta-based:**

- `pointFromAbsoluteCoords` converts absolute canvas pos → local using the bounding box center
- After mutation, the center shifts → dragged point doesn't land exactly on cursor (~6px error at 45°)
- Deltas don't use the center, so there's no center-shift problem
- This is the same approach excalidraw's own LinearElementEditor drag uses

- [ ] **Step 2: Verify imports**

Confirm these are already imported in App.tsx:

- `LinearElementEditor` — yes (line ~126)
- `pointFrom` — yes (line ~10)
- `LocalPoint` — yes (line ~265)

Run: `yarn test:typecheck` Expected: PASS

- [ ] **Step 3: Full validation**

```bash
yarn fix              # must pass with 0 warnings
yarn test:typecheck   # must pass
cd packages/excalidraw && yarn build:esm  # must succeed
```

---

## Task 4: Manual verification

- [ ] **Step 1:** `yarn start` — open dev server
- [ ] **Step 2:** Create a 3D wireframe (cube preset)
- [ ] **Step 3:** Select group → click vertex → drag on **unrotated** wireframe → all connected edges should follow
- [ ] **Step 4:** Rotate the wireframe ~45° → drag a non-point-0 vertex → edges follow, no drift
- [ ] **Step 5:** Rotate the wireframe ~45° → drag a **point-0 vertex** specifically → edges follow, other vertices stay (this tests the offset fix in `_propagateSharedVertices`)
- [ ] **Step 6:** Add a midpoint to an edge → drag an endpoint → still works
- [ ] **Step 7:** Undo/redo after vertex drag → should restore correctly

---

## Task 5: Publish and deploy

- [ ] Bump version in `packages/excalidraw/package.json`
- [ ] Build and publish: `cd packages/excalidraw && yarn build:esm && NPM_TOKEN=<token> npm publish`
- [ ] Install in billion-dollars: `cd apps/frontend && NPM_TOKEN=<token> npm install @emevart/excalidraw@<version>`
- [ ] Commit both repos (package.json + package-lock.json in billion-dollars)
- [ ] Push and create PR

---

## Notes

- **Wireframe edges are NOT polygons** — they don't have `element.polygon = true`, so `movePoints`'s polygon coupling (point 0 ↔ last point) won't trigger.
- **No cascade** — `_propagateSharedVertices` mutates siblings via `scene.mutateElement`, not via `movePoints`, so propagation doesn't cascade.
- **Floating point accumulation** — delta-based approach accumulates rounding errors over many frames. In practice this is sub-pixel and imperceptible. The alternative (absolute) has ~6px systematic error from center-shift, which is much worse.
