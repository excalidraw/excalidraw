# Module 02 — Math Layer

**Time:** 4-6 hours
**Goal:** Understand the pure geometry library that everything else builds on.
**Package:** `packages/math/src/`

---

## Why This Comes First

Every pixel on the Excalidraw canvas is positioned by math from this package. Bounds calculations, collision detection, arrow routing, text positioning — they all call into `@excalidraw/math`. Understanding this package means you can read any other file without getting stuck on "what does this function do?"

---

## The Type System

**File:** `packages/math/src/types.ts`

The math library uses **tuple types with brands**:

```typescript
// A point is a [x, y] tuple with a brand
type GlobalPoint = readonly [x: number, y: number] & { _brand: "excalimath__globalpoint" };
type LocalPoint  = readonly [x: number, y: number] & { _brand: "excalimath__localpoint" };

// A vector is also a [x, y] tuple with a different brand
type Vector = [x: number, y: number] & { _brand: "excalimath__vector" };

// A line is two points
type Line<P> = [p: P, q: P];

// A segment is two points (same shape, different meaning)
type Segment<P> = [a: P, b: P];
```

**Why brands?** Scene coordinates and local (element-relative) coordinates are both `[number, number]`. Without brands, you could accidentally pass local coords to a function expecting global coords. The brand makes TypeScript catch this at compile time.

**How points are created:**
```typescript
const p = pointFrom<GlobalPoint>(100, 200);
// Returns [100, 200] as GlobalPoint — the brand is phantom (doesn't exist at runtime)
```

---

## Reading Order

Read these files in this exact order. Each builds on the previous.

### 1. `point.ts` — Start here

The most fundamental file. Every other module imports from here.

**Key functions:**

| Function | What it does | Used for |
|----------|-------------|----------|
| `pointFrom(x, y)` | Create a typed point | Everywhere |
| `pointDistance(a, b)` | Euclidean distance | Hit testing, snapping |
| `pointRotateRads(p, center, angle)` | Rotate point around center | Element rotation |
| `pointsEqual(a, b, threshold?)` | Compare with tolerance | Avoiding floating-point traps |
| `pointFromPair([x, y])` | Convert array to point | Deserialization |
| `pointTranslate(p, v)` | Move point by vector | Dragging, offsetting |

**Read carefully:** The generic parameter `<Point extends GlobalPoint | LocalPoint>` flows through every function. This is how the brand propagates — if you pass a `GlobalPoint`, you get a `GlobalPoint` back.

### 2. `vector.ts` — Direction and magnitude

**Key functions:**

| Function | What it does | Used for |
|----------|-------------|----------|
| `vectorFromPoint(p, origin?)` | Create vector from point | Arrow direction |
| `vectorScale(v, scalar)` | Multiply length | Extending/shortening arrows |
| `vectorNormalize(v)` | Make unit length (magnitude = 1) | Direction without magnitude |
| `vectorDot(a, b)` | Dot product | Angle between directions |
| `vectorCross(a, b)` | Cross product | Clockwise/counter-clockwise |
| `vectorAdd(a, b)` | Add vectors | Combining movements |

**Mental model:** A vector is "how far and in what direction." Point + vector = new point.

### 3. `angle.ts` — Rotation utilities

Small but important:

| Function | What it does |
|----------|-------------|
| `radiansToDegrees(r)` | Convert for display |
| `degreesToRadians(d)` | Convert for math |
| `normalizeRadians(angle)` | Keep angle in [0, 2π) |

Excalidraw stores `element.angle` in radians. When you see `angle: 1.5707963` that's 90 degrees.

### 4. `line.ts` and `segment.ts` — Lines and segments

| Function | What it does | Used for |
|----------|-------------|----------|
| `linesIntersectAt(l1, l2)` | Find where two infinite lines cross | Arrow-to-element intersection |
| `segmentIncludesPoint(seg, p)` | Is point on segment? | Click detection |
| `segmentIntersectsSegment(s1, s2)` | Do segments cross? | Collision detection |

**Key distinction:** A `Line` extends infinitely. A `Segment` has endpoints. Same math, different bounds checks.

### 5. `rectangle.ts` — Axis-aligned bounding boxes

| Function | What it does |
|----------|-------------|
| `rectangle(topLeft, bottomRight)` | Create from corners |
| `rectangleIntersectSegment(rect, seg)` | Does segment cross rectangle? |
| `pointInRectangle(point, rect)` | Is point inside? |

These are axis-aligned (not rotated). Rotated element bounds are handled in `packages/element/src/bounds.ts` using the rotation math from `point.ts`.

### 6. `polygon.ts` — General polygons

| Function | What it does | Used for |
|----------|-------------|----------|
| `pointInPolygon(p, polygon)` | Point containment test | Hit testing diamonds, rotated rects |
| `polygonFromPoints(points)` | Create from vertex array | Converting element bounds to polygon |

Uses the ray-casting algorithm: cast a ray from the point, count how many polygon edges it crosses. Odd count = inside.

### 7. `curve.ts` — Bezier curves (hardest)

| Function | What it does | Used for |
|----------|-------------|----------|
| `curve(p0, p1, p2, p3)` | Create cubic Bezier | Freedraw, smooth arrows |
| `curvePointAtParameter(c, t)` | Get point at t ∈ [0,1] | Positioning along curve |
| `curveLength(c)` | Arc length | Text placement on arrows |
| `curveTangent(c, t)` | Direction at point | Arrow head angle |
| `curveIntersectsSegment(c, seg)` | Curve-line intersection | Collision detection |

**Why this is hard:** Bezier math involves parametric equations. A cubic Bezier has 4 control points:
```
B(t) = (1-t)³P₀ + 3(1-t)²tP₁ + 3(1-t)t²P₂ + t³P₃,  t ∈ [0,1]
```

You don't need to derive this — just understand that `t=0` gives the start point, `t=1` gives the end, and values between trace the curve.

### 8. `ellipse.ts` — Ellipse geometry

| Function | What it does | Used for |
|----------|-------------|----------|
| `ellipse(center, halfWidth, halfHeight)` | Create ellipse | Ellipse elements |
| `ellipseIncludesPoint(e, p)` | Point inside? | Hit testing |
| `ellipseSegmentInterceptPoints(e, seg)` | Where segment crosses ellipse | Arrow binding to ellipse |

Ellipse-line intersection uses the quadratic formula on the ellipse equation. It's algebraically dense but the code is well-structured.

---

## Concept Dependency Graph

```
point.ts  ←── Everything depends on this
  │
  ├── vector.ts  ←── Used by line, segment, polygon
  │     │
  │     ├── line.ts
  │     └── segment.ts
  │
  ├── angle.ts  ←── Used by point rotation
  │
  ├── rectangle.ts  ←── Uses point, segment
  │
  ├── polygon.ts  ←── Uses point, segment
  │
  ├── curve.ts  ←── Uses point, vector (hardest)
  │
  └── ellipse.ts  ←── Uses point, segment (algebraically dense)
```

---

## Common Patterns You'll See

### Pattern 1: Generic point propagation

```typescript
function doSomething<P extends GlobalPoint | LocalPoint>(p: P): P {
  // P flows through — caller's point type is preserved
}
```

### Pattern 2: Threshold-based equality

```typescript
// Never do exact floating-point comparison:
if (a === b) // WRONG

// Always use threshold:
if (pointsEqual(a, b, 0.001)) // RIGHT
```

The `PRECISION` constant in `utils.ts` defines the default threshold.

### Pattern 3: Tuple destructuring

```typescript
const [x, y] = pointFrom<GlobalPoint>(10, 20);
// x = 10, y = 20
```

Points are tuples, so you'll see constant destructuring throughout the codebase.

---

## Exercises

1. Read `point.ts` top to bottom. For each function, write a one-line comment explaining what it does in plain English.
2. Trace `pointRotateRads` — verify it matches the rotation formula from Module 01.
3. Read `vector.ts`. Draw two vectors on paper. Compute their dot product and cross product by hand. Verify your understanding of what the sign means.
4. Open `curve.ts`. Don't try to understand every function — just identify which functions create curves and which query them.
5. Search the codebase for `pointDistance` calls. Pick 3 call sites and understand why distance is being calculated there.

```bash
# Find all usages of pointDistance
grep -rn "pointDistance" packages/ --include="*.ts" | head -20
```

---

**Next:** [Module 03 — Canvas Fundamentals](03-canvas-fundamentals.md)
