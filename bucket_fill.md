# Bucket / Flood Fill Spec

## Goal

Add a bucket fill tool to the toolbar's extra tools dropdown. Clicking an enclosed visible region creates a normal Excalidraw element that acts as a virtual background fill for that region.

The generated fill is a `line` polygon:

- `type: "line"`
- `polygon: true`
- `strokeColor: "transparent"`
- `backgroundColor: appState.currentItemBackgroundColor`
- `fillStyle: "solid"`
- sharp polygon points only; no Bezier curves
- positioned just below the target boundary element in scene order

The fill is static in the first implementation. Moving or editing the source boundary elements will not automatically regenerate it.

The first shippable version should fill the owner outline only. Overlap-aware fill, where neighboring outlines split the owner into smaller regions, is a later phase and should be treated as the hard geometry work in this feature.

The motivating overlapping-rectangle "lens" behavior is a Phase 3 deliverable. In v1, clicking that overlap fills the whole topmost owner shape.

## User Behavior

- The tool appears in the existing extra tools dropdown in `packages/excalidraw/components/Actions.tsx` and `packages/excalidraw/components/MobileToolBar.tsx`.
- Selecting the tool changes `appState.activeTool.type` to `"bucketFill"`.
- A single pointer click attempts to fill the visible enclosed region under the pointer.
- The fill color comes from `appState.currentItemBackgroundColor`.
- If the current background color is transparent, the tool should no-op with a toast such as "Choose a background color to fill."
- On success, the new fill element is inserted, selected, and the tool returns to the preferred selection tool unless the active tool is locked.
- Undo should remove the generated fill in one step.
- The generated fill remains a normal editable element. Users can select, delete, recolor, resize, or edit its points.

## Non-Goals For The First Version

- No live binding between the fill and the elements that produced it.
- No raster flood fill or bitmap dependency.
- No boolean clipping engine dependency.
- No support for filling arbitrary open canvas space outside a closed owner shape.
- No support for holes or multi-contour fill elements.
- No automatic grouping with the owner unless the owner is already inside a group.
- No attempt to perfectly match rough.js jitter. The fill should approximate the logical/vector boundary closely.

## Terminology

- Owner element: the topmost closed element under the click. The owner provides insertion position, frame/group context, and the default bounded area.
- Boundary element: an element whose visible outline can stop the flood fill.
- Boundary graph: flattened line segments from owner and overlapping boundary elements, split at intersections.
- Face: a closed polygonal cell in the boundary graph.
- Fill element: the generated `line` polygon that fills the selected face.

## Integration Points

Update tool definitions:

- `packages/excalidraw/types.ts`: add `"bucketFill"` to `ToolType`.
- `packages/common/src/constants.ts`: add `TOOL_TYPE.bucketFill`.
- `packages/excalidraw/locales/en.json`: add `toolBar.bucketFill`.
- `packages/excalidraw/components/icons.tsx`: add or reuse a paint bucket icon.
- `packages/excalidraw/components/shapes.tsx`: add a `SHAPES` entry with `toolbar: false` so tool lookup/keyboard plumbing stays consistent.
- `packages/excalidraw/components/Actions.tsx`: add dropdown item in the extra tools menu.
- `packages/excalidraw/components/MobileToolBar.tsx`: add dropdown item for mobile and update the extra-tools active icon/selection logic.
- `packages/excalidraw/components/App.tsx`: handle bucket fill on pointer down before normal selection/drag behavior and before the `createGenericElementOnPointerDown` fallback.
- `packages/excalidraw/components/HintViewer.tsx`: optional short hint while active.

Add reusable geometry in `packages/element/src/bucketFill.ts`. Keep this module pure: no React, no app state, no DOM.

Export the module from `packages/element/src/index.ts`.

## Geometry API

Suggested element-level API:

```ts
export type BucketFillOptions = {
  snapEpsilon: number;
  gapTolerance: number;
  minArea: number;
  maxBoundarySegments: number;
  maxGeneratedPoints: number;
};

export type BucketFillGeometryResult =
  | {
      ok: true;
      ownerId: ExcalidrawElement["id"];
      boundaryElementIds: ExcalidrawElement["id"][];
      scenePoints: GlobalPoint[];
    }
  | {
      ok: false;
      reason:
        | "no_owner"
        | "open_region"
        | "too_complex"
        | "too_small"
        | "invalid_polygon";
    };

export const computeBucketFillPolygon = (args: {
  point: GlobalPoint;
  elements: readonly Ordered<NonDeletedExcalidrawElement>[];
  elementsMap: NonDeletedSceneElementsMap;
  options?: Partial<BucketFillOptions>;
}): BucketFillGeometryResult;
```

The Excalidraw app layer should convert the returned `scenePoints` into local `line` points and call `newLinearElement()`.

## Reuse Existing Helpers

Prefer existing helpers before adding bucket-specific geometry:

- `getElementBounds()` from `packages/element/src/bounds.ts` for candidate filtering.
- `doBoundsIntersect()` from `packages/element/src/bounds.ts` for broad-phase filtering.
- `getElementLineSegments()` from `packages/element/src/bounds.ts` for boundary extraction.
- `isPointInElement()` from `packages/element/src/collision.ts` for owner detection and validation.
- `intersectElementWithLineSegment()` from `packages/element/src/collision.ts` for validation/ray checks where useful.
- `isPathALoop()` from `packages/element/src/utils.ts` for closed freedraw/linear detection.
- `isValidPolygon()` from `packages/element/src/typeChecks.ts`.
- `newLinearElement()` from `packages/element/src/newElement.ts`.
- `Scene.insertElementsAtIndex()` for z-order insertion.
- `polygonIncludesPointNonZero()` from `@excalidraw/math` for face containment checks.

`getElementLineSegments()` currently hardcodes subdivision counts: Bezier/rounded curves use 10 subdivisions and ellipses use 90. For v1, rely on polygon simplification to reduce the generated fill. If this is too dense or too slow, add a bucket-specific wrapper or add options to `getElementLineSegments()` as part of the same change. Do not expose `curveSubdivisions` or `ellipseSubdivisions` in the public bucket fill options until the helper can actually honor them.

## Owner Selection

On click:

1. Iterate non-deleted elements from top to bottom.
2. Ignore elements with `opacity <= 0`.
3. Ignore generated bucket fills when detecting an owner unless the user clicked them directly with the selection tool.
4. A fill owner must have a closed interior:
   - rectangle, diamond, ellipse, frame-like shapes with visible bounds
   - `line` with `polygon: true` and `isValidPolygon(points)`
   - closed freedraw where `isPathALoop(points)`
5. Use `isPointInElement(point, element, elementsMap)` to test ownership.
6. Choose the first/topmost matching owner.
7. If no owner is found, return `no_owner`.

This keeps the first version bounded. The tool fills regions inside a known closed owner instead of trying to flood fill the infinite canvas.

## Boundary Element Selection

After choosing the owner:

1. Get `ownerIndex` in scene order.
2. Get owner bounds via `getElementBounds(owner, elementsMap)`.
3. Expand owner bounds by:
   - the max relevant stroke width
   - `gapTolerance`
   - a small constant such as `2`
4. Include the owner.
5. For v1, include only the owner.
6. For overlap-aware fill, include every visible boundary element whose expanded bounds intersect the owner bounds, regardless of z-order. Z-order affects insertion, not graph membership.

`gapTolerance` has two jobs:

- v1: expand owner candidate bounds so slightly rough outlines are not clipped too aggressively.
- overlap-aware phase: bridge endpoint-to-endpoint gaps up to `gapTolerance` when graph construction would otherwise leave an obvious near-closed boundary open. Do not use it for broad endpoint-to-segment snapping until that behavior is tested; ambiguous gaps should return `open_region`.

Eligible boundary elements:

- rectangle, diamond, ellipse
- frame-like elements
- `line` and `freedraw`, open or closed, because open strokes can split an owner region if they connect to other boundaries
- arrow shafts may be included as blockers only if this does not interfere with binding behavior; default to excluding arrows in the first version

Excluded in the first version:

- text
- image
- embeddable/iframe contents
- deleted elements
- elements with transparent stroke and no visible outline
- prior bucket fill elements, unless later UX explicitly supports using fills as blockers

The z-order rule is intentional: a fill under the owner should be clipped by outlines that are visually above the owner, while lower elements are usually content to be covered by the virtual background.

Important consequence for overlap-aware fill: the main overlapping-shape use case requires lower z-order shapes to participate in the boundary graph. If the generated fill is inserted immediately below the topmost owner, it can cover stroke segments from lower elements inside the filled face. That is an explicit tradeoff of the "virtual background under owner" model, not a graph membership rule.

## Boundary Segment Extraction

For each boundary element:

1. Call `getElementLineSegments(element, elementsMap)`.
2. Drop zero-length or near-zero-length segments.
3. Clip or filter segments to the expanded owner bounds.
4. Store source metadata:

```ts
type BoundarySegment = {
  id: string;
  elementId: ExcalidrawElement["id"];
  sourceIndex: number;
  a: GlobalPoint;
  b: GlobalPoint;
};
```

Default options:

```ts
const DEFAULT_BUCKET_FILL_OPTIONS = {
  snapEpsilon: 0.5,
  gapTolerance: 2,
  minArea: 4,
  maxBoundarySegments: 2000,
  maxGeneratedPoints: 256,
};
```

If segment count exceeds `maxBoundarySegments`, return `too_complex` rather than blocking the UI.

## Segment Normalization And Intersections

This section is for overlap-aware fill, not the v1 owner-only fill.

Build a planar straight-line graph:

1. Snap endpoints within `snapEpsilon` to the same graph node.
2. Spatially bucket segments by bounds to avoid comparing every pair for large scenes.
3. For each segment pair with intersecting bounds:
   - detect ordinary point intersections with `lineSegmentIntersectionPoints(segmentA, segmentB, snapEpsilon)`
   - handle collinear overlaps by inserting overlap endpoints as split points on both segments
   - ignore intersections outside segment bounds after epsilon expansion
4. For each original segment, collect split parameters `t`:
   - `0`
   - `1`
   - every intersection point projected onto the segment
5. Sort and de-dupe `t` values.
6. Emit atomic edges between adjacent split points.
7. Drop atomic edges shorter than `snapEpsilon`.
8. Bridge endpoint-to-endpoint gaps no larger than `gapTolerance` when doing so does not create multiple possible closures.

This gives a graph where overlapping shapes are split at their visible intersections, enabling fills like the overlapping-rounded-rectangle case.

`lineSegmentIntersectionPoints()` returns one point or `null`; it does not return multiple points and it does not detect collinear overlaps. Add explicit collinearity and interval-overlap helpers before attempting overlap-aware fill.

## Face Extraction

Use half-edge traversal:

1. Each atomic edge creates two directed half-edges.
2. For every graph node, sort outgoing half-edges by angle.
3. Traverse unvisited half-edges using a consistent rule:
   - at the next node, find the reverse direction
   - choose the outgoing edge immediately clockwise from that reverse direction to keep the face on one side
4. Collect closed rings.
5. Compute signed area for each ring.
6. Discard:
   - unbounded outer face
   - rings with `abs(area) < minArea`
   - self-intersecting rings, if detected
7. Select the smallest-area valid face that contains the click point.

Containment should use `polygonIncludesPointNonZero()` or an equivalent local helper. If the click lies directly on an edge, return `open_region` and avoid creating an unstable fill. Do not nudge inward in v1; the correct nudge direction is ambiguous near concave vertices.

This phase is a 2D segment arrangement plus face-location problem. It is substantially more complex than the tool shell and owner-only fill. Timebox a robustness spike before committing to it, and bail out with `too_complex` for dense graphs, unstable snapping, self-intersections, or ambiguous faces.

## Polygon Simplification

The generated fill should be close fitting but not overly dense.

After selecting the face:

1. Remove duplicate adjacent points.
2. Remove collinear points within an angular tolerance.
3. Preserve points created from element intersections.
4. Apply Ramer-Douglas-Peucker simplification with a starting tolerance around `0.75`.
5. If point count is still above `maxGeneratedPoints`, increase tolerance until it fits or return `too_complex`.
6. Ensure the polygon is closed by repeating the first point as the last point if it is not already closed.
7. Ensure `isValidPolygon(localPoints)` would be true.

Do not generate Bezier curves or rounded corners. Curves are approximated by line segments.

Line polygon rendering requires both an actual loop (`isPathALoop(points)`) and a non-transparent background. Set `polygon: true`, explicitly close the points, and guard against appending the closing point more than once.

## Fill Element Creation

In the app layer:

1. Convert scene polygon points to local line points:
   - `x = min(scenePoints.x)`
   - `y = min(scenePoints.y)`
   - local point = `[sceneX - x, sceneY - y]`
   - `width = maxX - minX`
   - `height = maxY - minY`
2. Ensure first and last local points are equal.
3. Create:

```ts
const fill = newLinearElement({
  type: "line",
  x,
  y,
  width,
  height,
  points,
  polygon: true,
  strokeColor: "transparent",
  backgroundColor: appState.currentItemBackgroundColor,
  fillStyle: "solid",
  strokeWidth: 1,
  strokeStyle: "solid",
  roughness: 0,
  roundness: null,
  opacity: appState.currentItemOpacity,
  frameId: isFrameLikeElement(owner) ? owner.id : owner.frameId,
  groupIds: owner.groupIds,
  customData: {
    bucketFill: {
      version: 1,
      ownerId,
      boundaryElementIds,
      seedPoint: point,
    },
  },
});
```

If the owner has no `groupIds`, do not create a new group automatically.

## Z-Order

Insert the generated fill immediately before the owner element:

```ts
scene.insertElementsAtIndex([fill], ownerIndex);
```

This makes the fill behave like a background for the owner while still covering lower content. Boundary elements above the owner remain visible because they render above the fill.

Known limitation: if the chosen face uses visible boundary edges from elements below the owner, inserting above those elements can cover their strokes. This is expected in the primary overlapping-shape use case when the owner is the topmost shape. The initial z-order rule favors the "fill this owner shape" workflow over perfect visual preservation for every mixed-z-order case.

## Selection And History

After insertion:

- select only the generated fill element
- clear `newElement`
- commit the element insertion and selection update with `CaptureUpdateAction.IMMEDIATELY`
- return to selection unless the bucket tool is locked

The fill is not bound to the owner. Future work can use `customData.bucketFill` to add a "Regenerate bucket fill" action.

## Failure Handling

Return no generated element for:

- transparent fill color, handled in the app layer before geometry runs
- no closed owner under the pointer
- no bounded face contains the pointer
- graph too complex
- simplified polygon is invalid
- area is too small

Prefer a small toast over throwing. Geometry failures should not mutate the scene.

## Tests

Add unit tests for `packages/element/src/bucketFill.ts`:

- fills a simple rectangle and returns a closed polygon
- fills a rotated rectangle
- fills an ellipse with bounded point count
- v1: ignores non-owner overlapping elements
- overlap-aware phase: fills a region split by an overlapping rectangle below or above the owner
- overlap-aware phase: lower z-order elements participate in the boundary graph
- handles segment intersections at rectangle/ellipse crossings
- returns `no_owner` for open canvas
- returns `open_region` for an unclosed owner/open face
- returns `too_complex` when segment cap is exceeded
- simplification preserves closure and validity

Add integration tests in `packages/excalidraw/tests`:

- extra tools dropdown selects bucket fill
- click creates a `line` with `polygon: true`
- generated fill uses current background color
- generated fill has transparent stroke and solid fill style
- generated fill is inserted immediately below owner
- generated fill is selected after creation
- undo removes the fill
- generated fill copies `frameId` when owner is inside a frame
- generated fill uses the frame's id as `frameId` when the owner itself is a frame

## Implementation Phases

### Phase 1: Tool Shell

- Add tool type, constants, locale, icon, toolbar entries.
- Add pointer handler that identifies owner and no-ops with toasts.
- No geometry generation yet.

### Phase 2: Simple Owner Fill

- Generate fill from only the owner outline.
- Support rectangle, diamond, ellipse, and valid line polygons.
- Chain owner segments into one ordered ring before simplification; `getElementLineSegments()` returns segments, not a ready-made polygon.
- Create and insert the fill element.
- Add basic tests.
- This is the first shippable v1.

### Phase 3: Overlap-Aware Fill

- Add z-order-agnostic boundary element collection.
- Add collinear-overlap detection helpers.
- Add segment splitting at intersections.
- Add half-edge face extraction.
- Add overlap tests matching the target behavior.
- Treat this as the main computational geometry phase, not as a small follow-up.

### Phase 4: Robustness

- Add simplification point caps.
- Add complexity limits and failure toasts.
- Decide whether `getElementLineSegments()` needs bucket-specific subdivision options.
- Add rotated and mixed-shape tests.

### Phase 5: Follow-Ups

- Optional "Regenerate bucket fill" action using `customData.bucketFill`.
- Optional support for arrows as blockers.
- Optional support for holes and multi-contour fills.
- Optional support for using existing bucket fills as blockers.
- Optional keyboard shortcut after UX review.
