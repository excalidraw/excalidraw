# Excalidraw Rendering Engine

How element data becomes pixels on screen. The engine uses a **3-layer canvas architecture** with RoughJS for the hand-drawn aesthetic, shape caching for performance, and a RAF-based animation loop for the interactive layer.

---

## Canvas Layers

Three separate `<canvas>` elements are stacked on top of each other. Each has a distinct role:

```
┌─────────────────────────────────────┐
│  InteractiveCanvas  (top)           │  Selection boxes, handles, cursors,
│                                     │  snap lines, scrollbars — RAF loop
├─────────────────────────────────────┤
│  NewElementCanvas   (middle)        │  The element being drawn right now
│                                     │  (before pointer-up finalizes it)
├─────────────────────────────────────┤
│  StaticCanvas       (bottom)        │  All committed elements, grid, links
│                                     │  — only re-renders on scene change
└─────────────────────────────────────┘
```

| Layer | File | Re-renders when | Draws |
|-------|------|-----------------|-------|
| **Static** | `components/canvases/StaticCanvas.tsx` | `sceneNonce` changes (element added/mutated/deleted), zoom, scroll, grid toggle | All committed elements, grid, link icons, embeddables |
| **Interactive** | `components/canvases/InteractiveCanvas.tsx` | Every frame (requestAnimationFrame) | Selection outlines, transform handles, snap lines, remote cursors, binding highlights, scrollbars |
| **NewElement** | `components/canvases/NewElementCanvas.tsx` | `appState.newElement` changes | The single element being actively drawn |

This separation is the core performance strategy — the expensive static layer (every element through RoughJS) only re-renders when the scene actually changes, while the cheap interactive layer (outlines and handles) runs at full frame rate.

---

## Render Pipeline

### Static Scene

**Entry:** `renderStaticScene()` → `_renderStaticScene()` (`renderer/staticScene.ts:229`)

```
1. Bootstrap canvas
   ├── context.setTransform(1, 0, 0, 1, 0, 0)    reset matrix
   ├── context.scale(scale, scale)                 device pixel ratio
   ├── fill/clear background                       viewBackgroundColor
   └── context.scale(zoom.value, zoom.value)        user zoom level

2. Render grid
   └── strokeGrid()                                 staticScene.ts:56

3. For each visible element:
   ├── Apply frame clip (if element is inside a frame)
   │   └── frameClip()                             staticScene.ts:132
   ├── renderElement()                             element/src/renderElement.ts:780
   │   ├── Set globalAlpha (element opacity × frame opacity)
   │   ├── Generate or fetch cached shape
   │   │   └── ShapeCache.generateElementShape()   element/src/shape.ts:81
   │   ├── Generate or fetch cached offscreen canvas
   │   │   └── generateElementWithCanvas()         renderElement.ts:204
   │   └── Draw cached canvas to main canvas
   │       └── drawElementFromCanvas()             renderElement.ts:665
   ├── Render bound text (arrow labels, container text)
   └── Render link icon (top-right corner)

4. Render embeddables/iframes on top (separate pass)

5. Render pending flowchart preview nodes
```

### Interactive Scene

**Entry:** `renderInteractiveScene()` → `_renderInteractiveScene()` (`renderer/interactiveScene.ts`)

Runs on every animation frame via `AnimationController`:

```
1. Bootstrap canvas (same as static)

2. Selection rendering
   ├── Single element: solid selection box + transform handles
   ├── Multi element: dashed bounding box + corner handles
   └── Rotation handle (circle above selection)

3. Linear element editing UI (when editing arrows/lines)
   ├── Point highlights (circles on control points)
   ├── Focus point indicators (binding target circles)
   └── Elbow arrow midpoint highlights

4. Binding highlights
   └── Outline around target element when arrow approaches

5. Search highlights
   └── Colored rectangles over text matches

6. Snap lines
   └── renderSnaps()                               renderer/renderSnaps.ts

7. Remote cursors (collaboration)
   └── Other users' pointer positions and selections

8. Scrollbars
   └── Rounded rectangles at viewport edges
```

### New Element Scene

**Entry:** `renderNewElementScene()` (`renderer/renderNewElementScene.ts`)

Minimal pipeline — renders a single element:

```
1. If appState.newElement exists:
   ├── Bootstrap canvas
   ├── Apply zoom
   ├── Apply frame clip (if in frame)
   └── renderElement(newElement)
2. Else:
   └── context.clearRect()   (clear the canvas)
```

---

## Element Rendering

`renderElement()` (`packages/element/src/renderElement.ts:780`) is the core function that draws a single element. It branches on element type:

### Generic shapes (rectangle, diamond, ellipse)

```
renderElement()
  → getRenderOpacity()           calculate combined opacity
  → generateElementWithCanvas()  get/create offscreen canvas
    → ShapeCache.generateElementShape()
      → _generateElementShape()  create RoughJS Drawable
      → cache in WeakMap
    → document.createElement("canvas")  offscreen canvas
    → drawElementOnCanvas()
      → rc.draw(shape)           RoughJS draws to offscreen canvas
    → cache offscreen canvas in WeakMap
  → drawElementFromCanvas()      blit offscreen canvas to main canvas
```

### Freedraw

Same pipeline but shapes are a mix of RoughJS `Drawable` objects and raw SVG path strings:

```typescript
for (const shape of shapes) {
  if (typeof shape === "string") {
    context.fill(new Path2D(shape));   // direct SVG path
  } else {
    rc.draw(shape);                    // RoughJS shape
  }
}
```

### Arrows and lines

An array of `Drawable[]` — the shaft plus each arrowhead are separate shapes:

```typescript
ShapeCache.generateElementShape(element).forEach(shape => {
  rc.draw(shape);
});
```

### Text

No RoughJS involvement — drawn directly with canvas text API:

```typescript
context.font = getFontString(element);
context.fillStyle = element.strokeColor;
for (const line of lines) {
  context.fillText(line, horizontalOffset, verticalOffset);
}
```

### Images

Direct `drawImage` with optional crop:

```typescript
context.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, width, height);
```

When in crop editing mode, the uncropped image is also rendered at 10% opacity behind the cropped version.

### Frames

Outline only — no RoughJS shapes:

```typescript
context.strokeStyle = frameColor;  // black in light, green for magic frames
context.roundRect(0, 0, element.width, element.height, FRAME_STYLE.radius);
context.stroke();
```

---

## RoughJS Integration

RoughJS provides the hand-drawn aesthetic. Every shape element gets a `Drawable` generated by `RoughGenerator` and cached.

### Shape generation

`ShapeCache.generateElementShape()` (`packages/element/src/shape.ts:81`):

```
element → generateRoughOptions() → RoughGenerator.rectangle/ellipse/path() → Drawable
                                          ↓
                                    cached in WeakMap
                                    keyed by element + theme
```

### Rough options

`generateRoughOptions()` (`shape.ts:193`) translates element properties to RoughJS config:

| Element property | RoughJS option | Notes |
|-----------------|----------------|-------|
| `element.seed` | `seed` | Deterministic wobble — same seed = same hand-drawn randomness |
| `element.roughness` | `roughness` | Scaled down for small elements (< 50px) via `adjustRoughness()` |
| `element.strokeWidth` | `strokeWidth` | Adjusted for dashed/dotted styles |
| `element.strokeStyle` | `strokeLineDash` | Solid, dashed `[12, 8]`, dotted `[3, 6]` patterns |
| `element.fillStyle` | `fillStyle` | `"hachure"`, `"cross-hatch"`, or `"solid"` |
| `element.backgroundColor` | `fill` | Only set when not `"transparent"` |
| `element.strokeColor` | `stroke` | Inverted in dark mode when `"#000000"` |

Roughness is automatically reduced for small elements:
```typescript
function adjustRoughness(element) {
  const maxSize = Math.max(element.width, element.height);
  if (maxSize < 50) {
    return roughness / (maxSize < 10 ? 3 : 2);  // capped at 2.5
  }
  return roughness;
}
```

---

## Caching Strategy

Two levels of caching avoid redundant work:

### Level 1: Shape Cache (RoughJS Drawables)

**Location:** `ShapeCache` class (`packages/element/src/shape.ts:81`)

```
ExcalidrawElement → WeakMap → { shape: Drawable, theme: string }
```

- Keyed by element reference + theme (light shapes differ from dark shapes)
- `WeakMap` — automatically garbage-collected when element is removed
- Bypassed during export (`renderConfig.isExporting`) to ensure full fidelity

### Level 2: Element Canvas Cache (offscreen canvases)

**Location:** `elementWithCanvasCache` WeakMap (`renderElement.ts:603`)

```
ExcalidrawElement → WeakMap → {
  canvas: HTMLCanvasElement,   // pre-rendered offscreen canvas
  theme, scale, zoomValue,     // invalidation keys
  angle, cropStore,
  boundTextVersion
}
```

- Each element is rendered once to an offscreen canvas
- Main canvas just calls `context.drawImage(cachedCanvas, ...)` — very fast
- Invalidated when zoom, theme, angle, crop, or bound text changes

### Canvas size limits

`cappedElementCanvasSize()` (`renderElement.ts:149`) enforces browser limits:

- Max dimension: 32767px
- Max area: ~16 million pixels (browser canvas limit)
- Padding varies by type: freedraw 12px, text half, arrows 40px, others 20px

---

## Coordinate System

### Scene coordinates → canvas pixels

Three transforms are applied in order:

```
1. Device pixel ratio     context.scale(dpr, dpr)
2. User zoom              context.scale(zoom.value, zoom.value)
3. Scroll offset          element positions offset by scrollX, scrollY
```

### Element rotation

Applied per-element around its center point:

```typescript
const cx = (x1 + x2) / 2;
const cy = (y1 + y2) / 2;
context.translate(cx, cy);
context.rotate(element.angle);
context.translate(-cx, -cy);
// draw element at (x, y)
```

### Frame clipping

Elements inside frames are clipped to frame bounds (`frameClip()`, `staticScene.ts:132`):

```typescript
context.translate(frame.x + scrollX, frame.y + scrollY);
context.beginPath();
context.roundRect(0, 0, frame.width, frame.height, radius);
context.clip();
context.translate(-(frame.x + scrollX), -(frame.y + scrollY));
```

---

## Grid Rendering

`strokeGrid()` (`renderer/staticScene.ts:56`):

- Grid cells calculated from scroll offset: `(scrollX % gridSize) - gridSize`
- **Bold lines** every `gridStep` cells, **regular lines** everywhere else
- Regular lines hidden when zoomed out below 10px (`normalizedGridSize < 10`)
- Dashed pattern: `[lineWidth * 3, spaceWidth + (lineWidth + spaceWidth)]`
- **Crisp line hack:** 0.5px offset applied only at exactly 100% zoom to align with pixel grid
- Colors: light mode `#e5e5e5` regular / `#dddddd` bold, inverted in dark mode

---

## Snap Line Rendering

`renderSnaps()` (`renderer/renderSnaps.ts`):

| Snap type | Visual |
|-----------|--------|
| **Point snap** | Line connecting snap points + cross marker at each point |
| **Pointer snap** | Cross at pointer + line to snap origin |
| **Gap snap** | Lines showing equal spacing between elements (4 indicator marks) |

- Color: `#ff6b6b` in light mode, `#ff0000` in dark mode
- Line width: zoom-aware at `1 / zoom.value` (constant screen-space width)
- Zen mode: shows only cross markers, not connecting lines

---

## Interactive Layer Details

### Selection rendering

| Selection state | Visual |
|----------------|--------|
| Single element | Solid outline + 8 transform handles (corners + edges) + rotation handle |
| Multiple elements | Dashed bounding box + corner handles |
| Locked elements | No transform handles shown |

Transform handles (`renderTransformHandles()`, `interactiveScene.ts:1325`):
- Corner handles: small rounded rectangles
- Rotation handle: circle above the selection
- Color: from `renderConfig.selectionColor` (CSS custom property `--color-selection`)

### Binding highlights

When an arrow approaches a bindable element, the target gets an outline:

```
renderBindingHighlightForBindableElement_simple()   interactiveScene.ts:223
```

- Color: `#6abffc` (light), `#035da1` (dark)
- Line width: clamped between 1.75px and 4px based on element stroke width
- Shape-specific: rectangle gets rounded rect, ellipse gets `context.ellipse()`, diamond gets segmented path

### Arrow focus points

When editing arrow endpoints (`interactiveScene.ts:1233`):
- Focus point circle on the surface of the bound element
- Dashed line from arrow endpoint to focus point
- White fill normally, purple when hovered

---

## Animation Loop

`AnimationController` (`renderer/animation.ts`):

```typescript
class AnimationController {
  private static animations = Map<string, { animation, lastTime, state }>();

  static start(key, animation) {
    state = animation({ deltaTime: 0, state: undefined });
    if (state) animations.set(key, { animation, lastTime: now, state });
    requestAnimationFrame(tick);
  }

  static tick() {
    for (const [key, entry] of animations) {
      const deltaTime = now - entry.lastTime;
      const nextState = entry.animation({ deltaTime, state: entry.state });
      if (!nextState) animations.delete(key);
      else update(entry);
    }
    if (animations.size > 0) requestAnimationFrame(tick);
  }
}
```

The interactive canvas registers itself as `"animateInteractiveScene"`. Each tick calls `renderInteractiveScene()`, which returns animation state (e.g., binding highlight fade-in runtime). When all animations complete (state returns null), the RAF loop stops.

---

## SVG Export Rendering

`renderStaticSvgScene()` (`renderer/staticSvgScene.ts`) mirrors the static canvas pipeline but outputs SVG DOM elements instead of canvas draw calls:

| Canvas | SVG equivalent |
|--------|---------------|
| `rc.draw(shape)` | `roughSVG.draw(shape)` → `<path>` elements |
| `context.drawImage(img)` | `<image href="...">` with optional `<clipPath>` for rounding |
| `context.fillText(text)` | `<text>` with `<tspan>` per line |
| `frameClip()` via context.clip() | `<defs><clipPath>` referenced by `clip-path="url(#id)"` |
| `context.globalAlpha` | `stroke-opacity` + `fill-opacity` attributes |

Additional SVG features:
- Elements with links are wrapped in `<a href="...">` tags
- Decimal precision capped via `MAX_DECIMALS_FOR_SVG_EXPORT`
- Optional image reuse via `<symbol>` elements (`reuseImages` flag)
- Dark mode filter applied to entire SVG group if enabled

---

## Data Flow Summary

```
ExcalidrawElement[]  (immutable data)
        │
        ▼
  ┌─────────────┐     scene change?     ┌──────────────────┐
  │ StaticCanvas │ ◄──── sceneNonce ────► │ _renderStaticScene│
  │  (bottom)    │                       │                  │
  └─────────────┘                       │  grid            │
                                        │  for each elem:  │
                                        │   ShapeCache     │
                                        │   → RoughJS      │
                                        │   → offscreen    │
                                        │     canvas       │
                                        │   → drawImage    │
                                        │  link icons      │
                                        │  embeddables     │
                                        └──────────────────┘

  ┌─────────────┐     every frame       ┌──────────────────────┐
  │ Interactive  │ ◄──── RAF loop ──────►│_renderInteractiveScene│
  │ Canvas (top) │                       │                      │
  └─────────────┘                       │  selection outlines   │
                                        │  transform handles    │
                                        │  binding highlights   │
                                        │  snap lines           │
                                        │  remote cursors       │
                                        │  scrollbars           │
                                        └──────────────────────┘

  ┌─────────────┐    newElement change   ┌──────────────────────┐
  │ NewElement   │ ◄──── setState ──────►│ renderNewElementScene │
  │ Canvas (mid) │                       │   renderElement()     │
  └─────────────┘                       └──────────────────────┘
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `packages/excalidraw/components/canvases/StaticCanvas.tsx` | Static layer React component |
| `packages/excalidraw/components/canvases/InteractiveCanvas.tsx` | Interactive layer React component + RAF |
| `packages/excalidraw/components/canvases/NewElementCanvas.tsx` | New element preview layer |
| `packages/excalidraw/renderer/staticScene.ts` | Static render pipeline (grid, elements, links) |
| `packages/excalidraw/renderer/interactiveScene.ts` | Interactive render pipeline (selection, handles, snaps) |
| `packages/excalidraw/renderer/renderNewElementScene.ts` | New element render pipeline |
| `packages/excalidraw/renderer/renderSnaps.ts` | Snap line drawing |
| `packages/excalidraw/renderer/staticSvgScene.ts` | SVG export rendering |
| `packages/excalidraw/renderer/animation.ts` | RAF animation controller |
| `packages/excalidraw/renderer/helpers.ts` | Canvas bootstrap (`bootstrapCanvas()`) |
| `packages/element/src/renderElement.ts` | Per-element rendering + canvas caching |
| `packages/element/src/shape.ts` | RoughJS shape generation + `ShapeCache` |
