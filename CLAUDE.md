# CLAUDE.md

## Project Structure

Excalidraw is a **Yarn workspaces monorepo** with two main layers: a publishable React library and a web application that consumes it.

```
excalidraw/
├── packages/
│   ├── excalidraw/    # Main library (@excalidraw/excalidraw, v0.18.0) — published to npm
│   ├── common/        # Constants, colors, keyboard keys, event emitter
│   ├── element/       # All element logic (binding, bounds, collision, shapes, rendering)
│   ├── math/          # Pure 2D geometry (points, curves, polygons, angles)
│   └── utils/         # Export helpers (canvas, SVG, blob, clipboard)
├── excalidraw-app/    # excalidraw.com web app (collaboration, Firebase, PWA)
└── examples/          # NextJS and browser-script integration examples
```

### Package Dependency Order

```
excalidraw-app
    └── @excalidraw/excalidraw
            ├── @excalidraw/element
            │       ├── @excalidraw/math
            │       └── @excalidraw/common
            ├── @excalidraw/common
            └── @excalidraw/utils
```

Packages use TypeScript path aliases so imports resolve directly to source during development — no build step needed between packages.

## Development Workflow

1. **Package Development**: Work in `packages/*` for editor/library features
2. **App Development**: Work in `excalidraw-app/` for app-specific features (collab, persistence)
3. **Testing**: Always run `yarn test:update` before committing
4. **Type Safety**: Use `yarn test:typecheck` to verify TypeScript

## Development Commands

```bash
yarn test:typecheck   # TypeScript type checking
yarn test:update      # Run all tests (with snapshot updates)
yarn fix              # Auto-fix formatting and linting issues
yarn build:packages   # Build all packages with esbuild
yarn build:app        # Build excalidraw-app with Vite
yarn lint:arch        # Terraform import boundaries (dependency-cruiser)
yarn lint:oxlint      # Fast oxlint pass on terraform UI (report-only)
yarn health           # fix + typecheck + eslint + arch + knip + depcheck
```

See [docs/code-quality.md](docs/code-quality.md) for SonarJS, type-checked ESLint scopes, Oxlint rollout, and SonarQube Community Build setup.

### Terraform import and canvas performance

- **Import/layout wall-clock:** [docs/terraform-import-performance-log.md](docs/terraform-import-performance-log.md)
- **Canvas runtime (pan/zoom/hover/expand after import):** [docs/excalidraw-canvas-architecture.md](docs/excalidraw-canvas-architecture.md)
- **Pipeline import toggles (compact/compound/packed/ancillary):** [docs/terraform-pipeline-import-agent-guide.md](docs/terraform-pipeline-import-agent-guide.md)

### Repo RAG (code + docs search)

Local hybrid search over this monorepo (AST chunking, BM25 + vector). Embeddings use shared [`tools/rag-common`](../tools/rag-common) with named profiles (`RAG_EMBED_PROFILE` / `--embed-profile`): OpenAI, Gemini, or local MLX/ST; legacy `RAG_EMBED_BACKEND=auto` still works.

```bash
cd tools/repo-rag && uv sync && cp .env.example .env  # set OPENAI_API_KEY in .env
yarn repo-rag:index
yarn repo-rag:query "terraform pipeline compound layout" --top 8 --json
yarn repo-rag:status
```

See [tools/repo-rag/README.md](tools/repo-rag/README.md). Agent skill: [.agents/skills/repo-rag/SKILL.md](.agents/skills/repo-rag/SKILL.md).

### Graph layout RAG (literature search)

Local vector search over harvested graph-drawing papers (LanceDB). Same embed stack as repo-rag via `tools/rag-common` — pick a profile (`mlx-qwen4b`, `openai-large`, `gemini`, etc.) with `RAG_EMBED_PROFILE` or `--embed-profile`.

```bash
cd tools/graph-layout-rag && uv sync && cp .env.example .env
yarn graph-rag:harvest
yarn graph-rag:ingest -- --force --rebuild   # first build or after embed model change
yarn graph-rag:ingest -- -v                  # resume after interrupt (incremental; no --force)
yarn graph-rag:query "VPSC separation constraints" --tag constraints --json
```

Embeddings: OpenAI (~$5–7 one-time, ~1h full corpus) or local **Qwen3-4B MLX 4-bit** on Apple Silicon (free, ~10–15h; set `RAG_LOCAL_EMBED_QUANT=4bit` in `.env`). Ingest checkpoints per batch in `data/ingest_state.json` + LanceDB — stop/resume without `--force`. Do not query during ingest on 24 GB Mac.

See [tools/graph-layout-rag/README.md](tools/graph-layout-rag/README.md). Agent skill: [.agents/skills/graph-layout-rag/SKILL.md](.agents/skills/graph-layout-rag/SKILL.md).

## Architecture Notes

### Build System

- **Vite** — dev server + `excalidraw-app/` bundling
- **esbuild** — package builds (ESM output in `dist/dev/` and `dist/prod/`)
- **Vitest** — unit tests with jsdom environment
- **TypeScript 5.9** — strict mode throughout; declarations emitted separately via `tsc --emitDeclarationOnly`

### Element System (`packages/element/`)

Everything on the canvas is an `ExcalidrawElement` — a plain immutable-style object:

- Position (`x`, `y`), `width`, `height`, `angle` (rotation)
- Styling: `strokeColor`, `backgroundColor`, `fillStyle`, `strokeWidth`, `opacity`, `roundness`
- `version` (sequential) + `versionNonce` (random) — used for conflict-free sync/reconciliation
- Fractional `index` — for z-ordering in collaboration scenarios
- `groupIds`, `frameId`, `boundElements`, `locked`, `isDeleted`

**Element types**: `rectangle`, `diamond`, `ellipse`, `arrow`, `line`, `freedraw`, `text`, `image`, `frame`, `embeddable`, `iframe`, `magic_frame`, `selection`

**Key modules in `packages/element/`:**

- `binding.ts` — arrow-to-element binding and automatic routing
- `bounds.ts` — bounding box calculations
- `elbowArrow.ts` — elbow/orthogonal arrow routing
- `linearElementEditor.ts` — editing points on arrows/lines
- `newElement.ts` — factory functions for creating elements
- `mutateElement.ts` — mutation helpers (elements are otherwise treated as immutable)
- `renderElement.ts` — per-element rendering instructions consumed by the canvas renderer
- `textElement.ts` — text wrapping, measurement, editing
- `frame.ts` — frame container logic
- `groups.ts` — multi-select grouping

### State Management

- **Jotai** atoms via an isolated scoped store (`packages/excalidraw/editor-jotai.ts`)
- `AppState` (defined in `packages/excalidraw/types.ts`) — all non-element UI state: zoom, scroll, active tool, selection, collaboration flags, etc.
- Element state lives separately as an array of `ExcalidrawElement`
- History (undo/redo) tracked in `packages/excalidraw/history.ts`

### Rendering

- Pure **canvas-based** rendering — shapes are not DOM elements
- **RoughJS** provides the hand-drawn aesthetic
- `packages/excalidraw/renderer/` draws to canvas contexts
- `packages/element/renderElement.ts` provides shape geometry/instructions

### Data & Persistence (`packages/excalidraw/data/`)

- `json.ts` — JSON scene serialization/deserialization
- `blob.ts` — compressed binary format (pako/gzip)
- `restore.ts` — schema migrations across file format versions
- `reconcile.ts` — multi-user conflict resolution using element versions

### Public API

The `Excalidraw` React component (entry: `packages/excalidraw/index.tsx`) accepts:

**Key props:**

- `initialData` — starting scene (elements + appState + files)
- `onChange(elements, appState, files)` — fired on every change
- `excalidrawAPI` — ref callback that receives the imperative API
- `isCollaborating`, `viewModeEnabled`, `zenModeEnabled`, `gridModeEnabled`
- `renderTopLeftUI`, `renderTopRightUI`, `children` — UI extension slots
- `onPaste`, `onLinkOpen`, `onPointerUpdate` — event hooks
- `UIOptions` — hide/show toolbar items and canvas actions

**Imperative API** (via `excalidrawAPI`): `getElements()`, `setElements()`, `getAppState()`, `setAppState()`, `getFiles()`, `addFiles()`, `scrollToContent()`, `refresh()`, `exportToBlob()`, `exportToSvg()`

**Key re-exports from `index.tsx`:** `mutateElement`, `newElementWith`, `bumpVersion`, `restoreElements`, `loadFromBlob`, `serializeAsJSON`, `exportToCanvas`, `exportToBlob`, `exportToSvg`, `FONT_FAMILY`, `THEME`, `MIME_TYPES`

### App Layer (`excalidraw-app/`)

Builds on top of the library and adds:

- Real-time collaboration via **Socket.io** + **Firebase**
- Scene persistence (localStorage + cloud)
- PWA with service worker and caching
- Error tracking (Sentry)
- `collab/` — all collaboration logic
- `data/` — app-specific persistence helpers
- `app-jotai.ts` — app-level atoms separate from library atoms

### Component Hierarchy (`packages/excalidraw/`)

```
Excalidraw (index.tsx, memoized)
  └── EditorJotaiProvider
       └── InitializeApp
            └── App.tsx
                 ├── Actions.tsx (toolbar/menu actions)
                 ├── Canvas layers (static, interactive, UI)
                 ├── Sidebar
                 └── Various overlays (dialogs, context menus, etc.)
```
