# Freedraw Rendering Level 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover lost input points via `getCoalescedEvents()` and switch to faster/smoother T-command SVG path generation for freedraw strokes.

**Architecture:** Two independent changes: (1) collect coalesced pointer events before throttleRAF to recover 2-4x more input points, (2) replace Q-command SVG path builder with the T-command version already in the codebase. Both reduce spike artifacts and improve smoothness.

**Tech Stack:** React, TypeScript, Canvas 2D, PointerEvent API. Use `/tmp/yarn.sh` instead of `yarn`.

**Spec:** `docs/superpowers/specs/2026-03-18-freedraw-rendering-design.md` (Level 1)

---

### Task 1: Collect coalesced events for freedraw point accumulation

**Files:**

- Modify: `packages/excalidraw/components/App.tsx` (lines ~9815-9822 and ~10555-10584)

- [ ] **Step 1: Add coalesced events buffer as module-level variable**

In `packages/excalidraw/components/App.tsx`, find the module-level variables section (around line 600-630, where `twoFingerTouchStart`, `toolSettings` etc. are defined). Add:

```typescript
// Buffer for coalesced pointer events during freedraw drawing.
// Collected in the raw pointermove listener (before throttleRAF),
// drained in the throttled handler.
let pendingFreedrawPoints: Array<{
  x: number;
  y: number;
  pressure: number;
}> = [];
```

- [ ] **Step 2: Add coalesced event collection in the raw pointermove path**

The key insight: `getCoalescedEvents()` must be called on the original PointerEvent BEFORE `throttleRAF` discards it. The current architecture wraps the entire handler in `withBatchedUpdatesThrottled` at line 9818.

Find the method `onPointerMoveFromPointerDownHandler` (line 9815). Currently it returns `withBatchedUpdatesThrottled((event: PointerEvent) => { ... })`. We need to collect coalesced events from every event, not just the surviving one.

Replace the return statement at line 9818:

```typescript
return withBatchedUpdatesThrottled((event: PointerEvent) => {
```

With a wrapper that collects coalesced events first:

```typescript
const throttledHandler = withBatchedUpdatesThrottled((event: PointerEvent) => {
```

And at the end of the method (before the closing `}`), change the return to a wrapper that collects coalesced events AND proxies `.flush()`/`.cancel()` from the inner throttled handler (required by `PointerDownState.eventListeners.onMove` type and `.flush()` call at line 10790):

```typescript
const wrapper = ((event: PointerEvent) => {
  // Collect coalesced events for freedraw BEFORE throttle discards them
  if (this.state.newElement?.type === "freedraw" && event.getCoalescedEvents) {
    const coalesced = event.getCoalescedEvents();
    for (const ce of coalesced) {
      const coords = viewportCoordsToSceneCoords(ce, this.state);
      pendingFreedrawPoints.push({
        x: coords.x,
        y: coords.y,
        pressure: ce.pressure,
      });
    }
  }
  throttledHandler(event);
}) as ReturnType<typeof withBatchedUpdatesThrottled>;
// Proxy flush/cancel from the inner throttled handler
wrapper.flush = () => throttledHandler.flush();
wrapper.cancel = () => throttledHandler.cancel();
return wrapper;
```

Note: `viewportCoordsToSceneCoords` is already imported at line 77 from `@excalidraw/common`. It accepts `{ clientX, clientY }` which coalesced events have. The `as ReturnType<typeof withBatchedUpdatesThrottled>` cast ensures the wrapper satisfies the `onMove` type in `PointerDownState`.

- [ ] **Step 3: Drain the buffer in the freedraw section of the throttled handler**

In the throttled handler, find the freedraw point accumulation (line ~10555-10584). Replace the current single-point logic:

Current code:

```typescript
if (newElement.type === "freedraw") {
  const points = newElement.points;
  const dx = pointerCoords.x - newElement.x;
  const dy = pointerCoords.y - newElement.y;

  const lastPoint = points.length > 0 && points[points.length - 1];
  const discardPoint = lastPoint && lastPoint[0] === dx && lastPoint[1] === dy;

  if (!discardPoint) {
    const pressures = newElement.simulatePressure
      ? newElement.pressures
      : [...newElement.pressures, event.pressure];

    this.scene.mutateElement(
      newElement,
      {
        points: [...points, pointFrom<LocalPoint>(dx, dy)],
        pressures,
      },
      {
        informMutation: false,
        isDragging: false,
      },
    );

    this.setState({
      newElement,
    });
  }
}
```

Replace with:

```typescript
if (newElement.type === "freedraw") {
  // Drain coalesced events buffer (collected before throttle)
  // Fall back to single event point if buffer is empty
  const buffered = pendingFreedrawPoints.splice(0);
  const pointsToAdd =
    buffered.length > 0
      ? buffered.map((p) => ({
          dx: p.x - newElement.x,
          dy: p.y - newElement.y,
          pressure: p.pressure,
        }))
      : [
          {
            dx: pointerCoords.x - newElement.x,
            dy: pointerCoords.y - newElement.y,
            pressure: event.pressure,
          },
        ];

  const currentPoints = newElement.points;
  const currentPressures = newElement.pressures;
  const newPointsList: LocalPoint[] = [];
  const newPressuresList: number[] = [];
  let lastPoint =
    currentPoints.length > 0 ? currentPoints[currentPoints.length - 1] : null;

  for (const pt of pointsToAdd) {
    // Deduplicate
    if (lastPoint && lastPoint[0] === pt.dx && lastPoint[1] === pt.dy) {
      continue;
    }
    const p = pointFrom<LocalPoint>(pt.dx, pt.dy);
    newPointsList.push(p);
    if (!newElement.simulatePressure) {
      newPressuresList.push(pt.pressure);
    }
    lastPoint = p;
  }

  if (newPointsList.length > 0) {
    this.scene.mutateElement(
      newElement,
      {
        points: [...currentPoints, ...newPointsList],
        pressures: newElement.simulatePressure
          ? currentPressures
          : [...currentPressures, ...newPressuresList],
      },
      {
        informMutation: false,
        isDragging: false,
      },
    );

    this.setState({
      newElement,
    });
  }
}
```

- [ ] **Step 4: Clear buffer on pointerUp**

Find the freedraw finalization in `handleCanvasPointerUp` / `onPointerUp` where the freedraw element is finalized (around line 11026-11053). Add at the start of the freedraw finalization:

```typescript
pendingFreedrawPoints = [];
```

This ensures no stale points leak into the next stroke.

- [ ] **Step 5: Verify and commit**

```bash
cd H:/excalidraw && /tmp/yarn.sh test:typecheck && /tmp/yarn.sh fix
cd packages/excalidraw && /tmp/yarn.sh build:esm
git add packages/excalidraw/components/App.tsx
git commit -m "feat: collect coalesced pointer events for smoother freedraw strokes"
```

---

### Task 2: Switch to T-command SVG path generation

**Files:**

- Modify: `packages/element/src/shape.ts` (lines ~1290-1347)

- [ ] **Step 1: Replace getSvgPathFromStroke with T-command version**

In `packages/element/src/shape.ts`, find the current `getSvgPathFromStroke` function (lines 1326-1347) and the helper `med` (lines 1317-1319). Also find the `TO_FIXED_PRECISION` regex (line 1324).

Delete `med`, `TO_FIXED_PRECISION`, and the current `getSvgPathFromStroke`. Replace with:

```typescript
const average = (a: number, b: number) => (a + b) / 2;

const getSvgPathFromStroke = (points: number[][]): string => {
  const len = points.length;

  // Short strokes: render as a dot
  if (len < 4) {
    if (len === 0) {
      return "";
    }
    // Single point or very short — draw a tiny circle via SVG arc
    const [x, y] = points[0];
    const r = 0.5;
    return `M${x - r},${y} a${r},${r} 0 1,0 ${r * 2},0 a${r},${r} 0 1,0 -${
      r * 2
    },0 Z`;
  }

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let result = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${b[0].toFixed(
    2,
  )},${b[1].toFixed(2)} ${average(b[0], c[0]).toFixed(2)},${average(
    b[1],
    c[1],
  ).toFixed(2)} T`;

  for (let i = 2, max = len - 1; i < max; i++) {
    a = points[i];
    b = points[i + 1];
    result += `${average(a[0], b[0]).toFixed(2)},${average(a[1], b[1]).toFixed(
      2,
    )} `;
  }

  result += "Z";
  return result;
};
```

This is the T-command version from `packages/common/src/utils.ts` with:

- Always closed (freedraw outlines are always closed polygons)
- Short-stroke fallback (SVG arc for dots/very short marks)
- Same `.toFixed(2)` precision

- [ ] **Step 2: Verify and commit**

```bash
cd H:/excalidraw && /tmp/yarn.sh test:typecheck && /tmp/yarn.sh fix
cd packages/excalidraw && /tmp/yarn.sh build:esm
git add packages/element/src/shape.ts
git commit -m "feat: T-command SVG path for smoother freedraw outline rendering"
```

---

### Task 3: Version bump, publish, install

- [ ] **Step 1: Bump version**

In `packages/excalidraw/package.json`, bump version from `0.26.44` to `0.26.45`.

- [ ] **Step 2: Full verify, build, publish**

```bash
cd H:/excalidraw && /tmp/yarn.sh fix && /tmp/yarn.sh test:typecheck
cd packages/excalidraw && /tmp/yarn.sh build:esm
git add packages/excalidraw/package.json
git commit -m "chore: bump version to 0.26.45"
/tmp/yarn.sh publish --non-interactive
```

- [ ] **Step 3: Install in billion-dollars**

```bash
cd h:/billion-dollars/apps/frontend
NPM_TOKEN=<from .npmrc> npm install @emevart/excalidraw@0.26.45
git add apps/frontend/package.json apps/frontend/package-lock.json
git commit -m "fix: excalidraw 0.26.45 (freedraw coalesced events + T-command SVG)"
git push origin develop
```
