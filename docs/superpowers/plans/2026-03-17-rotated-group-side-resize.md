# Rotated Group Side-Handle Resize — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow non-proportional resize via side handles (e/w/n/s) on rotated groups, constraining stretch to a single axis along the group's rotated direction.

**Architecture:** Detect the common rotation angle of grouped elements. In `getNextMultipleWidthAndHeightFromPointer`, reverse-rotate the pointer around the bounding box center by `-commonAngle` before computing `nextWidth`/`nextHeight`. This converts diagonal mouse movement (natural for rotated handles) into axis-aligned movement. Also disable the `keepAspectRatio` override for side handles on rotated groups. The single-element version (`getNextSingleWidthAndHeightFromPointer`, line 954) already does this correctly — we mirror the pattern.

**Tech Stack:** TypeScript, excalidraw math utilities (`pointRotateRads`)

---

## File Structure

Only one file needs changes:

- **Modify:** `packages/element/src/resizeElements.ts`
  - `getNextMultipleWidthAndHeightFromPointer()` (lines 1022-1147) — add pointer rotation
  - `resizeMultipleElements()` (lines 1306-1317) — fix `keepAspectRatio` condition

---

## Task 1: Add common angle detection + pointer rotation in `getNextMultipleWidthAndHeightFromPointer`

**Files:**

- Modify: `packages/element/src/resizeElements.ts:1022-1110`

- [ ] **Step 1: Detect common angle of selected elements**

After computing `originalBoundingBox` (line 1072), add:

```typescript
// Detect common rotation angle for the group.
// If all elements share the same angle, reverse-rotate the pointer
// so side handles constrain to the group's rotated axes.
const angles = new Set(originalElementsArray.map((el) => el.angle));
const commonAngle = angles.size === 1 ? originalElementsArray[0].angle : 0;
```

- [ ] **Step 2: Reverse-rotate pointer and anchor around bbox center**

Before the `scale` computation (line 1097), add rotation of pointer:

```typescript
// Reverse-rotate pointer into the group's local coordinate space
// (mirrors getNextSingleWidthAndHeightFromPointer line 954)
let effectivePointerX = pointerX;
let effectivePointerY = pointerY;
let effectiveAnchorX = anchorX;
let effectiveAnchorY = anchorY;

if (commonAngle) {
  const [rpx, rpy] = pointRotateRads(
    pointFrom(pointerX, pointerY),
    pointFrom(midX, midY),
    -commonAngle as Radians,
  );
  const [rax, ray] = pointRotateRads(
    pointFrom(anchorX, anchorY),
    pointFrom(midX, midY),
    -commonAngle as Radians,
  );
  effectivePointerX = rpx;
  effectivePointerY = rpy;
  effectiveAnchorX = rax;
  effectiveAnchorY = ray;
}
```

- [ ] **Step 3: Replace `pointerX/Y` and `anchorX/Y` with effective versions**

Change lines 1097-1134 to use `effectivePointerX/Y` and `effectiveAnchorX/Y` instead of raw `pointerX/Y` and `anchorX/Y`:

```typescript
const scale =
  Math.max(
    Math.abs(effectivePointerX - effectiveAnchorX) / width || 0,
    Math.abs(effectivePointerY - effectiveAnchorY) / height || 0,
  ) * resizeFromCenterScale;

let nextWidth =
  handleDirection.includes("e") || handleDirection.includes("w")
    ? Math.abs(effectivePointerX - effectiveAnchorX) * resizeFromCenterScale
    : width;
let nextHeight =
  handleDirection.includes("n") || handleDirection.includes("s")
    ? Math.abs(effectivePointerY - effectiveAnchorY) * resizeFromCenterScale
    : height;

if (shouldMaintainAspectRatio) {
  nextWidth = width * scale * Math.sign(effectivePointerX - effectiveAnchorX);
  nextHeight = height * scale * Math.sign(effectivePointerY - effectiveAnchorY);
}
```

Also update flipConditionsMap to use effective coords:

```typescript
const flipConditionsMap: Record<
  TransformHandleDirection,
  [x: boolean, y: boolean]
> = {
  ne: [
    effectivePointerX < effectiveAnchorX,
    effectivePointerY > effectiveAnchorY,
  ],
  se: [
    effectivePointerX < effectiveAnchorX,
    effectivePointerY < effectiveAnchorY,
  ],
  sw: [
    effectivePointerX > effectiveAnchorX,
    effectivePointerY < effectiveAnchorY,
  ],
  nw: [
    effectivePointerX > effectiveAnchorX,
    effectivePointerY > effectiveAnchorY,
  ],
  e: [effectivePointerX < effectiveAnchorX, false],
  w: [effectivePointerX > effectiveAnchorX, false],
  n: [false, effectivePointerY > effectiveAnchorY],
  s: [false, effectivePointerY < effectiveAnchorY],
};
```

- [ ] **Step 4: Ensure `pointRotateRads` and `Radians` are imported**

Check imports at top of file. `pointRotateRads` and `pointFrom` should already be imported. Add `Radians` if missing.

---

## Task 2: Fix `keepAspectRatio` for side handles on rotated groups

**Files:**

- Modify: `packages/element/src/resizeElements.ts:1306-1317`

- [ ] **Step 1: Allow non-proportional resize for side handles on rotated groups**

Change the `keepAspectRatio` condition from:

```typescript
const isSideHandle = handleDirection.length === 1; // e, w, n, s
const keepAspectRatio =
  shouldMaintainAspectRatio ||
  targetElements.some(
    (item) =>
      item.latest.angle !== 0 ||
      isTextElement(item.latest) ||
      // Allow non-proportional stretch via side handles for groups
      // (only when unrotated — rotated elements need proportional
      // resize because world X/Y axes don't align with element axes)
      (isInGroup(item.latest) && !isSideHandle),
  );
```

to:

```typescript
const isSideHandle = handleDirection.length === 1; // e, w, n, s
// Check if all elements share a common rotation (group was rotated together)
const allSameAngle = targetElements.every(
  (item) => item.latest.angle === targetElements[0]?.latest.angle,
);
const keepAspectRatio =
  shouldMaintainAspectRatio ||
  targetElements.some(
    (item) =>
      // Rotated elements need proportional resize UNLESS:
      // - it's a side handle AND all elements share the same angle
      //   (pointer is already reverse-rotated in getNextMultipleWidthAndHeightFromPointer)
      (item.latest.angle !== 0 && !(isSideHandle && allSameAngle)) ||
      isTextElement(item.latest) ||
      // Corner handles on grouped elements always keep aspect ratio
      (isInGroup(item.latest) && !isSideHandle),
  );
```

**Why `allSameAngle`:** If elements have different angles (e.g., individually rotated), we can't define a single "group axis" for the side handle. In that case, fall back to proportional resize. When all angles match (common case: group was rotated as a unit), the reverse-rotation in Task 1 handles the axis alignment.

---

## Task 3: Validate and publish

- [ ] **Step 1: Run checks**

```bash
yarn fix              # must pass with 0 warnings
yarn test:typecheck   # must pass
cd packages/excalidraw && yarn build:esm
```

- [ ] **Step 2: Manual verification**

1. Create wireframe group (unrotated) → drag side handle → single-axis stretch ✓
2. Rotate wireframe group ~45° → drag side handle → single-axis stretch along rotated direction ✓
3. Rotate wireframe group ~45° → drag corner handle → proportional resize ✓
4. Select multiple elements with different individual rotations → drag side handle → proportional (fallback) ✓

- [ ] **Step 3: Publish and deploy**

```bash
# Bump version, build, publish, install in billion-dollars, commit, PR
```
