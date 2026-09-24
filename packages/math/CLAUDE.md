## @excalidraw/math

Low-level, pure geometric and vector math library for Excalidraw's canvas engine. It provides branded geometric types, point/vector/curve/shape primitives, and intersection/containment algorithms. All other packages (`@excalidraw/element`, `packages/excalidraw`) depend on these primitives rather than writing their own geometry.

See `packages/math/README.md` for installation instructions.

## Type System and Coordinate Spaces

The central design choice is **branded TypeScript types** that prevent accidentally mixing coordinate spaces at compile time.

- `GlobalPoint` — a `[x, y]` tuple in world/canvas/scene space, branded `excalimath__globalpoint`
- `LocalPoint` — a `[x, y]` tuple in element-local space, branded `excalimath__localpoint`
- `Vector` — a `[u, v]` direction/displacement, branded `excalimath__vector`; not interchangeable with points even though both are number tuples
- `Radians` / `Degrees` — branded `number` subtypes; arithmetic on bare `number` does not satisfy them
- `InclusiveRange` — branded `[number, number]` pair for 1D interval arithmetic
- `Line<P>` — infinite line defined by two points; `LineSegment<P>` — bounded by two endpoints
- `Curve<P>` — cubic Bézier with exactly four control points
- `Polygon<P>` — closed `Point[]` array (constructor always appends the first point at the end)
- `Rectangle<P>` — two-point bounding box `[topLeft, bottomRight]`
- `Triangle<P>` — three-point tuple
- `Ellipse<P>` — object with `center`, `halfWidth`, `halfHeight` (axis-aligned; rotation handled by callers)

**Ongoing migration**: `GlobalCoord` / `LocalCoord` (`{ x, y }` objects) exist for backward compatibility and carry TODO comments for removal once the codebase fully migrates to tuple points. New code should use `GlobalPoint` / `LocalPoint` tuples.

## Primitive Construction

Every type has a factory function that attaches the brand through a cast (no runtime overhead):

- `pointFrom(x, y)` / `pointFrom({ x, y })` — overloaded; also accepts `GlobalCoord`/`LocalCoord` objects during migration
- `vector(x, y, originX?, originY?)` — constructs relative to an optional origin
- `lineSegment(a, b)`, `line(a, b)`, `curve(a, b, c, d)`
- `ellipse(center, halfWidth, halfHeight)`
- `polygon(...points)` / `polygonFromPoints(points[])` — automatically closes the ring
- `rectangle(topLeft, bottomRight)`, `rectangleFromNumberSequence(minX, minY, maxX, maxY)`
- `rangeInclusive(start, end)`, `rangeInclusiveFromPair([start, end])`

## Key Algorithms

### Cubic Bézier (curve.ts)

`bezierEquation(c, t)` evaluates the standard cubic Bézier formula at parameter `t ∈ [0,1]`.

**Curve–segment intersection** (`curveIntersectLineSegment`): Newton-Raphson with an analytical Jacobian, seeded at three initial guesses (t=0.5, t=0.2, t=0.8 / s=0 each). Returns the first solution found within `[0,1]×[0,1]`; the caller receives at most one intersection point per call. Default tolerance 1e-2, iteration limit 4.

**Arc length** (`curveLength`, `curveLengthAtParameter`): 24-point Legendre-Gauss quadrature using the abscissae/weights stored in `packages/math/src/constants.ts`. Partial length up to parameter `t` scales the integration interval to `[0,t]` before applying the same quadrature.

**Point at arc-length percentage** (`curvePointAtLength`): binary search over `t` using `curveLengthAtParameter`, up to 20 iterations with tolerance = 0.01% of total length.

**Closest point** (`curveClosestPoint`): 30-step uniform coarse sweep to find the best `t`, then bisection refinement within ±1/30 of that step.

**Tangent and normal** (`curveTangent`, `vectorNormal`): analytic derivative of the cubic Bézier; `vectorNormal` returns the right-hand perpendicular `(y, -x)`.

**Offset curves** (`curveOffsetPoints`, `offsetPointsForQuadraticBezier`): samples the curve at uniform `t` steps, computes the normalized normal at each sample, and pushes the point outward by the offset distance. Used to generate stroke-width parallel curves.

**Catmull-Rom spline conversion** (`curveCatmullRomCubicApproxPoints`, `curveCatmullRomQuadraticApproxPoints`): converts a sequence of control points and a tension parameter into a chain of Bézier curves by computing tangent-based control points.

### Ellipse (ellipse.ts)

`ellipseIncludesPoint`: normalized quadratic inequality test (no iteration).

`ellipseDistanceFromPoint`: 3-iteration closest-point-on-ellipse approximation using the parametric foot-of-normal approach, accurate enough for hit testing.

`ellipseSegmentInterceptPoints`: quadratic discriminant on the implicit ellipse equation; returns 0, 1, or 2 intersection points filtered to `t ∈ [0,1]`.

`ellipseLineIntersectionPoints`: same formula without the segment clamp, returning all real intersections with the infinite line.

### Line and Segment (line.ts, segment.ts)

`linesIntersectAt`: solves the 2×2 linear system via determinant; returns null when lines are parallel (D=0).

`segmentsIntersectAt`: cross-product parameterization; returns the intersection only when both parameters `t, u ∈ [0,1)` (endpoint-exclusive on the right).

`distanceToLineSegment`: projects the point onto the segment, clamping to the nearer endpoint when the projection falls outside.

### Polygon (polygon.ts)

`polygonIncludesPoint`: ray-casting (even-odd rule).

`polygonIncludesPointNonZero`: winding number; handles self-intersecting polygons correctly where ray-casting would not.

`pointOnPolygon`: tests all edges via `pointOnLineSegment`.

### Triangle (triangle.ts)

`triangleIncludesPoint`: sign-of-area test using three cross products; returns false for points exactly on the boundary.

### Range (range.ts)

1D interval helpers (`rangesOverlap`, `rangeIntersection`, `rangeIncludesValue`) used by bounding-box overlap tests elsewhere in the engine.

## Numeric Precision

`PRECISION = 10e-5` (0.0001) is the shared tolerance for floating-point equality checks across `pointsEqual`, `pointOnLineSegment`, `ellipseTouchesPoint`, and related predicates. Callers may override it via an optional `threshold` parameter.

`pointDistanceSq` / `vectorMagnitudeSq` are provided specifically to avoid a square root when only comparing magnitudes.

## Angle Utilities (angle.ts)

`normalizeRadians(angle)`: maps any angle to `[0, 2π)`.

`radiansBetweenAngles(a, min, max)`: handles wraparound ranges where `min > max` (e.g., `[5.5, 0.8]`).

`cartesian2Polar([x, y])`: returns `[radius, normalizedAngle]` — the `PolarCoords` tuple.