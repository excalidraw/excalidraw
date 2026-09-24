## Element System

`@excalidraw/element` is the canonical home for all canvas primitives: their type definitions, creation factories, mutation rules, geometry helpers, rendering pipeline, and higher-level operations like binding, grouping, and z-ordering. Everything that touches a shape's data or how it appears on screen flows through this package. See `packages/element/README.md` for install instructions.

### Element Type Hierarchy

All element types share `_ExcalidrawElementBase` (defined in `packages/element/src/types.ts`), which carries:

- **Identity**: `id` (random id — `nanoid` in prod, deterministic `id0`/`id1`… in tests), `seed` (integer for deterministic roughjs noise)
- **Geometry**: `x`, `y`, `width`, `height`, `angle` (as branded `Radians` from `@excalidraw/math`)
- **Style**: `strokeColor`, `backgroundColor`, `fillStyle` (`hachure | cross-hatch | solid | zigzag`), `strokeWidth`, `strokeStyle`, `roundness`, `roughness`, `opacity`
- **Versioning for collaboration**: `version` (monotonically incremented integer), `versionNonce` (random integer for tie-breaking), `updated` (epoch ms timestamp)
- **Ordering**: `index` (`FractionalIndex | null`) — fractional string used for conflict-free ordering in multiplayer
- **Containment**: `groupIds` (ordered deepest-to-shallowest), `frameId`, `boundElements` (arrows and text labels anchored to this element)
- **Soft delete**: `isDeleted: boolean` — elements are never removed from the scene array; deletion sets this flag

Concrete subtypes:

| TypeScript type | `type` field | Notable extra fields |
|---|---|---|
| `ExcalidrawGenericElement` | `rectangle \| diamond \| ellipse \| selection` | — |
| `ExcalidrawTextElement` | `text` | `fontSize`, `fontFamily`, `text`, `originalText`, `textAlign`, `verticalAlign`, `containerId`, `autoResize`, `lineHeight` |
| `ExcalidrawLinearElement` | `line \| arrow` | `points: LocalPoint[]`, `startBinding`, `endBinding`, `startArrowhead`, `endArrowhead` |
| `ExcalidrawArrowElement` | `arrow` | `elbowed: boolean` |
| `ExcalidrawElbowArrowElement` | `arrow` | `elbowed: true`, `fixedSegments`, `startIsSpecial`, `endIsSpecial` |
| `ExcalidrawFreeDrawElement` | `freedraw` | `points`, `pressures` (stylus), `simulatePressure` |
| `ExcalidrawImageElement` | `image` | `fileId`, `status` (`pending \| saved \| error`), `scale` (for axis flip), `crop` |
| `ExcalidrawFrameElement` | `frame` | `name` |
| `ExcalidrawMagicFrameElement` | `magicframe` | `name` |
| `ExcalidrawIframeElement` | `iframe` | `customData.generationData` (AI generation status) |
| `ExcalidrawEmbeddableElement` | `embeddable` | — |

**Map types**: The codebase uses four Map types — `ElementsMap` (a plain `Map`), plus three branded variants: `NonDeletedElementsMap`, `SceneElementsMap` (all elements including deleted, always ordered by fractional index), and `NonDeletedSceneElementsMap`. The brands prevent accidentally substituting a subset map where the full scene map is required.

### Creating Elements

Factory functions in `packages/element/src/newElement.ts` are the only sanctioned way to create elements:

- `newElement(opts)` — generic (rectangle/diamond/ellipse)
- `newTextElement(opts)` — measures text and computes initial dimensions immediately
- `newLinearElement(opts)` — line or arrow; `polygon: true` enables closed polygon mode for lines
- `newArrowElement(opts)` — `opts.elbowed: true` produces an `ExcalidrawElbowArrowElement` with an empty `fixedSegments` array
- `newFreeDrawElement(opts)` — includes `pressures` array for pen pressure
- `newImageElement(opts)` — always starts with `status: "pending"` and `strokeColor: "transparent"`
- `newFrameElement`, `newMagicFrameElement`, `newEmbeddableElement`, `newIframeElement`

All converge on `_newElementBase`, which assigns a random `id`, random `seed`, `version: 1`, `versionNonce: 0`, `isDeleted: false`, and the current timestamp as `updated`. The package logs a console error (not throws) when coordinates exceed ±1e6.

### Mutation Rules

Two mutation functions in `packages/element/src/mutateElement.ts`:

**`mutateElement(element, elementsMap, updates, options)`** — mutates the element object in place. It:
1. Short-circuits if no values actually changed (with special deep-equality checks for `points` and `scale`)
2. For elbow arrows: automatically recalculates the route via `updateElbowArrowPoints` when `points` or `fixedSegments` change
3. For linear elements: recalculates `width`/`height` from the points bounding box
4. Deletes the element's `ShapeCache` entry when geometry changes (width/height/points/fileId)
5. Bumps `version`, randomizes `versionNonce`, updates `updated` timestamp

**WARNING**: `mutateElement` alone does NOT trigger a React re-render. To trigger UI update, use `scene.mutateElement(...)` (which calls `triggerUpdate()` when the version actually changed) or the imperative API.

**`newElementWith(element, updates)`** — immutable version: returns a spread copy with bumped versioning. Used for collaboration reconciliation and history entries where immutability is required.

**`bumpVersion(element, version?)`** — lowest-level: just increments `version`, randomizes `versionNonce`, updates timestamp. Used when the element itself didn't logically change but other participants need to see it as updated.

### Scene

`packages/element/src/Scene.ts` (the `Scene` class) is the live state container:

- Keeps parallel data structures: an ordered `elements` array (the authoritative order), a `SceneElementsMap`, a `nonDeletedElements` array, and a `NonDeletedSceneElementsMap`
- `replaceAllElements(nextElements)` — the only way to bulk-update; calls `syncInvalidIndices` so fractional indices are always valid, rebuilds all maps, separates frames, triggers update
- `mutateElement(element, updates, options)` — wraps the low-level `mutateElement` and calls `triggerUpdate()` only when the version actually changed and `options.informMutation` is true
- `insertElementsAtIndex(elements, index)` — low-level insertion; prefer `app.insertNewElements()` from outside the package
- `mapElements(iteratee)` — efficient batch update: iterates current elements, only calls `replaceAllElements` if any element reference changed
- `getSelectedElements(opts)` — cached; cache is keyed on `selectedElementIds` reference + option flags
- `triggerUpdate()` — regenerates `sceneNonce` (used as a renderer cache key) and fires all registered callbacks
- `onUpdate(cb)` — subscribe to scene changes; returns an unsubscribe function

### Fractional Index Ordering

Elements carry a `FractionalIndex` string (from the `fractional-indexing` library) in their `index` field. This enables efficient conflict-free ordering during multiplayer reconciliation and undo/redo, without needing full array re-sorts.

Key invariants maintained in `packages/element/src/fractionalIndex.ts`:

- The array order and fractional indices must always be in sync
- `syncMovedIndices(elements, movedMap)` — after an in-array reorder (z-index moves), updates only the moved elements' indices to fit between their new neighbors
- `syncInvalidIndices(elements)` — heals elements with `null` or out-of-order indices; called by `replaceAllElements` on every scene update
- `validateFractionalIndices` — throws in dev/test environments, logs in production; throttled to once per minute and only checked if `window.DEBUG_FRACTIONAL_INDICES` is set in production
- `orderByFractionalIndex(elements)` — sort by fractional index; used during history application and reconciliation, NOT during normal rendering (array order is the cache)

Bound text elements must sort immediately after their container (`text.index > container.index`); `validateFractionalIndices` enforces this with `includeBoundTextValidation`.

### Shape Cache & Rendering

`packages/element/src/shape.ts` maintains the `ShapeCache` (a WeakMap-backed cache from element to roughjs `Drawable`). Shapes are generated lazily and reused until a geometry change clears the cache entry. The package uses roughjs for the sketchy/hand-drawn appearance; the `seed` field on each element ensures the roughjs noise is deterministic across renders and collaborators.

`packages/element/src/renderElement.ts` renders individual elements to Canvas 2D or an off-screen canvas (for caching). It handles:
- Rotation (saves/restores canvas transform around element center)
- Opacity
- Dark mode filter (`DARK_THEME_FILTER` constant applied via canvas filter)
- Frame clipping (elements inside frames are clipped to frame bounds)
- Pending image placeholder
- Text rendering (line by line, respecting `lineHeight` and `verticalAlign`)
- ArrowHead rendering via geometry from `bounds.ts`

### Binding System

Arrows and lines can bind their endpoints to "bindable" elements (rectangles, diamonds, ellipses, text, images, iframe, embeddable, frame, magicframe). Binding is defined as a `FixedPointBinding` on `startBinding`/`endBinding`:

```
{ elementId, fixedPoint: [ratioX, ratioY], mode: "inside" | "orbit" | "skip" }
```

The `fixedPoint` ratios are 0–1 fractions of the target element's width/height, describing where on the element the arrow endpoint is anchored. `mode: "orbit"` keeps the arrow outside the shape boundary; `mode: "inside"` allows the arrowhead to reach all the way to the fixed point inside the shape.

`packages/element/src/binding.ts` provides:
- `updateBoundElements(element, scene, opts)` — called after any bindable element moves/resizes; repositions all arrows bound to it
- `snapToMid(...)` — snaps an arrow endpoint to a bindable element's edge midpoints

(Hit-testing for binding candidates during drag lives in `collision.ts` — see Other Notable Modules.)

### Elbow Arrow Routing

`packages/element/src/elbowArrow.ts` implements orthogonal (axis-aligned) routing for elbow arrows via A\* pathfinding on a sparse grid derived from element bounding boxes. The algorithm avoids routing through other elements. Key behaviors:

- When segments are not fixed, routing is fully automatic based on the `Heading` of exit/entry points on bound elements
- `fixedSegments` lets users lock specific path segments in place; the router adjusts only the unfixed portions
- `startIsSpecial`/`endIsSpecial` are internal markers used when a binding side changes orientation (horizontal↔vertical) while fixed segments are present — they temporarily "hide" the first or last segment without losing the points array data

`packages/element/src/heading.ts` defines the cardinal `Heading` type (`[1,0] | [0,1] | [-1,0] | [0,-1]`) used throughout the binding and elbow routing systems.

### Text Bound to Containers

A text element can be bound to a container (rectangle, diamond, ellipse, or arrow) via `containerId`. This creates a two-way link: the container's `boundElements` array includes `{ id: textId, type: "text" }`.

- `textElement.autoResize = true` (default): element width expands to fit content; text does not wrap
- `textElement.autoResize = false`: text wraps to fill the available container width
- `wrapText` in `packages/element/src/textWrapping.ts` performs line-breaking using canvas `measureText`
- `redrawTextBoundingBox` in `packages/element/src/textElement.ts` recomputes text element dimensions and position after any change to text content or container geometry
- Arrow labels: text bound to an arrow has `angle` forced to 0 and is positioned at the arrow midpoint

### Store & Undo/Redo Infrastructure

`packages/element/src/store.ts` defines the `Store` class that observes every scene commit and produces typed increments for the undo/redo stack and collaboration:

- `CaptureUpdateAction.IMMEDIATELY` — captured immediately into undo stack (normal edits)
- `CaptureUpdateAction.NEVER` — never recorded (remote updates, scene initialization)
- `CaptureUpdateAction.EVENTUALLY` — not captured immediately; folded into the next IMMEDIATELY commit (async operations like freedraw, text entry, image drop)

`packages/element/src/delta.ts` defines `Delta<T>` as `{ deleted: Partial<T>, inserted: Partial<T> }`. `ElementsDelta` and `AppStateDelta` extend this for element-level and app-state-level changes respectively. A `StoreDelta` aggregates both for a single undo step.

### Groups and Frames

**Groups**: There is no group object. Membership is expressed as the `groupIds: readonly GroupId[]` array on each element, ordered deepest-to-shallowest. A selection in the UI selects the entire top-level group. `packages/element/src/groups.ts` contains helpers like `getElementsInGroup`, `getSelectedElementsByGroup`, `selectGroup`.

**Frames**: `ExcalidrawFrameElement` and `ExcalidrawMagicFrameElement` are regular elements whose `id` is referenced by other elements' `frameId` field. `packages/element/src/frame.ts` provides `getContainingFrame`, `getFrameChildren`, `elementsAreInFrameBounds`, `elementOverlapsWithFrame`. When elements are rendered inside a frame, they are clipped to the frame boundary.

### Other Notable Modules

- `packages/element/src/bounds.ts` — `getElementAbsoluteCoords` (rotated bounding box corners), `getElementBounds` (includes stroke/arrowhead padding), `getCommonBounds`, `aabbForElement` (axis-aligned), `getDiamondPoints`, `getArrowheadPoints`
- `packages/element/src/collision.ts` — `isPointInElement`, `intersectElementWithLineSegment`, `getHoveredElementForBinding`, `shouldTestInside`; used for hit testing during pointer events
- `packages/element/src/resizeElements.ts` — multi-element resize while preserving relative positions, handles text reflow and binding updates
- `packages/element/src/align.ts` / `packages/element/src/distribute.ts` — align/distribute operations; both call `updateBoundElements` after repositioning
- `packages/element/src/zindex.ts` — send-to-back/bring-to-front; moves contiguous groups together; respects frame boundaries
- `packages/element/src/duplicate.ts` — duplicates elements preserving group/frame membership and re-binding arrows to duplicated endpoints
- `packages/element/src/transform.ts` — bulk-transforms (paste, import from clipboard) a set of elements into the scene; creates a fresh `Scene` instance, resolves binding, and syncs fractional indices
- `packages/element/src/flowchart.ts` — creates a new shape and an elbow arrow connecting it to an existing flowchart node when the user presses an arrow key with a flowchart-capable element selected
- `packages/element/src/cropElement.ts` — computes the `ImageCrop` rectangle when the user drags a crop handle on an image; preserves aspect ratio when requested
- `packages/element/src/typeChecks.ts` — runtime type guard functions (`isTextElement`, `isArrowElement`, `isElbowArrow`, `isBindableElement`, `isBoundToContainer`, `isFrameLikeElement`, etc.); used throughout the codebase to narrow the union type
- `packages/element/src/linearElementEditor.ts` — `LinearElementEditor` class that manages the editing session for a selected line/arrow (point dragging, midpoint insertion, segment deletion, snapping to grid)