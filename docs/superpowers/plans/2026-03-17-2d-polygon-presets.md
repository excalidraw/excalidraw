# 2D Polygon Presets Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 6 new 2D polygon presets: pentagon, octagon, semicircle, trapezoid, right trapezoid, right triangle.

**Architecture:** Each preset follows the existing pattern: add type to `POLY_PRESET_TYPES`, add `computePolyPoints` case, add icon SVG, add `SHAPES` entry. 2D presets are single polygon line elements (not grouped wireframes). Semicircle uses arc approximation via polyline points.

**Tech Stack:** TypeScript, SVG icons, excalidraw math (`pointFrom`)

---

## File Structure

All changes fit in existing files:

| File | Changes |
| --- | --- |
| `packages/element/src/polyPresets.ts` | Add 6 cases to `computePolyPoints`, update `POLY_PRESET_TYPES`, update `getPolyPresetXOffset`, `getPolyPresetAspectHeight` |
| `packages/excalidraw/components/icons.tsx` | Add 6 icon constants |
| `packages/excalidraw/components/shapes.tsx` | Add 6 entries to `SHAPES` array |

---

## Geometry Reference

All shapes are computed within a bounding box of `(0, 0, width, height)`. Points form a closed polygon (first point = last point). Origin depends on shape.

| Shape | Origin | Points | Aspect ratio (shift) |
| --- | --- | --- | --- |
| pentagon | top-center | 6 pts (regular, centered) | width (square bbox) |
| octagon | top-left | 9 pts (regular, centered) | width |
| semicircle | top-left | ~17 pts (arc + diameter) | width/2 |
| trapezoid | top-left | 5 pts (symmetric, top shorter) | width\*0.7 |
| rightTrapezoid | top-left | 5 pts (left side vertical) | width\*0.7 |
| rightTriangle | top-left | 4 pts (right angle at bottom-left) | width |

---

## Task 1: Add polygon geometry (polyPresets.ts)

**Files:**

- Modify: `packages/element/src/polyPresets.ts`

- [ ] **Step 1: Update POLY_PRESET_TYPES**

```typescript
export const POLY_PRESET_TYPES = new Set([
  "rectangle",
  "diamond",
  "triangle",
  "pentagon",
  "octagon",
  "semicircle",
  "trapezoid",
  "rightTrapezoid",
  "rightTriangle",
]);
```

- [ ] **Step 2: Add pentagon case to computePolyPoints**

Regular pentagon inscribed in bounding box, centered. Origin at top vertex.

```typescript
case "pentagon": {
  const cx = 0;
  const cy = height / 2;
  const r = Math.min(width, height) / 2;
  // 5 vertices starting from top, going clockwise
  const pts: LocalPoint[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / 5;
    pts.push(
      pointFrom<LocalPoint>(
        cx + r * Math.cos(angle),
        cy + r * Math.sin(angle),
      ),
    );
  }
  pts.push(pts[0]); // close
  return pts;
}
```

- [ ] **Step 3: Add octagon case**

Regular octagon inscribed in bounding box. Origin at top-left.

```typescript
case "octagon": {
  const s = Math.min(width, height);
  const cx = width / 2;
  const cy = height / 2;
  const r = s / 2;
  const pts: LocalPoint[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = -Math.PI / 2 + (Math.PI / 8) + (2 * Math.PI * i) / 8;
    pts.push(
      pointFrom<LocalPoint>(
        cx + r * Math.cos(angle),
        cy + r * Math.sin(angle),
      ),
    );
  }
  pts.push(pts[0]);
  return pts;
}
```

- [ ] **Step 4: Add semicircle case**

Upper semicircle approximated with polyline + diameter. Origin at top-left.

```typescript
case "semicircle": {
  const cx = width / 2;
  const r = width / 2;
  const segments = 16;
  const pts: LocalPoint[] = [];
  // Arc from left to right (π → 0), flipped for top semicircle
  for (let i = 0; i <= segments; i++) {
    const angle = Math.PI - (Math.PI * i) / segments;
    pts.push(
      pointFrom<LocalPoint>(
        cx + r * Math.cos(angle),
        r - r * Math.sin(angle),
      ),
    );
  }
  pts.push(pts[0]); // close diameter
  return pts;
}
```

- [ ] **Step 5: Add trapezoid case**

Symmetric trapezoid. Top side = 60% of bottom. Origin at top-left.

```typescript
case "trapezoid": {
  const inset = width * 0.2;
  return [
    pointFrom<LocalPoint>(inset, 0),
    pointFrom<LocalPoint>(width - inset, 0),
    pointFrom<LocalPoint>(width, height),
    pointFrom<LocalPoint>(0, height),
    pointFrom<LocalPoint>(inset, 0),
  ];
}
```

- [ ] **Step 6: Add rightTrapezoid case**

Left side vertical, right side slanted. Origin at top-left.

```typescript
case "rightTrapezoid": {
  const inset = width * 0.25;
  return [
    pointFrom<LocalPoint>(0, 0),
    pointFrom<LocalPoint>(width - inset, 0),
    pointFrom<LocalPoint>(width, height),
    pointFrom<LocalPoint>(0, height),
    pointFrom<LocalPoint>(0, 0),
  ];
}
```

- [ ] **Step 7: Add rightTriangle case**

Right angle at bottom-left. Origin at top-left of bounding box.

```typescript
case "rightTriangle":
  return [
    pointFrom<LocalPoint>(0, 0),
    pointFrom<LocalPoint>(0, height),
    pointFrom<LocalPoint>(width, height),
    pointFrom<LocalPoint>(0, 0),
  ];
```

- [ ] **Step 8: Update getPolyPresetXOffset**

Pentagon needs centering (like triangle/diamond):

```typescript
export const getPolyPresetXOffset = (type: string, width: number): number => {
  if (type === "triangle" || type === "diamond" || type === "pentagon") {
    return width / 2;
  }
  return 0;
};
```

- [ ] **Step 9: Update getPolyPresetAspectHeight**

```typescript
export const getPolyPresetAspectHeight = (
  type: string,
  width: number,
): number => {
  if (type === "triangle") {
    return width * (Math.sqrt(3) / 2);
  }
  if (type === "semicircle") {
    return width / 2;
  }
  if (type === "trapezoid" || type === "rightTrapezoid") {
    return width * 0.7;
  }
  // rectangle, diamond, pentagon, octagon, rightTriangle: square
  return width;
};
```

---

## Task 2: Add icons (icons.tsx)

**Files:**

- Modify: `packages/excalidraw/components/icons.tsx`

Add after existing shape icons (around line 425). Each icon is a 24x24 SVG using `createIcon` with `tablerIconProps`.

- [ ] **Step 1: Add all 6 icons**

```typescript
export const PentagonIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M12 3 L22 10.5 L18.5 21 L5.5 21 L2 10.5 Z" />
  </g>,
  tablerIconProps,
);

export const OctagonIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M8.5 2.5 L15.5 2.5 L21.5 8.5 L21.5 15.5 L15.5 21.5 L8.5 21.5 L2.5 15.5 L2.5 8.5 Z" />
  </g>,
  tablerIconProps,
);

export const SemicircleIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 16 A9 9 0 0 1 21 16 Z" />
  </g>,
  tablerIconProps,
);

export const TrapezoidIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M6 5 L18 5 L22 19 L2 19 Z" />
  </g>,
  tablerIconProps,
);

export const RightTrapezoidIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M3 5 L18 5 L22 19 L3 19 Z" />
  </g>,
  tablerIconProps,
);

export const RightTriangleIcon = createIcon(
  <g strokeWidth="1.5">
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M4 4 L4 20 L20 20 Z" />
  </g>,
  tablerIconProps,
);
```

---

## Task 3: Add to SHAPES toolbar (shapes.tsx)

**Files:**

- Modify: `packages/excalidraw/components/shapes.tsx`

- [ ] **Step 1: Import icons**

Add to the import from `./icons`:

```typescript
import {
  // ... existing imports ...
  PentagonIcon,
  OctagonIcon,
  SemicircleIcon,
  TrapezoidIcon,
  RightTrapezoidIcon,
  RightTriangleIcon,
} from "./icons";
```

- [ ] **Step 2: Add SHAPES entries**

Add after existing polygon entries (triangle, diamond). Group them logically:

```typescript
{
  icon: PentagonIcon,
  value: "pentagon",
  key: null,
  numericKey: null,
  fillable: true,
  toolbar: true,
},
{
  icon: OctagonIcon,
  value: "octagon",
  key: null,
  numericKey: null,
  fillable: true,
  toolbar: true,
},
{
  icon: SemicircleIcon,
  value: "semicircle",
  key: null,
  numericKey: null,
  fillable: true,
  toolbar: true,
},
{
  icon: TrapezoidIcon,
  value: "trapezoid",
  key: null,
  numericKey: null,
  fillable: true,
  toolbar: true,
},
{
  icon: RightTrapezoidIcon,
  value: "rightTrapezoid",
  key: null,
  numericKey: null,
  fillable: true,
  toolbar: true,
},
{
  icon: RightTriangleIcon,
  value: "rightTriangle",
  key: null,
  numericKey: null,
  fillable: true,
  toolbar: true,
},
```

Note: `fillable: true` because 2D polygons can be filled (unlike 3D wireframes).

---

## Task 4: Validate, build, test

- [ ] **Step 1: Run checks**

```bash
yarn fix              # 0 warnings
yarn test:typecheck   # pass
cd packages/excalidraw && yarn build:esm
```

- [ ] **Step 2: Manual verification**

1. Each preset appears in the toolbar sidebar
2. Click preset → draw on canvas → correct shape
3. Shift-drag → constrained aspect ratio
4. Shapes are fillable (stroke + background color)
5. Undo/redo works

- [ ] **Step 3: Commit**

```bash
git add packages/element/src/polyPresets.ts packages/excalidraw/components/icons.tsx packages/excalidraw/components/shapes.tsx
git commit -m "feat: add 2D polygon presets (pentagon, octagon, semicircle, trapezoid, right trapezoid, right triangle)"
```

---

## Task 5: Publish and deploy

- [ ] Bump MINOR version in `packages/excalidraw/package.json` (new feature)
- [ ] `cd packages/excalidraw && yarn build:esm && NPM_TOKEN=<token> npm publish`
- [ ] Install in billion-dollars, commit both files, push, PR
