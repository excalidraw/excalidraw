# Scroll Constraints: Snap-free Zoom

## Problem

When scroll constraints are active and the user zooms out at a non-center cursor position, the viewport snaps back after ~200ms. `getStateForZoom` computes the new scroll purely from cursor geometry, ignoring constraints — and the debounced constraint check then corrects it with an animated jump.

Additionally, the debounce was firing on zoom-in too (despite zoom-in always expanding the valid range), causing spurious snaps when zoom level differed between the debounce capture and fire time.

---

## Solution

Two changes:

### 1. Adjust zoom anchor to prevent out-of-bounds scroll on zoom-out

In `handleWheel`, before calling `getStateForZoom`, check whether the intended zoom-out would produce a scroll outside the valid bounds. If it would, back-compute the effective zoom anchor point that lands exactly at the nearest valid bound, and use that instead.

The user never sees a snap. When the cursor is already in a "safe" position, behaviour is completely unchanged. Only fires when scroll constraints are active.

**New helper** in `packages/excalidraw/scene/zoom.ts`: `getConstrainedZoomAnchor`

**Key math**: `getStateForZoom` produces `newScrollX = scrollX + appLayerX * factor` where `factor = 1/nextZoom - 1/currentZoom`. To find the anchor that produces a specific target scroll:

```
adjustedAppLayerX = (targetScrollX - scrollX) / factor
```

So if `constrainScrollState` tells us the valid scroll is `constrainedScrollX`, we back-compute the anchor that produces exactly that scroll.

### 2. Only debounce zoom-out, not zoom-in

In `translateCanvas`, the debounce was previously triggered on any zoom change. Zoom-in always expands the valid scroll range, so it can never produce an out-of-bounds scroll — it can be constrained immediately. Only zoom-out needs the debounce (to allow cursor-centering before constraining).

```typescript
// Before:
if (newState.zoom.value !== this.state.zoom.value) {
  this.debounceConstrainScrollState(newState);
} else {
  this.setState(constrainScrollState(newState));
}

// After:
if (newState.zoom.value < this.state.zoom.value) {
  // zoom-out: debounce to allow centering before constraining
  this.debounceConstrainScrollState(newState);
} else {
  // zoom-in or pan: valid range only expands on zoom-in, constrain immediately
  this.setState(constrainScrollState(newState));
}
```

---

## Files modified

- `packages/excalidraw/scene/zoom.ts` — added `getConstrainedZoomAnchor`, imported `constrainScrollState`
- `packages/excalidraw/components/App.tsx` — used `getConstrainedZoomAnchor` in `handleWheel`; changed debounce condition in `translateCanvas`

---

## No-op guarantee

Both changes are strictly gated on `scrollConstraints` being set. When scrollConstraints is null/undefined, behaviour is byte-for-byte identical to before.
