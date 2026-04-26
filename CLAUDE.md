# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Structure

Excalidraw is a **monorepo** managed with Yarn workspaces:

- **`packages/excalidraw/`** - Main React component library, published as `@excalidraw/excalidraw`
- **`packages/common/`** - Shared constants, utilities, types (`@excalidraw/common`)
- **`packages/element/`** - Element logic: creation, mutation, bounds, binding, rendering (`@excalidraw/element`)
- **`packages/math/`** - Geometric primitives: points, vectors, curves, angles (`@excalidraw/math`)
- **`packages/utils/`** - Misc utilities (`@excalidraw/utils`)
- **`excalidraw-app/`** - Full web application (excalidraw.com) built on top of the library
- **`examples/`** - Integration examples (NextJS, browser script)

## Development Commands

```bash
yarn start                # Start dev server for excalidraw-app (port 3000)
yarn test                 # Run vitest in watch mode
yarn test:update          # Run all tests with snapshot updates (run before committing)
yarn test:typecheck       # TypeScript type checking (tsc)
yarn test:code            # ESLint (max-warnings=0)
yarn test:other           # Prettier format check
yarn fix                  # Auto-fix formatting and linting issues
yarn build:packages       # Build all packages in dependency order
yarn build:app            # Build the web app
```

Run a single test file:
```bash
yarn test packages/excalidraw/tests/dragCreate.test.tsx
```

Run tests matching a pattern:
```bash
yarn test --reporter=verbose -t "test name pattern"
```

## Architecture

### State Management

The core editor state lives in `packages/excalidraw/App.tsx` (the main class component). State is split:
- **`AppState`** (`types.ts`) — UI, tool, and selection state
- **`SceneElementsMap`** — ordered map of canvas elements (from `@excalidraw/element`)
- **`BinaryFiles`** — images and other binary assets

Jotai atoms (via `editor-jotai.ts`) handle reactive UI state in a scoped store (`EditorJotaiProvider`), isolated from any parent Jotai providers.

### Package Dependency Order

```
@excalidraw/math
    ↓
@excalidraw/common
    ↓
@excalidraw/element   (depends on common + math)
    ↓
@excalidraw/excalidraw (the React component)
    ↓
excalidraw-app
```

`build:packages` must run in this order: `common → math → element → excalidraw`.

### Actions System

User interactions are modeled as **Actions** (`packages/excalidraw/actions/`). Each action returns `ActionResult` containing optional updated `elements`, `appState`, and `files`, plus a `captureUpdate` flag for history. Actions can be triggered from `"ui"`, `"keyboard"`, `"contextMenu"`, `"api"`, or `"commandPalette"`.

### Element System

All canvas elements are defined in `packages/element/src/types.ts`. Key concepts:
- Elements are **immutable** — use `mutateElement()` from `@excalidraw/element` for changes
- Elements have a `version` and `versionNonce` for conflict detection in collaboration
- `OrderedExcalidrawElement` adds fractional-index ordering for z-order
- Deleted elements are kept in the map (`isDeleted: true`) for collaboration sync

### History / Store

`packages/excalidraw/history.ts` implements undo/redo via `HistoryDelta` (extends `StoreDelta` from `@excalidraw/element`). Deltas capture incremental changes to both elements and appState.

### Path Aliases (vitest + vite)

Both `vitest.config.mts` (root) and `excalidraw-app/vite.config.mts` define identical aliases that map `@excalidraw/*` package names to their `src/` directories, so no build step is required during development.

### Testing

Tests use Vitest + jsdom + `@testing-library/react`. Test helpers live in `packages/excalidraw/tests/helpers/` and `packages/excalidraw/tests/test-utils.tsx`. Snapshot files are in `__snapshots__/` directories — update them with `yarn test:update`.
