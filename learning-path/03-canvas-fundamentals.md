# Module 03 — Canvas Fundamentals

**Time:** 4-6 hours
**Goal:** Understand how Excalidraw uses the Canvas 2D API, the coordinate pipeline, and the transform stack.

---

## Why Canvas, Not SVG or DOM?

Excalidraw can have thousands of elements on screen. Three rendering approaches:

| Approach | 1000 elements | Interaction | Used by |
|----------|---------------|-------------|---------|
| **DOM divs** | 1000 DOM nodes, very slow | Easy (click events) | Not viable |
| **SVG** | 1000 SVG nodes, slow re-renders | Medium (events per element) | Excalidraw export only |
| **Canvas** | Single pixel buffer, fast | Hard (must implement hit-testing) | Excalidraw live rendering |

Canvas wins for live rendering. The trade-off is you must implement everything yourself: hit testing, selection, text editing, scrollbars. That's why the codebase is so large.

---

## The 3-Layer Architecture

Excalidraw stacks three `<canvas>` elements:

```
┌──────────────────────────────────┐
│ InteractiveCanvas   (z-index: 3) │  ← pointer events land here
│ Selection, handles, cursors      │  ← re-renders every frame (RAF)
├──────────────────────────────────┤
│ NewElementCanvas    (z-index: 2) │  ← element being drawn
│ Single element preview           │  ← re-renders on drag
├──────────────────────────────────┤
│ StaticCanvas        (z-index: 1) │  ← all committed elements
│ Grid, elements, link icons       │  ← re-renders on scene change
└──────────────────────────────────┘
```

**Files:**
- `packages/excalidraw/components/canvases/StaticCanvas.tsx`
- `packages/excalidraw/components/canvases/InteractiveCanvas.tsx`
- `packages/excalidraw/components/canvases/NewElementCanvas.tsx`

**Why three layers?**

Drawing 500 elements through RoughJS is expensive (~5-10ms). If the interactive layer (selection handles, cursor) shared the same canvas, you'd need to redraw all 500 elements at 60fps just to animate a selection box. Separating them means:

- **Static canvas:** Only redraws when elements change (~1-5 times/sec)
- **Interactive canvas:** Redraws every frame but only draws cheap overlays
- **New element canvas:** Redraws during drag but only draws one element

---

## The Coordinate Pipeline

Every point goes through this transform chain to reach the screen:

```
Scene coordinates (element.x, element.y)
        │
        │  context.scale(zoom.value, zoom.value)
        ▼
Zoomed coordinates
        │
        │  offset by (scrollX, scrollY) — applied per-element or via translate
        ▼
Viewport coordinates (relative to canvas top-left)
        │
        │  context.scale(devicePixelRatio, devicePixelRatio)
        ▼
Physical pixels on screen
```

### In code

From `renderer/helpers.ts` — `bootstrapCanvas()`:

```typescript
context.setTransform(1, 0, 0, 1, 0, 0);          // reset everything
context.scale(scale, scale);                       // device pixel ratio

// Then in the render function:
context.scale(appState.zoom.value, appState.zoom.value);  // user zoom
```

Scroll offset (`scrollX`, `scrollY`) is applied when positioning each element, not as a global transform. This is because the grid needs to scroll differently from elements.

### Element rotation

Individual elements are rotated around their center:

```typescript
// From renderElement.ts — drawing a rotated element
const cx = (x1 + x2) / 2;      // center X
const cy = (y1 + y2) / 2;      // center Y
context.translate(cx, cy);       // move origin to center
context.rotate(element.angle);   // rotate around new origin
context.translate(-cx, -cy);     // move origin back
// now draw the element at (x1, y1) — it appears rotated
```

**Why translate-rotate-translate?** Canvas rotation rotates around the *current origin* (0,0). To rotate around an element's center, you temporarily move the origin to the center, rotate, then move it back.

---

## The Transform Stack

Canvas 2D context maintains a *stack* of states. `save()` pushes, `restore()` pops.

```typescript
ctx.save();                    // snapshot current state
  ctx.translate(100, 100);     // modify transform
  ctx.globalAlpha = 0.5;       // modify alpha
  ctx.fillRect(0, 0, 50, 50); // draw at (100, 100) with 50% opacity
ctx.restore();                 // undo translate AND alpha change

ctx.fillRect(0, 0, 50, 50);   // draws at (0, 0) with 100% opacity
```

**Critical rule:** Every `save()` must have a matching `restore()`. Forgetting one means all subsequent draws inherit the wrong transform/alpha/clip state. The codebase is very disciplined about this.

### Frame clipping

Elements inside frames are clipped to the frame's bounds. From `staticScene.ts`:

```typescript
// frameClip() — sets up a clip region
context.save();
context.translate(frame.x + scrollX, frame.y + scrollY);
context.beginPath();
context.roundRect(0, 0, frame.width, frame.height, FRAME_STYLE.radius);
context.clip();                     // everything drawn after this is clipped
context.translate(-(frame.x + scrollX), -(frame.y + scrollY));
// ... draw elements inside frame ...
context.restore();                  // removes clip
```

The double translate ensures elements inside the frame still use their own scene coordinates.

---

## Grid Rendering

`strokeGrid()` in `renderer/staticScene.ts:56` is a good first read — it's self-contained and demonstrates all the core canvas patterns:

1. **Offset calculation** from scroll position: `(scrollX % gridSize) - gridSize`
2. **Zoom-aware sizing:** `gridSize * zoom.value`
3. **Crisp line trick:** 0.5px offset at 100% zoom to align with pixel grid
4. **Bold vs regular lines:** every Nth line is bolder
5. **Visibility optimization:** hide regular lines when zoomed out (< 10px)
6. **Dashed lines:** `context.setLineDash([lineWidth * 3, gap])`

Read this function line by line as your first real code exercise.

---

## Device Pixel Ratio

On a Retina display, `devicePixelRatio = 2`. One CSS pixel = 4 physical pixels. Without handling this, canvas content looks blurry.

The fix (in `StaticCanvas.tsx`):

```typescript
canvas.width  = appState.width  * scale;  // physical pixels
canvas.height = appState.height * scale;
canvas.style.width  = `${appState.width}px`;   // CSS pixels
canvas.style.height = `${appState.height}px`;

context.scale(scale, scale);  // scale drawing to match
```

This means `context.fillRect(0, 0, 100, 100)` fills 100 CSS pixels = 200 physical pixels on Retina = sharp.

---

## Offscreen Canvas Caching

Each element is pre-rendered to its own offscreen canvas (a `<canvas>` created with `document.createElement("canvas")` but never added to the DOM). The main canvas then just copies the cached image:

```typescript
// Render once (expensive — involves RoughJS):
const offscreen = document.createElement("canvas");
const offCtx = offscreen.getContext("2d");
drawElementOnCanvas(element, offCtx, roughCanvas);  // RoughJS draws here

// Render every frame (cheap — just an image copy):
mainCtx.drawImage(offscreen, x, y);
```

This cache is stored in a `WeakMap<ExcalidrawElement, CachedCanvas>`. When an element is mutated, the cache is implicitly invalidated (the old element object is replaced, so the WeakMap entry becomes unreachable).

More details in [Module 07 — Rendering Engine](07-rendering-engine.md).

---

## Exercises

1. Open `renderer/staticScene.ts`. Find `strokeGrid()` (around line 56). Read it and annotate every canvas API call with what it does.
2. Open `renderer/helpers.ts`. Find `bootstrapCanvas()`. Trace the transform setup — what order are scale and clear applied?
3. In Chrome DevTools on the running app, run:
   ```javascript
   document.querySelectorAll("canvas").length
   ```
   Verify you see 3 canvases (or more if there are offscreen ones).
4. Draw a rectangle in the app. Open the static canvas with DevTools element inspector. Right-click → "Save Image As" → look at the raw canvas content.
5. Open `packages/element/src/renderElement.ts`. Find the rotation transform pattern (translate-rotate-translate). Count how many times this pattern appears.

---

**Next:** [Module 04 — React Patterns](04-react-patterns.md)
