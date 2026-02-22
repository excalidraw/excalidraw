# Excalidraw Repository Structure

Excalidraw is a virtual whiteboard for sketching hand-drawn-like diagrams. The codebase is a **Yarn workspaces monorepo** split into a set of publishable npm packages and a web application that consumes them.

## High-Level Layout

```
excalidraw/
├── packages/
│   ├── common/        # Shared constants, colors, keys, utilities
│   ├── math/          # Pure 2D geometry (points, vectors, curves, polygons)
│   ├── element/       # Element creation, mutation, binding, rendering, collision
│   ├── excalidraw/    # Main React library component (@excalidraw/excalidraw)
│   └── utils/         # Export helpers (canvas, SVG, PNG, clipboard)
├── excalidraw-app/    # excalidraw.com web application
├── examples/          # Integration examples (Next.js, browser script)
├── scripts/           # Build and release scripts
├── public/            # Static assets for the web app
├── dev-docs/          # Internal development documentation
└── .github/workflows/ # CI/CD pipelines
```

### Package Dependency Graph

```
excalidraw-app
    └── @excalidraw/excalidraw
            ├── @excalidraw/element
            │       ├── @excalidraw/math
            │       └── @excalidraw/common
            ├── @excalidraw/utils
            ├── @excalidraw/common
            └── @excalidraw/math
```

Packages use TypeScript path aliases so imports resolve directly to source during development — no intermediate build step needed.

---

## Packages

### `@excalidraw/common`

Low-level constants and utilities shared across every other package.

| File | Purpose |
|------|---------|
| `constants.ts` | MIME types, themes, default UI options, roundness presets |
| `colors.ts` | Color manipulation (wraps tinycolor2) |
| `keys.ts` | Keyboard key mappings |
| `utils.ts` | Debounce, throttle, UUID generation, general helpers |
| `emitter.ts` | Pub/sub event emitter |
| `random.ts` | Cryptographically secure random IDs |
| `binary-heap.ts` | Binary heap data structure |
| `promise-pool.ts` | Bounded concurrent promise execution |
| `font-metadata.ts` | Font metadata and subsetting configuration |

---

### `@excalidraw/math`

Pure 2D geometry library with no side effects. Used by the element package for bounds, collision, and routing calculations.

| File | Purpose |
|------|---------|
| `point.ts` | Distance, angle, interpolation |
| `vector.ts` | Dot/cross product, rotation |
| `line.ts` | Line intersection, distance-to-point |
| `segment.ts` | Line segment math |
| `rectangle.ts` | Bounds, overlap detection |
| `ellipse.ts` | Point-on-ellipse, bounding |
| `polygon.ts` | Point-in-polygon, centroid |
| `curve.ts` | Bezier and smooth curve math |
| `angle.ts` | Conversions between degrees/radians |
| `range.ts` | Numeric range utilities |

---

### `@excalidraw/element`

All element logic — creation, mutation, binding, rendering instructions, and collision detection. This is the core geometric engine.

**Core:**

| File | Purpose |
|------|---------|
| `types.ts` | `ExcalidrawElement` union type and all subtypes |
| `newElement.ts` | Factory functions for creating elements with defaults |
| `mutateElement.ts` | Immutable-style mutation helpers + version bumping |
| `typeChecks.ts` | Type guards (`isLinearElement`, `isBindableElement`, etc.) |
| `Scene.ts` | Scene container with change tracking |

**Geometry & Positioning:**

| File | Purpose |
|------|---------|
| `bounds.ts` | Bounding box calculations for every element type |
| `collision.ts` | Hit-testing and collision detection |
| `distance.ts` | Distance between elements |
| `align.ts` | Alignment operations (center, distribute) |
| `shape.ts` | Shape-specific geometry |

**Advanced Features:**

| File | Purpose |
|------|---------|
| `binding.ts` | Arrow-to-element binding and resolution |
| `elbowArrow.ts` | Orthogonal/elbow arrow routing algorithm |
| `linearElementEditor.ts` | Point editing for arrows and lines |
| `textElement.ts` | Text wrapping, measurement, editing state |
| `textWrapping.ts` | Text wrapping algorithms |
| `frame.ts` | Frame container logic |
| `embeddable.ts` | Embedded content (iframes, videos) |
| `groups.ts` | Multi-select grouping |
| `flowchart.ts` | Flowchart detection and suggestions |

**Rendering & Interaction:**

| File | Purpose |
|------|---------|
| `renderElement.ts` | Per-element rendering instructions for the canvas |
| `transformHandles.ts` | Resize/rotate handle placement |
| `dragElements.ts` | Drag operation logic |
| `resizeElements.ts` | Resize operation logic |
| `cropElement.ts` | Image cropping |
| `zindex.ts` | Z-ordering / layering |
| `fractionalIndex.ts` | Fractional indexing for collaborative z-ordering |
| `duplicate.ts` | Element duplication |

---

### `@excalidraw/excalidraw`

The main React library. This is what consumers install from npm. It exports the `<Excalidraw>` component, imperative API, and supporting utilities.

**Component Hierarchy:**

```
<Excalidraw>               (index.tsx — React.memo with custom comparison)
  └── EditorJotaiProvider  (scoped Jotai atom store)
       └── InitializeApp   (locale + theme setup)
            └── App.tsx    (main editor — handles all interactions)
                 ├── Canvas layers (static, interactive, new-element preview)
                 ├── Toolbar / Actions
                 ├── Sidebar
                 └── Dialogs, menus, popovers
```

**Key Subdirectories:**

| Directory | Purpose |
|-----------|---------|
| `components/` | All React UI — App.tsx, Sidebar, ColorPicker, FontPicker, CommandPalette, welcome screen, etc. |
| `actions/` | ~30 action files — one per operation (clipboard, align, group, flip, export, history, etc.) |
| `data/` | Persistence — JSON serialization, gzip binary format, schema migrations, conflict reconciliation, encryption |
| `renderer/` | Canvas rendering — static scene, interactive scene, SVG export, snap lines, animations |
| `scene/` | Scene graph utilities and export helpers |
| `hooks/` | React hooks (useExcalidrawAppState, useCallbackRefState, etc.) |
| `context/` | React context providers |
| `fonts/` | 13 font families (Virgil, Cascadia, Comic Shanns, Excalifont, etc.) |
| `subset/` | Font subsetting via HarfBuzz WASM + WOFF2 compression |
| `lasso/` | Lasso selection tool logic |
| `eraser/` | Eraser tool logic |
| `wysiwyg/` | Rich text editing |
| `css/` | SCSS stylesheets |
| `locales/` | 30+ language translation files |
| `tests/` | Test suites and fixtures |

**State Management:**

- **Jotai** atoms via a scoped store in `editor-jotai.ts` (isolated from app-level atoms)
- `AppState` — all non-element UI state: zoom, scroll offset, active tool, selection, collaboration flags
- Element state — a separate array of `ExcalidrawElement` objects, treated as immutable
- History — undo/redo via `history.ts`

**Public API (key exports from `index.tsx`):**

- `<Excalidraw>` component with props: `initialData`, `onChange`, `excalidrawAPI`, `isCollaborating`, `viewModeEnabled`, `UIOptions`, render slots
- Imperative API: `getElements()`, `setElements()`, `getAppState()`, `setAppState()`, `getFiles()`, `addFiles()`, `scrollToContent()`, `exportToBlob()`, `exportToSvg()`
- Utilities: `mutateElement`, `restoreElements`, `loadFromBlob`, `serializeAsJSON`, `exportToCanvas`, `FONT_FAMILY`, `THEME`, `MIME_TYPES`

---

### `@excalidraw/utils`

Export utilities for generating canvas, SVG, and PNG output. Uses RoughJS for hand-drawn rendering.

| File | Purpose |
|------|---------|
| `export.ts` | Canvas/SVG/PNG/clipboard export pipeline |
| `bbox.ts` | Bounding box calculations |
| `withinBounds.ts` | Overlap detection |
| `shape.ts` | Shape-specific rendering helpers |
| `test-utils.ts` | Shared test utilities |

---

## excalidraw-app

The excalidraw.com web application. Built on top of the library and adds collaboration, persistence, PWA support, and error tracking.

| File/Directory | Purpose |
|----------------|---------|
| `App.tsx` | Main app container — integrates collaboration, persistence, UI extensions |
| `index.tsx` | React root entry point |
| `app-jotai.ts` | App-level Jotai atoms (separate from library atoms) |
| `app_constants.ts` | Storage keys, Firebase prefixes |
| `sentry.ts` | Sentry error tracking |
| `collab/` | Real-time collaboration — Socket.io + Firebase Realtime Database |
| `collab/Collab.tsx` | Main collaboration component |
| `collab/Portal.tsx` | WebSocket abstraction layer |
| `data/` | App-level persistence — FileManager, Firebase, LocalData, cross-tab sync |
| `data/firebase.ts` | Firebase Realtime Database integration |
| `data/tabSync.ts` | Cross-tab synchronization |
| `components/` | App-specific UI (footer, sidebar, language picker) |
| `share/` | Shareable link generation |
| `vite.config.mts` | Vite build config with PWA, HTML minification, sitemap |

---

## Build System

| Tool | Scope | Notes |
|------|-------|-------|
| **esbuild** | Package builds | ESM output in `dist/dev/` and `dist/prod/`, code splitting for excalidraw package |
| **Vite** | Dev server + app build | Port 3000, PWA with service worker, runtime caching |
| **TypeScript 5.9** | Type checking | Strict mode, declarations via `tsc --emitDeclarationOnly` |
| **Vitest** | Testing | jsdom environment, 60% line / 70% branch coverage thresholds |

**Key Commands:**

```bash
yarn start              # Dev server (excalidraw-app)
yarn build:packages     # Build all packages with esbuild
yarn build:app          # Build excalidraw-app with Vite
yarn test:typecheck     # TypeScript type checking
yarn test:update        # Run all tests (with snapshot updates)
yarn fix                # Auto-fix formatting and linting issues
```

---

## Testing

- **Framework:** Vitest 3.x with jsdom environment
- **Setup:** `setupTests.ts` — canvas mocks, fake-indexeddb, FontFace polyfills, testing-library matchers
- **Pattern:** `*.test.ts(x)` files co-located throughout packages
- **Coverage:** Enforced thresholds (60% lines, 70% branches, 63% functions)

---

## CI/CD (GitHub Actions)

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `test.yml` | Push to master | Runs full test suite |
| `lint.yml` | Pull request | Prettier, ESLint, TypeScript checks |
| `test-coverage-pr.yml` | Pull request | Coverage report generation |
| `size-limit.yml` | Pull request | Bundle size monitoring |
| `semantic-pr-title.yml` | Pull request | Enforces conventional commit PR titles |
| `locales-coverage.yml` | Pull request | Translation completeness checks |
| `autorelease-excalidraw.yml` | Tag push | Publishes package to npm |
| `publish-docker.yml` | Release | Docker image publishing |

---

## Rendering Architecture

All drawing happens on **HTML Canvas** — shapes are not DOM elements.

```
User Interaction
    ↓
Action handler (actions/*.tsx)
    ↓
State update (AppState + Element array)
    ↓
onChange callback (for external consumers)
    ↓
Canvas re-render (renderer/)
    ├── staticScene.ts     — background elements
    ├── interactiveScene.ts — selection, handles, hover states
    └── renderNewElementScene.ts — element being drawn
    ↓
Visual output (RoughJS for hand-drawn aesthetic)
```

---

## Element Model

Every object on the canvas is an `ExcalidrawElement` — a plain, immutable-style object.

**Common fields:** `id`, `type`, `x`, `y`, `width`, `height`, `angle`, `strokeColor`, `backgroundColor`, `fillStyle`, `strokeWidth`, `opacity`, `roundness`, `version`, `versionNonce`, `index` (fractional z-order), `groupIds`, `frameId`, `boundElements`, `locked`, `isDeleted`

**Element types:** `rectangle`, `diamond`, `ellipse`, `arrow`, `line`, `freedraw`, `text`, `image`, `frame`, `embeddable`, `iframe`, `magic_frame`, `selection`

**Collaboration:** Elements carry a sequential `version` and random `versionNonce` used for conflict-free synchronization. Fractional `index` values maintain z-ordering across concurrent edits.

---

## Examples

| Example | Stack | Purpose |
|---------|-------|---------|
| `examples/with-nextjs/` | Next.js 14 + React 19 | Server-rendered integration |
| `examples/with-script-in-browser/` | Vite + plain HTML | Direct script-tag usage |

---

## Key External Dependencies

| Dependency | Purpose |
|------------|---------|
| React 17–19 | UI framework (peer dependency) |
| Jotai | Atom-based state management |
| RoughJS | Hand-drawn rendering aesthetic |
| perfect-freehand | Smooth freehand drawing curves |
| pako | gzip compression for binary format |
| Firebase | Realtime Database + Auth (app only) |
| Socket.io | WebSocket communication (app only) |
| tinycolor2 | Color manipulation |
| browser-fs-access | File System Access API |
| fractional-indexing | Z-order management for collaboration |
