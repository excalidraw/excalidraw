# Ellipse Arc Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `ExcalidrawEllipseElement` with optional `startAngle`/`endAngle` properties to render smooth arcs using rough.js `generator.arc()`, replacing polyline-based arc approximations.

**Architecture:** Add two optional properties to the ellipse element type. When present, shape generation uses `generator.arc()` instead of `generator.ellipse()`. Bounds and hit-testing are updated to consider only the arc extent. The semicircle 2D preset is converted from a polyline to an arc element. 3D presets (cylinder, cone, truncated cone, sphere) can later adopt arc elements too but are out of scope for this plan.

**Tech Stack:** TypeScript, rough.js (`generator.arc()`), excalidraw math

---

## Key Facts

- rough.js API: `generator.arc(x, y, width, height, start, stop, closed?, options?): Drawable`
  - `x, y` = center, `width, height` = ellipse dimensions
  - `start, stop` = angles in radians, `closed` = connect endpoints to center
- Current ellipse shape gen: `generator.ellipse(w/2, h/2, w, h, options)` in `shape.ts:903-912`
- Current ellipse bounds: analytic formula in `bounds.ts:206-213`
- Current ellipse hit-test segments: 90-point polygon in `bounds.ts:478-507`
- `newElement({ type: "ellipse", ... })` in `newElement.ts:158-163`

---

## Task 1: Extend element type

**Files:**

- Modify: `packages/element/src/types.ts:96-98`

- [ ] **Step 1: Add arc properties to ExcalidrawEllipseElement**

```typescript
export type ExcalidrawEllipseElement = _ExcalidrawElementBase & {
  type: "ellipse";
  /** Arc start angle in radians. When undefined, renders full ellipse. */
  startAngle?: number;
  /** Arc end angle in radians. */
  endAngle?: number;
};
```

---

## Task 2: Shape generation

**Files:**

- Modify: `packages/element/src/shape.ts:903-912`

- [ ] **Step 1: Use generator.arc() when angles are present**

```typescript
case "ellipse": {
  const ellipseEl = element as ExcalidrawEllipseElement;
  let shape: ElementShapes[typeof element.type];

  if (
    ellipseEl.startAngle !== undefined &&
    ellipseEl.endAngle !== undefined
  ) {
    // Partial arc — use rough.js arc()
    shape = generator.arc(
      element.width / 2,
      element.height / 2,
      element.width,
      element.height,
      ellipseEl.startAngle,
      ellipseEl.endAngle,
      true, // closed: connect endpoints with straight line
      generateRoughOptions(element, false, isDarkMode),
    );
  } else {
    // Full ellipse
    shape = generator.ellipse(
      element.width / 2,
      element.height / 2,
      element.width,
      element.height,
      generateRoughOptions(element, false, isDarkMode),
    );
  }
  return shape;
}
```

Note: `closed: true` draws a chord (straight line between arc endpoints), creating a semicircle shape. For open arcs (like cylinder bottom), use `closed: false`.

---

## Task 3: Bounds computation

**Files:**

- Modify: `packages/element/src/bounds.ts:206-213`

- [ ] **Step 1: Update getElementAbsoluteCoords for arcs**

For a partial arc, the bounding box must include:

- The two endpoints of the arc
- Any axis-crossing points (0°, 90°, 180°, 270°) within the arc range

```typescript
} else if (element.type === "ellipse") {
  const ellipseEl = element as ExcalidrawEllipseElement;

  if (
    ellipseEl.startAngle !== undefined &&
    ellipseEl.endAngle !== undefined
  ) {
    // Arc bounds: collect endpoints + axis crossings
    const a = (x2 - x1) / 2;
    const b = (y2 - y1) / 2;
    const points: [number, number][] = [];

    // Arc endpoints
    points.push([cx + a * Math.cos(ellipseEl.startAngle), cy + b * Math.sin(ellipseEl.startAngle)]);
    points.push([cx + a * Math.cos(ellipseEl.endAngle), cy + b * Math.sin(ellipseEl.endAngle)]);

    // Check if arc crosses axis angles (0, π/2, π, 3π/2)
    const normAngle = (angle: number) => ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const start = normAngle(ellipseEl.startAngle);
    const end = normAngle(ellipseEl.endAngle);

    for (const axisAngle of [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]) {
      const na = normAngle(axisAngle);
      const inArc = start < end
        ? na >= start && na <= end
        : na >= start || na <= end;
      if (inArc) {
        points.push([cx + a * Math.cos(axisAngle), cy + b * Math.sin(axisAngle)]);
      }
    }

    // Also include center if closed arc
    points.push([cx, cy]);

    let minXa = Infinity, minYa = Infinity, maxXa = -Infinity, maxYa = -Infinity;
    for (const [px, py] of points) {
      // Apply element rotation
      const cos = Math.cos(element.angle);
      const sin = Math.sin(element.angle);
      const rx = cx + (px - cx) * cos - (py - cy) * sin;
      const ry = cy + (px - cx) * sin + (py - cy) * cos;
      minXa = Math.min(minXa, rx);
      minYa = Math.min(minYa, ry);
      maxXa = Math.max(maxXa, rx);
      maxYa = Math.max(maxYa, ry);
    }
    bounds = [minXa, minYa, maxXa, maxYa];
  } else {
    // Full ellipse — existing formula
    const w = (x2 - x1) / 2;
    const h = (y2 - y1) / 2;
    const cos = Math.cos(element.angle);
    const sin = Math.sin(element.angle);
    const ww = Math.hypot(w * cos, h * sin);
    const hh = Math.hypot(h * cos, w * sin);
    bounds = [cx - ww, cy - hh, cx + ww, cy + hh];
  }
}
```

---

## Task 4: Hit-test segments

**Files:**

- Modify: `packages/element/src/bounds.ts:478-507` (`getSegmentsOnEllipse`)

- [ ] **Step 1: Generate segments only for the arc range**

```typescript
const getSegmentsOnEllipse = (
  ellipse: ExcalidrawEllipseElement,
): LineSegment<GlobalPoint>[] => {
  const center = pointFrom<GlobalPoint>(
    ellipse.x + ellipse.width / 2,
    ellipse.y + ellipse.height / 2,
  );

  const a = ellipse.width / 2;
  const b = ellipse.height / 2;

  const startAngle = ellipse.startAngle ?? 0;
  const endAngle = ellipse.endAngle ?? Math.PI * 2;
  const isArc = ellipse.startAngle !== undefined;

  const segments: LineSegment<GlobalPoint>[] = [];
  const points: GlobalPoint[] = [];
  const n = 90;
  const deltaT = (endAngle - startAngle) / n;

  for (let i = 0; i <= n; i++) {
    const t = startAngle + i * deltaT;
    const x = center[0] + a * Math.cos(t);
    const y = center[1] + b * Math.sin(t);
    points.push(pointRotateRads(pointFrom(x, y), center, ellipse.angle));
  }

  for (let i = 0; i < points.length - 1; i++) {
    segments.push(lineSegment(points[i], points[i + 1]));
  }

  // Close: for full ellipse connect last→first, for arc connect endpoints via center
  if (isArc) {
    // Chord: connect last point to first point (closed arc)
    segments.push(lineSegment(points[points.length - 1], points[0]));
  } else {
    segments.push(lineSegment(points[points.length - 1], points[0]));
  }

  return segments;
};
```

---

## Task 5: Restore/serialize

**Files:**

- Modify: `packages/excalidraw/data/restore.ts`

- [ ] **Step 1: Preserve arc properties during restore**

Find where ellipse elements are restored and ensure `startAngle`/`endAngle` are preserved. The generic restore logic should pass through unknown properties, but verify:

```typescript
// In the element restore logic, ensure arc properties survive:
if (element.type === "ellipse") {
  // startAngle/endAngle are optional — pass through if present
  // No special handling needed if _restoreElement preserves extra props
}
```

Most likely no changes needed — excalidraw's restore preserves element properties generically. But verify by testing save/load of an arc element.

---

## Task 6: Convert semicircle preset to arc element

**Files:**

- Modify: `packages/element/src/polyPresets.ts` — remove semicircle from POLY_PRESET_TYPES
- Modify: `packages/excalidraw/shapePresets/index.ts` — add semicircle to SOLID_PRESET_TYPES (or new ARC set)
- Modify: `packages/excalidraw/components/App.tsx` — handle semicircle creation as arc element

Actually, the simplest approach: keep semicircle as a poly preset but change its creation to produce an ellipse arc element instead of a polyline. This means the pointer-up handler for 2D poly presets needs a special case for semicircle.

**Revised approach:** In the pointer-up handler for 2D poly presets, when type is "semicircle", create an ellipse element with `startAngle: Math.PI, endAngle: 2 * Math.PI` instead of a linear element.

- [ ] **Step 1: Update pointer-up handler for semicircle**

In `App.tsx`, in the 2D polygon preset pointer-up block, add a special case:

```typescript
if (activeTool.type === "semicircle") {
  // Create arc element instead of polygon
  const arcElement = newElement({
    type: "ellipse",
    x: proxyEl.x,
    y: proxyEl.y,
    width: proxyEl.width,
    height: proxyEl.height * 2, // full ellipse height = 2x semicircle height
    // ... styles ...
  });
  // Set arc angles: top semicircle = π → 2π
  (arcElement as any).startAngle = Math.PI;
  (arcElement as any).endAngle = 2 * Math.PI;
  // Shift y up by height to position correctly
  // ... insert and select
}
```

Actually, the arc angles need careful thought:

- rough.js arc: `start=π, stop=2π` draws bottom half (π=left, going clockwise to 2π=right through bottom)
- For a top semicircle: `start=Math.PI, stop=2*Math.PI` with y-offset

Let me reconsider: rough.js uses standard math angles (0=right, π/2=bottom in screen coords, π=left, 3π/2=top). For a top semicircle visible on screen: `start=π, stop=0` (or `start=π, stop=2π` traversing through top).

Wait: in screen coordinates y is inverted. `sin(π/2) > 0` = downward on screen. So:

- `start=π, stop=2π` = left → top → right = **top semicircle** ✓

The ellipse element dimensions: for a semicircle with bbox width W and height H:

- The full ellipse would be W wide and 2H tall (semicircle is top half)
- Element positioned with y shifted up so the visible arc fills the bbox

- [ ] **Step 2: Update updatePolyPresetPreview for semicircle**

During drag, show an arc preview instead of a polyline. Create an ellipse element with arc properties.

---

## Task 7: Validate and publish

- [ ] **Step 1: Run checks**

```bash
yarn fix && yarn test:typecheck && cd packages/excalidraw && yarn build:esm
```

- [ ] **Step 2: Manual verification**

1. Draw semicircle — smooth curve, not polyline
2. Zoom in — remains smooth
3. Fill works correctly
4. Select/move/resize semicircle
5. Save and reload — arc preserved
6. Existing ellipses still work
7. 3D cylinder/sphere still work (unchanged)

- [ ] **Step 3: Publish**
