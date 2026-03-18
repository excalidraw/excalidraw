# Freedraw Rendering Improvements — Design Spec

> Three-level improvement to freedraw (pencil) stroke quality and performance. Each level builds on the previous and delivers standalone value.

## Problem

Two symptoms in the current freedraw rendering:

1. **Latency** — line appears with visible delay behind the finger/stylus
2. **Spike artifacts** — fast circular motions produce momentary "hedgehog" tangent spikes

### Root causes

- **`throttleRAF`** wraps the entire pointermove handler, coalescing all events between frames into one. Intermediate points are lost (50-75% on 120Hz+ devices).
- **perfect-freehand** outline algorithm generates perpendicular offsets that spike at moderate sharp turns (45-90°). It only handles full 180° reversals, not gradual direction changes.
- **Full O(N) recomputation** every frame — ShapeCache is invalidated on every new point, regenerating the entire outline from all accumulated points.
- **SVG path pipeline** — outline polygon → SVG string → `new Path2D(string)` → `context.fill()` — multiple unnecessary conversions.

---

## Level 1: Quick wins (getCoalescedEvents + SVG path optimization)

### 1a. Recover lost points via `getCoalescedEvents()`

**Where:** `packages/excalidraw/components/App.tsx`, inside the freedraw point accumulation code (line ~10555-10583).

**What:** The `PointerEvent.getCoalescedEvents()` Web API returns all intermediate pointer positions that the browser coalesced into a single event. Currently unused in the codebase (zero matches for "coalesced").

**Problem with `throttleRAF`:** The pointermove handler is wrapped in `withBatchedUpdatesThrottled` (App.tsx line 9818), which uses `throttleRAF`. This keeps only the LAST event's args — intermediate PointerEvent objects between frames are completely dropped. `getCoalescedEvents()` on the surviving event only recovers sub-event points within that one browser event, not across dropped events.

**Change (two parts):**

1. **Extract coalesced events BEFORE the throttle.** Add an outer non-throttled pointermove listener that collects coalesced events into a buffer:

```typescript
// Outside throttleRAF:
let pendingFreedrawPoints: Array<{ x: number; y: number; pressure: number }> =
  [];

canvas.addEventListener("pointermove", (event) => {
  if (!isDrawingFreedraw) return;
  const events = event.getCoalescedEvents?.() ?? [event];
  for (const ce of events) {
    const coords = viewportCoordsToSceneCoords(ce, this.state);
    pendingFreedrawPoints.push({
      x: coords.x,
      y: coords.y,
      pressure: ce.pressure,
    });
  }
});
```

2. **Consume the buffer inside the throttled handler.** Instead of reading one point from the event, drain `pendingFreedrawPoints` and add all accumulated points to the element:

```typescript
// Inside the existing throttled handler, freedraw section:
const newPoints = pendingFreedrawPoints.splice(0);
for (const pt of newPoints) {
  const dx = pt.x - newElement.x;
  const dy = pt.y - newElement.y;
  points.push(pointFrom(dx, dy));
  pressures.push(pt.pressure);
}
```

**Coordinate space:** Each coalesced event must go through `viewportCoordsToSceneCoords()` to convert from viewport to scene coordinates (accounting for zoom, scroll, canvas offset). This happens in the outer listener, so the buffer contains scene-space coordinates.

**Pressure:** Each coalesced event has its own `pressure` value — stored per-point in the pressures array.

**Fallback:** `getCoalescedEvents()` is supported in Chrome 58+, Firefox 59+, Safari 16.4+. If unavailable, falls back to single point per event.

**Performance note:** The array spreading `[...points, ...newPoints]` is O(N) per frame. This is an existing cost (current code does `[...points, newPoint]`), just with more points per frame. Level 3's incremental approach addresses this with append-only mutation.

**Impact:** 2-4x more input points on high-refresh-rate devices. Smoother curves, fewer sharp direction changes → fewer spike triggers.

### 1b. Switch to T-command SVG path generation

**Where:** `packages/element/src/shape.ts`, the `getSvgPathFromStroke` function (lines 1326-1347).

**What:** Replace the Q-command version with the T-command version already in the codebase (`packages/common/src/utils.ts`, lines 1103-1134). The T-command version:

- Produces smoother curves (G1 continuity at joins via auto-mirrored control points)
- Is faster (string concatenation vs array reduce + regex)
- Already tested in production (used by AnimatedTrail/laser pointer)

**Edge case:** The T-command version returns empty string for `len < 4` outline points. Add a fallback for very short strokes (1-3 points): render as a filled circle at the stroke position (single dot).

**Impact:** Smoother visual output, slight performance improvement.

**Files:**

- `packages/excalidraw/components/App.tsx` — coalesced events buffer + drain in freedraw pointermove
- `packages/element/src/shape.ts` — replace getSvgPathFromStroke with T-command version + short-stroke fallback

---

## Level 2: Replace perfect-freehand with LaserPointer outline

### Why LaserPointer is better for freedraw

The `@excalidraw/laser-pointer` library (already in the dependency tree) has a superior outline algorithm:

- **Corner detection at 75°** with speed-adaptive sensitivity (vs perfect-freehand's 180°-only reversal detection)
- **Proportional arc generation** matching actual turn angle (vs full-PI arc in 13 steps)
- **Flexible width** via `sizeMapping` callback (vs hardcoded thinning formula)
- **Built-in Douglas-Peucker simplification** on output

### sizeMapping for pressure-based width

```typescript
sizeMapping: (details) => {
  const { pressure, runningLength, totalLength } = details;
  // Pressure mapping (same easing as current freedraw)
  const pressureWidth = Math.sin((pressure * Math.PI) / 2);
  // Start taper
  const startTaper = Math.min(1, runningLength / (size * 2));
  // End taper (only when stroke is finalized)
  const endTaper = isFinalized
    ? Math.min(1, (totalLength - runningLength) / (size * 2))
    : 1;
  return pressureWidth * startTaper * endTaper;
};
```

### simulatePressure via velocity

When `event.pressure === 0.5` (mouse/trackpad), compute pseudo-pressure from drawing speed:

- Fast movement → low pressure → thin line
- Slow movement → high pressure → thick line
- Store speed-derived pressure as `point[2]` instead of actual pressure

### Integration into freedraw pipeline

Replace calls to `getFreedrawOutlinePoints()` (which calls perfect-freehand's `getStroke`) with a new function that uses LaserPointer:

```typescript
const getFreedrawOutlinePointsV2 = (element) => {
  const lp = new LaserPointer({
    size: element.strokeWidth * 4.25,
    streamline: 0.4,
    simplify: 0, // no simplification (avoids stabilizeTail "not implemented" error)
    sizeMapping: buildSizeMapping(element),
  });
  for (const [x, y, p] of element.points) {
    lp.addPoint([x, y, p ?? 0.5]); // Note: addPoint takes a Point tuple [x, y, r]
  }
  lp.close();
  return lp.getStrokeOutline();
};
```

**Concern:** LaserPointer instances are created per render call. This is fine because the outline computation is O(N) regardless — same cost as perfect-freehand. The object creation overhead is negligible.

**Note on sizeMapping semantics:** All existing LaserPointer call sites in the codebase pass `performance.now()` as `point[2]` (timestamp for trail decay). Our usage passes actual pen pressure — this is a novel usage pattern but the API supports it. The `sizeMapping` callback receives `point[2]` as the `pressure` field regardless of what it represents.

**Files:**

- `packages/element/src/shape.ts` — new `getFreedrawOutlinePointsV2`, replace `getFreedrawOutlinePoints`
- `packages/excalidraw/components/App.tsx` — store pressure/velocity as point[2] during drawing

---

## Level 3: Incremental rendering

### The problem

Current pipeline recomputes the entire outline from ALL points on every frame. A 500-point stroke does O(500) work per frame. This compounds with rAF throttling — the delayed rendering makes the latency worse.

### Approach: stable + tail split rendering

During drawing, split the stroke into two parts:

- **Stable part** — all points except the last N (e.g., last 30 points). Rendered once to an offscreen canvas, cached, never recomputed.
- **Tail part** — the last N points. Recomputed and rendered on every frame. O(30) instead of O(N).

When new points arrive:

1. Add to tail
2. When tail exceeds threshold, move oldest tail points to stable part
3. Regenerate stable part's offscreen canvas (incremental: only render the newly-moved points on top of the existing stable canvas)
4. Only regenerate tail outline

### Implementation

- **Offscreen canvas for stable part:** Use `OffscreenCanvas` (or regular canvas if not available). Render the stable outline once. When new points become stable, draw only the new segment onto the existing stable canvas (no full re-render).
- **Tail rendering:** On each frame, compute outline for only the tail points (with overlap of ~5 points for continuity). Draw tail on the display canvas on top of the stable canvas blit.
- **Finalization:** On pointerUp, render the full stroke normally (for clean final result + undo history). The incremental rendering is only for the in-progress drawing phase.

### LaserPointer's stable/tail architecture

LaserPointer already has `stablePoints` / `tailPoints` separation with a `stabilizeTail()` method. The `getStrokeOutline()` currently concatenates both and processes the full array. The improvement would be:

1. Cache the stable outline polygon
2. Only recompute outline for tail points (with a few overlap points for continuity)
3. Concatenate cached stable outline + fresh tail outline

This requires modifying `@excalidraw/laser-pointer` or implementing the caching wrapper externally.

**Note on renderNewElementScene throttle:** `renderNewElementScene.ts` already has its own `throttleRAF` wrapper (line 87). The incremental rendering (offscreen canvas composition + tail rendering) must happen within this existing render cycle, not as a separate loop. The stable canvas is blitted first, then the tail is drawn on top.

**Note on stabilizeTail:** LaserPointer's `stabilizeTail()` throws "Not implemented yet" when `simplifyPhase === 'tail'`. With `simplify: 0` (our Level 2 config), the simplify check is bypassed. If simplify is later enabled, use `simplifyPhase: 'output'` or `'input'` to avoid the crash.

**Files:**

- `packages/excalidraw/components/App.tsx` — split rendering during freedraw
- `packages/excalidraw/renderer/renderNewElementScene.ts` — incremental canvas composition
- `packages/element/src/shape.ts` — stable/tail outline caching
- Possibly `node_modules/@excalidraw/laser-pointer/src/state.ts` — if modifying the library (or fork it into packages/)
