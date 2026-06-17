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

### Local-first RAG (all three corpora)

All three tools share [`tools/rag-common`](../tools/rag-common) embed profiles and GPU scripts (`tools/rag-common/scripts/gpu_*.sh`). **Query default:** `cuda-qwen0.6b-1024` (Qwen3-0.6B @ 1024, GPU reembed, $0 API). **Secondary cloud build** (once on Mac/Vertex, then `ingest reembed` on RTX 3060 Ti): `gemini-2-structure-v1` for PDF corpora (graph-layout-rag, rag-literature-rag) or `gemini-2` for repo-rag code AST chunks.

```bash
# Example: rag-literature-rag
RAG_EMBED_PROFILE=gemini-2-structure-v1 uv run rag-literature-rag ingest --force --rebuild
RAG_GPU_TOOL=tools/rag-literature-rag tools/rag-literature-rag/scripts/gpu_dense_reembed.sh
yarn rag-lit:query "Self-RAG" --top 8 --json   # uses cuda-qwen0.6b-1024 from .env
```

### Repo RAG (code + docs search)

Local hybrid search over this monorepo (AST chunking, BM25 + vector). Per-profile indexes under `data/indexes/{profile}/`.

```bash
cd tools/repo-rag && uv sync && cp .env.example .env
yarn repo-rag:index --embed-profile gemini-2   # secondary build (once)
# GPU reembed → cuda-qwen0.6b-1024, then query with default profile
yarn repo-rag:query "terraform pipeline compound layout" --top 8 --json
yarn repo-rag:status
```

See [tools/repo-rag/README.md](tools/repo-rag/README.md). Agent skill: [.agents/skills/repo-rag/SKILL.md](.agents/skills/repo-rag/SKILL.md).

### Graph layout RAG (literature search)

Local vector search over harvested graph-drawing papers (LanceDB). Production query: `cuda-qwen0.6b-1024`; secondary: `gemini-2-structure-v1`.

```bash
cd tools/graph-layout-rag && uv sync && cp .env.example .env
yarn graph-rag:harvest
yarn graph-rag:ingest -- --force --rebuild --embed-profile gemini-2-structure-v1  # secondary (once)
# RAG_GPU_TOOL=tools/graph-layout-rag tools/graph-layout-rag/scripts/gpu_dense_reembed.sh
yarn graph-rag:ingest -- -v                  # resume after interrupt (incremental; no --force)
yarn graph-rag:query "VPSC separation constraints" --tag constraints --json
```

See [tools/graph-layout-rag/README.md](tools/graph-layout-rag/README.md). Agent skill: [.agents/skills/graph-layout-rag/SKILL.md](.agents/skills/graph-layout-rag/SKILL.md). **Local LLM (HyDE):** Ollama on RTX 3060 Ti (`desktop` SSH); measured 2026-06-17 — **cuda hybrid still wins** (0.715/0.684 nDCG@10); use `gemma4:e4b` only if enabling `--expand auto`. `./scripts/gpu_execute_local_llm_benchmark.sh` — [docs/graph-layout-rag-local-llm-benchmark-2026.md](docs/graph-layout-rag-local-llm-benchmark-2026.md).

### RAG literature RAG (RAG research papers)

Local hybrid search over core retrieval-augmented generation research. Same local-first stack as graph-layout-rag.

```bash
cd tools/rag-literature-rag && uv sync && cp .env.example .env
yarn rag-lit:harvest -- --deep-harvest --target-pdfs 1000 --resume -v
yarn rag-lit:ingest -- --force --rebuild --embed-profile gemini-2-structure-v1
yarn rag-lit:query "Self-RAG reflection tokens" --tag self-correcting --json
```

See [tools/rag-literature-rag/README.md](tools/rag-literature-rag/README.md). Agent skill: [.agents/skills/rag-literature-rag/SKILL.md](.agents/skills/rag-literature-rag/SKILL.md).

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
