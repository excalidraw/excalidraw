## @excalidraw/common

The `@excalidraw/common` package (`packages/common/`) is the foundation layer imported by every other package and the app. It publishes shared constants, utility functions, TypeScript type helpers, and internal infrastructure (event bus, observable store, data structures).

### Constants (`constants.ts`)

A single large file that is the authoritative source for all cross-cutting numeric and string constants:

- **Element defaults** — `DEFAULT_FONT_SIZE`, `DEFAULT_FONT_FAMILY` (Excalifont), `DEFAULT_ELEMENT_PROPS` (stroke/fill/roughness/opacity)
- **Font system** — `FONT_FAMILY` map (name → integer id; id 4 is intentionally unused, formerly Assistant/Obsidian), `FONT_FAMILY_FALLBACKS`, CJK/emoji/generic fallback chains, `FONT_SIZES`
- **Roundness algorithms** — `ROUNDNESS` enum: `LEGACY` (1), `PROPORTIONAL_RADIUS` (2), `ADAPTIVE_RADIUS` (3, default for rectangles using a fixed 32 px radius)
- **Tools** — `TOOL_TYPE` object used to identify tools by string without magic strings in call sites
- **UI** — `CLASSES`, `CURSOR_TYPE`, `POINTER_BUTTON`, `POINTER_EVENTS`, frame styling via `FRAME_STYLE`
- **MIME types** — `MIME_TYPES`, `STRING_MIME_TYPES`, `IMAGE_MIME_TYPES`, `ALLOWED_PASTE_MIME_TYPES`
- **Events** — `EVENT` enum for all DOM event names including custom `excalidraw-link` and `menu.itemSelect`
- **Export** — `EXPORT_IMAGE_TYPES`, `EXPORT_DATA_TYPES`, `VERSIONS` (`excalidraw: 2`, `excalidrawLibrary: 2`)
- **Timing constants** — `IDLE_THRESHOLD` (60 s), `ACTIVE_THRESHOLD` (3 s), `HYPERLINK_TOOLTIP_DELAY`, `ZOOM_STEP`, `MIN_ZOOM`/`MAX_ZOOM` (0.1–30)
- **Feature flag** — `getFeatureFlag`/`setFeatureFlag` backed by `localStorage` key `"excalidraw-feature-flags"`; currently the only flag is `COMPLEX_BINDINGS: false`

### Core Utilities (`utils.ts`)

Miscellaneous utilities that span the whole editor:

- **Coordinate transforms** — `viewportCoordsToSceneCoords` and `sceneCoordsToViewportCoords` handle zoom + scroll + canvas offset in both directions
- **Animation** — `debounce` (with `.flush()`/`.cancel()`), `throttleRAF` (executes once per animation frame with latest args), `easeToValuesRAF` (multi-value exponential ease-out animation via `requestAnimationFrame`)
- **Array helpers** — `arrayToMap`, `arrayToMapWithIndex`, `arrayToObject`, `arrayToList` (circular doubly-linked list), `findIndex`/`findLastIndex`, `mapFind`, `chunk`, `toIterable`/`toArray`, `reduceToCommonValue`
- **Branded types** — `toBrandedType`, `Unbrand`, `CombineBrands`, `HasBrand` — a zero-runtime branding system for compile-time type safety on coordinates, IDs, etc.
- **Assertions** — `assertNever` (exhaustive switch guard, soft mode available), `invariant`
- **Shallow equality** — `isShallowEqual` supports per-key comparator functions or an explicit key list; used heavily for React render memoization
- **Environment** — `isTestEnv`, `isDevEnv`, `isProdEnv`, `isRunningInIframe`, `getFrame`
- **DOM** — `addEventListener` (overloaded, returns unsubscribe fn; accepts falsy targets safely), `queryFocusableElements`, `getNearestScrollableContainer`, `selectNode`/`removeSelection`
- **Misc** — `isRTL` (detects right-to-left text direction for bidi support), `updateObject` (identity-preserving shallow merge), `memoize` (single-slot cache keyed by object entries), `resolvablePromise`, `promiseTry`, `getFontString`/`getFontFamilyString`

### Type Utilities (`utility-types.ts`)

Pure TypeScript helpers re-exported from `@excalidraw/common`: `Mutable`, `Merge`, `MarkOptional`, `MarkRequired`, `MarkNonNullable`, `MaybePromise`, `MakeBrand`, `SetLike`/`ReadonlySetLike`, `DTO` (strips methods), `MapEntry`, `SameType`.

### Event Infrastructure

**`Emitter<T>`** — minimal pub/sub: `on()` (returns unsubscribe), `once()`, `off()`, `trigger()`, `clear()`.

**`AppEventBus`** — typed event bus built on `Emitter` with two behaviors per event: *cardinality* (`once` / `many`) and *replay* (`none` / `last`). Events declared as `once + replay:last` are awaitable via `bus.on(name)` (returns a Promise). In non-production builds, emitting a `once` event twice throws. Used for app lifecycle signals.

**`VersionedSnapshotStore<T>`** — observable value store with monotonic version counter. `set()` rejects equal values (using custom or `Object.is` comparator). `pull(sinceVersion)` returns immediately if already stale, otherwise returns a Promise that resolves on the next change — enabling long-polling patterns. Subscribers receive `{ version, value }` snapshots.

### Data Structures

- **`BinaryHeap<T>`** — min-heap with `push`, `pop`, `remove`, `rescoreElement`; used by pathfinding (A* in elbow arrow routing)
- **`Queue`** — serial promise queue: jobs run one at a time in FIFO order
- **`PromisePool<T>`** — concurrent execution of n promises at a time, wrapping `es6-promise-pool`; preserves insertion-order results via index tuples

### Other Modules

- **`colors.ts`** — `COLOR_PALETTE` constant and dark-mode color transformation (CSS `invert(93%) hue-rotate(180deg)` reproduced in pure math for per-color mapping)
- **`font-metadata.ts`** — `FONT_METADATA` record: per-font `unitsPerEm`, `ascender`, `descender`, `lineHeight` for correct text measurement; also flags (`deprecated`, `private`, `local`, `fallback`)
- **`editorInterface.ts`** — `EditorInterface` type (formFactor, desktopUIMode, userAgent, isTouchScreen, canFitSidebar) plus breakpoint constants (`MQ_MAX_MOBILE = 599`, tablet up to 1180 px), device detection helpers (`isDarwin`, `isIOS`, `isFirefox`, etc.), `getFormFactor`, `deriveStylesPanelMode`. Desktop UI mode preference persisted under `"excalidraw.desktopUIMode"` in localStorage.
- **`keys.ts`** — `KEYS`/`CODES` constants plus `matchKey` which falls back from `event.key` to `event.code` for non-Latin keyboard layouts (Cyrillic, Hebrew, CJK etc.) so shortcuts work internationally
- **`url.ts`** — `normalizeLink` (sanitize + escape quotes) and `toValidURL` (makes relative URLs fully-qualified; returns `"about:blank"` on invalid input) via `@braintree/sanitize-url`
- **`bounds.ts`** — `Bounds` tuple type `[minX, minY, maxX, maxY]` and `isBounds` guard
- **`points.ts`** — `getSizeFromPoints`, `rescalePoints`, `getGridPoint` (snaps to grid)
- **`random.ts`** — `randomId` (nanoid in prod, deterministic `id0`, `id1`… in test env), `randomInteger`, `reseed` (seeded roughjs `Random`)
- **`debug.ts`** — `Debug` class: `logTime`/`logTimeAverage`/`logTimeWrap` for interval-based frame-budget profiling; `logChanged` for diffing object snapshots; auto-stops after 600 ms of inactivity

---

## @excalidraw/utils

The `@excalidraw/utils` package (`packages/utils/`) is the **public npm API surface** for embedding. External consumers import `exportToCanvas`, `exportToBlob`, `exportToSvg`, `exportToClipboard` from here rather than from `@excalidraw/excalidraw` directly. It also re-exports `elementsOverlappingBBox` and `getCommonBounds` from `@excalidraw/element` and `MIME_TYPES` from `@excalidraw/common`.

### Export Functions (`export.ts`)

All accept an `ExportOpts` base (`elements`, optional `appState`, `files`) plus function-specific overrides.

- **`exportToCanvas`** — restores elements/appState (via `restoreElements`/`restoreAppState`), then calls the internal `_exportToCanvas`. Supports `maxWidthOrHeight` (mutually exclusive with `getDimensions`) and `exportPadding`.
- **`exportToBlob`** — wraps `exportToCanvas` then `canvas.toBlob`. When `mimeType` is PNG and `exportEmbedScene` is set, encodes the scene JSON into PNG metadata chunks. JPEG forces `exportBackground: true`.
- **`exportToSvg`** — delegates to internal `_exportToSvg`; supports `skipInliningFonts` and `reuseImages` flags for performance.
- **`exportToClipboard`** — dispatches to the appropriate clipboard API based on `type: "png" | "svg" | "json"`.

### Geometric Shapes (`shape.ts`)

Defines **pure geometric shapes** independent of roughjs or element specifics:

- `GeometricShape` — discriminated union: `line` (LineSegment), `polygon`, `curve` (Bézier), `ellipse`, `polyline` (array of LineSegments), `polycurve` (array of Bézier curves)
- Converters from `ExcalidrawElement` → `GeometricShape`: `getPolygonShape` (rectangle, diamond, frame, image, text), `getEllipseShape`, `getCurveShape` (linear elements via roughjs ops), `getFreedrawShape`, `getClosedCurveShape`
- Collision helpers: `pointOnEllipse`, `pointInEllipse`, `segmentIntersectRectangleElement`, `getSelectionBoxShape`
- These shapes are used by hit-testing and lasso selection to avoid depending on rendered geometry.

See `packages/utils/README.md` for usage examples.

---

## @excalidraw/fractional-indexing

The `@excalidraw/fractional-indexing` package (`packages/fractional-indexing/`) provides **order keys for element z-ordering**. It is vendored from the `fractional-indexing` npm package (CC0 license), based on the [Observable notebook by dgreensp](https://observablehq.com/@dgreensp/implementing-fractional-indexing).

### Why Fractional Indexing

Excalidraw maintains canvas elements in a flat ordered array; their position in this array determines paint order (z-order). Naively, reordering requires renumbering all indices. Fractional indexing assigns each element a string key that sorts lexicographically, so inserting between two elements only requires generating one new key between the two neighbors — no other elements change.

### Key Format

Keys use `BASE_62_DIGITS` (`0–9A–Za–z`). A key consists of an **integer part** (whose length is determined by the head character — lowercase letters encode lengths 2–27, uppercase letters encode lengths 2–27 descending) followed by an optional **fractional part**. No trailing zeros are allowed in either part.

The key space is bounded: there is a largest and a smallest valid integer. `generateKeyBetween` throws if the space is exhausted.

### API

- **`generateKeyBetween(a, b)`** — returns a single key `k` such that `a < k < b` lexicographically. Either bound may be `null`/`undefined` (open-ended). Throws if `a >= b`.
- **`generateNKeysBetween(a, b, n)`** — returns `n` distinct sorted keys between `a` and `b`. Uses divide-and-conquer (picks a midpoint, recurses on both halves) to distribute keys evenly.
- **`validateOrderKey(key)`** — throws on invalid keys (wrong character set, trailing zeros, out-of-range integer head).
- **`BASE_62_DIGITS`** — the digit set constant; can be passed to functions for custom alphabets.