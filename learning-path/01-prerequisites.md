# Module 01 — Prerequisites

**Time:** 2-3 hours
**Goal:** Gather the external knowledge you need before reading any Excalidraw code.

---

## What You Need to Know Already

This guide assumes you have:
- Comfortable reading TypeScript (generics, union types, type guards)
- Understanding of state management concepts (immutability, state transitions)
- Basic web development (HTML, CSS, DOM events)
- Familiarity with a terminal and git

---

## What You Need to Learn First

### 1. Canvas 2D API Basics (1 hour)

Excalidraw draws everything to `<canvas>` — no DOM elements for shapes. You need to understand these concepts before touching the renderer:

**Core API surface used in Excalidraw:**

```javascript
const ctx = canvas.getContext("2d");

// Drawing
ctx.fillRect(x, y, width, height);
ctx.strokeRect(x, y, width, height);
ctx.fillText("hello", x, y);
ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

// Paths
ctx.beginPath();
ctx.moveTo(x, y);
ctx.lineTo(x, y);
ctx.arc(x, y, radius, startAngle, endAngle);
ctx.closePath();
ctx.fill();
ctx.stroke();

// Transforms (CRITICAL — used everywhere)
ctx.save();          // push current state to stack
ctx.restore();       // pop state from stack
ctx.translate(x, y); // shift origin
ctx.rotate(angle);   // rotate around origin
ctx.scale(sx, sy);   // zoom

// Style
ctx.fillStyle = "#ff0000";
ctx.strokeStyle = "#000000";
ctx.lineWidth = 2;
ctx.globalAlpha = 0.5;
ctx.setLineDash([5, 3]);

// Clipping
ctx.clip();          // clip to current path
```

**Key concept:** Canvas transforms are *cumulative*. `translate(10, 0)` then `translate(0, 10)` means you're at `(10, 10)`. You MUST use `save()`/`restore()` to undo transforms. Forgetting `restore()` breaks everything drawn after.

**Resource:** [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial) — read sections 1-5, skip the rest.

### 2. Trigonometry Refresher (30 min)

Used constantly for rotation, angle calculation, and positioning:

```
sin(angle) = opposite / hypotenuse
cos(angle) = adjacent / hypotenuse
atan2(y, x) = angle from origin to point (x, y)

Radians = Degrees × (π / 180)
Degrees = Radians × (180 / π)
```

Excalidraw stores all angles in **radians**. The `angle.ts` module handles conversion.

**Key formula — rotating point P around center C by angle θ:**
```
P'.x = cos(θ) × (P.x - C.x) - sin(θ) × (P.y - C.y) + C.x
P'.y = sin(θ) × (P.x - C.x) + cos(θ) × (P.y - C.y) + C.y
```

You'll see this exact pattern in `math/src/point.ts` (`pointRotateRads`).

### 3. Vector Math Basics (30 min)

A vector is a direction + magnitude. Used for arrow directions, snapping, collision.

```
Vector from A to B:  V = (B.x - A.x, B.y - A.y)
Magnitude (length):  |V| = √(V.x² + V.y²)
Normalize (unit):    V̂ = (V.x / |V|, V.y / |V|)
Dot product:         A·B = A.x×B.x + A.y×B.y
Cross product (2D):  A×B = A.x×B.y - A.y×B.x
```

**What they tell you:**
- Dot product > 0: vectors point roughly same direction
- Dot product = 0: vectors are perpendicular
- Cross product sign: tells you if B is clockwise or counter-clockwise from A

### 4. TypeScript Branded Types (15 min)

The math library uses branded types to prevent coordinate system mix-ups at compile time:

```typescript
type GlobalPoint = [x: number, y: number] & { _brand: "excalimath__globalpoint" };
type LocalPoint  = [x: number, y: number] & { _brand: "excalimath__localpoint" };

// This compiles:
pointDistance(globalA, globalB);

// This does NOT compile — different brands:
pointDistance(globalA, localB);  // Type error!
```

The `_brand` field never exists at runtime. It's purely a compile-time safety net. You'll see `pointFrom<GlobalPoint>(x, y)` throughout the codebase — the generic parameter picks the brand.

### 5. A* Pathfinding Algorithm (optional, for Module 09)

The elbow arrow routing uses A* search. If you haven't studied it:

```
Open set: nodes to explore (sorted by cost)
Closed set: nodes already explored

f(n) = g(n) + h(n)
  g(n) = actual cost from start to n
  h(n) = estimated cost from n to goal (heuristic)

Repeat:
  1. Pick node with lowest f from open set
  2. If it's the goal, reconstruct path
  3. Move to closed set
  4. For each neighbor:
     - If in closed set, skip
     - Calculate tentative g
     - If better than existing, update parent and add to open set
```

**Resource:** [Red Blob Games A* Tutorial](https://www.redblobgames.com/pathfinding/a-star/introduction.html) — the best visual explanation available.

---

## What You Do NOT Need to Learn Yet

- **React** — Module 04 covers exactly what you need. Don't do a full React course.
- **RoughJS internals** — you'll use it as a black box ("give it a rectangle, get hand-drawn output")
- **Firebase/Socket.io** — only needed for Module 10 (collaboration)
- **Vite/esbuild** — build tools are not part of the learning path
- **CSS/SCSS** — the UI styling is not architecturally interesting

---

## Setup Your Environment

Before starting Module 02:

```bash
cd /home/tushar/Projects/excalidraw
yarn install
yarn start           # runs dev server at localhost:3000
yarn test:typecheck  # verify TypeScript compiles
```

Open the app in Chrome and draw a few shapes. Get a feel for:
- Rectangle, ellipse, diamond tools
- Arrow binding (drag arrow to a shape)
- Text inside shapes (double-click a rectangle)
- Elbow arrows (create arrow, switch to elbow style)
- Undo/redo behavior
- Multi-select and grouping

This hands-on experience gives you mental anchors for when you read the code.

---

## Exercises

1. Open Chrome DevTools console on the running app. Type `window.h` — explore what's available. Try `h.elements` and `h.state`.
2. Draw a rectangle. Run `h.elements[h.elements.length - 1]` in console. Read every field — match them against your intuition of what a rectangle "is."
3. Draw an arrow from one rectangle to another. Inspect the arrow element — find the `startBinding` and `endBinding` fields. Note what they contain.
4. Open `packages/math/src/point.ts` in your editor. Read the first 50 lines. If the TypeScript generics or branded types are confusing, revisit the branded types section above.

---

**Next:** [Module 02 — Math Layer](02-math-layer.md)
