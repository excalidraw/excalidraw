# CLAUDE.md

Excalidraw is a **Yarn-workspaces monorepo** split between a publishable whiteboard library and the production web app. The npm library `@excalidraw/excalidraw` (in `packages/excalidraw/`) exposes the embeddable `<Excalidraw>` React component plus an imperative `ExcalidrawImperativeAPI`; `excalidraw-app/` is the excalidraw.com application shell built on top of it. Several lower-level packages (`packages/element/`, `packages/math/`, `packages/common/`, `packages/utils/`, `packages/fractional-indexing/`) supply the canvas engine, geometry, and shared infrastructure.

## How it works

The core React component renders the canvas and delegates all element state to `@excalidraw/element`: the `Scene` class (`packages/element/src/index.ts` barrel) is the single authoritative store for the live element list, and `scene.mutateElement()` is the correct call site for changing an element and triggering a re-render. Geometry (hit testing, intersections, transforms) goes through `@excalidraw/math`, which uses branded coordinate types (GlobalPoint vs LocalPoint, Radians vs Degrees) for space safety. Consumers supply `initialData`, receive changes via `onChange(elements, appState, files)` or fine-grained deltas via `onIncrement`, and drive the canvas with `api.updateScene()` / `api.applyDeltas()`. Collaboration is transport-agnostic at the library layer: the host sends deltas from `onIncrement` and applies remote ones via `api.applyDeltas()`; `excalidraw-app/` is the concrete host, wiring Socket.IO + Firebase with end-to-end AES-GCM encryption.

## Build / test / run

- `yarn build:packages` (repo root) — builds the `@excalidraw/*` packages; required before running either example.
- Examples: `examples/with-script-in-browser` runs on port 3001; `examples/with-nextjs` on port 3005.
- Dev docs are a **separate** project (own `package.json`/lockfile, not in the monorepo): run `yarn start` from inside `dev-docs/` (port 3003).
- `yarn test:typecheck` (TypeScript checking), `yarn test:update` (run tests with snapshot updates), and `yarn fix` (auto-fix lint/format) are the prior team's documented commands — verify against `package.json` before relying on them.

Package builds use esbuild (dev + prod ESM variants); the app uses Vite. Internal packages are wired via path aliases.

## Consumer / usage surface

- Library entry points: `<Excalidraw>` component, `ExcalidrawImperativeAPI` (via `onExcalidrawAPI` prop or `useExcalidrawAPI()`), and export/serialization helpers (`exportToCanvas`, `exportToSvg`, `exportToBlob`, `serializeAsJSON`, `loadFromBlob`).
- `@excalidraw/utils` is the public npm export surface for embedders (`exportToCanvas`, `exportToBlob`, `exportToSvg`, `exportToClipboard`, plus geometric collision/shape helpers); `@excalidraw/math` is also installable standalone.
- `examples/with-script-in-browser/components/ExampleApp.tsx` is the canonical end-to-end demonstration of the full public API (imperative API, exports, custom tools, slot components, collaborators); the NextJS example imports it directly.

## Codebase map

- **excalidraw-core** (`packages/excalidraw/`) — the embeddable React whiteboard editor published as `@excalidraw/excalidraw`.
- **element-system** (`packages/element/`) — canvas element types, the `Scene` store, mutation/rendering pipeline, binding, text layout, elbow-arrow routing, and undo/redo deltas.
- **math** (`packages/math/`) — pure 2D geometry/vector math (points, curves, intersections, transforms) with branded coordinate types.
- **shared-libs** (`packages/common/`, `packages/utils/`, `packages/fractional-indexing/`) — cross-cutting constants/utilities/infra (`@excalidraw/common`), the public embedding export surface (`@excalidraw/utils`), and lexicographic z-order keys (`@excalidraw/fractional-indexing`).
- **web-app** (`excalidraw-app/`) — the excalidraw.com PWA: real-time collaboration, local/IndexedDB persistence, encrypted share links, Excalidraw+ integration, and AI diagram features. Self-contained, not importable.
- **examples** (`examples/`) — runnable embedding demos (browser-script Vite app, Next.js app).
- **dev-docs** (`dev-docs/`) — Docusaurus site powering docs.excalidraw.com, with live editable demos.
- **ci-cd** (`.github/`) — GitHub Actions: PR checks, post-merge tests, and release workflows (npm, Docker, Sentry, Crowdin l10n).
- **build-tooling** (`scripts/`) — esbuild package builds, WASM/font codegen, the npm release orchestrator, version stamping, and i18n coverage; invoked via yarn/CI only.
- **firebase-project** (`firebase-project/`) — Firebase config for collaboration/share-link persistence (see below).
- **public** (`public/`) — static assets served by the app build (see below).

Flow: a user in the `excalidraw-app/` shell interacts with the `<Excalidraw>` core component → edits flow into the `@excalidraw/element` `Scene` store via `mutateElement` → geometry resolves through `@excalidraw/math` → the canvas re-renders; collaboration deltas surface via `onIncrement` and are sent/applied by the app over Socket.IO + Firebase.

## Firebase project

`firebase-project/` is a standalone Firebase config (not a Node package), deployed with the Firebase CLI independently of the Yarn build. It owns `firebase-project/firestore.rules` (read/write permitted but `list` hard-blocked — intentional, to stop users enumerating each other's drawings), `firebase-project/storage.rules` (open get/write scoped to room and share-link path shapes), and `firebase-project/firestore.indexes.json` (no custom indexes). `.firebaserc` points at project ID `excalidraw-room-persistence`.

## Public

`public/` holds assets served verbatim by the Vite/PWA build: the hand-drawn-style fonts that define Excalidraw's identity (`public/Virgil.woff2`, `public/Cascadia.woff2`, `public/Assistant-Regular.woff2`), the full PWA icon set, and social/OG images. `public/_headers` sets `Access-Control-Allow-Origin: *` globally for cross-origin font/asset loading. `public/service-worker.js` is a one-time migration shim that unregisters itself so CRA-era service workers don't block the Vite PWA (its `sw.js`); removable once migration completes. `public/robots.txt` allows Twitterbot/facebookexternalhit for link previews while blocking general indexing of drawing URLs.

## Documentation

- `README.md` — repository overview and features.
- `CONTRIBUTING.md` — contributor guide.
- `.github/copilot-instructions.md` — project coding standards.

Per-package detail lives in each package's own README and area CLAUDE.md.