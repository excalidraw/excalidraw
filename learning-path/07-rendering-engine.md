# Module 07 — Rendering Engine

**Time:** 8-10 hours
**Goal:** Understand how element data becomes pixels — the 3-layer canvas, RoughJS, shape caching, and the render pipeline.

---

## Prerequisites

You should have completed:
- Module 03 (Canvas fundamentals — transforms, save/restore, coordinate pipeline)
- Module 05 (Element system — types, fields, what each element "is")

---

## Architecture Recap

```
┌────────────────────────────┐
│ InteractiveCanvas  (top)   │  Selection, handles, cursors — every frame
├────────────────────────────┤
│ NewElementCanvas   (mid)   │  Element being drawn — on drag
├────────────────────────────┤
│ StaticCanvas       (bot)   │  All elements, grid — on scene change
└────────────────────────────┘
```

See `RENDERING_ENGINE.md` in the repo root for the full architecture doc. This module focuses on *how to read the code*.

---

## File Map

| File | Lines | What to read |
|------|-------|-------------|
| `renderer/helpers.ts` | ~80 | `bootstrapCanvas()` — start here |
| `renderer/staticScene.ts` | ~500 | `strokeGrid()` first, then `_renderStaticScene()` |
| `renderer/interactiveScene.ts` | ~2000 | Skim — focus on selection rendering |
| `renderer/renderNewElementScene.ts` | ~100 | Short, read entirely |
| `renderer/renderSnaps.ts` | ~60 | Short, read entirely |
| `renderer/animation.ts` | ~85 | `AnimationController` class |
| `element/src/renderElement.ts` | ~1100 | `renderElement()` + `drawElementOnCanvas()` |
| `element/src/shape.ts` | ~260 | `ShapeCache` + `generateRoughOptions()` |

---

## Reading Order

### Step 1: bootstrapCanvas (renderer/helpers.ts)

Every render pass starts here:

```typescript
function bootstrapCanvas(params) {
  const context = canvas.getContext("2d");
  context.setTransform(1, 0, 0, 1, 0, 0);  // reset
  context.scale(scale, scale);               // device pixel ratio

  // Clear or fill background:
  if (viewBackgroundColor) {
    context.fillStyle = viewBackgroundColor;
    context.fillRect(0, 0, width, height);
  } else {
    context.clearRect(0, 0, width, height);
  }

  return context;
}
```

**Takeaway:** Every frame starts clean. No incremental updates — the entire canvas is redrawn.

### Step 2: strokeGrid (renderer/staticScene.ts:56)

Read this function completely. It's self-contained and uses every canvas pattern:

1. Calculate grid offsets from scroll position
2. Iterate rows and columns
3. Draw bold lines every Nth cell
4. Apply dashed pattern
5. Handle zoom-based visibility

**Key detail — crisp lines:** At 100% zoom, the code adds a 0.5px offset so 1px lines land on pixel boundaries instead of being anti-aliased across two pixels.

### Step 3: _renderStaticScene (renderer/staticScene.ts:229)

The main static render function. Read it as a pipeline:

```
1. bootstrapCanvas()
2. Apply zoom: context.scale(zoom, zoom)
3. Render grid (if enabled)
4. For each visible element:
   a. Apply frame clipping (if in frame)
   b. renderElement() — the big one
   c. Render bound text
   d. Render link icon
5. Render embeddables on top (separate pass)
6. Render flowchart preview nodes
```

**Frame clipping pattern:**
```typescript
if (element is inside a frame && frame rendering enabled) {
  context.save();
  // Clip to frame bounds
  frameClip(frame, context, renderConfig, appState);
  // Draw element (clipped)
  renderElement(element, ...);
  context.restore();
} else {
  renderElement(element, ...);
}
```

### Step 4: renderElement (element/src/renderElement.ts:780)

This is the core per-element rendering function. It branches by type and by mode:

**Two modes:**
- **Export mode** (`renderConfig.isExporting`): Draw directly to canvas context. No caching. Full fidelity.
- **Normal mode**: Use offscreen canvas cache. Draw cached image to main canvas.

**For normal mode (non-export), the flow is:**
```
renderElement()
  → generateElementWithCanvas()    // get or create offscreen canvas
    → ShapeCache.generateElementShape()  // get or create RoughJS shape
    → drawElementOnCanvas()              // RoughJS draws to offscreen canvas
  → drawElementFromCanvas()        // blit offscreen canvas to main canvas
```

### Step 5: ShapeCache (element/src/shape.ts:81)

```typescript
class ShapeCache {
  private static cache = new WeakMap<ExcalidrawElement, { shape, theme }>();

  static generateElementShape(element, renderConfig) {
    // Check cache:
    const cached = this.get(element, renderConfig?.theme);
    if (cached !== undefined) return cached;

    // Generate shape via RoughJS:
    const shape = _generateElementShape(element, this.rg, renderConfig);

    // Cache and return:
    this.cache.set(element, { shape, theme: renderConfig?.theme });
    return shape;
  }
}
```

**WeakMap:** When an element object is garbage-collected (e.g., after undo replaces it), the cache entry is automatically removed. No manual invalidation needed for most cases.

**Per-theme caching:** Light and dark mode have different stroke colors, so shapes are cached per theme.

### Step 6: generateRoughOptions (element/src/shape.ts:193)

This function translates element properties to RoughJS configuration:

```typescript
{
  seed: element.seed,           // deterministic wobble
  roughness: adjustRoughness(), // scale down for small elements
  stroke: element.strokeColor,
  fill: element.backgroundColor,
  fillStyle: element.fillStyle, // "hachure", "cross-hatch", "solid"
  strokeWidth: element.strokeWidth,
  strokeLineDash: dashPattern,  // from element.strokeStyle
}
```

**The seed:** Each element has a random `seed` assigned at creation. RoughJS uses it as a PRNG seed — same seed = same hand-drawn wobble pattern. This means elements look consistent across renders and across different users' screens.

**Roughness adjustment:** Small elements (< 50px) get reduced roughness so they don't look like blobs.

### Step 7: drawElementOnCanvas (element/src/renderElement.ts:387)

Type-specific drawing. Key branches:

**Rectangles/diamonds/ellipses:**
```typescript
rc.draw(ShapeCache.generateElementShape(element, renderConfig));
```

**Arrows/lines (multiple shapes):**
```typescript
shapes.forEach(shape => rc.draw(shape));
```

**Freedraw (mix of RoughJS and raw paths):**
```typescript
for (const shape of shapes) {
  if (typeof shape === "string") {
    context.fill(new Path2D(shape));  // SVG path string
  } else {
    rc.draw(shape);  // RoughJS Drawable
  }
}
```

**Text (no RoughJS):**
```typescript
context.font = getFontString(element);
context.fillStyle = element.strokeColor;
lines.forEach((line, i) => {
  context.fillText(line, horizontalOffset, verticalOffset + i * lineHeight);
});
```

**Images:**
```typescript
context.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, width, height);
```

### Step 8: The interactive layer (renderer/interactiveScene.ts)

Skim this file. Focus on:

1. **Selection rendering** (~line 1780): Dashed outline + transform handles
2. **Transform handles** (~line 1325): Corner squares + rotation circle
3. **Binding highlights** (~line 223): Outline when arrow approaches a shape
4. **Snap lines** (calls `renderSnaps()`)

The interactive layer runs on every animation frame via `AnimationController`:

```typescript
// In InteractiveCanvas.tsx:
AnimationController.start("animateInteractiveScene", ({ deltaTime, state }) => {
  return renderInteractiveScene({ ..., animationState: state });
});
```

### Step 9: AnimationController (renderer/animation.ts)

Simple RAF loop manager:

```typescript
class AnimationController {
  static start(key, animationFn) {
    // Run animation, get initial state
    // Add to animations map
    // Start RAF loop
  }

  static tick() {
    for (const [key, entry] of animations) {
      const nextState = entry.animation({ deltaTime, state: entry.state });
      if (!nextState) animations.delete(key);  // animation done
    }
    if (animations.size > 0) requestAnimationFrame(tick);
  }
}
```

The RAF loop automatically stops when there are no active animations. The interactive canvas animation runs continuously while the editor is active.

---

## Caching Summary

```
Level 1: ShapeCache (WeakMap)
  Key:   ExcalidrawElement reference + theme
  Value: RoughJS Drawable (the shape data)
  Cost:  RoughJS generation (~1-5ms per element)

Level 2: elementWithCanvasCache (WeakMap)
  Key:   ExcalidrawElement reference
  Value: Offscreen HTMLCanvasElement with the element pre-drawn
  Cost:  Canvas drawing (~0.5-2ms per element)

Level 3: linkIconCanvasCache (Map)
  Key:   Zoom level
  Value: Pre-rendered link icon at that zoom
  Cost:  Icon rendering (~0.1ms)
```

When drawing to the main canvas:
- Cache hit: `context.drawImage(cachedCanvas)` — ~0.01ms
- Cache miss: Generate shape + draw to offscreen canvas + cache — ~2-7ms

---

## Render Triggers

| Event | What re-renders |
|-------|-----------------|
| Element added/changed/deleted | Static canvas (via `sceneNonce` change) |
| Selection changed | Interactive canvas (next RAF frame) |
| Zoom/scroll changed | Static + interactive canvas |
| Pointer moved while drawing | New element canvas |
| Snap line appears/disappears | Interactive canvas |
| Remote cursor moves | Interactive canvas |
| Window resize | All canvases |

---

## Exercises

1. Read `renderer/helpers.ts` — `bootstrapCanvas()`. Note the order of operations.
2. Read `renderer/staticScene.ts` — `strokeGrid()` (line 56). Annotate each canvas API call.
3. Read `element/src/shape.ts` — `ShapeCache` class. Understand the WeakMap caching pattern.
4. Read `element/src/shape.ts` — `generateRoughOptions()`. Map each RoughJS option to the element property it comes from.
5. Read `element/src/renderElement.ts` — `drawElementOnCanvas()` (line 387). Find the branch for rectangles, for text, and for images.
6. In the running app, open DevTools Performance tab. Record while dragging a rectangle. Look at the flame chart — find the `renderStaticScene` and `renderInteractiveScene` calls. Note their timing.

---

**Next:** [Module 08 — Text System](08-text-system.md)
