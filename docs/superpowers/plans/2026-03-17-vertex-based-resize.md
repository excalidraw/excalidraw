# Vertex-Based Resize for Rotated Wireframe Groups — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable non-proportional side-handle resize on rotated wireframe groups by transforming shared vertex positions instead of scaling elements independently.

**Architecture:** After the standard `resizeMultipleElements` runs (with proportional resize for rotated elements — upstream behavior), detect wireframe groups with a common rotation angle and apply a vertex-based correction: collect all shared vertex global positions, apply an affine transform (scale along the group's rotated axis), then reconstruct each element's `(x, y, points)` from the transformed vertices. This is a post-processing step that overrides the proportional resize result for wireframe groups only.

**Tech Stack:** TypeScript, excalidraw math (`pointRotateRads`, `pointFrom`), `LinearElementEditor.getPointsGlobalCoordinates`

---

## Key Insight

The standard element-based resize breaks shared vertices for rotated elements because each element rotates around its own center. Vertex-based resize sidesteps this by operating on the shared vertices directly — the topology is preserved by construction.

**Reconstruction formulas** for a line element with known angle θ and two new global vertices G0, G1:

```
// The vector G1-G0 in global space, reverse-rotated to local space, gives the points vector
[p1x, p1y] = rotateRads([G1.x - G0.x, G1.y - G0.y], [0, 0], -θ)

// The element position is derived from G0 and the rotation geometry:
// G0 = rotateRads([x, y], [x + p1x/2, y + p1y/2], θ)
// Solving for x, y:
x = G0.x + p1x/2 * (1 - cosθ) + p1y/2 * sinθ
y = G0.y - p1x/2 * sinθ + p1y/2 * (1 - cosθ)  -- wait, need to verify
```

Actually, the simplest correct reconstruction: reverse-rotate BOTH global vertices around their midpoint by -θ. This gives the pre-rotation positions. Then x = preRot0.x, y = preRot0.y, p1 = preRot1 - preRot0.

```
mid = [(G0.x + G1.x) / 2, (G0.y + G1.y) / 2]
-- BUT: mid of global vertices ≠ rotation center for excalidraw elements
-- Rotation center = center of pre-rotation BOUNDS, not center of pre-rotation POINTS
```

For a 2-point line where points = [[0,0], [dx, dy]]:

- pre-rotation bounds center = [x + dx/2, y + dy/2] (for positive dx, dy)
- But bounds center = center of [min, max] of points, which for arbitrary dx, dy: cx = x + (min(0, dx) + max(0, dx)) / 2 = x + dx/2 cy = y + dy/2
- So the rotation center IS [x + dx/2, y + dy/2], same as midpoint of the two pre-rotation points.
- Therefore mid of global vertices = rotation center (rotated). Since rotation preserves center: global_mid = rotateRads([x + dx/2, y + dy/2], [x + dx/2, y + dy/2], θ) = [x + dx/2, y + dy/2] So global_mid = pre-rotation mid!

This means: `mid = (G0 + G1) / 2` is the correct rotation center. We can reverse-rotate around it:

```typescript
const mid = [(G0[0] + G1[0]) / 2, (G0[1] + G1[1]) / 2];
const preRot0 = pointRotateRads(G0, mid, -angle);
const preRot1 = pointRotateRads(G1, mid, -angle);
// x = preRot0[0], y = preRot0[1]
// points[1] = [preRot1[0] - preRot0[0], preRot1[1] - preRot0[1]]
```

**But wait** — this only works for 2-point lines. For lines with midpoints (3+ points), we need to handle intermediate points too. For those, we can interpolate: intermediate points maintain their proportional position along the line.

---

## File Structure

- **Modify:** `packages/element/src/resizeElements.ts` — add vertex-based resize post-processing
- No new files needed.

---

## Task 1: Detect wireframe groups and bypass proportional constraint

**Files:**

- Modify: `packages/element/src/resizeElements.ts:1296-1310` (keepAspectRatio logic)

The standard code forces `keepAspectRatio = true` when `angle !== 0`. We need to let this happen (proportional resize runs normally), but THEN override the result for wireframe groups.

Actually, simpler approach: let proportional resize run, then apply vertex-based correction as post-processing. This way we don't need to change the keepAspectRatio logic at all.

BUT: with proportional resize, scaleX = scaleY = scale. The group scales uniformly. We need a DIFFERENT scale for the side-handle axis. So we need to:

1. Compute the correct single-axis scale from the pointer
2. Apply it via vertex transform
3. Override the proportional resize result

**Revised approach:** Instead of post-processing, intercept BEFORE the element loop. For wireframe groups with side handles, compute the vertex-based updates directly and skip the standard element loop.

- [ ] **Step 1: Add wireframe group detection at the top of the element loop**

After line 1307 (keepAspectRatio computation), add detection:

```typescript
// For side handles on rotated wireframe groups, use vertex-based resize
// instead of element-based resize (which breaks shared vertices).
const isSideHandle = handleDirection.length === 1;
const allSameAngle = targetElements.every(
  (item) => item.latest.angle === targetElements[0]?.latest.angle,
);
const groupAngle = targetElements[0]?.latest.angle ?? 0;
const isRotatedWireframeGroup =
  isSideHandle &&
  groupAngle !== 0 &&
  allSameAngle &&
  targetElements.some(
    (item) =>
      isLineElement(item.latest) && (item.latest as any).sharedVertices,
  );

if (isRotatedWireframeGroup) {
  // Vertex-based resize — see Task 2
  applyVertexBasedResize(...);
  scene.triggerUpdate();
  return;
}
```

This early-returns for the wireframe case, leaving the standard path untouched.

---

## Task 2: Implement `applyVertexBasedResize`

**Files:**

- Modify: `packages/element/src/resizeElements.ts` — add function before `resizeMultipleElements`

- [ ] **Step 1: Compute the single-axis scale from the pointer**

For east handle on a group rotated by θ:

- Reverse-rotate pointer and anchor around bbox center by -θ
- Scale = |rotatedPointerX - rotatedAnchorX| / rotatedFrameWidth

```typescript
function applyVertexBasedResize(
  targetElements: { orig: NonDeletedExcalidrawElement; latest: NonDeletedExcalidrawElement }[],
  handleDirection: TransformHandleDirection,
  scene: Scene,
  elementsMap: ElementsMap,
  originalElementsMap: ElementsMap,
  boundingBox: BoundingBox,
  nextWidth: number | undefined,
  nextHeight: number | undefined,
) {
  const groupAngle = targetElements[0].orig.angle;
  const { minX, minY, maxX, maxY, midX, midY } = boundingBox;
  const axisAlignedWidth = maxX - minX;
  const axisAlignedHeight = maxY - minY;

  // Compute rotated-frame dimensions from elements' pre-rotation extents
  const allOrig = targetElements.map((t) => t.orig);
  const rMinX = Math.min(...allOrig.map((el) => el.x));
  const rMaxX = Math.max(...allOrig.map((el) => el.x + el.width));
  const rMinY = Math.min(...allOrig.map((el) => el.y));
  const rMaxY = Math.max(...allOrig.map((el) => el.y + el.height));
  const rotFrameWidth = rMaxX - rMinX || 1;
  const rotFrameHeight = rMaxY - rMinY || 1;

  // Compute scale in rotated frame.
  // nextWidth/nextHeight come from getNextMultipleWidthAndHeightFromPointer
  // and are in axis-aligned frame. Convert to rotated-frame scale.
  let scaleX = 1;
  let scaleY = 1;
  if (handleDirection.includes("e") || handleDirection.includes("w")) {
    scaleX = (nextWidth ?? axisAlignedWidth) / axisAlignedWidth;
    // Convert axis-aligned scale to rotated-frame scale is complex.
    // Instead, use the raw nextWidth to derive the rotated-frame scale:
    // ... actually, we need to recompute from the pointer directly.
  }
```

Hmm, this gets complex because `nextWidth` is in axis-aligned frame. Let me simplify: recompute the scale from the pointer inside this function.

**Revised approach:** Don't use `nextWidth`/`nextHeight` from the caller. Instead, compute the correct rotated-frame scale directly from the pointer.

But we don't have pointerX/Y inside `resizeMultipleElements`. They're only in `getNextMultipleWidthAndHeightFromPointer`.

**Final approach:** Pass pointerX/Y through to `resizeMultipleElements`. Or: compute the vertex-based resize inside `getNextMultipleWidthAndHeightFromPointer` + `resizeMultipleElements` together.

Actually, the simplest approach: do everything in `resizeMultipleElements`. We have `nextWidth`, `nextHeight`, and the `originalBoundingBox`. For the proportional case (which upstream forces), `nextWidth/nextHeight` maintain the aspect ratio. But we need the ACTUAL single-axis scale.

We can recover it: for the east handle, the single-axis scale is determined by the pointer position. But we only have nextWidth (which was forced proportional).

**Cleanest approach:** Override `keepAspectRatio` for wireframe groups (let non-proportional through), but instead of the standard element loop, use vertex-based resize.

OK let me restructure the plan to be pragmatic.

---

## Revised Plan

### Task 1: Allow non-proportional nextWidth/nextHeight for rotated wireframe groups

**Files:**

- Modify: `packages/element/src/resizeElements.ts:1296-1310`

The `keepAspectRatio` logic at line 1296 forces proportional for `angle !== 0`. We need to allow non-proportional for side handles on wireframe groups so that `nextWidth` reflects the true single-axis scale (not the proportional one).

- [ ] **Step 1: Fix keepAspectRatio to allow wireframe side handles**

Change lines 1296-1310:

```typescript
const isSideHandle = handleDirection.length === 1;
const allSameAngle = targetElements.every(
  (item) => item.latest.angle === targetElements[0]?.latest.angle,
);
const hasWireframe = targetElements.some(
  (item) => isLineElement(item.latest) && (item.latest as any).sharedVertices,
);
const keepAspectRatio =
  shouldMaintainAspectRatio ||
  targetElements.some(
    (item) =>
      // Rotated elements force proportional — UNLESS side handle
      // on a wireframe group with common angle (vertex-based resize handles it)
      (item.latest.angle !== 0 &&
        !(isSideHandle && allSameAngle && hasWireframe)) ||
      isTextElement(item.latest) ||
      (isInGroup(item.latest) && !isSideHandle),
  );
```

### Task 2: Add pointer rotation in getNextMultipleWidthAndHeightFromPointer

Same as previous plan — reverse-rotate pointer for side handles on rotated groups so the pointer movement maps to a single axis. But use rotated-frame dimensions for the scale computation.

- [ ] **Step 1: Add common angle detection and pointer rotation**

After line 1076, add:

```typescript
const angles = new Set(originalElementsArray.map((el) => el.angle));
const commonAngle = angles.size === 1 ? originalElementsArray[0].angle : 0;
const isSideHandle_ = handleDirection.length === 1;
```

Before the scale computation, add pointer rotation AND rotated-frame dimensions:

```typescript
let epx = pointerX,
  epy = pointerY;
let eax = anchorX,
  eay = anchorY;
let scaleWidth = width,
  scaleHeight = height;

if (commonAngle && isSideHandle_) {
  [epx, epy] = pointRotateRads(
    pointFrom(pointerX, pointerY),
    pointFrom(midX, midY),
    -commonAngle as Radians,
  );
  [eax, eay] = pointRotateRads(
    pointFrom(anchorX, anchorY),
    pointFrom(midX, midY),
    -commonAngle as Radians,
  );
  // Use rotated-frame dimensions for scale computation
  const rMinX = Math.min(...originalElementsArray.map((el) => el.x));
  const rMaxX = Math.max(...originalElementsArray.map((el) => el.x + el.width));
  const rMinY = Math.min(...originalElementsArray.map((el) => el.y));
  const rMaxY = Math.max(
    ...originalElementsArray.map((el) => el.y + el.height),
  );
  scaleWidth = rMaxX - rMinX || width;
  scaleHeight = rMaxY - rMinY || height;
}
```

Then use `epx/epy`, `eax/eay`, and return nextWidth/nextHeight adjusted so that `resizeMultipleElements` gets the correct rotated-frame scale:

```typescript
let nextWidth =
  handleDirection.includes("e") || handleDirection.includes("w")
    ? Math.abs(epx - eax) * resizeFromCenterScale * (width / scaleWidth)
    : width;
let nextHeight =
  handleDirection.includes("n") || handleDirection.includes("s")
    ? Math.abs(epy - eay) * resizeFromCenterScale * (height / scaleHeight)
    : height;
```

The `(width / scaleWidth)` factor converts the rotated-frame measurement to an axis-aligned equivalent, so that `nextWidth / width` gives the correct rotated-frame scale.

Also update flipConditionsMap to use epx/epy, eax/eay.

### Task 3: Vertex-based element update in resizeMultipleElements

**Files:**

- Modify: `packages/element/src/resizeElements.ts:1340-1460` (element update loop)

- [ ] **Step 1: Detect wireframe group and apply vertex-based resize**

Inside the element loop (after the standard position/size computation), for wireframe line elements in a rotated group, OVERRIDE the computed (x, y, width, height, points) using vertex reconstruction.

```typescript
// After standard computation of x, y, width, height, rescaledPoints...

// For rotated wireframe elements, override with vertex-based reconstruction
if (
  groupAngle !== 0 &&
  isSideHandle &&
  allSameAngle &&
  isLinearElement(orig) &&
  (orig as any).sharedVertices
) {
  // 1. Get original vertex global positions
  const origGlobals = LinearElementEditor.getPointsGlobalCoordinates(
    orig as any,
    originalElementsMap,
  );

  // 2. Apply affine transform to each vertex:
  //    translate-to-center → rotate(-θ) → scale(sx,sy) → rotate(+θ) → translate-back
  const transformVertex = (gx: number, gy: number): [number, number] => {
    // Reverse-rotate around bbox center
    const [lx, ly] = pointRotateRads(
      pointFrom(gx, gy),
      pointFrom(midX, midY),
      -groupAngle as Radians,
    );
    // Scale in rotated frame
    const sx = lx - midX_rot; // offset from rotated anchor
    const sy = ly - midY_rot;
    const nlx = anchorX_rot + sx * scaleX; // ... need rotated anchor
    const nly = anchorY_rot + sy * scaleY;
    // Rotate back
    return pointRotateRads(
      pointFrom(nlx, nly),
      pointFrom(midX, midY),
      groupAngle as Radians,
    );
  };

  const newGlobals = origGlobals.map((g) => transformVertex(g[0], g[1]));

  // 3. Reconstruct element from new vertex globals
  //    For 2-point line: reverse-rotate both globals around their midpoint
  const G0 = newGlobals[0];
  const GLast = newGlobals[newGlobals.length - 1];
  const gmid = [(G0[0] + GLast[0]) / 2, (G0[1] + GLast[1]) / 2];
  // ... reconstruct all points by reverse-rotating around element center

  // Actually simpler: reverse-rotate ALL new globals around the element's
  // new center to get pre-rotation positions. The new center = midpoint
  // of all new global points' bounding box.
  const allX = newGlobals.map((g) => g[0]);
  const allY = newGlobals.map((g) => g[1]);
  const gCx = (Math.min(...allX) + Math.max(...allX)) / 2;
  const gCy = (Math.min(...allY) + Math.max(...allY)) / 2;

  const preRots = newGlobals.map((g) =>
    pointRotateRads(
      pointFrom(g[0], g[1]),
      pointFrom(gCx, gCy),
      -groupAngle as Radians,
    ),
  );

  // x, y = first pre-rotation point (points[0] is always [0,0])
  const newX = preRots[0][0];
  const newY = preRots[0][1];
  const newPoints = preRots.map((p) => pointFrom(p[0] - newX, p[1] - newY));

  // Override the update
  update.x = newX;
  update.y = newY;
  update.points = newPoints as LocalPoint[];
  update.width =
    Math.max(...newPoints.map((p) => p[0])) -
    Math.min(...newPoints.map((p) => p[0]));
  update.height =
    Math.max(...newPoints.map((p) => p[1])) -
    Math.min(...newPoints.map((p) => p[1]));
}
```

Wait, there's a problem: `getPointsGlobalCoordinates` uses the element's center which is derived from `getElementAbsoluteCoords` (the rough.js bounds). For accurate reconstruction, we need the SAME center computation.

**Simpler reconstruction:** Don't try to compute the center. Instead, use the fact that for excalidraw, the relationship between global vertex positions and element properties is mediated by `getPointGlobalCoordinates`. We need the INVERSE of this function.

The inverse already exists: `LinearElementEditor.pointFromAbsoluteCoords`. But it has the center-shift issue.

**Even simpler:** For each element, we know the ORIGINAL global positions and the ORIGINAL element properties. We know the affine transform T that maps old globals to new globals. We can compute:

- new pre-rotation vertex positions by reverse-rotating new globals around the new element center
- But we don't know the new center yet (chicken-and-egg)

**Pragmatic approach:** For 2-point lines (most wireframe edges), the center is the midpoint of the two pre-rotation vertices. This is self-consistent:

```
center = [x + dx/2, y + dy/2] where dx = points[1][0], dy = points[1][1]
G0 = rotateRads([x, y], center, θ)
G1 = rotateRads([x + dx, y + dy], center, θ)
center = (G0 + G1) / 2  // because rotation preserves the center!
```

So for a 2-point line: `center = midpoint of global vertices`. Reverse-rotate both globals around this center gives pre-rotation positions. Then x = preRot0.x, y = preRot0.y, p1 = preRot1 - preRot0.

For 3+ point lines: center = midpoint of ALL points' bounding box. More complex but same principle.

- [ ] **Step 2: Implement the affine transform for vertices**

The transform for "scale along group X-axis by scaleX, Y-axis by scaleY, around anchor":

```typescript
function transformVertex(
  gx: number,
  gy: number,
  midX: number,
  midY: number,
  anchorX: number,
  anchorY: number,
  scaleX: number,
  scaleY: number,
  groupAngle: number,
): [number, number] {
  // 1. Reverse-rotate vertex and anchor into group-local space
  const [lx, ly] = pointRotateRads(
    pointFrom(gx, gy),
    pointFrom(midX, midY),
    -groupAngle as Radians,
  );
  const [lax, lay] = pointRotateRads(
    pointFrom(anchorX, anchorY),
    pointFrom(midX, midY),
    -groupAngle as Radians,
  );
  // 2. Scale around anchor in local space
  const nlx = lax + (lx - lax) * scaleX;
  const nly = lay + (ly - lay) * scaleY;
  // 3. Rotate back to global
  return pointRotateRads(
    pointFrom(nlx, nly),
    pointFrom(midX, midY),
    groupAngle as Radians,
  ) as unknown as [number, number];
}
```

- [ ] **Step 3: Implement element reconstruction from new globals**

```typescript
function reconstructLineFromGlobals(
  newGlobals: GlobalPoint[],
  angle: number,
): {
  x: number;
  y: number;
  points: LocalPoint[];
  width: number;
  height: number;
} {
  // For lines: rotation center = midpoint of bounding box of globals
  // (which equals midpoint of pre-rotation bounds, since rotation preserves center)
  const xs = newGlobals.map((g) => g[0]);
  const ys = newGlobals.map((g) => g[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;

  // Reverse-rotate all globals around center to get pre-rotation positions
  const preRots = newGlobals.map((g) =>
    pointRotateRads(g, pointFrom(cx, cy), -angle as Radians),
  );

  // x, y = first pre-rotation point (points[0] must be [0,0])
  const x = preRots[0][0];
  const y = preRots[0][1];
  const points = preRots.map((p) => pointFrom<LocalPoint>(p[0] - x, p[1] - y));

  // Width/height from points extent
  const pxs = points.map((p) => p[0]);
  const pys = points.map((p) => p[1]);
  const width = Math.max(...pxs) - Math.min(...pxs);
  const height = Math.max(...pys) - Math.min(...pys);

  return { x, y, points, width, height };
}
```

### Task 4: Wire it all together

- [ ] **Step 1: In resizeMultipleElements, add the vertex-based override**

Inside the element loop, after computing the standard `x, y, width, height, rescaledPoints`, add:

```typescript
if (isRotatedWireframeGroup && isLinearElement(orig)) {
  const origGlobals = LinearElementEditor.getPointsGlobalCoordinates(
    orig as NonDeleted<ExcalidrawLinearElement>,
    originalElementsMap,
  );
  const newGlobals = origGlobals.map((g) =>
    transformVertex(
      g[0],
      g[1],
      midX,
      midY,
      anchorX,
      anchorY,
      scaleX,
      scaleY,
      groupAngle,
    ),
  );
  const recon = reconstructLineFromGlobals(
    newGlobals.map((g) => pointFrom<GlobalPoint>(g[0], g[1])),
    groupAngle,
  );
  // Override the standard computation
  x = recon.x;
  y = recon.y;
  Object.assign(update, {
    x: recon.x,
    y: recon.y,
    width: recon.width,
    height: recon.height,
    points: recon.points,
  });
  // Skip the standard rescaledPoints
}
```

Wait, this won't work cleanly because `update` is constructed after the position computation. Let me restructure: the override should happen when building the `update` object.

**Cleaner approach:** After the `update` object is built (line 1375-1382), override it:

```typescript
const update = { x, y, width, height, angle, ...rescaledPoints };

// Vertex-based override for rotated wireframe elements
if (isRotatedWireframeGroup && isLinearElement(orig)) {
  const origGlobals = LinearElementEditor.getPointsGlobalCoordinates(
    orig as any,
    originalElementsMap,
  );
  const newGlobals = origGlobals.map((g) =>
    transformVertex(
      g[0],
      g[1],
      midX,
      midY,
      anchorX,
      anchorY,
      scaleX,
      scaleY,
      groupAngle,
    ),
  );
  const recon = reconstructLineFromGlobals(
    newGlobals.map((g) => pointFrom<GlobalPoint>(g[0], g[1])),
    groupAngle,
  );
  update.x = recon.x;
  update.y = recon.y;
  update.width = recon.width;
  update.height = recon.height;
  if (recon.points) {
    (update as any).points = recon.points;
  }
}
```

### Task 5: Validate and publish

- [ ] **Step 1: Run checks**

```bash
yarn fix && yarn test:typecheck && cd packages/excalidraw && yarn build:esm
```

- [ ] **Step 2: Manual verification**

1. Unrotated wireframe → side handle → single-axis stretch ✓
2. Rotated wireframe ~45° → side handle → single-axis stretch along rotated direction, edges stay connected ✓
3. Rotated wireframe → corner handle → proportional resize ✓
4. Undo/redo works ✓

- [ ] **Step 3: Publish and deploy**
