# Technical Analysis: Scroll Constraints Snap-Back Behavior

This document provides a technical deep-dive into the scroll constraints snap-back behavior described in the main analysis. It examines the implementation details, root causes, and potential modification approaches.

---

## Observed Behavior

When zooming out at non-center points while well above the minimum zoom threshold, the viewport snaps back after ~200ms. For example: zooming from 1200% to 1000% (when minimum is 480%) triggers an animated snap toward center.

The system recalculates allowable scroll bounds at **every zoom level**, not just at the minimum. This is why the snap-back occurs even when significantly above the threshold.

---

## Root Cause Analysis

The snap-back behavior results from three interconnected mechanisms:

### 1. Dynamic Scroll Bounds

The allowable scroll range changes with every zoom level. As you zoom out, the viewport covers more of the scene, which means there's less room to pan around while keeping the constrained area on-screen.

**Formula** ([scrollConstraints.ts:162-168](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/scene/scrollConstraints.ts#L162-L168)):

```typescript
// When constrained area doesn't fit entirely in viewport
return fits
  ? { min: center, max: center }
  : { min: pos - size + viewportSize / zoom, max: pos };
```

The key term is `viewportSize / zoom`:

- As **zoom increases** (zooming in), this term **decreases** → scroll bounds **expand** (more freedom to pan)
- As **zoom decreases** (zooming out), this term **increases** → scroll bounds **shrink** (less freedom to pan)

### 2. Mathematical Example

Let's use concrete numbers to demonstrate how the range shrinks:

**Setup:**

- Constrained area: `x = 0`, `width = 1000px`
- Viewport: `2000px` wide
- Examining X-axis only for simplicity

**Calculations:**

| Zoom Level | Zoom Factor | viewportSize / zoom | min scroll | max scroll | Allowable Range |
| --- | --- | --- | --- | --- | --- |
| 1200% | 12.0 | 2000 / 12.0 = 166.67 | 0 - 1000 + 166.67 = **-833.33** | 0 | 833.33 units |
| 1000% | 10.0 | 2000 / 10.0 = 200.00 | 0 - 1000 + 200.00 = **-800.00** | 0 | 800.00 units |
| 800% | 8.0 | 2000 / 8.0 = 250.00 | 0 - 1000 + 250.00 = **-750.00** | 0 | 750.00 units |
| 600% | 6.0 | 2000 / 6.0 = 333.33 | 0 - 1000 + 333.33 = **-666.67** | 0 | 666.67 units |
| 480% | 4.8 | 2000 / 4.8 = 416.67 | 0 - 1000 + 416.67 = **-583.33** | 0 | 583.33 units |

**What Happens:**

If you're scrolled to `scrollX = -820` at 1200% zoom (perfectly valid), when you zoom out to 1000%, your scroll position becomes invalid because `-820 < -800` (the new minimum). The constraint system detects this and clamps you back to `-800`.

### 3. Why Non-Center Zoom Triggers This

When you zoom at the **center** of the constrained area:

- `getStateForZoom` adjusts `scrollX/scrollY` to keep that center point under your cursor
- The new scroll position tends to stay within the (shrinking) allowable bounds
- No snap-back occurs

When you zoom at an **edge or corner**:

- `getStateForZoom` tries to keep that edge/corner under your cursor
- This may position the viewport so the constrained area would partially go off-screen
- The new scroll position violates the bounds
- Snap-back occurs to bring it back into valid range

---

## Code Flow Walkthrough

Here's what happens when you zoom via mouse wheel:

### Step 1: Mouse Wheel Event

[App.tsx:12197-12272](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L12197-L12272)

```typescript
private handleWheel = withBatchedUpdates((event: WheelEvent | React.WheelEvent) => {
  // ... event validation ...

  if (event.metaKey || event.ctrlKey) {
    // Calculate new zoom level based on wheel delta
    let newZoom = this.state.zoom.value - delta / 100;
    newZoom += Math.log10(Math.max(1, this.state.zoom.value)) * -sign * Math.min(1, absDelta / 20);

    // Apply zoom transformation centered on cursor
    this.translateCanvas((state) => ({
      ...getStateForZoom(
        {
          viewportX: this.lastViewportPosition.x,
          viewportY: this.lastViewportPosition.y,
          nextZoom: getNormalizedZoom(newZoom),
        },
        state,
      ),
      shouldCacheIgnoreZoom: true,
    }));

    this.resetShouldCacheIgnoreZoomDebounced();
    return;
  }
  // ... pan handling ...
});
```

### Step 2: Calculate Zoom-to-Cursor Transformation

[zoom.ts:3-35](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/scene/zoom.ts#L3-L35)

```typescript
export const getStateForZoom = (
  {
    viewportX,
    viewportY,
    nextZoom,
  }: { viewportX: number; viewportY: number; nextZoom: NormalizedZoomValue },
  appState: AppState,
) => {
  const appLayerX = viewportX - appState.offsetLeft;
  const appLayerY = viewportY - appState.offsetTop;
  const currentZoom = appState.zoom.value;

  // Get original scroll position without zoom
  const baseScrollX = appState.scrollX + (appLayerX - appLayerX / currentZoom);
  const baseScrollY = appState.scrollY + (appLayerY - appLayerY / currentZoom);

  // Get scroll offsets for target zoom level
  const zoomOffsetScrollX = -(appLayerX - appLayerX / nextZoom);
  const zoomOffsetScrollY = -(appLayerY - appLayerY / nextZoom);

  return {
    scrollX: baseScrollX + zoomOffsetScrollX,
    scrollY: baseScrollY + zoomOffsetScrollY,
    zoom: { value: nextZoom },
  };
};
```

This calculates the new `scrollX/scrollY` values needed to keep the cursor position fixed in the scene. **This calculation doesn't consider scroll constraints** - it just computes the math to maintain cursor position.

### Step 3: TranslateCanvas Method

[App.tsx:4292-4344](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L4292-L4344)

```typescript
private translateCanvas: React.Component<any, AppState>["setState"] = (stateUpdate) => {
  this.cancelInProgressAnimation?.();
  this.maybeUnfollowRemoteUser();

  if (scrollConstraintsAnimationTimeout) {
    clearTimeout(scrollConstraintsAnimationTimeout);
  }

  // Compute the new state from the update
  const partialNewState = typeof stateUpdate === "function"
    ? stateUpdate(this.state, this.props)
    : stateUpdate;

  const newState: AppState = {
    ...this.state,
    ...partialNewState,
    ...(this.state.scrollConstraints && {
      shouldCacheIgnoreZoom: false,
    }),
  };

  // RULE: cannot go below the minimum zoom level if zoom lock is enabled
  const constrainedState =
    newState.scrollConstraints && newState.scrollConstraints.lockZoom
      ? constrainScrollState(newState, "elastic")
      : newState;

  if (constrainedState.zoom.value > newState.zoom.value) {
    // Zoom was too low, already constrained, debounce and return
    newState.zoom = constrainedState.zoom;
    newState.scrollX = constrainedState.scrollX;
    newState.scrollY = constrainedState.scrollY;
    this.debounceConstrainScrollState(newState);
    return;
  }

  // Apply the new state immediately (this is what you see first)
  this.setState(newState);

  // If scroll constraints exist, apply them
  if (this.state.scrollConstraints) {
    // Debounce to allow centering on user's cursor position before constraining
    if (newState.zoom.value !== this.state.zoom.value) {
      this.debounceConstrainScrollState(newState);  // ← Triggers on zoom change
    } else {
      this.setState(constrainScrollState(newState));
    }
  }
};
```

**Key Point**: The state is updated immediately with the zoom-to-cursor calculation, providing smooth initial feedback. But if the zoom changed, `debounceConstrainScrollState` is called, which fires after 200ms.

### Step 4: Debounced Constraint Application

[App.tsx:4346-4366](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L4346-L4366)

```typescript
private debounceConstrainScrollState = debounce((state: AppState) => {
  const newState = constrainScrollState(state, "rigid");  // ← Note: "rigid" mode

  const fromValues = {
    scrollX: this.state.scrollX,
    scrollY: this.state.scrollY,
    zoom: this.state.zoom.value,
  };
  const toValues = {
    scrollX: newState.scrollX,
    scrollY: newState.scrollY,
    zoom: newState.zoom.value,
  };

  // Only animate if the adjustment is significant
  if (areCanvasTranslatesClose(fromValues, toValues)) {
    return;
  }

  this.cancelInProgressAnimation?.();
  this.animateToConstrainedArea(fromValues, toValues);  // ← Animated snap-back
}, 200);  // ← 200ms delay
```

After 200ms, this recalculates the valid scroll bounds for the current zoom level and animates to the constrained position if needed.

### Step 5: Constraint Calculation

[scrollConstraints.ts:432-533](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/scene/scrollConstraints.ts#L432-L533)

```typescript
export const constrainScrollState = (
  state: AppState,
  constraintMode: "elastic" | "rigid" | "loose" = "elastic",
): AppState => {
  if (!state.scrollConstraints) {
    return state;
  }

  // ... mode selection ...

  const constraints = calculateConstraints({
    scrollConstraints,
    width,
    height,
    zoom,
    allowOverscroll,
  });

  // Key logic: always clamp to bounds
  const constrainedValues =
    zoom.value >= constraints.effectiveZoom.value
      ? constrainScrollValues({
          scrollX,
          scrollY,
          minScrollX: constraints.minScrollX, // ← Recalculated for current zoom
          maxScrollX: constraints.maxScrollX, // ← Recalculated for current zoom
          minScrollY: constraints.minScrollY,
          maxScrollY: constraints.maxScrollY,
          constrainedZoom: constraints.effectiveZoom,
        })
      : calculateConstrainedScrollCenter(state, { scrollX, scrollY });

  return {
    ...state,
    scrollConstraints: {
      ...state.scrollConstraints,
      animateOnNextUpdate: disableAnimation
        ? false
        : isViewportOutsideOfConstrainedArea(state),
    },
    ...constrainedValues,
  };
};
```

### Step 6: Scroll Value Clamping

[scrollConstraints.ts:240-264](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/scene/scrollConstraints.ts#L240-L264)

```typescript
const constrainScrollValues = ({
  scrollX,
  scrollY,
  minScrollX,
  maxScrollX,
  minScrollY,
  maxScrollY,
  constrainedZoom,
}: {
  scrollX: number;
  scrollY: number;
  minScrollX: number;
  maxScrollX: number;
  minScrollY: number;
  maxScrollY: number;
  constrainedZoom: AppState["zoom"];
}): CanvasTranslate => {
  const constrainedScrollX = clamp(scrollX, minScrollX, maxScrollX);
  const constrainedScrollY = clamp(scrollY, minScrollY, maxScrollY);
  return {
    scrollX: constrainedScrollX,
    scrollY: constrainedScrollY,
    zoom: constrainedZoom,
  };
};
```

This is where the scroll position gets clamped to the valid range. If you were at `-820` but the new maximum is `-800`, you get moved to `-800`.

---

## Why Mode Changes Aren't Enough

The three constraint modes (`"elastic"`, `"rigid"`, `"loose"`) only differ in their parameters:

[scrollConstraints.ts:451-466](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/scene/scrollConstraints.ts#L451-L466)

```typescript
switch (constraintMode) {
  case "elastic":
    ({ allowOverscroll, disableAnimation } = DEFAULT_OPTION); // true, false
    break;
  case "rigid":
    allowOverscroll = false;
    disableAnimation = false;
    break;
  case "loose":
    allowOverscroll = true;
    disableAnimation = true;
    break;
  default:
    ({ allowOverscroll, disableAnimation } = DEFAULT_OPTION);
    break;
}
```

| Mode | allowOverscroll | disableAnimation | Result |
| --- | --- | --- | --- |
| `"rigid"` | `false` | `false` | Tight bounds + animated snap |
| `"elastic"` | `true` | `false` | Slightly wider bounds (with padding) + animated snap |
| `"loose"` | `true` | `true` | Slightly wider bounds + instant snap (no animation) |

**All three modes** still execute the same core logic:

```typescript
const constrainedValues =
  zoom.value >= constraints.effectiveZoom.value
    ? constrainScrollValues({
        /* CLAMP TO BOUNDS */
      })
    : calculateConstrainedScrollCenter(state, { scrollX, scrollY });
```

The `allowOverscroll` parameter only adds some padding to the bounds ([scrollConstraints.ts:137-140](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/scene/scrollConstraints.ts#L137-L140)):

```typescript
const overscrollValue = Math.min(
  validatedOverscroll * scrollConstraints.width,
  validatedOverscroll * scrollConstraints.height,
);
```

But the fundamental behavior of recalculating zoom-dependent bounds and clamping scroll position remains unchanged.

---

## Potential Modifications

If different behavior is desired when well above minimum zoom, here are some approaches:

### Option 1: Conditional Debounce Based on Zoom Distance

**Idea**: Only apply the debounced constraint check when close to the minimum zoom level.

**Implementation** (modify [App.tsx:4338-4342](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/components/App.tsx#L4338-L4342)):

```typescript
if (this.state.scrollConstraints) {
  if (newState.zoom.value !== this.state.zoom.value) {
    // Calculate minimum zoom level
    const { scrollConstraints } = this.state;
    const adjustedConstraints = alignScrollConstraints(scrollConstraints);
    const { initialZoomLevel } = calculateZoomLevel(
      adjustedConstraints,
      this.state.width,
      this.state.height,
    );

    // Add a buffer (e.g., 20% above minimum)
    const zoomThreshold = initialZoomLevel * 1.2;

    // Only apply rigid constraints if we're close to the minimum
    if (newState.zoom.value < zoomThreshold) {
      this.debounceConstrainScrollState(newState);
    } else {
      // Still apply elastic constraints for immediate feedback
      this.setState(constrainScrollState(newState, "elastic"));
    }
  } else {
    this.setState(constrainScrollState(newState));
  }
}
```

**Pros:**

- Preserves smooth zoom-to-cursor behavior when zoomed in significantly
- Still enforces constraints near the minimum zoom level
- Minimal code changes

**Cons:**

- At high zoom levels, the constrained area could go partially off-screen
- Need to choose an appropriate threshold (1.2x? 1.5x? 2x?)
- Edge case: rapid zoom from high to near-minimum might bypass constraints temporarily

### Option 2: Remove Debounced Constraints on Zoom

**Idea**: Don't apply debounced "rigid" constraints on zoom changes at all. Only constrain during pan operations.

**Implementation**:

```typescript
if (this.state.scrollConstraints) {
  if (newState.zoom.value !== this.state.zoom.value) {
    // No debounced rigid constraints on zoom
    // Only apply immediate elastic constraints if needed
    const elasticState = constrainScrollState(newState, "elastic");
    if (
      elasticState.scrollX !== newState.scrollX ||
      elasticState.scrollY !== newState.scrollY
    ) {
      this.setState(elasticState);
    }
  } else {
    // Still constrain pan operations
    this.setState(constrainScrollState(newState));
  }
}
```

**Pros:**

- Most natural zoom behavior
- No snap-back after zoom
- Simple logic

**Cons:**

- Constrained area can go significantly off-screen
- May need additional mechanism to bring it back (e.g., on idle, or on next pan)
- Changes the fundamental behavior significantly

### Option 3: Progressive Bounds Based on Zoom Ratio

**Idea**: Scale the allowable scroll range based on how far above minimum zoom you are.

**Implementation** (modify [scrollConstraints.ts:106-194](https://github.com/dwelle/excalidraw/blob/master/packages/excalidraw/scene/scrollConstraints.ts#L106-L194)):

```typescript
const calculateScrollBounds = ({
  scrollConstraints,
  width,
  height,
  effectiveZoom,
  zoomLevelX,
  zoomLevelY,
  allowOverscroll,
  initialZoomLevel, // ← New parameter
}: {
  // ... existing params ...
  initialZoomLevel: number; // ← Add this
}) => {
  // ... existing center and overscroll calculations ...

  // Calculate zoom ratio above minimum
  const zoomRatio = effectiveZoom / initialZoomLevel;

  // Scale bounds multiplier: more freedom as zoom increases
  // At 1x minimum: multiplier = 1 (normal bounds)
  // At 2x minimum: multiplier = 1.5
  // At 3x minimum: multiplier = 2
  const boundsMultiplier = Math.min(1 + (zoomRatio - 1) * 0.5, 3.0);

  const getScrollRange = (
    axis: "x" | "y",
    fits: boolean,
    constraint: ScrollConstraints,
    viewportSize: number,
    zoom: number,
    overscroll: number,
  ) => {
    const { pos, size } =
      axis === "x"
        ? { pos: constraint.x, size: constraint.width }
        : { pos: constraint.y, size: constraint.height };
    const center = axis === "x" ? centerX : centerY;

    if (allowOverscroll) {
      return fits
        ? {
            min: center - overscroll * boundsMultiplier,
            max: center + overscroll * boundsMultiplier,
          }
        : {
            min:
              pos - size + viewportSize / zoom - overscroll * boundsMultiplier,
            max: pos + overscroll * boundsMultiplier,
          };
    }

    return fits
      ? { min: center, max: center }
      : {
          min: pos - size + (viewportSize / zoom) * boundsMultiplier,
          max: pos + size * (boundsMultiplier - 1),
        };
  };

  // ... rest of function ...
};
```

**Pros:**

- Gradual behavior change
- More freedom when zoomed in, tighter constraints near minimum
- Configurable via multiplier formula

**Cons:**

- More complex calculation
- Harder to predict behavior
- May feel inconsistent

### Option 4: Use "loose" Mode for Zoom, "rigid" for Pan

**Idea**: Apply loose constraints immediately during zoom (instant, no animation), but rigid constraints on pan.

**Implementation**:

```typescript
if (this.state.scrollConstraints) {
  if (newState.zoom.value !== this.state.zoom.value) {
    // Apply loose constraints: immediate, no animation
    this.setState(constrainScrollState(newState, "loose"));
  } else {
    // Apply rigid constraints on pan
    this.setState(constrainScrollState(newState, "rigid"));
  }
}
```

**Pros:**

- Simple change
- Removes the animated snap on zoom
- Still constrains bounds, just instantly

**Cons:**

- Still clamps scroll position (just without animation)
- May feel like a "pop" instead of a "snap"

---

## Summary

The snap-back behavior is a fundamental aspect of the scroll constraints system. It ensures the constrained area remains properly visible by recalculating allowable scroll bounds at every zoom level and clamping the scroll position accordingly.

The behavior cannot be changed simply by switching constraint modes - all three modes (`"elastic"`, `"rigid"`, `"loose"`) apply the same core constraint logic. Modifications would require changes to the logic in `translateCanvas` to conditionally skip or relax constraint enforcement based on zoom level or other criteria.
